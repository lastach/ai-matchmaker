import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'

/**
 * Returns a 1-sentence contextual acknowledgment of what the user just said
 * during onboarding. The point is to make the conversation feel heard, not
 * interview-like. The ack must reference SOMETHING SPECIFIC from the answer
 * (a phrase, a feeling, a fact) - never "that tells me a lot" generic filler.
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anon'
    const rl = await checkRateLimit('intake-ack:' + ip)
    if (!rl.success) return NextResponse.json({ ack: 'Got it.' })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ack: 'Got it.' })
    const { prompt, answer } = body || {}
    const ans = String(answer || '').trim()
    if (!ans) return NextResponse.json({ ack: 'Got it.' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ ack: 'Got it.' })

    const system = [
      "You're a warm, sharp matchmaker hearing someone's answer in a conversational intake.",
      "Reply with ONE short acknowledgment (1 sentence, max 25 words) that references something SPECIFIC the user actually said.",
      "Hard rules:",
      "1. NEVER use generic filler: no 'that tells me a lot', 'useful', 'got it', 'thanks for sharing', 'paints a picture', 'noted'.",
      "2. NEVER claim to have learned something they didn't say. If they said 'nothing has worked,' do NOT respond as if they listed things to avoid.",
      "3. Reflect back a phrase or a feeling from THEIR answer - show you actually read it.",
      "4. No therapy-speak ('I hear you', 'sounds challenging'). No emojis. No exclamation points.",
      "5. If their answer is short or evasive, acknowledge that honestly: 'Short answer - that's fine, I'll fill in around it.'",
      "Examples:",
      "Q: 'What's been hard about dating?' A: 'nothing has worked. matchmakers, apps, in person - none of it.'",
      "  → 'Yeah, the matchmaker-app-meetup treadmill is its own kind of exhausting. You\\'ve clearly been trying.'",
      "Q: 'What does a good Saturday look like?' A: 'morning run, brunch with my sister, then puttering in the yard.'",
      "  → 'A morning-run-and-puttering kind of Saturday - low-key, not performative.'",
      "Return ONLY the acknowledgment text. No quotes, no preamble.",
    ].join('\n')

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system,
        messages: [{ role: 'user', content: `Question: ${prompt || '(none)'}\n\nTheir answer: ${ans.slice(0, 1500)}` }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return NextResponse.json({ ack: 'Got it.' })
    const d = await r.json()
    let text = (d?.content?.[0]?.text || '').trim()
    text = text.replace(/^["'“‘]+|["'”’]+$/g, '').trim()
    if (!text) return NextResponse.json({ ack: 'Got it.' })
    return NextResponse.json({ ack: text.slice(0, 220) })
  } catch {
    return NextResponse.json({ ack: 'Got it.' })
  }
}
