'use client'

/**
 * Per-user-scoped localStorage helpers.
 *
 * Every key gets namespaced with the current user id so that switching
 * accounts on a shared device does not leak data between users.
 *
 * Usage:
 *   const v = readUserScoped(userId, 'onboarding_step', '1')
 *   writeUserScoped(userId, 'onboarding_step', '2')
 *   useUserScopedState(userId, 'draft', '') // React hook with auto-persist
 *
 * If userId is null/undefined the helpers read/write a 'guest' bucket so
 * pre-auth flows still work, but they also clear that bucket on first
 * authenticated write.
 */

import { useEffect, useState } from 'react'

function key(userId: string | null | undefined, k: string) {
  return `u_${userId || 'guest'}__${k}`
}

export function readUserScoped(userId: string | null | undefined, k: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(key(userId, k))
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

export function writeUserScoped(userId: string | null | undefined, k: string, value: string) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key(userId, k), value) } catch {}
}

export function clearUserScoped(userId: string | null | undefined, k: string) {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(key(userId, k)) } catch {}
}

export function useUserScopedState<T extends string>(userId: string | null | undefined, k: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const stored = window.localStorage.getItem(key(userId, k))
      return (stored ?? initial) as T
    } catch { return initial }
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(key(userId, k), val) } catch {}
  }, [userId, k, val])
  return [val, setVal]
}

/**
 * One-time migrator: lift any unscoped value into the per-user namespace.
 * Call once after sign-in for keys you used to read at the global scope.
 */
export function migrateUnscopedToUser(userId: string, keys: string[]) {
  if (typeof window === 'undefined' || !userId) return
  for (const k of keys) {
    try {
      const old = window.localStorage.getItem(k)
      if (old == null) continue
      const scoped = key(userId, k)
      if (window.localStorage.getItem(scoped) == null) {
        window.localStorage.setItem(scoped, old)
      }
    } catch {}
  }
}
