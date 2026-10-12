import { NextResponse } from 'next/server'
import { callClaudeJson, clampNum, type ChatMsg } from '@/lib/v2/ai'
import { VIDEO_SYSTEM } from '@/lib/v2/prompts'
import { errorResponse, loadProfile, requireService, requireUser, saveProfile } from '@/lib/v2/server'
import { checkRateLimit } from '@/lib/rateLimit'
import type { VideoAssessment } from '@/lib/v2/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/v2/video
 * body: { frames: string[] (JPEG data URLs), answers: [{ question, transcript }] }
 * The AI rates warmth, energy and expressiveness (plus agreeableness, extraversion, neuroticism)
 * from still frames and the spoken answers. Frames are analyzed and discarded, not stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const rl = await checkRateLimit('v2-video:' + auth.user.id)
    if (!rl.success) return NextResponse.json({ error: 'Please wait a moment and try again.' }, { status: 429 })
    const body = await req.json().catch(() => ({} as any))
    const frames: string[] = Array.isArray(body.frames) ? body.frames.slice(0, 6) : []
    const answers: Array<{ question: string; transcript: string }> = Array.isArray(body.answers) ? body.answers.slice(0, 6) : []
    if (frames.length === 0) return NextResponse.json({ error: 'No video frames received. Check camera access and try again.' }, { status: 400 })

    const blocks: any[] = []
    for (const f of frames) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(f))
      if (!m || m[2].length > 600_000) continue
      blocks.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } })
    }
    if (blocks.length === 0) return NextResponse.json({ error: 'Video frames were unreadable. Try again in better light.' }, { status: 400 })
    const transcript = answers
      .map((a) => `Q: ${String(a.question || '').slice(0, 200)}\nA: ${String(a.transcript || '').slice(0, 2000) || '(no transcript)'}`)
      .join('\n\n')
    const hasTranscript = answers.some((a) => String(a.transcript || '').trim().length > 20)
    blocks.push({ type: 'text', text: `Transcript:\n${transcript || '(no transcript available)'}` })

    const msgs: ChatMsg[] = [{ role: 'user', content: blocks }]
    const out = (await callClaudeJson<any>({ system: VIDEO_SYSTEM, messages: msgs, maxTokens: 600 })).out || {}
    const video: VideoAssessment = {
      warmth: clampNum(out.warmth, 1, 10, 5),
      energy: clampNum(out.energy, 1, 10, 5),
      expressiveness: clampNum(out.expressiveness, 1, 10, 5),
      agreeableness: clampNum(out.agreeableness, 1, 10, 5),
      extraversion: clampNum(out.extraversion, 1, 10, 5),
      neuroticism: clampNum(out.neuroticism, 1, 10, 5),
      notes: typeof out.notes === 'string' ? out.notes.slice(0, 500) : undefined,
      transcriptAvailable: hasTranscript,
      at: new Date().toISOString(),
    }
    const p = await loadProfile(svc, auth.user.id)
    await saveProfile(svc, auth.user.id, { video, step: p.step === 'video' ? 'photos' : p.step })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
