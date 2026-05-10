import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isAdminEmail } from '@/lib/isAdmin'
import { topMatches, MatchProfile } from '@/lib/matching'

export const runtime = 'nodejs'

/**
 * GET /api/admin/candidates?userId=<uuid>
 * Returns the top 3 compatible candidates for the given user, computed against
 * the live pool of completed matchmaker_profiles. Admin-only.
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
  const userId = url.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { data: rows } = await supa
    .from('matchmaker_profiles')
    .select('*')
    .limit(500)

  if (!rows || rows.length === 0) {
    return NextResponse.json({ candidates: [], pool: 0 })
  }

  // Map matchmaker_profiles row to MatchProfile shape used by the matching engine.
  const toMatchProfile = (r: any): MatchProfile => ({
    userId: r.user_id,
    name: r.name || '(unnamed)',
    age: typeof r.age === 'number' ? r.age : 30,
    gender: r.gender || 'unspecified',
    interestedIn: r.interested_in || 'anyone',
    location: r.location || '',
    ownWantChildren: (r.own_want_children || r.want_children || 'maybe') as any,
    preferredAgeMin: typeof r.age_min === 'number' ? r.age_min : 25,
    preferredAgeMax: typeof r.age_max === 'number' ? r.age_max : 50,
    ageFlexible: !!r.age_flexible,
    valueRatings: r.value_ratings || {},
    attachmentStyle: (r.attachment_self || 'secure') as any,
    communicationStyle: (r.communication_style || 'direct-when-upset') as any,
    lifeGoals: r.life_goals || (r.top_life_goal ? [r.top_life_goal] : []),
    relationshipPriority: (r.priority_choice || r.relationship_priority || 'open-and-serious') as any,
    dealbreakers: r.dealbreakers || [],
  })

  const meRow = rows.find((r: any) => r.user_id === userId)
  if (!meRow) return NextResponse.json({ error: 'user not found' }, { status: 404 })
  const me = toMatchProfile(meRow)
  const pool = rows.filter((r: any) => r.user_id !== userId).map(toMatchProfile)

  const matches = topMatches(me, pool, 3)
  return NextResponse.json({ candidates: matches, pool: pool.length, user: me })
}
