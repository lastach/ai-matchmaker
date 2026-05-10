import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isAdminEmail } from '@/lib/isAdmin'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10))

  // Try matchmaker_profiles first; if intake_profiles is the source of truth, fall back.
  const result = await supa
    .from('matchmaker_profiles')
    .select('user_id, name, location, intake_completed_at, top_value, top_life_goal, attachment_self, priority_choice, profile_strength, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)

  return NextResponse.json({
    users: result.data || [],
    table: 'matchmaker_profiles',
    error: result.error ? result.error.message : null,
  })
}
