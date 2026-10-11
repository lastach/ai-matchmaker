/** Server-side crisis screen, run on every member message before it reaches the AI. */

const PATTERNS = {
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
    /\bafraid of (him|her|them)\b/i,
    /restrain.*order/i,
  ],
}

export const CRISIS_REPLY =
  'Thank you for telling me. Your safety comes first, so I am pausing the matchmaking conversation. ' +
  'If you are thinking about harming yourself, call or text 988 (Suicide and Crisis Lifeline). ' +
  'If someone is hurting or threatening you, the National Domestic Violence Hotline is 1-800-799-7233, or text START to 88788. ' +
  'If you are in immediate danger, call 911. You can come back to this whenever you are ready.'

export function crisisFlags(text: string): string[] {
  const flags: string[] = []
  for (const [k, ps] of Object.entries(PATTERNS)) if (ps.some((p) => p.test(text))) flags.push(k)
  return flags
}
