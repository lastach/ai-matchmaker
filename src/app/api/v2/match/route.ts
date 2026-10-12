import { NextResponse } from 'next/server'
import { errorResponse, firstPhotoUrl, matchPartner, myMatches, requireUser } from '@/lib/v2/server'

export const runtime = 'nodejs'

/**
 * GET: the member's current date (no messaging; the service sets the date).
 * POST { matchId, attending: 'yes' | 'no' }: confirm, or say you can't make it so the matchmaker reschedules.
 */
export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = auth.session
  try {
    const uid = auth.user.id
    const m = (await myMatches(svc))[0]
    if (!m) return NextResponse.json({ match: null })
    const partner = await matchPartner(svc, m.id)
    const { data: mine } = await svc.from('amorlay_coach').select('outcome').eq('match_id', m.id).eq('user_id', uid).maybeSingle()
    const mutual = !!partner?.mutual_second_date
    const debriefOpen = m.status === 'completed' || (!!m.date_at && new Date(m.date_at).getTime() < Date.now())
    return NextResponse.json({
      match: {
        id: m.id,
        status: m.status,
        dateAt: m.date_at,
        venueName: m.venue_name,
        venueAddress: m.venue_address,
        dateIdea: m.date_idea,
        myAttending: m.my_attending,
        partnerConfirmed: m.partner_attending === 'yes',
        partner: {
          firstName: partner?.first_name || 'your match',
          age: partner?.age ?? null,
          photoUrl: partner ? await firstPhotoUrl(svc, partner.partner_id) : null,
        },
        debriefOpen,
        debriefDone: !!mine?.outcome,
        mutualSecondDate: mutual,
        partnerContact: mutual ? partner?.partner_contact || null : null,
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = auth.session
  try {
    const { matchId, attending } = await req.json().catch(() => ({} as any))
    if (!matchId || (attending !== 'yes' && attending !== 'no')) return NextResponse.json({ error: 'bad request' }, { status: 400 })
    const { data: status, error } = await svc.rpc('amorlay_set_attending', { match: matchId, attending })
    if (error) return NextResponse.json({ error: /not found/i.test(error.message) ? 'not found' : error.message }, { status: /not found/i.test(error.message) ? 404 : 500 })
    return NextResponse.json({ ok: true, status })
  } catch (e) {
    return errorResponse(e)
  }
}
