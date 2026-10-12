import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/isAdmin'
import { callClaudeJson } from '@/lib/v2/ai'
import { DEBRIEF_SYSTEM, INTAKE_REPLY_SYSTEM, INTAKE_ANALYZE_SYSTEM, PREP_SYSTEM, VIDEO_SYSTEM } from '@/lib/v2/prompts'
import { evaluatePair } from '@/lib/v2/pairEval'
import { requireUser } from '@/lib/v2/server'
import type { ProfileRow } from '@/lib/v2/types'

export const runtime = 'nodejs'
export const maxDuration = 120

// Small synthetic face sketch (not a real person) for the video check.
const TEST_FRAME = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAB4AKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDp6KKK4zuCiiigAooooAKKKKACiinBGYZCk/QUANopxRwMlSB7im0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABTkQu21RzSAEkAdTV2KMRpgde5pMENSBEHI3H1NS0UUigqN4UcHjB9RUlFAFGSMxtg9Ox9aZV90DrtYcVSZSjFT1FNMlobRRRTAKKKKACiiigAooooAKKKKACiiigCe1XLlvQVaqK2GIc+pzUtSxoKK8c8V/wBr/wDCYz+f9o+0ed/om3rs3fu9mP6c5z3zXren/av7Ntftv/H15Ked0+/gbunHXPTiqlGyTFGV3YsUUV4p/wAVD/wlf/Lx/bXne27dj8tuP+A7faiMeYJS5T2uq90vCv8AhVimTDdCw9s1JRRoooqiQooooAKKKKACiiigAooooAKKKKALtv8A6lfx/nUlQWrZQr6Gp6koKKKKACiiigApsn+qb/dNOqK4bbCffigCnRRRVEhRRRQAUUUUAFFFFABRRRQAUUUUASQPskBPQ8GrtZ1WYJsgI3XsaTGjG1qw1S11Q65pJSZ1g8uW3kyxYZz8o/XAxyO+SKLbxtpT7kvBNZTR4DpLGThu4GMng+oFdDUFzZWl5t+1WsM+zO3zYw2M9cZ+lI05k9GY1x430OGMNHNLcEnG2OIgj3+bAqLToda1jVINU1BfsNtBvEdspZXYEj73Q4yB14O37uDW7b6dY2khktrO3gcjBaOJVJHpkCrFAcyWyCqly+59o/hqWabyxtX738qqU0ZsKKKKYgooooAKKKKACiiigAooooAKKKKACiiigCZLllGGG4e55qYXMZHJI+oqnRSsFy4biIDrn2AqJ7ksCFGPfvUFFFguBOTk0UUUwCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/9k='

const personA: ProfileRow = {
  user_id: '00000000-0000-0000-0000-00000000000a', step: 'ready', city_key: 'boston', conversation: [], video: { warmth: 8, energy: 6, expressiveness: 7, at: 'test' },
  clip_path: null, share_clip: false, intake_complete: true, weights: { mustHaves: 30, values: 25, attraction: 20, goodPartner: 15, energy: 10 },
  basics: { firstName: 'Test A', birthDate: '1985-03-01', city: 'Boston, MA', gender: 'woman', interestedIn: ['men'], ageMin: 36, ageMax: 48 },
  ai_profile: {
    about: 'Founder who dances ballroom and travels a lot.', readiness: { level: 9, ready: true }, kids: { stance: 'maybe', flexible: true },
    idealPerson: 'Kind, direct, curious, has his own big project.', mustHaves: [{ item: 'kind and direct', goodEnough: 'says hard things kindly', flexible: false, rank: 1 }, { item: 'active', goodEnough: 'moves a few times a week', flexible: true, rank: 2 }],
    dealbreakers: [{ item: 'smoking', source: 'stated' }], values: [{ value: 'honesty', importance: 5, dealLevel: true }, { value: 'adventure', importance: 4 }],
    exPattern: { traits: 'charming, avoids conflict', problems: 'went silent instead of talking things through' }, interests: ['ballroom', 'travel', 'building companies'],
  },
}
const personB: ProfileRow = {
  ...personA, user_id: '00000000-0000-0000-0000-00000000000b', video: { warmth: 7, energy: 5, expressiveness: 6, at: 'test' },
  basics: { firstName: 'Test B', birthDate: '1983-07-01', city: 'Boston, MA', gender: 'man', interestedIn: ['women'], ageMin: 34, ageMax: 46 },
  ai_profile: {
    about: 'Architect who restores sailboats and hikes most weekends.', readiness: { level: 8, ready: true }, kids: { stance: 'maybe', flexible: true },
    idealPerson: 'Ambitious, warm, someone who tells me what she thinks.', mustHaves: [{ item: 'ambitious', goodEnough: 'has something she is building', flexible: false, rank: 1 }],
    dealbreakers: [{ item: 'dishonesty', source: 'past-relationships' }], values: [{ value: 'honesty', importance: 5, dealLevel: true }, { value: 'craft', importance: 4 }],
    exPattern: { traits: 'very social, always busy', problems: 'never made time' }, interests: ['sailing', 'hiking', 'design'],
  },
}

