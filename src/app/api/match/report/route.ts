import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/match/report
 * Body: { reportedUserId, reason, details }
 *
 * Records a safety report against another user. Required for app-store + safety.
 * Writes to match_reports table; if table doesn't exist yet (pre-migration), the
 * route still 200s with `pending: true` so the UI doesn't break.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            try { cookieStore.set({ name, value, ...options }) } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try { cookieStore.set({ name, value: '', ...options }) } catch {}
          },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { reportedUserId, reason, details } = body || {}
    if (!reportedUserId || !reason) {
      return NextResponse.json({ error: 'reportedUserId and reason are required' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ ok: true, pending: true, note: 'Report received but DB not yet wired' })
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    const { error } = await admin.from('match_reports').insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      reason,
      details: details || null,
      created_at: new Date().toISOString(),
    })
    if (error) {
      // If the table is missing, accept the report and tag pending
      if (/does not exist|relation/i.test(error.message)) {
        return NextResponse.json({ ok: true, pending: true, note: 'match_reports table not migrated yet' })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}
