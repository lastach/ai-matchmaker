import { NextResponse } from 'next/server'
import { clipUrl, errorResponse, firstPhotoUrl, loadProfile, requireUser } from '@/lib/v2/server'

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
  const svc = auth.session
  try {
    const stage = new URL(req.url).searchParams.get('stage') === 'video' ? 'video' : 'photo'
    const me = await loadProfile(svc, auth.user.id)
    if (!me.city_key || !me.intake_complete) return NextResponse.json({ items: [], remaining: 0, note: 'Finish the conversation first.' })
    // City members who could be a mutual match on the basics (interest and age, both ways).
    const { data: pool, error } = await svc.rpc('amorlay_attraction_pool')
    if (error) throw new Error(error.message)
    const eligible = (pool || []) as Array<{ user_id: string; first_name: string | null; age: number | null; about: string | null; share_clip: boolean; clip_path: string | null }>
    const { data: mine } = await svc.from('amorlay_ratings').select('target_id, photo_rating, video_rating').eq('rater_id', auth.user.id)
    const rated = new Map((mine || []).map((r) => [r.target_id, r]))
    const todo = eligible.filter((r) => {
      const x = rated.get(r.user_id)
      return stage === 'photo' ? !x?.photo_rating : !!x?.photo_rating && !x?.video_rating
    })

    const items = []
    for (const r of todo.slice(0, BATCH)) {
      const photoUrl = await firstPhotoUrl(svc, r.user_id)
      if (!photoUrl) continue
      items.push({
        id: r.user_id,
        firstName: r.first_name || '',
        age: r.age,
        photoUrl,
        clipUrl: stage === 'video' && r.share_clip ? await clipUrl(svc, r.clip_path) : null,
        about: stage === 'video' ? r.about || null : null,
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
  const svc = auth.session
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