async function check(name: string, fn: () => Promise<{ ok: boolean; detail: unknown }>) {
  const t = Date.now()
  try {
    const r = await fn()
    return { name, ok: r.ok, ms: Date.now() - t, detail: r.detail }
  } catch (e) {
    return { name, ok: false, ms: Date.now() - t, detail: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * GET /api/v2/admin/selftest  (admin only)
 * Runs every AI step on synthetic test data and checks configuration. Writes nothing.
 */
export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  if (!(await isAdmin(auth.user.email, auth.session))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const results = await Promise.all([
    check('config', async () => {
      const svc = auth.session
      const env = { anthropicKey: !!process.env.ANTHROPIC_API_KEY }
      const checks: Record<string, string> = {}
      const t1 = await svc.from('amorlay_profiles').select('user_id', { count: 'exact', head: true })
      checks.profiles = t1.error ? t1.error.message : 'ok'
      const t2 = await svc.rpc('amorlay_cohort_count')
      checks.cohortFunction = t2.error ? t2.error.message : 'ok'
      const t3 = await svc.rpc('amorlay_my_matches')
      checks.matchesFunction = t3.error ? t3.error.message : 'ok'
      const t4 = await svc.storage.from('matchmaker-photos').list(auth.user.id, { limit: 1 })
      checks.photoStorage = t4.error ? t4.error.message : 'ok'
      const ok = env.anthropicKey && Object.values(checks).every((v) => v === 'ok')
      return { ok, detail: { ...env, ...checks } }
    }),
    check('intake', async () => {
      const { out, raw } = await callClaudeJson<any>({
        system: INTAKE_REPLY_SYSTEM, maxTokens: 700,
        messages: [
          { role: 'user', content: 'Member\'s first name: Sam. City: Boston, MA.\nWhat you know so far (carry it forward): {}' },
          { role: 'assistant', content: 'Hi Sam. What does your life look like right now?' },
          { role: 'user', content: 'I teach high school chemistry, run on weekends, and just moved back to Boston after a breakup a year ago. I feel ready to meet someone serious now.' },
        ],
      })
      return { ok: !!out?.reply, detail: out ? { reply: out.reply } : { unparsed: raw.slice(0, 1500) } }
    }),
    check('intakeAnalysis', async () => {
      const { out, raw } = await callClaudeJson<any>({
        system: INTAKE_ANALYZE_SYSTEM, maxTokens: 3000,
        messages: [{ role: 'user', content: 'Profile so far:\n{}\n\nConversation:\nMatchmaker: Hi Sam. To start, what does your life look like right now?\n\nMember: I teach high school chemistry, run on weekends, and just moved back to Boston after a breakup a year ago. I feel ready to meet someone serious now.' }],
      })
      return { ok: !!out?.coverage && !!out?.readiness, detail: out ? { readiness: out.readiness, coverage: out.coverage } : { unparsed: raw.slice(0, 1500) } }
    }),
    check('video', async () => {
      const { out, raw } = await callClaudeJson<any>({
        system: VIDEO_SYSTEM, maxTokens: 600,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: TEST_FRAME } },
          { type: 'text', text: 'Transcript:\nQ: What do your friends come to you for?\nA: Honestly, advice on hard conversations, and a good hike recommendation. I love helping people think things through.' },
        ] }],
      })
      return { ok: typeof out?.warmth === 'number' && typeof out?.energy === 'number', detail: out ?? { unparsed: raw.slice(0, 1500) } }
    }),
    check('pairEvaluation', async () => {
      const ev = await evaluatePair(personA, personB)
      return { ok: ev.aMustHaves.length > 0 && typeof ev.valuesAlignment === 'number' && !!ev.dateIdea, detail: ev }
    }),
    check('coachPrep', async () => {
      const { out, raw } = await callClaudeJson<any>({ system: PREP_SYSTEM, maxTokens: 900, messages: [{ role: 'user', content: JSON.stringify({
        you: { firstName: 'Test A', about: personA.ai_profile.about, interests: personA.ai_profile.interests, values: ['honesty', 'adventure'], feelUnderstood: 'when someone asks follow-up questions' },
        yourDate: { firstName: 'Test B', about: personB.ai_profile.about, interests: personB.ai_profile.interests, values: ['honesty', 'craft'], feelUnderstood: 'when someone is curious about why he builds things' },
        whyMatched: 'Both value honesty and are building something of their own.', date: { idea: 'pottery night', venue: 'Mudflat', when: '2026-10-23T23:00:00Z' },
      }) }] })
      return { ok: !!out?.why && Array.isArray(out?.questions) && out.questions.length > 0, detail: out ?? { unparsed: raw.slice(0, 1500) } }
    }),
    check('debrief', async () => {
      const { out, raw } = await callClaudeJson<any>({ system: DEBRIEF_SYSTEM, maxTokens: 900, messages: [
        { role: 'user', content: 'Context for you only (do not recite it): {"member":{"firstName":"Test A","mustHaves":[{"item":"kind and direct","flexible":false}],"maximizing":8}}' },
        { role: 'assistant', content: 'Welcome back. How did it go overall?' },
        { role: 'user', content: 'Pretty good. He was kind and direct and we laughed a lot. Conversation flowed easily.' },
        { role: 'assistant', content: 'Did you feel understood?' },
        { role: 'user', content: 'Yes, he asked great follow-up questions. Nothing felt off. I guess I would see him again, though he is a little shorter than I pictured.' },
      ] })
      return { ok: !!out?.reply, detail: out ?? { unparsed: raw.slice(0, 1500) } }
    }),
  ])
  return NextResponse.json({ allPassed: results.every((r) => r.ok), results })
}
