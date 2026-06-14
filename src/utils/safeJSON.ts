/**
 * Wraps JSON.parse in a try/catch and returns null on failure.
 * Use this for every AsyncStorage read — stored data can be corrupted
 * or have a stale shape after an app update, which would otherwise
 * throw an unhandled exception and crash the screen on mount.
 */
export function safeParseJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
