import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Photo verification - confirm the user's profile photos show the same person
 * as a fresh selfie. Uses Claude vision to compare. Not as strong as Persona
 * liveness but useful for "is this a stock photo?" / "is this a different person?"
 * spot-checks at scale during preview.
 */
async function getSupa() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value }, set() {}, remove() {} } }
  )
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anon'
  const rl = await checkRateLimit('photo-verify:' + ip)
  if (!rl.success) return NextResponse.json({ error: 'rate limit' }, { status: 429 })

  const supa = await getSupa()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const fd = await req.formData().catch(() => null)
  if (!fd) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
  const selfie = fd.get('selfie') as File | null
  if (!selfie) return NextResponse.json({ error: 'selfie required' }, { status: 400 })

  // Pull profile photos
  const { data: profile } = await supa.from('user_profiles').select('photos').eq('id', user.id).single()
  const photos: string[] = Array.isArray(profile?.photos) ? profile.photos.slice(0, 3) : []
  if (photos.length === 0) return NextResponse.json({ error: 'No profile photos to verify against. Upload profile photos first.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Without Claude, just record that a selfie was submitted
    try {
      await supa.from('user_verification').upsert({
        user_id: user.id,
        provider: 'photo-manual',
        status: 'submitted_pending_review',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    } catch {}
    return NextResponse.json({ verified: false, status: 'submitted_pending_review', note: 'Selfie received - matchmaker will review manually.' })
  }

  // Convert selfie to base64
  const selfieBytes = await selfie.arrayBuffer()
  const selfieB64 = Buffer.from(selfieBytes).toString('base64')
  const selfieMedia = selfie.type || 'image/jpeg'

  // Build content array with the selfie + each profile photo URL
  const content: any[] = [
    { type: 'image', source: { type: 'base64', media_type: selfieMedia, data: selfieB64 } },
    ...photos.map(url => ({ type: 'image', source: { type: 'url', url } })),
    { type: 'text', text: 'Image 1 is a fresh selfie. Images 2+ are profile photos. Question: is this the same person across the photos? Respond with ONLY a JSON object: {"same_person": "yes" | "uncertain" | "no", "confidence": 0-100, "reasons": "1 sentence"}. No preamble.' },
  ]

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) return NextResponse.json({ error: 'verification service unavailable' }, { status: 503 })
  const d = await r.json()
  let text = (d?.content?.[0]?.text || '{}').trim()
  const m = text.match(/\{[\s\S]*\}/)
  if (m) text = m[0]
  let parsed: any = {}
  try { parsed = JSON.parse(text) } catch {}

  const verified = parsed.same_person === 'yes' && (parsed.confidence || 0) >= 75
  const status = verified ? 'verified' : (parsed.same_person === 'no' ? 'failed' : 'flagged_for_review')

  try {
    await supa.from('user_verification').upsert({
      user_id: user.id,
      provider: 'photo-claude',
      status,
      vision_result: parsed,
      updated_at: new Date().toISOString(),
      verified_at: verified ? new Date().toISOString() : null,
    }, { onConflict: 'user_id' })
  } catch {}

  return NextResponse.json({ verified, status, confidence: parsed.confidence, reasons: parsed.reasons })
}
