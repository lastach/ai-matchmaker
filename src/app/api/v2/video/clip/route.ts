import { NextResponse } from 'next/server'
import { CLIP_BUCKET, errorResponse, requireService, requireUser, saveProfile } from '@/lib/v2/server'

export const runtime = 'nodejs'

/**
 * Optional intro clip, shown to potential matches in the second attraction round
 * only when the member opts in. Uploaded straight to private storage with a signed URL.
 *
 * GET  -> { path, token } for supabase.storage.uploadToSignedUrl
 * POST body: { path } -> records the uploaded clip on the profile
 * DELETE -> removes the clip
 */
export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const path = `${auth.user.id}/intro-${crypto.randomUUID()}.webm`
    let r = await svc.storage.from(CLIP_BUCKET).createSignedUploadUrl(path)
    if (r.error && /not found/i.test(r.error.message)) {
      await svc.storage.createBucket(CLIP_BUCKET, { public: false, fileSizeLimit: 20 * 1024 * 1024 })
      r = await svc.storage.from(CLIP_BUCKET).createSignedUploadUrl(path)
    }
    if (r.error || !r.data) return NextResponse.json({ error: r.error?.message || 'upload unavailable' }, { status: 500 })
    return NextResponse.json({ path: r.data.path, token: r.data.token, bucket: CLIP_BUCKET })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const { path } = await req.json().catch(() => ({} as any))
    if (typeof path !== 'string' || !path.startsWith(auth.user.id + '/')) return NextResponse.json({ error: 'bad path' }, { status: 400 })
    await saveProfile(svc, auth.user.id, { clip_path: path, share_clip: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const { data } = await svc.from('amorlay_profiles').select('clip_path').eq('user_id', auth.user.id).maybeSingle()
    if (data?.clip_path) await svc.storage.from(CLIP_BUCKET).remove([data.clip_path])
    await saveProfile(svc, auth.user.id, { clip_path: null, share_clip: false })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
