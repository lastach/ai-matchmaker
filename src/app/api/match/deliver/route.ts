import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Deliver a reviewed match. The HUMAN matchmaker calls this after reviewing the
 * scored candidates from /api/match/score. Both parties get the brief and the
 * accept/decline prompt.
 *
 * Body: { user_a_id, user_b_id, brief, where_to_be_careful }
 */
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  // Only matchmakers (admin role) can deliver matches
  const { data: me } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'matchmaker' && me?.role !== 'admin') {
    return NextResponse.json({ error: 'matchmaker role required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { user_a_id, user_b_id, brief, where_to_be_careful } = body
  if (!user_a_id || !user_b_id || !brief) return NextResponse.json({ error: 'user_a_id, user_b_id, brief required' }, { status: 400 })

  const matchId = crypto.randomUUID()
  try {
    // Two rows so each user has their own copy of the match - you only see your own row.
    await supabase.from('matches').insert([
      { id: matchId + ':a', match_pair_id: matchId, user_id: user_a_id, partner_id: user_b_id, brief, where_to_be_careful, status: 'pending_acceptance', created_at: new Date().toISOString() },
      { id: matchId + ':b', match_pair_id: matchId, user_id: user_b_id, partner_id: user_a_id, brief, where_to_be_careful, status: 'pending_acceptance', created_at: new Date().toISOString() },
    ])
    // TODO: trigger email notification to both users
    return NextResponse.json({ ok: true, matchId, delivered_to: [user_a_id, user_b_id] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'matches table may need migration' }, { status: 500 })
  }
}
