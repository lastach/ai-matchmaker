import { NextResponse } from 'next/server'
import { callClaude, parseJsonObject } from '@/lib/v2/ai'
import { PREP_SYSTEM } from '@/lib/v2/prompts'
import { errorResponse, requireService, requireUser } from '@/lib/v2/server'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

/** GET ?matchId=  The pre-date brief from the AI coach (generated once, then cached). */
export async function GET(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const matchId = new URL(req.url).searchParams.get('matchId')
    const uid = auth.user.id
    const { data: m } = await svc.from('amorlay_matches').select('*').eq('id', matchId).maybeSingle()
    if (!m || (m.user_a !== uid && m.user_b !== uid)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (!['scheduled', 'confirmed', 'completed'].includes(m.status)) return NextResponse.json({ error: 'No date set yet.' }, { status: 400 })

    const { data: existing } = await svc.from('amorlay_coach').select('prep').eq('match_id', m.id).eq('user_id', uid).maybeSingle()
    if (existing?.prep) return NextResponse.json({ prep: existing.prep })

    const rl = await checkRateLimit('v2-prep:' + uid)
    if (!rl.success) return NextResponse.json({ error: 'Please wait a moment.' }, { status: 429 })

    const partnerId = m.user_a === uid ? m.user_b : m.user_a
    const { data: rows } = await svc.from('amorlay_profiles').select('user_id, basics, ai_profile').in('user_id', [uid, partnerId])
    const me = rows?.find((r) => r.user_id === uid)
    const them = rows?.find((r) => r.user_id === partnerId)
    // Only what the date coach is allowed to share: no past relationships, attachment or personality scores.
    const safe = (r: any) => ({
      firstName: r?.basics?.firstName,
      about: r?.ai_profile?.about,
      interests: r?.ai_profile?.interests,
      values: (r?.ai_profile?.values || []).map((v: any) => v.value),
      feelUnderstood: r?.ai_profile?.feelUnderstood,
    })
    const input = {
      you: safe(me),
      yourDate: safe(them),
      whyMatched: m.breakdown?.why || '',
      date: { idea: m.date_idea, venue: m.venue_name, when: m.date_at },
    }
    const raw = await callClaude({ system: PREP_SYSTEM, maxTokens: 900, messages: [{ role: 'user', content: JSON.stringify(input) }] })
    const out = parseJsonObject<any>(raw) || {}
    const prep = {
      why: String(out.why || m.breakdown?.why || ''),
      feelUnderstood: String(out.feelUnderstood || ''),
      questions: Array.isArray(out.questions) ? out.questions.slice(0, 3).map(String) : [],
      reminders: Array.isArray(out.reminders) && out.reminders.length
        ? out.reminders.slice(0, 4).map(String)
        : ['Ask follow-up questions on what they just said instead of switching topics', 'Go past small talk early', 'Reflect back what you heard before adding your own story'],
      note: String(out.note || ''),
    }
    await svc.from('amorlay_coach').upsert({ match_id: m.id, user_id: uid, prep, updated_at: new Date().toISOString() }, { onConflict: 'match_id,user_id' })
    return NextResponse.json({ prep })
  } catch (e) {
    return errorResponse(e)
  }
}
