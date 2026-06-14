import { useState, useEffect } from 'react';

const HEALTH_URL = 'https://fba-backend-production-6c44.up.railway.app/api/health';

let _online   = true;
let _started  = false;
const _listeners = new Set<(online: boolean) => void>();

async function _check() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    await fetch(HEALTH_URL, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (!_online) {
      _online = true;
      _listeners.forEach(fn => fn(true));
    }
  } catch {
    if (_online) {
      _online = false;
      _listeners.forEach(fn => fn(false));
    }
  }
}

function _startPolling() {
  if (_started) return;
  _started = true;
  _check();
  setInterval(_check, 30_000);
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(_online);

  useEffect(() => {
    _startPolling();
    _listeners.add(setIsOnline);
    return () => { _listeners.delete(setIsOnline); };
  }, []);

  return { isOnline, recheckNow: _check };
}
