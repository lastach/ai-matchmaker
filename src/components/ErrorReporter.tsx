'use client'

import { useEffect } from 'react'

/**
 * Mount once near root layout. Forwards unhandled errors and promise
 * rejections to /api/errors. Best-effort: never throws, never blocks UI.
 */
export default function ErrorReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    let lastSent = 0
    function send(payload: any) {
      const now = Date.now()
      if (now - lastSent < 1500) return // throttle bursts
      lastSent = now
      try {
        fetch('/api/errors', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            ...payload,
            url: window.location.href,
            route: window.location.pathname,
          }),
        }).catch(() => {})
      } catch {}
    }
    function onError(e: ErrorEvent) {
      send({ message: e.message || 'unknown error', stack: e.error?.stack || null, level: 'error' })
    }
    function onRejection(e: PromiseRejectionEvent) {
      const reason = e.reason
      const message = (reason && (reason.message || String(reason))) || 'unhandled promise rejection'
      const stack = reason && reason.stack || null
      send({ message: String(message).slice(0, 500), stack, level: 'error' })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
