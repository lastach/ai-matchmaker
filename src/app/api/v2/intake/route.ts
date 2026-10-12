import { NextResponse } from 'next/server'
import { callClaudeJson, type ChatMsg } from '@/lib/v2/ai'
import { INTAKE_SYSTEM, COVERAGE_AREAS } from '@/lib/v2/prompts'
import { CRISIS_REPLY, crisisFlags } from '@/lib/v2/safety'
import { errorResponse, loadProfile, requireService, requireUser, saveProfile } from '@/lib/v2/server'
import { checkRateLimit } from '@/lib/rateLimit'
import type { AiProfile } from '@/lib/v2/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/v2/intake  body: { message?: string, restart?: boolean }
 * One turn of the conversational intake. The AI replies, updates its analysis of the member,
 * and asks only about areas still missing. Returns { reply, complete, progress, pause }.
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const rl = await checkRateLimit('v2-intake:' + auth.user.id)
    if (!rl.success) return NextResponse.json({ error: 'Too many messages at once. Give it a few seconds.' }, { status: 429 })

    const body = await req.json().catch(() => ({} as any))
    const p = await loadProfile(svc, auth.user.id)
    if (!p.basics.firstName) return NextResponse.json({ error: 'Add your basics first.' }, { status: 400 })

    const conversation = body.restart ? [] : [...(p.conversation || [])]
    let aiProfile: AiProfile = body.restart ? {} : { ...(p.ai_profile || {}) }
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : ''

    if (message) {
      conversation.push({ role: 'user', content: message })
      if (crisisFlags(message).length) {
        conversation.push({ role: 'assistant', content: CRISIS_REPLY })
        await saveProfile(svc, auth.user.id, { conversation })
        return NextResponse.json({ reply: CRISIS_REPLY, pause: true, complete: false })
      }
    } else if (conversation.length > 0) {
      // Nothing new to say; return the last assistant message.
      const last = [...conversation].reverse().find((m) => m.role === 'assistant')
      return NextResponse.json({ reply: last?.content || '', complete: p.intake_complete })
    }

    const context = [
      `Member's first name: ${p.basics.firstName}. City: ${p.basics.city}.`,
      `What you know so far (carry it forward): ${JSON.stringify(aiProfile)}`,
      conversation.length === 0 ? 'This is the start. Greet them by first name, say in one sentence how this works (a real conversation, about 15 minutes, saves as you go), then ask your first open question about their life right now.' : '',
    ].filter(Boolean).join('\n')

    // The model sees the dialogue as alternating turns; seed with context as the first user turn.
    const msgs: ChatMsg[] = [{ role: 'user', content: context }]
    for (const m of conversation) {
      const prev = msgs[msgs.length - 1]
      if (prev.role === m.role) prev.content = String(prev.content) + '\n\n' + m.content
      else msgs.push({ role: m.role, content: m.content })
    }
    if (msgs[msgs.length - 1].role === 'assistant') msgs.push({ role: 'user', content: '(continue)' })

    const { out } = await callClaudeJson<{ reply?: string; profile?: AiProfile; complete?: boolean; pause?: boolean }>({ system: INTAKE_SYSTEM, messages: msgs, maxTokens: 3000 })
    const reply = (out?.reply || '').trim() || 'Tell me a bit more about that?'
    if (out?.profile && typeof out.profile === 'object') aiProfile = { ...aiProfile, ...out.profile }

    conversation.push({ role: 'assistant', content: reply })
    const coverage = aiProfile.coverage || {}
    const allCovered = Object.keys(COVERAGE_AREAS).every((k) => coverage[k] === 'covered')
    const complete = !!out?.complete && allCovered

    const patch: any = { conversation, ai_profile: aiProfile }
    if (complete) {
      patch.intake_complete = true
      if (p.step === 'intake') patch.step = 'video'
    }
    if (body.restart) patch.intake_complete = false
    await saveProfile(svc, auth.user.id, patch)

    const covered = Object.keys(COVERAGE_AREAS).filter((k) => coverage[k] === 'covered').length
    return NextResponse.json({
      reply,
      complete,
      pause: !!out?.pause,
      progress: { covered, total: Object.keys(COVERAGE_AREAS).length },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
