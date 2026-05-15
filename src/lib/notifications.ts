import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Lazy-import expo-notifications so the native module is only resolved when
// notifications are actually used, not at bundle evaluation time.
// This prevents the 'ExpoPushTokenManager' crash when the native module isn't
// available in an older dev client build.
async function getNotifications() {
  try {
    return (await import('expo-notifications')).default ?? (await import('expo-notifications'));
  } catch {
    return null;
  }
}

// Configure the notification handler once, lazily, on first use.
let handlerConfigured = false;
async function ensureHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge:  false,
        shouldShowBanner: true,
        shouldShowList:   true,
      }),
    });
  } catch { /* native module not present in this build — notifications disabled */ }
}

const NOTIF_SCHEDULED_KEY = '@siftly_notif_scheduled_date';

async function requestPermission(N: any): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await N.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await N.requestPermissionsAsync();
  return status === 'granted';
}

// Schedule a "streak at risk" notification for tomorrow at 9 AM.
// Only schedules once per calendar day — safe to call on every app open.
export async function scheduleStreakReminder(streakCount: number): Promise<void> {
  try {
    await ensureHandler();
    const N = await getNotifications();
    if (!N) return; // native module not available in this build

    const today = new Date().toISOString().split('T')[0];
    const lastScheduled = await AsyncStorage.getItem(NOTIF_SCHEDULED_KEY);
    if (lastScheduled === today) return;

    const granted = await requestPermission(N);
    if (!granted) return;

    // Cancel only our streak notifications (identified by data.type)
    const scheduled = await N.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n: any) => n.content.data?.type === 'streak_reminder')
        .map((n: any) => N.cancelScheduledNotificationAsync(n.identifier)),
    );

    const trigger = new Date();
    trigger.setDate(trigger.getDate() + 1);
    trigger.setHours(9, 0, 0, 0);

    await N.scheduleNotificationAsync({
      content: {
        title: 'Keep your streak going 🔥',
        body:  streakCount > 1
          ? `You're on a ${streakCount}-day streak — don't let it slip today.`
          : 'Open Siftly to start building your product research habit.',
        data:  { type: 'streak_reminder' },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: trigger },
    });

    await AsyncStorage.setItem(NOTIF_SCHEDULED_KEY, today);
  } catch {
    // Notifications are best-effort — never crash the app over them.
  }
}
