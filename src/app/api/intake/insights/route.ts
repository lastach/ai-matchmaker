import { NextResponse } from 'next/server'
import { checkRateLimit, checkWeeklyInsightsLimit, cacheInsights, getCachedInsights } from '@/lib/rateLimit'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const supa = createServerClient(
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
    const { data } = await supa.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anon'
    const rl = await checkRateLimit('intake-insights:' + ip)
    if (!rl.success) return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const { profileData, coreIntakeData } = body
    if (!profileData || !coreIntakeData) {
      return NextResponse.json({ error: 'Missing intake data' }, { status: 400 })
    }

    // Per-user weekly cap: 5 regenerations per 7-day rolling window. On hit,
    // serve the cached last-good response so the user always sees SOMETHING.
    const userId = await getUserId()
    const cacheKey = userId ? `insights-cache:amorlay-intake:${userId}` : null
    if (userId) {
      const cap = await checkWeeklyInsightsLimit('amorlay-intake-insights:' + userId)
      if (!cap.success) {
        const cached = await getCachedInsights<{ insights: string[] }>(cacheKey!)
        if (cached?.insights?.length) {
          return NextResponse.json({ insights: cached.insights, cached: true, retryAfterDays: Math.ceil(cap.retryAfter / 86400) })
        }
        return NextResponse.json({ error: 'You have reached the weekly limit on regenerating insights. Try again in a few days.', retryAfterDays: Math.ceil(cap.retryAfter / 86400) }, { status: 429 })
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Service not configured' }, { status: 503 })

    const intakeBlob = JSON.stringify({
      name: profileData.name,
      ownStanceOnKids: profileData.ownWantChildren,
      bio: profileData.bio,
      idealFuture: coreIntakeData.q6Response,
      conflictStyle: coreIntakeData.q7Response,
      idealSaturday: coreIntakeData.q8Response,
      pastRelationshipLesson: coreIntakeData.q9Response,
      whatSuccessLooksLike: coreIntakeData.q10Response,
      lookingFor: {
        wantChildren: coreIntakeData.wantChildren,
        location: coreIntakeData.location,
        attractionImportance: coreIntakeData.attractionImportance,
        dealbreakers: coreIntakeData.dealbreakersOther,
      },
    }, null, 2)

    const systemPrompt = [
      "You are a thoughtful matchmaker reading someone's intake answers.",
      "Surface 3-5 specific, non-obvious insights about who they are and what they're looking for - observations they would nod at because no one else has named them before.",
      "AVOID restating what they said. AVOID generic compatibility advice or therapy-speak.",
      "AIM FOR: patterns across answers (e.g. 'three different answers came back to wanting Sundays that don't look like vacation Instagram'), tensions worth naming (e.g. 'you want someone who pushes you AND someone who's secure when you're prickly'), and concrete implications for matching (e.g. 'pair you with someone whose success is about people, not titles').",
      "Return ONLY a JSON object: { \"insights\": [\"string\", \"string\", ...] } where each insight is 1-3 sentences in second person. 3-5 insights total. No preamble, no explanation outside the JSON.",
    ].join(' ')

    const userPrompt = `Their intake answers:\n\n${intakeBlob}\n\nGive me 3-5 specific insights as JSON.`

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!r.ok) return NextResponse.json({ error: 'Insights service is busy. Try again shortly.' }, { status: 503 })

    const d = await r.json()
    let text = (d?.content?.[0]?.text || '{}').trim()
    const fence = String.fromCharCode(96, 96, 96)
    if (text.startsWith(fence)) {
      text = text.slice(fence.length)
      if (text.toLowerCase().startsWith('json')) text = text.slice(4)
      text = text.trim()
      const endIdx = text.lastIndexOf(fence)
      if (endIdx !== -1) text = text.slice(0, endIdx).trim()
    }
    const m = text.match(/\{[\s\S]*\}/)
    if (m) text = m[0]

    let parsed: { insights: string[] }
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ insights: [] })
    }
    const insights = Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : []
    if (cacheKey && insights.length > 0) {
      await cacheInsights(cacheKey, { insights })
    }
    return NextResponse.json({ insights })
  } catch {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
