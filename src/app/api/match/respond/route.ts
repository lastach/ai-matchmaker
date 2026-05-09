import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Both parties must accept before contact details are exchanged.
 * Body: { matchId, response: 'accept' | 'decline' }
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

  const { matchId, response } = await req.json().catch(() => ({}))
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })
  if (response !== 'accept' && response !== 'decline') return NextResponse.json({ error: 'response must be accept or decline' }, { status: 400 })

  try {
    // Update only the row owned by this user
    await supabase.from('matches').update({
      status: response === 'accept' ? 'accepted' : 'declined',
      responded_at: new Date().toISOString(),
    }).eq('match_pair_id', matchId).eq('user_id', user.id)

    if (response === 'decline') {
      // Refund credit, mark the partner's row as 'partner_declined' so they don't see contact info
      await supabase.from('matches').update({ status: 'partner_declined' }).eq('match_pair_id', matchId).neq('user_id', user.id)
      return NextResponse.json({ ok: true, refunded: true })
    }

    // Check if partner has also accepted  -  if so, exchange first names + open chat
    const { data: rows } = await supabase.from('matches').select('user_id, status').eq('match_pair_id', matchId)
    const allAccepted = rows && rows.length === 2 && rows.every(r => r.status === 'accepted')
    if (allAccepted) {
      await supabase.from('matches').update({ status: 'connected' }).eq('match_pair_id', matchId)
      return NextResponse.json({ ok: true, connected: true, note: 'Both parties accepted - first-name exchange unlocked.' })
    }
    return NextResponse.json({ ok: true, waiting_on_partner: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'matches table may need migration' }, { status: 500 })
  }
}
