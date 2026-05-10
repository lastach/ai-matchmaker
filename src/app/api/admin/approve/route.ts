import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/isAdmin'

export const runtime = 'nodejs'

/**
 * POST /api/admin/approve
 * body: { userId: string, candidateUserId: string, score: number, notes?: string }
 * Inserts into matches table (status: pending_brief). The /api/match/memo and
 * /api/match/deliver pipeline can then pick it up to generate and send.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({} as any))
  const userId: string = body?.userId
  const candidateUserId: string = body?.candidateUserId
  const score: number = Number(body?.score) || 0
  const notes: string = String(body?.notes || '')
  if (!userId || !candidateUserId) {
    return NextResponse.json({ error: 'userId and candidateUserId required' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin
    .from('matches')
    .insert({
      user_id: userId,
      candidate_user_id: candidateUserId,
      score,
      status: 'pending_brief',
      approved_by: user.email,
      approved_at: new Date().toISOString(),
      admin_notes: notes,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'insert failed', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, match: data })
}
