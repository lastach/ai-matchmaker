import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const TRIGGERS = {
  selfHarm: [
    /\bkill myself\b/i,
    /\bend my life\b/i,
    /\bsuicid/i,
    /\bself[-\s]?harm/i,
    /\bcut myself\b/i,
    /\boverdose/i,
    /don'?t want to (be alive|live anymore|exist)/i,
    /\bbetter off dead\b/i,
  ],
  domesticViolence: [
    /\b(my|ex)?\s*(boyfriend|girlfriend|spouse|husband|wife|partner)\b.*\b(hits?|hit me|abus|threat)/i,
    /\b(forced|made|coerc)/i,
    /\bafraid of (him|her|them)\b/i,
    /restrain.*order/i,
  ],
  vulnerable: [
    /\bjust got out of (rehab|treatment|the hospital|psych)/i,
    /\brecently (lost|widow|miscarr)/i,
    /\bgrieving\b/i,
  ],
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const text = String(body.text || '')

  const flags: string[] = []
  for (const [key, patterns] of Object.entries(TRIGGERS)) {
    if (patterns.some(p => p.test(text))) flags.push(key)
  }

  if (flags.length === 0) return NextResponse.json({ flagged: false })

  return NextResponse.json({
    flagged: true,
    flags,
    resources: [
      { label: '988 Suicide and Crisis Lifeline', detail: 'Call or text 988', url: 'https://988lifeline.org' },
      { label: 'National Domestic Violence Hotline', detail: '1-800-799-7233', url: 'https://www.thehotline.org' },
      { label: 'Crisis Text Line', detail: 'Text HOME to 741741', url: 'https://www.crisistextline.org' },
    ],
    pause_intake: flags.includes('selfHarm') || flags.includes('domesticViolence'),
    note: 'We pause intake when the system detects a crisis disclosure. Your safety matters more than the matchmaking flow.',
  })
}
