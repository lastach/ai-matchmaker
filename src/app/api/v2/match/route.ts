import { NextResponse } from 'next/server'
import { ageFrom, errorResponse, firstPhotoUrl, requireService, requireUser } from '@/lib/v2/server'

export const runtime = 'nodejs'

/**
 * GET: the member's current date (no messaging; the service sets the date).
 * POST { matchId, attending: 'yes' | 'no' }: confirm, or say you can't make it so the matchmaker reschedules.
 */
export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const uid = auth.user.id
    const { data } = await svc
      .from('amorlay_matches')
      .select('*')
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .in('status', ['scheduled', 'confirmed', 'needs_reschedule', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
    const m = data?.[0]
    if (!m) return NextResponse.json({ match: null })
    const iAmA = m.user_a === uid
    const partnerId = iAmA ? m.user_b : m.user_a
    const { data: partner } = await svc.from('amorlay_profiles').select('basics').eq('user_id', partnerId).maybeSingle()
    const { data: coach } = await svc.from('amorlay_coach').select('user_id, outcome, share_contact').eq('match_id', m.id)
    const mine = coach?.find((c) => c.user_id === uid)
    const theirs = coach?.find((c) => c.user_id === partnerId)
    const mutual = !!mine?.outcome?.secondDate && !!theirs?.outcome?.secondDate
    const debriefOpen = m.status === 'completed' || (!!m.date_at && new Date(m.date_at).getTime() < Date.now())
    return NextResponse.json({
      match: {
        id: m.id,
        status: m.status,
        dateAt: m.date_at,
        venueName: m.venue_name,
        venueAddress: m.venue_address,
        dateIdea: m.date_idea,
        myAttending: iAmA ? m.a_attending : m.b_attending,
        partnerConfirmed: (iAmA ? m.b_attending : m.a_attending) === 'yes',
        partner: {
          firstName: partner?.basics?.firstName || 'your match',
          age: ageFrom(partner?.basics?.birthDate),
          photoUrl: await firstPhotoUrl(svc, partnerId),
        },
        debriefOpen,
        debriefDone: !!mine?.outcome,
        mutualSecondDate: mutual,
        partnerContact: mutual ? theirs?.share_contact || null : null,
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const { matchId, attending } = await req.json().catch(() => ({} as any))
    if (!matchId || (attending !== 'yes' && attending !== 'no')) return NextResponse.json({ error: 'bad request' }, { status: 400 })
    const { data: m } = await svc.from('amorlay_matches').select('*').eq('id', matchId).maybeSingle()
    if (!m || (m.user_a !== auth.user.id && m.user_b !== auth.user.id)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const iAmA = m.user_a === auth.user.id
    const patch: any = { updated_at: new Date().toISOString(), [iAmA ? 'a_attending' : 'b_attending']: attending }
    const other = iAmA ? m.b_attending : m.a_attending
    if (attending === 'no') patch.status = 'needs_reschedule'
    else if (other === 'yes') patch.status = 'confirmed'
    const { error } = await svc.from('amorlay_matches').update(patch).eq('id', matchId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, status: patch.status || m.status })
  } catch (e) {
    return errorResponse(e)
  }
}
