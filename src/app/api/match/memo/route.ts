import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * POST /api/match/memo
 * Body: { user: MatchProfile, candidate: MatchProfile, breakdown: {...}, score: number, notes: string[] }
 * Returns: { memo: string }
 *
 * Generates a short paragraph for the user explaining why this match was picked, what's likely
 * to land in conversation, what's likely to surprise them. Anchored ONLY to facts in the inputs;
 * no fabrication.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 requests / minute per IP. AI memo is expensive.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anon'
    const rl = await checkRateLimit('memo:' + ip)
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter || 60) } })
    }
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }
    const body = await request.json()
    const { user, candidate, breakdown, score, notes } = body || {}
    if (!user || !candidate) {
      return NextResponse.json({ error: 'Missing user or candidate' }, { status: 400 })
    }

    const system = `You write short, sober match memos for an AI-curated matchmaking service called Amorlay. The reader paid for intentional matchmaking and wants a thoughtful read-out, not marketing copy. Constraints:
- 3 short paragraphs, max ~150 words total.
- First paragraph: why this match was picked, anchored to the strongest dimensions in the breakdown.
- Second paragraph: a specific conversation thread that's likely to land, derived from their shared values, life goals, or attachment style.
- Third paragraph: one honest caveat — what to watch for, where the data is thin, or one dimension that's lower-scoring.
- No emojis, no exclamation marks, no platitudes. No "you two will be amazing together" type filler.
- Use the candidate's first name only.
- Never invent facts not in the inputs.`

    const userMsg = JSON.stringify({
      user: { name: user.name, age: user.age, attachmentStyle: user.attachmentStyle, lifeGoals: user.lifeGoals, valueRatings: user.valueRatings, relationshipPriority: user.relationshipPriority },
      candidate: { name: candidate.name, age: candidate.age, attachmentStyle: candidate.attachmentStyle, lifeGoals: candidate.lifeGoals, valueRatings: candidate.valueRatings, relationshipPriority: candidate.relationshipPriority },
      breakdown,
      score,
      notes: notes || [],
    })

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.55,
        max_tokens: 320,
      }),
    })
    if (!r.ok) {
      const errText = await r.text()
      return NextResponse.json({ error: 'OpenAI: ' + errText.slice(0, 200) }, { status: 502 })
    }
    const data = await r.json()
    const memo = data?.choices?.[0]?.message?.content?.trim() || ''
    return NextResponse.json({ memo })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}
