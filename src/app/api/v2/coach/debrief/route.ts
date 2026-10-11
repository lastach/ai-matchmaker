import { NextResponse } from 'next/server'
import { callClaude, clampNum, parseJsonObject, type ChatMsg } from '@/lib/v2/ai'
import { DEBRIEF_SYSTEM } from '@/lib/v2/prompts'
import { updateWeights, type Components } from '@/lib/v2/engine'
import { errorResponse, loadProfile, requireService, requireUser, saveProfile } from '@/lib/v2/server'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/v2/coach/debrief  body: { matchId, message?, shareContact? }
 * Conversational post-date debrief. When it closes, the outcome reweights this member's
 * matching, and a mutual "yes" to a second date reveals the contact each chose to share.
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const uid = auth.user.id
    const body = await req.json().catch(() => ({} as any))
    const { data: m } = await svc.from('amorlay_matches').select('*').eq('id', body.matchId).maybeSingle()
    if (!m || (m.user_a !== uid && m.user_b !== uid)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const open = m.status === 'completed' || (!!m.date_at && new Date(m.date_at).getTime() < Date.now())
    if (!open) return NextResponse.json({ error: 'The debrief opens after your date.' }, { status: 400 })

    const { data: row } = await svc.from('amorlay_coach').select('*').eq('match_id', m.id).eq('user_id', uid).maybeSingle()
    const debrief: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(row?.debrief) ? [...row.debrief] : []

    if (typeof body.shareContact === 'string') {
      await svc.from('amorlay_coach').upsert({ match_id: m.id, user_id: uid, share_contact: body.shareContact.slice(0, 200), updated_at: new Date().toISOString() }, { onConflict: 'match_id,user_id' })
      return NextResponse.json({ ok: true })
    }
    if (row?.outcome) return NextResponse.json({ reply: debrief[debrief.length - 1]?.content || '', done: true, outcome: row.outcome })

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 3000) : ''
    if (!message && debrief.length > 0) return NextResponse.json({ reply: debrief[debrief.length - 1].content, done: false })
    const rl = await checkRateLimit('v2-debrief:' + uid)
    if (!rl.success) return NextResponse.json({ error: 'Please wait a moment.' }, { status: 429 })
    if (message) debrief.push({ role: 'user', content: message })

    const me = await loadProfile(svc, uid)
    const partnerId = m.user_a === uid ? m.user_b : m.user_a
    const { data: partner } = await svc.from('amorlay_profiles').select('basics').eq('user_id', partnerId).maybeSingle()
    const context = JSON.stringify({
      member: { firstName: me.basics.firstName, mustHaves: me.ai_profile.mustHaves, maximizing: me.ai_profile.maximizing, exPattern: me.ai_profile.exPattern },
      date: { with: partner?.basics?.firstName, venue: m.venue_name, when: m.date_at },
    })
    const msgs: ChatMsg[] = [{ role: 'user', content: `Context for you only (do not recite it): ${context}\n${debrief.length === 0 ? 'Open the debrief warmly with your first question.' : ''}` }]
    for (const d of debrief) {
      const prev = msgs[msgs.length - 1]
      if (prev.role === d.role) prev.content = String(prev.content) + '\n\n' + d.content
      else msgs.push({ role: d.role, content: d.content })
    }
    if (msgs[msgs.length - 1].role === 'assistant') msgs.push({ role: 'user', content: '(continue)' })

    const raw = await callClaude({ system: DEBRIEF_SYSTEM, maxTokens: 900, messages: msgs })
    const out = parseJsonObject<any>(raw) || {}
    const reply = String(out.reply || 'How did it go?')
    debrief.push({ role: 'assistant', content: reply })

    let outcome: any = null
    if (out.done && out.outcome) {
      outcome = {
        overall: clampNum(out.outcome.overall, 1, 5, 3),
        feltUnderstood: clampNum(out.outcome.feltUnderstood, 1, 5, 3),
        flow: clampNum(out.outcome.flow, 1, 5, 3),
        secondDate: !!out.outcome.secondDate,
        redFlags: out.outcome.redFlags ? String(out.outcome.redFlags).slice(0, 500) : null,
        patternNote: out.outcome.patternNote ? String(out.outcome.patternNote).slice(0, 500) : null,
        at: new Date().toISOString(),
      }
      // Learning: reweight this member's matching from how the date went.
      const comps = (m.user_a === uid ? m.breakdown?.aComps : m.breakdown?.bComps) as Components | undefined
      if (comps) await saveProfile(svc, uid, { weights: updateWeights(me.weights, comps, outcome.overall) })
    }
    await svc.from('amorlay_coach').upsert(
      { match_id: m.id, user_id: uid, debrief, ...(outcome ? { outcome } : {}), updated_at: new Date().toISOString() },
      { onConflict: 'match_id,user_id' }
    )
    return NextResponse.json({ reply, done: !!outcome, outcome })
  } catch (e) {
    return errorResponse(e)
  }
}
