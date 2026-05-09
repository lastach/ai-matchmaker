import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'

/**
 * Safety reporting endpoint.
 * Accepts a report of bad behavior from one user about another. Goes into
 * safety_reports table; reviewed by a human within 24 hours.
 */
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anon'
  const rl = await checkRateLimit('safety-report:' + ip)
  if (!rl.success) return NextResponse.json({ error: 'rate limit' }, { status: 429 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const reported_user_id = String(body.reportedUserId || '')
  const category = String(body.category || 'other')
  const description = String(body.description || '').slice(0, 4000)
  const block_user = !!body.blockUser

  if (!reported_user_id) return NextResponse.json({ error: 'reportedUserId required' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const valid = ['harassment', 'inappropriate-content', 'misrepresentation', 'safety-concern', 'other']
  const safeCategory = valid.includes(category) ? category : 'other'

  try {
    await supabase.from('safety_reports').insert({
      reporter_id: user.id,
      reported_user_id,
      category: safeCategory,
      description,
      status: 'pending_review',
      created_at: new Date().toISOString(),
    })
    if (block_user) {
      await supabase.from('user_blocks').upsert({
        blocker_id: user.id,
        blocked_id: reported_user_id,
        created_at: new Date().toISOString(),
      })
    }
    return NextResponse.json({
      ok: true,
      message: 'Report received. A human reviews every report within 24 hours.',
      blocked: block_user,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, note: 'Save attempted - safety_reports table may need migration.' })
  }
}
