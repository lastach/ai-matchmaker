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

  // Get the user's stated location (free text) to filter the cohort
  let userLocation: string | null = null
  let position: number | null = null
  let total = 0
  let totalGlobal = 0
  let location: string | null = null
  try {
    const { data: own } = await supabase.from('matchmaker_profiles').select('created_at, location').eq('user_id', user.id).maybeSingle()
    userLocation = own?.location?.trim() || null
    location = userLocation
    // Global count regardless of location (sanity)
    const { count: globalTotal } = await supabase.from('matchmaker_profiles').select('*', { count: 'exact', head: true })
    totalGlobal = globalTotal || 0
    // Cohort total — anyone whose location matches the same area (case-insensitive substring on city/region)
    if (userLocation) {
      const firstToken = userLocation.split(/[\s,]/).filter(Boolean)[0] || userLocation
      const { count: areaTotal } = await supabase.from('matchmaker_profiles').select('*', { count: 'exact', head: true }).ilike('location', `%${firstToken}%`)
      total = areaTotal || 0
    } else {
      total = totalGlobal
    }
    if (own?.created_at) {
      let q = supabase.from('matchmaker_profiles').select('*', { count: 'exact', head: true }).lte('created_at', own.created_at)
      if (userLocation) {
        const firstToken = userLocation.split(/[\s,]/).filter(Boolean)[0] || userLocation
        q = q.ilike('location', `%${firstToken}%`)
      }
      const { count: priorCount } = await q
      position = priorCount || 1
    } else {
      position = total + 1
    }
  } catch {
    // Table missing pre-migration — fall back to "you're #1"
    position = 1
    total = 1
  }
  const cohortOpen = total >= COHORT_THRESHOLD
  return NextResponse.json({ position, total, totalGlobal, location, threshold: COHORT_THRESHOLD, cohortOpen })
}
