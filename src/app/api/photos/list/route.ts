import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'matchmaker-photos'

/**
 * GET /api/photos/list
 * Returns the authenticated user's photo URLs as signed URLs (1-hour TTL).
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
  if (!user) return NextResponse.json({ photos: [] })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ photos: [] })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  // Try DB first (when table exists), fall back to listing from storage
  let rows: Array<{ storage_path: string; position: number }> = []
  try {
    const { data } = await admin.from('matchmaker_photos').select('storage_path, position').eq('user_id', user.id).order('position')
    if (data) rows = data
  } catch {}

  if (rows.length === 0) {
    // List directly from storage (folder = userId)
    const { data: files } = await admin.storage.from(BUCKET).list(user.id, { limit: 50, search: '' })
    if (files) {
      for (const f of files) {
        if (f.name.startsWith('.')) continue
        // List recurses if needed
        rows.push({ storage_path: `${user.id}/${f.name}`, position: 0 })
      }
      // Also explore profile/ + attraction/ subfolders
      for (const sub of ['profile', 'attraction']) {
        const { data: subFiles } = await admin.storage.from(BUCKET).list(`${user.id}/${sub}`, { limit: 50 })
        if (subFiles) {
          for (const f of subFiles) {
            if (f.name.startsWith('.')) continue
            rows.push({ storage_path: `${user.id}/${sub}/${f.name}`, position: sub === 'profile' ? 0 : 100 })
          }
        }
      }
    }
  }

  // Generate signed URLs (1 hour)
  const photos: Array<{ url: string; slot: 'profile' | 'attraction' }> = []
  for (const r of rows) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(r.storage_path, 60 * 60)
    if (signed?.signedUrl) {
      const slot = r.storage_path.includes('/attraction/') ? 'attraction' : 'profile'
      photos.push({ url: signed.signedUrl, slot })
    }
  }
  return NextResponse.json({ photos })
}
