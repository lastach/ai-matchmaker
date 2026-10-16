import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/isAdmin'
import { eligibility } from '@/lib/v2/engine'
import { toMemberWithType } from '@/lib/v2/pool'
import { ageFrom, errorResponse, firstPhotoUrl, requireUser } from '@/lib/v2/server'
import type { ProfileRow } from '@/lib/v2/types'

export const runtime = 'nodejs'
export const maxDuration = 30

async function gate() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  if (!(await isAdmin(auth.user.email, auth.session))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const svc = auth.session
  return { auth, svc }
}

/** GET: cities with member counts, plus proposed and upcoming dates for review. */
export async function GET() {
  const g = await gate()
  if (g instanceof NextResponse) return g
  const { svc } = g
  try {
    const { data: profs } = await svc.from('amorlay_profiles').select('*').limit(5000)
    const cities: Record<string, { members: number; complete: number; eligible: number }> = {}
    const names = new Map<string, any>()
    const members = []
    for (const p of (profs || []) as ProfileRow[]) {
      names.set(p.user_id, p.basics || {})
      const finished = p.step === 'ready'
      const el = p.intake_complete ? eligibility(toMemberWithType(p)) : null
      members.push({
        id: p.user_id,
        firstName: p.basics?.firstName || '',
        email: p.basics?.email || '',
        city: p.basics?.city || '',
        cityKey: p.city_key,
        age: ageFrom(p.basics?.birthDate),
        step: p.step,
        finished,
        intakeComplete: p.intake_complete,
        videoDone: !!p.video?.at,
        looksDone: !!p.attraction?.looks && Object.keys(p.attraction.looks).length > 0,
        typeDone: !!p.attraction?.done,
        eligibility: el,
      })
      if (!p.city_key) continue
      const c = (cities[p.city_key] ||= { members: 0, complete: 0, eligible: 0 })
      c.members++
      if (finished) c.complete++
      if (finished && el?.ok) c.eligible++
    }
    const { data: matches } = await svc
      .from('amorlay_matches')
      .select('*')
      .in('status', ['proposed', 'scheduled', 'confirmed', 'needs_reschedule'])
      .order('created_at', { ascending: false })
      .limit(200)
    const items = []
    for (const m of matches || []) {
      const a = names.get(m.user_a) || {}
      const b = names.get(m.user_b) || {}
      items.push({
        ...m,
        a: { id: m.user_a, firstName: a.firstName, age: ageFrom(a.birthDate), photoUrl: await firstPhotoUrl(svc, m.user_a) },
        b: { id: m.user_b, firstName: b.firstName, age: ageFrom(b.birthDate), photoUrl: await firstPhotoUrl(svc, m.user_b) },
      })
    }
    return NextResponse.json({ cities, members, matches: items })
  } catch (e) {
    return errorResponse(e)
  }
}

/**
 * POST body:
 *   { matchId, action: 'schedule', venueName, venueAddress, dateAt (ISO) }  sets the date both members see
 *   { matchId, action: 'cancel' }
 *   { matchId, action: 'complete' }  opens the post-date debrief early (it also opens once the date time passes)
 */
export async function POST(req: Request) {
  const g = await gate()
  if (g instanceof NextResponse) return g
  const { svc, auth } = g
  try {
    const body = await req.json().catch(() => ({} as any))
    const { matchId, action } = body
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })
    const patch: any = { updated_at: new Date().toISOString() }
    if (action === 'schedule') {
      const when = new Date(body.dateAt)
      if (!body.venueName || Number.isNaN(when.getTime())) return NextResponse.json({ error: 'venue and date/time required' }, { status: 400 })
      Object.assign(patch, {
        status: 'scheduled',
        venue_name: String(body.venueName).slice(0, 200),
        venue_address: String(body.venueAddress || '').slice(0, 300),
        date_at: when.toISOString(),
        approved_by: auth.user.email,
        a_attending: null,
        b_attending: null,
      })
    } else if (action === 'cancel') patch.status = 'cancelled'
    else if (action === 'complete') patch.status = 'completed'
    else return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    const { error } = await svc.from('amorlay_matches').update(patch).eq('id', matchId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
