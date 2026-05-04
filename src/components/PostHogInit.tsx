'use client'
import { useEffect } from 'react'
import posthog from 'posthog-js'

// PostHog client initializer. Mount once at the app root.
// Reads NEXT_PUBLIC_POSTHOG_KEY (project API key) and optional NEXT_PUBLIC_POSTHOG_HOST.
// Gracefully no-ops if no key — so unset env on Vercel just disables tracking, no crash.
export default function PostHogInit() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return
    if (typeof window === 'undefined') return
    const ph = posthog as unknown as { __loaded?: boolean }
    if (ph.__loaded) return
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: 'history_change',
      autocapture: true,
      person_profiles: 'identified_only',
    })
  }, [])
  return null
}
