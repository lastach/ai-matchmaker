import { NextResponse } from 'next/server'
import { callClaudeJson } from '@/lib/v2/ai'
import { LOOKS_SYSTEM } from '@/lib/v2/prompts'
import { errorResponse, loadProfile, PHOTO_BUCKET, requireUser, saveProfile } from '@/lib/v2/server'
import { cleanLooks } from '@/lib/v2/typeLibrary'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/v2/photos/analyze
 * The AI describes the member's own photos on the same characteristics as the example library,
 * so their look can be compared with what other members are drawn to. Nobody else sees the photos.
 */
export async function POST() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = auth.session
  const uid = auth.user.id
  try {
    const rl = await checkRateLimit('v2-looks:' + uid)
    if (!rl.success) return NextResponse.json({ error: 'Please wait a moment and try again.' }, { status: 429 })
    const { data: rows } = await svc.from('matchmaker_photos').select('storage_path, position').eq('user_id', uid).order('position').limit(3)
    const paths = (rows || []).map((r) => String(r.storage_path)).filter((p) => p.includes('/profile/'))
    if (!paths.length) return NextResponse.json({ error: 'Add at least one photo first.' }, { status: 400 })

    const blocks: any[] = []
    for (const path of paths) {
      const { data: file } = await svc.storage.from(PHOTO_BUCKET).download(path)
      if (!file) continue
      const buf = Buffer.from(await file.arrayBuffer())
      if (buf.length > 4_500_000) continue
      const type = file.type && /image\/(jpeg|png|webp)/.test(file.type) ? file.type : 'image/jpeg'
      blocks.push({ type: 'image', source: { type: 'base64', media_type: type, data: buf.toString('base64') } })
    }
    if (!blocks.length) return NextResponse.json({ error: 'We could not read your photos. Try uploading them again.' }, { status: 400 })
    blocks.push({ type: 'text', text: 'Describe this member from these photos.' })

    const { out } = await callClaudeJson<any>({ system: LOOKS_SYSTEM, maxTokens: 300, messages: [{ role: 'user', content: blocks }] })
    const looks = cleanLooks(out)
    const p = await loadProfile(svc, uid)
    await saveProfile(svc, uid, { attraction: { ...(p.attraction || {}), looks, looksAt: new Date().toISOString() } })
    return NextResponse.json({ ok: true, clearFace: out?.clearFace !== false, note: typeof out?.note === 'string' ? out.note : '' })
  } catch (e) {
    return errorResponse(e)
  }
}
