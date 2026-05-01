import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'matchmaker-photos'

/**
 * POST /api/photos/upload
 * multipart/form-data: file + slot ('profile' | 'attraction')
 *
 * Uploads the photo to private Supabase Storage at <userId>/<slot>/<random>.<ext>.
 * Records a row in matchmaker_photos table for retrieval.
 */
export async function POST(request: Request) {
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
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  const slot = (form.get('slot') as string) === 'attraction' ? 'attraction' : 'profile'
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'file too large (max 8 MB)' }, { status: 413 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'image only' }, { status: 415 })

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 4)
  const id = crypto.randomUUID()
  const path = `${user.id}/${slot}/${id}.${ext}`

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'storage not configured (SUPABASE_SERVICE_ROLE_KEY missing)' }, { status: 500 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  const arrayBuf = await file.arrayBuffer()
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, arrayBuf, { contentType: file.type, upsert: false })
  if (upErr) {
    if (/Bucket not found/i.test(upErr.message)) {
      // Create the bucket on first upload
      await admin.storage.createBucket(BUCKET, { public: false })
      const { error: retryErr } = await admin.storage.from(BUCKET).upload(path, arrayBuf, { contentType: file.type, upsert: false })
      if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 })
    } else {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
  }

  // Record in matchmaker_photos (graceful if table missing)
  let dbError: string | null = null
  try {
    const { error } = await admin.from('matchmaker_photos').insert({
      user_id: user.id,
      storage_path: path,
      position: slot === 'profile' ? 0 : 100,
    })
    if (error && !/does not exist|relation/i.test(error.message)) dbError = error.message
  } catch (e) {
    dbError = String(e)
  }

  return NextResponse.json({ ok: true, path, slot, dbError })
}
