import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate-limit helper for LLM-calling routes.
 *
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars are set,
 * uses Upstash's sliding-window limiter. If missing, no-ops (returns
 * { success: true }) so the app still works in dev without the env vars.
 *
 * Usage in a route:
 *   const { success, retryAfter } = await checkRateLimit(`route:${user.id}`)
 *   if (!success) return new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(retryAfter) }})
 */
let limiter: Ratelimit | null | undefined = undefined

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    limiter = null
    return null
  }
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 req / minute / key by default
    analytics: false,
    prefix: 'rl',
  })
  return limiter
}

export async function checkRateLimit(key: string): Promise<{ success: boolean; remaining?: number; retryAfter?: number }> {
  const l = getLimiter()
  if (!l) return { success: true }
  try {
    const r = await l.limit(key)
    return {
      success: r.success,
      remaining: r.remaining,
      retryAfter: r.success ? 0 : Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)),
    }
  } catch {
    // If Redis is unreachable, fail-open rather than 500
    return { success: true }
  }
}
