import { NextResponse } from 'next/server'
import { errorResponse, loadProfile, requireUser, saveProfile } from '@/lib/v2/server'
import { examplesFor, round2For } from '@/lib/v2/typeLibrary'

export const runtime = 'nodejs'

/**
 * "Your type": members rate example photos (never other members).
 * Round 1: example photos alone, to learn the look they are drawn to.
 * Round 2: some of the same people with a short personality snippet, to measure how much
 * personality moves them versus looks.
 *
 * GET -> { stage: 'photo' | 'about' | 'done', items: [{ id, src, snippet? }], done, total }
 * POST { exampleId, stage, rating (1..5) }
 * POST { finish: true } -> marks the step done
 */
export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = auth.session
  try {
    const p = await loadProfile(svc, auth.user.id)
    const ratings = p.attraction?.ratings || {}
    const r1 = examplesFor(auth.user.id, p.basics)
    const r2 = round2For(auth.user.id, p.basics)
    const total = r1.length + r2.length
    const todo1 = r1.filter((e) => typeof ratings[e.id]?.photo !== 'number')
    if (todo1.length) {
      return NextResponse.json({ stage: 'photo', items: todo1.map((e) => ({ id: e.id, src: e.src })), done: r1.length - todo1.length, total })
    }
    const todo2 = r2.filter((x) => typeof ratings[x.example.id]?.about !== 'number')
    if (todo2.length) {
      return NextResponse.json({ stage: 'about', items: todo2.map((x) => ({ id: x.example.id, src: x.example.src, snippet: x.snippet })), done: total - todo2.length, total })
    }
    return NextResponse.json({ stage: 'done', items: [], done: total, total })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = auth.session
  try {
    const body = await req.json().catch(() => ({} as any))
    const p = await loadProfile(svc, auth.user.id)
    const attraction = { ...(p.attraction || {}) }

    if (body.finish) {
      attraction.done = true
      await saveProfile(svc, auth.user.id, { attraction, ...(p.step === 'type' ? { step: 'ready' } : {}) })
      return NextResponse.json({ ok: true })
    }

    const n = Number(body.rating)
    const stage = body.stage === 'about' ? 'about' : 'photo'
    if (!Number.isInteger(n) || n < 1 || n > 5) return NextResponse.json({ error: 'bad rating' }, { status: 400 })
    const ratings = { ...(attraction.ratings || {}) }
    if (stage === 'photo') {
      if (!examplesFor(auth.user.id, p.basics).some((e) => e.id === body.exampleId)) return NextResponse.json({ error: 'unknown example' }, { status: 400 })
      ratings[body.exampleId] = { ...(ratings[body.exampleId] || {}), photo: n }
    } else {
      const r = round2For(auth.user.id, p.basics).find((x) => x.example.id === body.exampleId)
      if (!r) return NextResponse.json({ error: 'unknown example' }, { status: 400 })
      ratings[body.exampleId] = { ...(ratings[body.exampleId] || {}), about: n, variant: r.variant }
    }
    attraction.ratings = ratings
    await saveProfile(svc, auth.user.id, { attraction })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
