import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { APP_VERSION } from '../constants/appVersion';

const QUEUE_KEY   = 'siftly_analytics_queue_v1';
const BACKEND_URL = 'https://fba-backend-production-6c44.up.railway.app/api/analytics/events';
const MAX_BATCH   = 50;

interface QueuedEvent {
  event:       string;
  userId?:     string;
  appVersion:  string;
  screen?:     string;
  properties?: Record<string, unknown>;
  ts:          string;
}

async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? undefined;
  } catch {
    return undefined;
  }
}

export async function enqueueEvent(
  event: string,
  properties?: Record<string, unknown>,
  screen?: string,
): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const raw    = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];
    queue.push({
      event,
      userId,
      appVersion: APP_VERSION,
      screen,
      properties,
      ts: new Date().toISOString(),
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-500)));
  } catch {}
}

async function writeToSupabase(events: QueuedEvent[]): Promise<void> {
  const rows = events.map(e => ({
    event:       e.event,
    user_id:     e.userId ?? null,
    app_version: e.appVersion,
    screen:      e.screen ?? null,
    properties:  e.properties ?? {},
    ts:          e.ts,
  }));
  const { error } = await supabase.from('analytics_events').insert(rows);
  // Throw so the queue is NOT cleared when Supabase rejects (e.g. RLS violation).
  if (error) throw new Error(error.message);
}

async function sendToRailway(batch: QueuedEvent[]): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(BACKEND_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ events: batch }),
      signal:  controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function flushAnalyticsQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    let queue: QueuedEvent[] = JSON.parse(raw);
    if (queue.length === 0) return;

    // Back-fill user_id for events that were queued before sign-in.
    const currentUserId = await getCurrentUserId();
    if (currentUserId) {
      queue = queue.map(e => e.userId ? e : { ...e, userId: currentUserId });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }

    const batch = queue.slice(0, MAX_BATCH);

    // Dual-write: Supabase (persistent storage) + Railway (log streaming).
    // Supabase write is the source of truth; Railway is best-effort.
    const [railwayOk, supabaseOk] = await Promise.allSettled([
      sendToRailway(batch),
      writeToSupabase(batch),
    ]);

    // Clear the batch if either target accepted it.
    const sent =
      (railwayOk.status === 'fulfilled' && railwayOk.value) ||
      supabaseOk.status === 'fulfilled';
    if (sent) {
      const remaining = queue.slice(MAX_BATCH);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch {
    // Leave in queue, retry on next app start
  }
}
