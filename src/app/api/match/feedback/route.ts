import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Post-date feedback. Calibrates the matching model.
 * Body: { matchId, met: bool, secondDate: bool, calibration: 'spot-on' | 'close' | 'off', notes }
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

  const body = await req.json().catch(() => ({}))
  const { matchId, met, secondDate, calibration, notes } = body
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

  try {
    await supabase.from('match_feedback').insert({
      match_pair_id: matchId,
      user_id: user.id,
      met: !!met,
      second_date: !!secondDate,
      calibration: ['spot-on', 'close', 'off'].includes(calibration) ? calibration : null,
      notes: typeof notes === 'string' ? notes.slice(0, 2000) : null,
      created_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, message: 'Thanks - this calibrates future matches.' })
  } catch {
    return NextResponse.json({ ok: false, error: 'match_feedback table may need migration' }, { status: 500 })
  }
}
