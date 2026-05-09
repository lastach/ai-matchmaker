import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Date logistics. Once both parties have accepted a match, either side can
 * propose specifics: venue, date and time, who pays for what, who arranges
 * what (reservation, ride, etc.). The other party confirms or counter-proposes.
 *
 * Schema (date_plans):
 *   id, match_pair_id, proposed_by_user_id, venue_name, venue_address,
 *   scheduled_at (ISO), notes, who_books, who_pays, status,
 *   confirmed_at, created_at, updated_at.
 *
 * status flow: draft -> proposed -> confirmed | counter | cancelled
 */

async function getSupa() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
}

async function userInPair(supa: any, userId: string, matchPairId: string) {
  const { data } = await supa.from('matches').select('user_id, status').eq('match_pair_id', matchPairId)
  if (!data || data.length === 0) return false
  const inPair = data.some((r: any) => r.user_id === userId)
  const bothAccepted = data.length >= 2 && data.every((r: any) => r.status === 'accepted')
  return inPair && bothAccepted
}

export async function GET(req: Request) {
  const supa = await getSupa()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const matchPairId = searchParams.get('match_pair_id')
  if (!matchPairId) return NextResponse.json({ error: 'match_pair_id required' }, { status: 400 })

  if (!await userInPair(supa, user.id, matchPairId)) {
    return NextResponse.json({ error: 'not in pair or both must accept first' }, { status: 403 })
  }

  try {
    const { data } = await supa.from('date_plans').select('*').eq('match_pair_id', matchPairId).order('created_at', { ascending: false })
    return NextResponse.json({ plans: data || [] })
  } catch {
    return NextResponse.json({ plans: [] })
  }
}

export async function POST(req: Request) {
  const supa = await getSupa()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || !body.match_pair_id) return NextResponse.json({ error: 'match_pair_id required' }, { status: 400 })

  if (!await userInPair(supa, user.id, body.match_pair_id)) {
    return NextResponse.json({ error: 'not in pair or both must accept first' }, { status: 403 })
  }

  const action = body.action || 'propose'

  if (action === 'propose' || action === 'counter') {
    if (!body.scheduled_at) return NextResponse.json({ error: 'scheduled_at required' }, { status: 400 })
    const row: any = {
      match_pair_id: body.match_pair_id,
      proposed_by_user_id: user.id,
      venue_name: body.venue_name ? String(body.venue_name).slice(0, 200) : null,
      venue_address: body.venue_address ? String(body.venue_address).slice(0, 300) : null,
      scheduled_at: body.scheduled_at,
      notes: body.notes ? String(body.notes).slice(0, 1000) : null,
      who_books: body.who_books || null,
      who_pays: body.who_pays || null,
      status: action === 'counter' ? 'counter' : 'proposed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    try {
      const { data, error } = await supa.from('date_plans').insert(row).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ plan: data })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'insert failed' }, { status: 500 })
    }
  }

  if (action === 'confirm' || action === 'cancel') {
    if (!body.plan_id) return NextResponse.json({ error: 'plan_id required' }, { status: 400 })
    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'
    try {
      const { data: existing } = await supa.from('date_plans').select('*').eq('id', body.plan_id).single()
      if (!existing) return NextResponse.json({ error: 'plan not found' }, { status: 404 })
      if (existing.match_pair_id !== body.match_pair_id) return NextResponse.json({ error: 'plan does not belong to pair' }, { status: 400 })
      if (action === 'confirm' && existing.proposed_by_user_id === user.id) {
        return NextResponse.json({ error: 'the other party must confirm your proposal' }, { status: 400 })
      }
      const { data, error } = await supa.from('date_plans').update({
        status: newStatus,
        confirmed_at: action === 'confirm' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', body.plan_id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ plan: data })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'update failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
