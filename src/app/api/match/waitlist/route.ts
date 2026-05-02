import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const COHORT_THRESHOLD = 50

/**
 * GET /api/match/waitlist
 * Returns the user's signup-order position + total signups.
 */
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch {} },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ position: null, total: 0, threshold: COHORT_THRESHOLD })

  // Count rows older or equal to user's row (position by created_at)
  let position: number | null = null
  let total = 0
  try {
    const { count: totalCount } = await supabase.from('matchmaker_profiles').select('*', { count: 'exact', head: true })
    total = totalCount || 0
    const { data: own } = await supabase.from('matchmaker_profiles').select('created_at').eq('user_id', user.id).maybeSingle()
    if (own?.created_at) {
      const { count: priorCount } = await supabase.from('matchmaker_profiles').select('*', { count: 'exact', head: true }).lte('created_at', own.created_at)
      position = priorCount || 1
    } else {
      position = total + 1 // they haven't completed intake yet — they'll be at the end
    }
  } catch {
    // Table missing pre-migration — fall back to "you're #1"
    position = 1
    total = 1
  }
  return NextResponse.json({ position, total, threshold: COHORT_THRESHOLD })
}
