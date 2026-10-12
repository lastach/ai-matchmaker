import { callClaudeJson, clampNum, MODEL_FAST } from './ai'
import { PAIR_SYSTEM } from './prompts'
import type { PairEval, ProfileRow } from './types'
import { ageFrom } from './server'

/** What the evaluator sees about one person. No names, emails, photos or exact birth dates. */
function view(r: ProfileRow) {
  const a = r.ai_profile || {}
  return {
    age: ageFrom(r.basics?.birthDate),
    city: r.basics?.city,
    about: a.about,
    relationshipGoals: a.relationshipGoals,
    kids: a.kids,
    idealPerson: a.idealPerson,
    idealRelationship: a.idealRelationship,
    mustHaves: a.mustHaves,
    dealbreakers: a.dealbreakers,
    values: a.values,
    exPattern: a.exPattern,
    personality: a.personality,
    interests: a.interests,
    videoImpression: r.video?.at ? { warmth: r.video.warmth, energy: r.video.energy, expressiveness: r.video.expressiveness } : null,
  }
}

/** Stable fingerprint of what the evaluation depends on, so cached evaluations are reused. */
export function versionKey(a: ProfileRow, b: ProfileRow): string {
  const s = JSON.stringify([view(a), view(b)])
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

function cleanMust(xs: any, fallback: ProfileRow): PairEval['aMustHaves'] {
  const own = fallback.ai_profile?.mustHaves || []
  if (!Array.isArray(xs)) return own.map((m) => ({ item: m.item, met: 0.5, flexible: !!m.flexible }))
  return xs.slice(0, 12).map((m: any) => {
    const raw = Number(m?.met)
    const met = raw >= 0.75 ? 1 : raw >= 0.25 ? 0.5 : 0
    const ownMatch = own.find((o) => o.item === m?.item)
    return { item: String(m?.item || '').slice(0, 200), met, flexible: ownMatch ? !!ownMatch.flexible : !!m?.flexible }
  })
}

const str = (v: any) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim().slice(0, 300) : null)

export function sanitizeEval(out: any, a: ProfileRow, b: ProfileRow): PairEval {
  return {
    aMustHaves: cleanMust(out?.aMustHaves, a),
    bMustHaves: cleanMust(out?.bMustHaves, b),
    aDealbreakerHit: str(out?.aDealbreakerHit),
    bDealbreakerHit: str(out?.bDealbreakerHit),
    valuesAlignment: clampNum(out?.valuesAlignment, 0, 1, 0.5),
    dealLevelValueConflict: str(out?.dealLevelValueConflict),
    aRepeatType: clampNum(out?.aRepeatType, 0, 1, 0),
    bRepeatType: clampNum(out?.bRepeatType, 0, 1, 0),
    why: str(out?.why) || '',
    dateIdea: str(out?.dateIdea) || '',
  }
}

/** Evaluate one pair with the AI. `a` must be the person whose id sorts first. */
export async function evaluatePair(a: ProfileRow, b: ProfileRow): Promise<PairEval> {
  const { out } = await callClaudeJson({
    system: PAIR_SYSTEM,
    model: MODEL_FAST,
    maxTokens: 1500,
    messages: [{ role: 'user', content: `Person A:\n${JSON.stringify(view(a))}\n\nPerson B:\n${JSON.stringify(view(b))}` }],
  })
  return sanitizeEval(out, a, b)
}
