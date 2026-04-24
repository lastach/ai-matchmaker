/**
 * Per-user-scoped localStorage wrapper.
 * Every key is namespaced with the authenticated user's ID so that
 * switching accounts on the same browser never leaks data. Signing
 * out calls clearForUser() which purges all keys for that user.
 */

const PREFIX = 'ls:'; // Laurie Stach Holdings

function keyFor(userId: string, key: string): string {
  return `${PREFIX}${userId}:${key}`;
}

export function getItem<T>(userId: string, key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(keyFor(userId, key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(userId: string, key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyFor(userId, key), JSON.stringify(value));
  } catch {
    // Quota exceeded or private mode — silently drop; UI state still holds.
  }
}

export function removeItem(userId: string, key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(userId, key));
  } catch {}
}

/** Purge every key belonging to the given user. Call on sign-out. */
export function clearForUser(userId: string): void {
  if (typeof window === 'undefined') return;
  const prefix = `${PREFIX}${userId}:`;
  const toDelete: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(prefix)) toDelete.push(k);
  }
  for (const k of toDelete) window.localStorage.removeItem(k);
}
