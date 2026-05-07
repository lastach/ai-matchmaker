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
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
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

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        temperature: 0.55,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })
    if (!r.ok) {
      const errText = await r.text()
      const friendly = /quota|insufficient|billing|rate_limit/i.test(errText) ? 'AI service usage limit reached. Please try again later.' : 'AI service temporarily unavailable. Please try again.'
      return NextResponse.json({ error: friendly }, { status: 502 })
    }
    const data = await r.json()
    let text = (data?.content?.[0]?.text || '').trim()
    const fence = String.fromCharCode(96, 96, 96)
    if (text.startsWith(fence)) {
      text = text.slice(fence.length)
      if (text.toLowerCase().startsWith('json')) text = text.slice(4)
      text = text.trim()
      const endIdx = text.lastIndexOf(fence)
      if (endIdx !== -1) text = text.slice(0, endIdx).trim()
    }
    const memo = text
    return NextResponse.json({ memo })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}
