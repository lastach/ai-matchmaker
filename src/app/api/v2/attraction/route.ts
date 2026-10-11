import { NextResponse } from 'next/server'
import { ageFits, interestedIn } from '@/lib/v2/engine'
import { loadCity, toMember } from '@/lib/v2/pool'
import { clipUrl, errorResponse, firstPhotoUrl, loadProfile, requireService, requireUser } from '@/lib/v2/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const BATCH = 12

/**
 * Attraction round, rated on real members of the member's city cohort.
 * Stage "photo": rate faces alone. Stage "video": rate the same people again with their intro clip
 * (or their short "about" when they did not share a clip). The difference measures how much
 * personality moves this member, which loosens or tightens their attraction bar.
 *
 * GET ?stage=photo|video -> { items: [{ id, firstName, age, photoUrl, clipUrl?, about? }], remaining }
 * POST { targetId, stage, rating (1..5) }
 */
export async function GET(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const stage = new URL(req.url).searchParams.get('stage') === 'video' ? 'video' : 'photo'
    const me = await loadProfile(svc, auth.user.id)
    if (!me.city_key || !me.intake_complete) return NextResponse.json({ items: [], remaining: 0, note: 'Finish the conversation first.' })
    const meM = toMember(me)
    const rows = await loadCity(svc, me.city_key)
    const { data: mine } = await svc.from('amorlay_ratings').select('target_id, photo_rating, video_rating').eq('rater_id', auth.user.id)
    const rated = new Map((mine || []).map((r) => [r.target_id, r]))

    const eligible = rows.filter((r) => {
      if (r.user_id === auth.user.id) return false
      const m = toMember(r)
      return interestedIn(meM, m) && interestedIn(m, meM) && ageFits(meM, m) && ageFits(m, meM)
    })
    const todo = eligible.filter((r) => {
      const x = rated.get(r.user_id)
      return stage === 'photo' ? !x?.photo_rating : !!x?.photo_rating && !x?.video_rating
    })

    const items = []
    for (const r of todo.slice(0, BATCH)) {
      const photoUrl = await firstPhotoUrl(svc, r.user_id)
      if (!photoUrl) continue
      const m = toMember(r)
      items.push({
        id: r.user_id,
        firstName: r.basics?.firstName || '',
        age: m.age,
        photoUrl,
        clipUrl: stage === 'video' && r.share_clip ? await clipUrl(svc, r.clip_path) : null,
        about: stage === 'video' ? r.ai_profile?.about || null : null,
      })
    }
    return NextResponse.json({ items, remaining: todo.length, eligible: eligible.length })
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
    const { targetId, stage, rating } = await req.json().catch(() => ({} as any))
    const n = Number(rating)
    if (!targetId || targetId === auth.user.id || !Number.isInteger(n) || n < 1 || n > 5) {
      return NextResponse.json({ error: 'bad rating' }, { status: 400 })
    }
    const col = stage === 'video' ? 'video_rating' : 'photo_rating'
    const { error } = await svc
      .from('amorlay_ratings')
      .upsert({ rater_id: auth.user.id, target_id: targetId, [col]: n, updated_at: new Date().toISOString() }, { onConflict: 'rater_id,target_id' })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
