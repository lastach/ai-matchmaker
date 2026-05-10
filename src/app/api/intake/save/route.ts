import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * POST /api/intake/save
 *
 * Persist the dashboard's in-memory profile to user_profiles so the data
 * survives reload, shows up in /admin, and feeds the matching engine.
 *
 * Body: { profileData, coreIntakeData, profileStrength, userPhotos }
 *
 * We map the dashboard shape onto the columns the rest of the app reads:
 *   - profile_data        (jsonb) - the full ProfileData blob
 *   - core_intake_data    (jsonb) - the q1..q21 answers
 *   - location            (text)  - mirrored from coreIntakeData.location
 *   - gender              (text)  - mirrored from profileData.gender
 *   - interested_in       (text)  - mirrored from profileData.interestedIn
 *   - dob                 (date)  - mirrored from profileData.dob
 *   - age_min / age_max   (int)   - mirrored from coreIntakeData
 *   - intake_completed_at (ts)    - set the moment the user crosses the
 *                                   completion line (caller decides)
 *   - updated_at          (ts)
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

  const body = await req.json().catch(() => ({} as any))
  const profileData = body?.profileData || {}
  const coreIntakeData = body?.coreIntakeData || {}
  const profileStrength = typeof body?.profileStrength === 'number' ? body.profileStrength : null
  const userPhotos = Array.isArray(body?.userPhotos) ? body.userPhotos.slice(0, 12) : []
  const intakeCompleted = !!body?.intakeCompleted

  const row: any = {
    id: user.id,
    profile_data: profileData,
    core_intake_data: coreIntakeData,
    location: coreIntakeData.location || profileData.location || null,
    gender: profileData.gender || null,
    interested_in: profileData.interestedIn || null,
    dob: profileData.dob || null,
    age_min: coreIntakeData.ageMin ?? null,
    age_max: coreIntakeData.ageMax ?? null,
    profile_strength: profileStrength,
    photos: userPhotos,
    updated_at: new Date().toISOString(),
  }
  if (intakeCompleted) row.intake_completed_at = new Date().toISOString()

  try {
    const { error } = await supa.from('user_profiles').upsert(row, { onConflict: 'id' })
    if (error) {
      // best-effort fallback: if some columns don't exist in the env, try a minimal upsert
      const minimal = { id: user.id, profile_data: profileData, core_intake_data: coreIntakeData, updated_at: row.updated_at, ...(intakeCompleted ? { intake_completed_at: row.intake_completed_at } : {}) }
      const r2 = await supa.from('user_profiles').upsert(minimal, { onConflict: 'id' })
      if (r2.error) return NextResponse.json({ error: r2.error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'save failed' }, { status: 500 })
  }
}
