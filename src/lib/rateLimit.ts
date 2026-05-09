import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate-limit helper for LLM-calling routes.
 *
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars are set,
 * uses Upstash's sliding-window limiter. If missing, no-ops (returns
 * { success: true }) so the app still works in dev without the env vars.
 */
let limiter: Ratelimit | null | undefined = undefined
let weeklyInsightsLimiter: Ratelimit | null | undefined = undefined
let redisClient: Redis | null | undefined = undefined

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    redisClient = null
    return null
  }
  redisClient = new Redis({ url, token })
  return redisClient
}

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter
  const r = getRedis()
  if (!r) {
    limiter = null
    return null
  }
  limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: false,
    prefix: 'rl',
  })
  return limiter
}

/**
 * Weekly insights limiter - caps users at 5 regenerations per 7-day rolling window.
 * Used for AI insights endpoints where we don't want users spamming refresh
 * to see "new" insights every few seconds.
 */
function getWeeklyInsightsLimiter(): Ratelimit | null {
  if (weeklyInsightsLimiter !== undefined) return weeklyInsightsLimiter
  const r = getRedis()
  if (!r) {
    weeklyInsightsLimiter = null
    return null
  }
  weeklyInsightsLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(5, '7 d'),
    analytics: false,
    prefix: 'rl-weekly',
  })
  return weeklyInsightsLimiter
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
    return { success: true }
  }
}

/**
 * Check the weekly insights cap for a user. Returns success + remaining count.
 * Fail-open if Redis is unreachable.
 */
export async function checkWeeklyInsightsLimit(userKey: string): Promise<{ success: boolean; remaining: number; retryAfter: number }> {
  const l = getWeeklyInsightsLimiter()
  if (!l) return { success: true, remaining: 5, retryAfter: 0 }
  try {
    const r = await l.limit(userKey)
    return {
      success: r.success,
      remaining: r.remaining,
      retryAfter: r.success ? 0 : Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)),
    }
  } catch {
    return { success: true, remaining: 5, retryAfter: 0 }
  }
}

/**
 * Persist an insights response so we can return it to a user who has hit the
 * weekly cap. 7-day TTL matches the rate-limit window.
 */
export async function cacheInsights(key: string, data: unknown): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.set(key, JSON.stringify(data), { ex: 60 * 60 * 24 * 7 })
  } catch {
    /* fail open */
  }
}

export async function getCachedInsights<T = unknown>(key: string): Promise<T | null> {
  const r = getRedis()
  if (!r) return null
  try {
    const raw = await r.get<string>(key)
    if (!raw) return null
    if (typeof raw === 'string') return JSON.parse(raw) as T
    return raw as T
  } catch {
    return null
  }
}
