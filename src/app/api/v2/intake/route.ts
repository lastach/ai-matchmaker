import { after, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { callClaudeJson, type ChatMsg } from '@/lib/v2/ai'
import { COVERAGE_AREAS, INTAKE_ANALYZE_SYSTEM, INTAKE_REPLY_SYSTEM } from '@/lib/v2/prompts'
import { CRISIS_REPLY, crisisFlags } from '@/lib/v2/safety'
import { detachedClient, errorResponse, loadProfile, requireUser, saveProfile } from '@/lib/v2/server'
import { checkRateLimit } from '@/lib/rateLimit'
import type { AiProfile } from '@/lib/v2/types'

export const runtime = 'nodejs'
export const maxDuration = 120

type Turn = { role: 'user' | 'assistant'; content: string }

const AREAS = Object.keys(COVERAGE_AREAS)
const coveredCount = (p: AiProfile) => AREAS.filter((k) => p.coverage?.[k] === 'covered').length
const allCovered = (p: AiProfile) => coveredCount(p) === AREAS.length

function asMessages(context: string, conversation: Turn[]): ChatMsg[] {
  const msgs: ChatMsg[] = [{ role: 'user', content: context }]
  for (const m of conversation) {
    const prev = msgs[msgs.length - 1]
    if (prev.role === m.role) prev.content = String(prev.content) + '\n\n' + m.content
    else msgs.push({ role: m.role, content: m.content })
  }
  if (msgs[msgs.length - 1].role === 'assistant') msgs.push({ role: 'user', content: '(continue)' })
  return msgs
}

/** Re-read the whole conversation and update the structured profile. Skips the write if a newer analysis already landed. */
async function analyze(db: SupabaseClient, userId: string, conversation: Turn[], base: AiProfile): Promise<AiProfile> {
  const transcript = conversation.map((m) => `${m.role === 'user' ? 'Member' : 'Matchmaker'}: ${m.content}`).join('\n\n')
  const { out } = await callClaudeJson<AiProfile>({
    system: INTAKE_ANALYZE_SYSTEM,
    maxTokens: 3000,
    timeoutMs: 100000,
    messages: [{ role: 'user', content: `Profile so far:\n${JSON.stringify(base)}\n\nConversation:\n${transcript}` }],
  })
  if (!out || typeof out !== 'object') return base
  const next: AiProfile & { analyzedTurns?: number } = { ...base, ...out, analyzedTurns: conversation.length }
  const { data } = await db.from('amorlay_profiles').select('ai_profile').eq('user_id', userId).maybeSingle()
  const stored = (data?.ai_profile || {}) as { analyzedTurns?: number }
  if ((stored.analyzedTurns || 0) > conversation.length) return stored as AiProfile
  await saveProfile(db, userId, { ai_profile: next })
  return next
}

/**
 * POST /api/v2/intake  body: { message?: string, restart?: boolean }
 * One turn of the intake. The reply comes back fast; the structured analysis of the member
 * runs right after the response, so the next question can target what is still missing.
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = auth.session
  const uid = auth.user.id
  try {
    const rl = await checkRateLimit('v2-intake:' + uid)
    if (!rl.success) return NextResponse.json({ error: 'Too many messages at once. Give it a few seconds.' }, { status: 429 })

    const body = await req.json().catch(() => ({} as any))
    const p = await loadProfile(svc, uid)
    if (!p.basics.firstName) return NextResponse.json({ error: 'Add your basics first.' }, { status: 400 })

    const conversation: Turn[] = body.restart ? [] : [...(p.conversation || [])]
    let aiProfile: AiProfile = body.restart ? {} : { ...(p.ai_profile || {}) }
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : ''
    const progress = () => ({ covered: coveredCount(aiProfile), total: AREAS.length })

    // Opening question: instant, no AI call.
    if (conversation.length === 0 && !message) {
      const reply = `Hi ${p.basics.firstName}. To start, what does your life look like right now?`
      conversation.push({ role: 'assistant', content: reply })
      await saveProfile(svc, uid, { conversation, ai_profile: aiProfile, ...(body.restart ? { intake_complete: false } : {}) })
      return NextResponse.json({ reply, complete: false, progress: progress() })
    }
    if (!message) {
      const last = [...conversation].reverse().find((m) => m.role === 'assistant')
      return NextResponse.json({ reply: last?.content || '', complete: p.intake_complete, progress: progress() })
    }

    conversation.push({ role: 'user', content: message })
    if (crisisFlags(message).length) {
      conversation.push({ role: 'assistant', content: CRISIS_REPLY })
      await saveProfile(svc, uid, { conversation })
      return NextResponse.json({ reply: CRISIS_REPLY, pause: true, complete: false })
    }

    const context = (profile: AiProfile) => [
      `Member's first name: ${p.basics.firstName}. City: ${p.basics.city}.`,
      `Coverage so far: ${JSON.stringify(profile.coverage || {})}`,
      `What you know so far: ${JSON.stringify({ ...profile, coverage: undefined })}`,
    ].join('\n')
    let { out } = await callClaudeJson<{ reply?: string; complete?: boolean; pause?: boolean }>({
      system: INTAKE_REPLY_SYSTEM, maxTokens: 700, messages: asMessages(context(aiProfile), conversation),
    })

    // The member confirmed the summary but the latest analysis has not caught up: analyze now, then decide.
    if (out?.complete && !allCovered(aiProfile)) {
      aiProfile = await analyze(svc, uid, conversation, aiProfile)
      if (!allCovered(aiProfile)) {
        ;({ out } = await callClaudeJson<{ reply?: string; complete?: boolean; pause?: boolean }>({
          system: INTAKE_REPLY_SYSTEM, maxTokens: 700, messages: asMessages(context(aiProfile), conversation),
        }))
      }
    }

    const reply = (out?.reply || '').trim() || 'Tell me a bit more about that?'
    conversation.push({ role: 'assistant', content: reply })
    const complete = !!out?.complete && allCovered(aiProfile)
    const patch: any = { conversation }
    if (complete) {
      patch.intake_complete = true
      if (p.step === 'intake') patch.step = 'video'
    }
    await saveProfile(svc, uid, patch)

    // Keep the structured profile current without making the member wait for it.
    if (!complete) {
      const db = await detachedClient(svc)
      const snapshot = [...conversation]
      const base = { ...aiProfile }
      if (db) after(async () => { try { await analyze(db, uid, snapshot, base) } catch {} })
    }

    return NextResponse.json({ reply, complete, pause: !!out?.pause, progress: progress() })
  } catch (e) {
    return errorResponse(e)
  }
}
