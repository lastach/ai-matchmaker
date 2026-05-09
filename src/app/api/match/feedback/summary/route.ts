import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Per-user feedback summary. The match engine reads this to learn what
 * calibration this user has been giving so far, and shifts dimension weights
 * accordingly on the next match.
 *
 * Returns:
 *   total_feedback, met_count, second_date_count, off_count,
 *   close_count, spot_on_count, last_feedback_at.
 */
async function getSupa() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
}

export async function GET() {
  const supa = await getSupa()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  try {
    const { data } = await supa.from('match_feedback').select('met, second_date, calibration, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    const rows = data || []
    const summary = {
      total_feedback: rows.length,
      met_count: rows.filter((r: any) => r.met).length,
      second_date_count: rows.filter((r: any) => r.second_date).length,
      off_count: rows.filter((r: any) => r.calibration === 'off').length,
      close_count: rows.filter((r: any) => r.calibration === 'close').length,
      spot_on_count: rows.filter((r: any) => r.calibration === 'spot-on').length,
      last_feedback_at: rows[0]?.created_at || null,
    }
    return NextResponse.json(summary)
  } catch {
    return NextResponse.json({ total_feedback: 0, met_count: 0, second_date_count: 0, off_count: 0, close_count: 0, spot_on_count: 0, last_feedback_at: null })
  }
}
