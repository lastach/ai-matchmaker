import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isAdminEmail } from '@/lib/isAdmin'

export const runtime = 'nodejs'

/**
 * Admin: list candidate members for review.
 *
 * Reads matchmaker_profiles first (the production source of truth populated
 * once the per-area cohort threshold is met). If that is empty - which is
 * common during early playtesting since intake answers persist to
 * user_profiles before the cron promotes them - we fall back to user_profiles
 * so the admin can see who has completed intake and inspect their answers.
 */
export async function GET(req: Request) {
  const cookieStore = await cookies()
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10))

  // After the email check passes, use the service-role client to bypass RLS so the admin
  // sees ALL members, not just their own row. The cookie-scoped supa client above is
  // RLS-restricted to the caller's user_id, which is why /admin was showing Members (0)
  // even after multiple test plays (other test users' rows were invisible).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ users: [], table: 'misconfigured', note: 'SUPABASE_SERVICE_ROLE_KEY is not set on this deployment. The admin route needs it to bypass RLS and see all members.' })
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Primary source: matchmaker_profiles (post-threshold)
  const primary = await admin
    .from('matchmaker_profiles')
    .select('user_id, name, location, intake_completed_at, top_value, top_life_goal, attachment_self, priority_choice, profile_strength, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (primary.data && primary.data.length > 0) {
    return NextResponse.json({ users: primary.data, table: 'matchmaker_profiles', error: (primary as any).error?.message || null })
  }

  // Fallback: user_profiles (pre-threshold or playtest data).
  // Map to the same shape the admin UI expects so it just renders.
  const fallback = await admin
    .from('user_profiles')
    .select('id, profile_data, core_intake_data, location, intake_completed_at, updated_at')
    .not('intake_completed_at', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  const users = (fallback.data || []).map((row: any) => {
    const pd = row.profile_data || {}
    const cd = row.core_intake_data || {}
    return {
      user_id: row.id,
      name: pd.firstName || pd.name || pd.displayName || null,
      location: row.location || pd.location || null,
      intake_completed_at: row.intake_completed_at,
      top_value: cd.topValue || cd.q1 || null,
      top_life_goal: cd.topLifeGoal || cd.q3 || null,
      attachment_self: cd.attachmentSelf || cd.q4 || null,
      priority_choice: cd.priorityChoice || cd.q5 || null,
      profile_strength: pd.profileStrength || null,
      updated_at: row.updated_at,
    }
  })

  return NextResponse.json({
    users,
    table: 'user_profiles (fallback)',
    note: users.length > 0 ? 'matchmaker_profiles is empty in this environment - showing pre-cohort intake data from user_profiles' : 'no completed intakes found in either table',
    error: (fallback as any).error?.message || null,
  })
}
