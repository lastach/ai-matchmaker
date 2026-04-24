import { NextRequest, NextResponse } from 'next/server'
import { topMatches, MatchProfile } from '@/lib/matching'
import { SEED_POOL } from '@/lib/seed-pool'

/**
 * POST body: the user's MatchProfile (client-side state, per localStorage).
 * Returns the top N matches from the current candidate pool.
 *
 * Until a real multi-user database is wired, the pool is a curated 40-profile
 * seed so the consumer can see the scoring engine produce real results.
 * When persistence lands, this route will read other users from Supabase
 * and respect opted-in privacy filters.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user: MatchProfile | null = body?.profile
    if (!user || !user.userId) {
      return NextResponse.json({ error: 'Missing user profile' }, { status: 400 })
    }
    const n = Math.max(1, Math.min(5, Number(body?.n) || 1))
    const results = topMatches(user, SEED_POOL, n)
    return NextResponse.json({ matches: results, pool_size: SEED_POOL.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}
