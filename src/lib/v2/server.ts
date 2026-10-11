import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { DEFAULT_WEIGHTS, type ProfileRow } from './types'

export const PHOTO_BUCKET = 'matchmaker-photos'
export const CLIP_BUCKET = 'amorlay-clips'
export const COHORT_THRESHOLD = 50

/** Session-bound client (reads the signed-in member from cookies). */
export async function sessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} },
  }) as unknown as SupabaseClient
}

/** Service-role client for cross-member reads and all v2 writes. Null when not configured. */
export function serviceClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function requireUser(): Promise<{ user: { id: string; email?: string | null }; session: SupabaseClient } | NextResponse> {
  const session = await sessionClient()
  const { data } = await session.auth.getUser()
  if (!data?.user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  return { user: { id: data.user.id, email: data.user.email }, session }
}

export function requireService(): SupabaseClient | NextResponse {
  const svc = serviceClient()
  if (!svc) return NextResponse.json({ error: 'server not configured (SUPABASE_SERVICE_ROLE_KEY missing)' }, { status: 503 })
  return svc
}

/** Normalized city key so "Boston, MA" and "boston" land in one cohort. */
export function cityKey(city?: string | null): string | null {
  if (!city) return null
  const first = city.split(',')[0].trim().toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ')
  return first || null
}

export function ageFrom(birthDate?: string | null): number | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000))
}

export function emptyProfile(userId: string): ProfileRow {
  return {
    user_id: userId,
    step: 'basics',
    basics: {},
    city_key: null,
    conversation: [],
    ai_profile: {},
    video: {},
    clip_path: null,
    share_clip: false,
    weights: { ...DEFAULT_WEIGHTS },
    intake_complete: false,
  }
}

export async function loadProfile(svc: SupabaseClient, userId: string): Promise<ProfileRow> {
  const { data, error } = await svc.from('amorlay_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return emptyProfile(userId)
  return { ...emptyProfile(userId), ...data, weights: { ...DEFAULT_WEIGHTS, ...(data.weights || {}) } } as ProfileRow
}

export async function saveProfile(svc: SupabaseClient, userId: string, patch: Partial<ProfileRow>): Promise<void> {
  const row: any = { user_id: userId, ...patch, updated_at: new Date().toISOString() }
  const { error } = await svc.from('amorlay_profiles').upsert(row, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}

/** Signed URL of a member's first profile photo (1 hour). */
export async function firstPhotoUrl(svc: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data: rows } = await svc.from('matchmaker_photos').select('storage_path, position').eq('user_id', userId).order('position').limit(1)
    let path = rows?.[0]?.storage_path as string | undefined
    if (!path) {
      const { data: files } = await svc.storage.from(PHOTO_BUCKET).list(`${userId}/profile`, { limit: 1 })
      const f = files?.find((x) => !x.name.startsWith('.'))
      if (f) path = `${userId}/profile/${f.name}`
    }
    if (!path) return null
    const { data } = await svc.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600)
    return data?.signedUrl || null
  } catch {
    return null
  }
}

export async function clipUrl(svc: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null
  const { data } = await svc.storage.from(CLIP_BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl || null
}

export function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  const status = (e as any)?.status && Number((e as any).status) ? Number((e as any).status) : 500
  return NextResponse.json({ error: msg }, { status })
}
