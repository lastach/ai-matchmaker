import { NextResponse } from 'next/server'
import { CLIP_BUCKET, PHOTO_BUCKET, requireUser, saveProfile, emptyProfile } from '@/lib/v2/server'

export const runtime = 'nodejs'

/**
 * POST /api/account/delete
 * Removes the member's Amorlay data with their own session: photos and intro clip
 * (files and rows), and the profile is wiped back to empty so it drops out of every
 * pool and match run. The sign-in itself is shared with other apps on this auth project,
 * so it is left in place.
 */
export async function POST() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = auth.session
  const uid = auth.user.id
  try {
    for (const bucket of [PHOTO_BUCKET, CLIP_BUCKET]) {
      for (const folder of [uid, `${uid}/profile`]) {
        const { data: files } = await svc.storage.from(bucket).list(folder, { limit: 100 })
        const paths = (files || []).filter((f) => f.id).map((f) => `${folder}/${f.name}`)
        if (paths.length) await svc.storage.from(bucket).remove(paths)
      }
    }
    await svc.from('matchmaker_photos').delete().eq('user_id', uid)
    const blank = emptyProfile(uid)
    await saveProfile(svc, uid, {
      step: 'basics', basics: {}, city_key: null, conversation: [], ai_profile: {}, video: {},
      clip_path: null, share_clip: false, weights: blank.weights, intake_complete: false,
    })
    await svc.auth.signOut().catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not delete your data.' }, { status: 500 })
  }
}
