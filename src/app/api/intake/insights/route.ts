import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
    try {

          const body = await req.json().catch(() => null)
          if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

          const { profileData, coreIntakeData } = body
          if (!profileData || !coreIntakeData) {
                  return NextResponse.json({ error: 'Missing intake data' }, { status: 400 })
                }

          const apiKey = process.env.ANTHROPIC_API_KEY
          if (!apiKey) {
                  return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
                }

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
                            dealbreakers: coreIntakeData.dealbreakersOther
                          }
                }, null, 2)

          const systemPrompt = 'You are a thoughtful matchmaker reading someone\'s intake answers. Surface 3-5 specific, non-obvious insights about who they are and what they\'re looking for — observations they would nod at because no one else has named them before. AVOID restating what they said, generic compatibility advice, or therapy-speak. AIM FOR patterns across answers, tensions worth naming, and concrete implications for matching. Return ONLY a JSON object: { "insights": ["string", "string", ...] } where each insight is 1-3 sentences in second person. 3-5 insights total.'

          const userPrompt = 'Their intake answers:\n\n' + intakeBlob + '\n\nGive me 3-5 specific insights as JSON.'

          const r = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                            'x-api-key': apiKey,
                            'anthropic-version': '2023-06-01',
                            'content-type': 'application/json'
                          },
                  body: JSON.stringify({
                            model: 'claude-haiku-4-5-20251001',
                            max_tokens: 1500,
                            system: systemPrompt,
                            messages: [{ role: 'user', content: userPrompt }]
                          })
                })

          if (!r.ok) {
                  return NextResponse.json({ error: 'Insights service is busy. Try again shortly.' }, { status: 503 })
                }

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

          return NextResponse.json({ insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [] })
        } catch (e) {
          return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
        }
  }
