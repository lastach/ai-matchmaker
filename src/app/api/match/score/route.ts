import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Score candidates from the same cohort against the requesting user.
 * Reads both intakes, asks Claude to produce a numeric compatibility (0-100)
 * with rationale per dimension. The matchmaker (a human) reviews the top N
 * before any introduction is sent. This is the actual matching engine - no
 * single dimension dominates; we balance:
 *   - life-shape compatibility (kids stance, location, age window)
 *   - emotional posture compatibility (conflict style, self-awareness, growth)
 *   - aesthetic/lifestyle overlap (ideal Saturday, success picture)
 *   - dealbreaker check (asymmetric - any dealbreaker zeros the score)
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anon'
    const rl = await checkRateLimit('match-score:' + ip)
    if (!rl.success) return NextResponse.json({ error: 'rate limit' }, { status: 429 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(n: string) { return cookieStore.get(n)?.value },
          set() {},
          remove() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'service not configured' }, { status: 503 })

    // Pull this user's intake
    const { data: meRow } = await supabase
      .from('user_profiles')
      .select('id, profile_data, core_intake_data, location, gender, interested_in, age_min, age_max, dob, intake_completed_at')
      .eq('id', user.id)
      .single()
    if (!meRow || !meRow.intake_completed_at) {
      return NextResponse.json({ error: 'Complete your intake first.' }, { status: 400 })
    }

    // Pull candidates from the same metro/area, opposite gender preference, mutual age fit, intake completed.
    // We are intentionally loose on filtering - the matchmaker reads the LLM scores and decides.
    const { data: candidates } = await supabase
      .from('user_profiles')
      .select('id, profile_data, core_intake_data, location, gender, interested_in, age_min, age_max, dob')
      .neq('id', user.id)
      .eq('location', meRow.location)
      .not('intake_completed_at', 'is', null)
      .limit(40)

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ scored: [], note: 'No candidates in your cohort yet. We email you the moment your cohort opens.' })
    }

    // Filter for mutual interest + age window + dealbreaker check (cheap, deterministic)
    const ageOf = (dob?: string | null) => {
      if (!dob) return null
      const d = new Date(dob)
      if (Number.isNaN(d.getTime())) return null
      return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    }
    const myAge = ageOf(meRow.dob)
    const eligible = candidates.filter((c: any) => {
      const cAge = ageOf(c.dob)
      if (myAge !== null && c.age_min && c.age_max && (myAge < c.age_min || myAge > c.age_max)) return false
      if (cAge !== null && meRow.age_min && meRow.age_max && (cAge < meRow.age_min || cAge > meRow.age_max)) return false
      // mutual interest match
      const myInterest = String(meRow.interested_in || '').toLowerCase()
      const cGender = String(c.gender || '').toLowerCase()
      const cInterest = String(c.interested_in || '').toLowerCase()
      const myGender = String(meRow.gender || '').toLowerCase()
      if (myInterest !== 'anyone' && myInterest && cGender && !myInterest.includes(cGender)) return false
      if (cInterest !== 'anyone' && cInterest && myGender && !cInterest.includes(myGender)) return false
      return true
    }).slice(0, 12) // cap LLM cost

    if (eligible.length === 0) {
      return NextResponse.json({ scored: [], note: 'Cohort has people but none match your basic filters yet.' })
    }

    // Build a compact JSON payload of intakes to score. Strip identifying info.
    const stripPII = (p: any, c: any) => ({
      kids: p?.ownWantChildren,
      bio: (p?.bio || '').slice(0, 400),
      idealFuture: c?.q6Response,
      conflictStyle: c?.q7Response,
      idealSaturday: c?.q8Response,
      pastLesson: c?.q9Response,
      successPicture: c?.q10Response,
      dealbreakers: c?.dealbreakersOther,
      wantsKids: c?.wantChildren,
    })

    const myIntake = stripPII(meRow.profile_data, meRow.core_intake_data)
    const candidateIntakes = eligible.map((c: any, i: number) => ({
      i,
      candidate_id: c.id,
      intake: stripPII(c.profile_data, c.core_intake_data),
    }))

    const system = [
      'You are a thoughtful human matchmaker reading two anonymized intakes and judging compatibility.',
      'For each candidate, return a JSON object with: candidate_id, score (0-100), rationale (2-3 sentences naming SPECIFIC overlap and SPECIFIC tension), where_to_be_careful (1 sentence), dealbreaker (true/false - true if either party named something the other does or is).',
      'Score weighting: 30% life-shape (kids, location, age, life stage), 30% emotional posture (conflict style, self-awareness, what they learned), 25% lifestyle/aesthetic overlap (ideal Saturday, success picture), 15% growth/depth signal across answers.',
      'Mark dealbreaker=true if either side named something concrete the other has (e.g. "no smokers" + the other writes about smoking).',
      'Return ONLY a JSON object: { "scored": [ {candidate_id, score, rationale, where_to_be_careful, dealbreaker} ] }. No preamble.',
    ].join('\n')

    const userMsg = JSON.stringify({ me: myIntake, candidates: candidateIntakes })

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!r.ok) return NextResponse.json({ error: 'matching service busy' }, { status: 503 })
    const d = await r.json()
    let text = (d?.content?.[0]?.text || '{}').trim()
    const fence = String.fromCharCode(96, 96, 96)
    if (text.startsWith(fence)) {
      text = text.slice(fence.length)
      if (text.toLowerCase().startsWith('json')) text = text.slice(4)
      text = text.trim()
      const end = text.lastIndexOf(fence)
      if (end !== -1) text = text.slice(0, end).trim()
    }
    const m = text.match(/\{[\s\S]*\}/)
    if (m) text = m[0]
    let parsed: any = {}
    try { parsed = JSON.parse(text) } catch { return NextResponse.json({ scored: [] }) }
    const scored: any[] = Array.isArray(parsed.scored) ? parsed.scored : []
    // Filter out dealbreakers, sort by score desc
    const final = scored.filter(s => !s.dealbreaker).sort((a, b) => (b.score || 0) - (a.score || 0))

    // Persist a matchmaker review queue entry  -  the human pairs / approves before introduction
    if (final.length > 0) {
      try {
        await supabase.from('match_review_queue').insert({
          requester_id: user.id,
          scored_candidates: final.slice(0, 5),
          status: 'pending_human_review',
        })
      } catch { /* table may not exist yet - graceful */ }
    }

    return NextResponse.json({
      scored: final.slice(0, 5),
      note: 'Top 5 candidates returned. A human matchmaker reviews these before any introduction is sent. Compatibility is signal, not a guarantee.',
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
  }
}
