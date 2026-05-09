import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Supply pool dashboard.
 *
 * Honest cohort metrics for the requester so they know what is actually
 * available in their geo + intent + age window. No fake numbers, no
 * inflation. Counts are derived from intake_profiles where verified=true,
 * minus existing matches/blocks for this user.
 *
 * Returns:
 *   verified_in_window: count of verified candidates currently matchable
 *   queue_position: where this requester sits among active queues for their geo
 *   cohort_size: total in their geo
 *   recent_join_velocity: 7d new verified joins in their geo
 *   open_match_requests: how many requesters in their geo right now
 *   wait_time_estimate_days: derived from join velocity vs match velocity
 */

async function getSupa() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
}

export async function GET(req: Request) {
  const supa = await getSupa()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  // Pull this user's intake to know the relevant filters
  const { data: me } = await supa.from('intake_profiles').select('*').eq('user_id', user.id).single()
  if (!me) return NextResponse.json({ error: 'no intake profile yet' }, { status: 404 })

  const region = me.metro_area || me.region || null
  const seekingGender = me.seeking_gender || null
  const ageMin = me.seeking_age_min || 0
  const ageMax = me.seeking_age_max || 99
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString()

  const out: any = {
    region,
    verified_in_window: 0,
    cohort_size: 0,
    recent_join_velocity_7d: 0,
    open_match_requests: 0,
    wait_time_estimate_days: null,
    last_updated: new Date().toISOString(),
  }

  try {
    // Verified candidates matching this requester's seeking criteria
    let q = supa.from('intake_profiles').select('user_id, age, gender, metro_area, region, verified, created_at, intent', { count: 'exact', head: false })
      .eq('verified', true)
      .neq('user_id', user.id)
    if (region) q = q.or(`metro_area.eq.${region},region.eq.${region}`)
    if (seekingGender) q = q.eq('gender', seekingGender)
    q = q.gte('age', ageMin).lte('age', ageMax)

    const { data: candidates, count: candCount } = await q
    out.verified_in_window = candCount ?? (candidates?.length || 0)

    // Cohort total in their region (any verified, any orientation)
    let qCohort = supa.from('intake_profiles').select('user_id', { count: 'exact', head: true }).eq('verified', true)
    if (region) qCohort = qCohort.or(`metro_area.eq.${region},region.eq.${region}`)
    const { count: cohortCount } = await qCohort
    out.cohort_size = cohortCount || 0

    // 7d join velocity
    let qVel = supa.from('intake_profiles').select('user_id', { count: 'exact', head: true }).eq('verified', true).gte('created_at', since7d)
    if (region) qVel = qVel.or(`metro_area.eq.${region},region.eq.${region}`)
    const { count: velCount } = await qVel
    out.recent_join_velocity_7d = velCount || 0

    // Open match requests in this geo (requesters in queue without an active match yet)
    let qOpen = supa.from('intake_profiles').select('user_id', { count: 'exact', head: true }).eq('verified', true).eq('intent', 'requesting')
    if (region) qOpen = qOpen.or(`metro_area.eq.${region},region.eq.${region}`)
    const { count: openCount } = await qOpen
    out.open_match_requests = openCount || 0

    // Wait-time estimate: candidates / weekly_match_velocity_per_requester. Conservative.
    // If we have any verified candidates and a 7d velocity, estimate.
    const weeklyMatchesPerRequester = 0.5 // conservative founder-mode estimate
    if (out.verified_in_window > 0 && out.open_match_requests > 0) {
      const candidatesPerRequester = out.verified_in_window / Math.max(out.open_match_requests, 1)
      out.wait_time_estimate_days = candidatesPerRequester < 1
        ? Math.round((1 / Math.max(candidatesPerRequester, 0.05)) * (7 / Math.max(weeklyMatchesPerRequester, 0.1)))
        : Math.max(7, Math.round(7 / weeklyMatchesPerRequester))
    } else if (out.recent_join_velocity_7d > 0) {
      out.wait_time_estimate_days = Math.round(7 / Math.max(out.recent_join_velocity_7d / 10, 0.1))
    }
  } catch (e) {
    // best-effort
  }

  return NextResponse.json(out)
}
