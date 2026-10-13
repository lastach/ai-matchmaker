import { NextResponse } from 'next/server'
import { ageFrom, cityKey, COHORT_THRESHOLD, errorResponse, loadProfile, requireUser, saveProfile } from '@/lib/v2/server'
import { COVERAGE_AREAS } from '@/lib/v2/prompts'
import type { Basics } from '@/lib/v2/types'

export const runtime = 'nodejs'

const STEPS = ['basics', 'intake', 'video', 'photos', 'attraction', 'ready'] as const

/** GET: the member's own state for the dashboard. */
export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = auth.session
  try {
    const p = await loadProfile(svc, auth.user.id)
    let cohort = 0
    if (p.city_key) {
      const { data: count } = await svc.rpc('amorlay_cohort_count')
      cohort = Number(count) || 0
    }
    const coverage = p.ai_profile?.coverage || {}
    const covered = Object.keys(COVERAGE_AREAS).filter((k) => coverage[k] === 'covered').length
    return NextResponse.json({
      step: p.step,
      basics: p.basics,
      // Until the member has answered, the opener is regenerated fresh by the intake.
      conversation: (p.conversation || []).some((m) => m.role === 'user') ? p.conversation : [],
      intakeProgress: { covered, total: Object.keys(COVERAGE_AREAS).length },
      intakeComplete: p.intake_complete,
      videoDone: !!p.video?.at,
      shareClip: p.share_clip,
      hasClip: !!p.clip_path,
      cohort: { city: p.basics.city || null, count: cohort, threshold: COHORT_THRESHOLD, open: cohort >= COHORT_THRESHOLD },
    })
  } catch (e) {
    return errorResponse(e)
  }
}

/** POST: save basics, or move to a step. Body: { basics?, step?, shareClip? } */
export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = auth.session
  try {
    const body = await req.json().catch(() => ({} as any))
    const p = await loadProfile(svc, auth.user.id)
    const patch: any = {}

    if (body.basics) {
      const b: Basics = { ...p.basics, ...body.basics }
      const age = ageFrom(b.birthDate)
      if (age == null) return NextResponse.json({ error: 'Please enter your birth date.' }, { status: 400 })
      if (age < 18) return NextResponse.json({ error: 'Amorlay is 18+ only.', underage: true }, { status: 403 })
      if (!b.firstName || !b.city || !b.gender || !b.interestedIn?.length) {
        return NextResponse.json({ error: 'Please fill in name, city, who you are and who you want to meet.' }, { status: 400 })
      }
      const lo = Math.max(18, Number(b.ageMin) || 18)
      const hi = Math.max(lo, Number(b.ageMax) || 99)
      b.ageMin = lo
      b.ageMax = hi
      patch.basics = b
      patch.city_key = cityKey(b.city)
      if (p.step === 'basics') patch.step = 'intake'
    }

    if (typeof body.shareClip === 'boolean') patch.share_clip = body.shareClip

    if (body.step && (STEPS as readonly string[]).includes(body.step)) {
      // Members can only move forward through steps they have finished, or back to redo one.
      const target = body.step as (typeof STEPS)[number]
      const blocked =
        (target === 'video' && !p.intake_complete) ||
        (target === 'attraction' && !p.intake_complete)
      if (blocked) return NextResponse.json({ error: 'Finish the conversation first.' }, { status: 400 })
      patch.step = target
    }

    if (Object.keys(patch).length) await saveProfile(svc, auth.user.id, patch)
    return NextResponse.json({ ok: true, step: patch.step || p.step })
  } catch (e) {
    return errorResponse(e)
  }
}
