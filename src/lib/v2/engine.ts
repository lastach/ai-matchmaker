/**
 * Amorlay v2 matching engine (pure functions, no I/O).
 *
 * 0. Eligibility: decided right after the conversation. Only members ready for a relationship, with a
 *    partnership readiness score of at least ELIGIBLE_SCORE, go on to the video, photos and type steps
 *    and count toward their city.
 * 1. Gates (pass/fail, checked both ways): interest, age range, background preference, city, kids, dealbreakers,
 *    deal-level values, inflexible must-haves, predicted attraction bar.
 * 2. Match score out of 100, from each person's own learned weights (defaults: must-haves 25,
 *    values 25, partner fit 20, energy 15, attraction 15). Every component is about this
 *    specific pair. The pair score is the average of the two directional scores.
 * 3. Flags: a candidate who resembles the type behind someone's past problems.
 * 4. Pairing: best mutual pairs across the city, one per person per cycle.
 * 5. Learning: each debrief nudges that person's weights.
 */
import { fitsEthnicityPref } from './ethnicity'
import { learnType, predictAttraction, type TypeModel } from './typeLibrary'
import { DEFAULT_WEIGHTS, type AiProfile, type AttractionData, type Basics, type PairEval, type VideoAssessment, type Weights } from './types'

export interface Member {
  id: string
  basics: Basics
  age: number | null
  cityKey: string | null
  ai: AiProfile
  video: VideoAssessment
  weights: Weights
  attraction?: AttractionData
  type?: TypeModel | null // learned from attraction ratings; filled in by withType()
}

export type Component = keyof Weights
export const COMPONENTS: Component[] = ['mustHaves', 'values', 'partnerFit', 'energy', 'attraction']

export const READY_LEVEL = 6
export const ELIGIBLE_SCORE = 60
export const REPEAT_TYPE_FLAG = 0.6

/** Learn each member's type once, before pairing. */
export function withType(m: Member): Member {
  return { ...m, type: m.type !== undefined ? m.type : learnType(m.attraction) }
}

// ---------- helpers ----------

const GENDER_TO_INTEREST: Record<string, string> = { woman: 'women', man: 'men', nonbinary: 'nonbinary' }

export function interestedIn(a: Member, b: Member): boolean {
  const wants = (a.basics.interestedIn || []).map((s) => String(s).toLowerCase())
  if (wants.includes('anyone')) return true
  const g = GENDER_TO_INTEREST[String(b.basics.gender || '').toLowerCase()]
  return !!g && wants.includes(g)
}

export function ageFits(a: Member, b: Member): boolean {
  if (b.age == null) return false
  const lo = a.basics.ageMin ?? 18
  const hi = a.basics.ageMax ?? 99
  return b.age >= lo && b.age <= hi
}

export function isReady(m: Member): boolean {
  const r = m.ai.readiness
  if (!r) return false
  if (r.ready === false) return false
  return typeof r.level === 'number' ? r.level >= READY_LEVEL : r.ready === true
}

const KID_CONFLICTS: Array<[string, string]> = [['yes', 'no'], ['have-and-want-more', 'no'], ['yes', 'have-and-done']]
export function kidsCompatible(a: Member, b: Member): boolean {
  const x = a.ai.kids?.stance
  const y = b.ai.kids?.stance
  if (!x || !y) return true
  if (a.ai.kids?.flexible || b.ai.kids?.flexible) return true
  return !KID_CONFLICTS.some(([p, q]) => (x === p && y === q) || (x === q && y === p))
}

/** Attraction bar on the 1..5 scale: 3 for looks-led members, down to 2 for personality-led members. */
export function attractionBar(personalityWeight: number): number {
  return 3 - personalityWeight
}

/** Predicted attraction from a to b on 1..5, or null when a has not rated examples or b has no tagged photo. */
export function predictedAttraction(a: Member, b: Member): number | null {
  const t = a.type !== undefined ? a.type : learnType(a.attraction)
  const looks = b.attraction?.looks
  if (!t || !looks || Object.keys(looks).length === 0) return null
  return predictAttraction(t, looks)
}

function avg(xs: Array<number | undefined | null>): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

/** 0..1: warm, agreeable, conscientious, calm (from conversation and video). A trait of the person, used for eligibility. */
export function partnerQualities(m: Member): number {
  const p = m.ai.personality || {}
  const v = m.video || {}
  const agree = avg([p.agreeableness, v.agreeableness])
  const neuro = avg([p.neuroticism, v.neuroticism])
  const parts = [v.warmth, agree, p.conscientiousness, neuro == null ? null : 11 - neuro]
  const a = avg(parts)
  return a == null ? 0.5 : Math.max(0, Math.min(1, (a - 1) / 9))
}

/** 0..1: secure attachment (low anxiety and low avoidance). */
export function security(m: Member): number {
  const a = m.ai.attachment || {}
  const x = avg([a.anxiety, a.avoidance])
  return x == null ? 0.5 : Math.max(0, Math.min(1, 1 - (x - 1) / 9))
}

export interface Eligibility { ok: boolean; score: number; reasons: string[] }

/**
 * Partnership readiness, 0..100, from the conversation alone, so it is decided right after it:
 * readiness for a relationship now (40%), partner qualities (40%) and secure attachment (20%). Members must be ready (6+ of 10) and score ELIGIBLE_SCORE or more to be matched.
 */
/** 0..1: kind, reliable and calm, from the conversation alone (so eligibility is known before the video). */
export function intakePartnerQualities(m: Member): number {
  const p = m.ai.personality || {}
  const parts = [p.agreeableness, p.conscientiousness, p.neuroticism == null ? null : 11 - p.neuroticism]
  const a = avg(parts)
  return a == null ? 0.5 : Math.max(0, Math.min(1, (a - 1) / 9))
}

export function eligibility(m: Member): Eligibility {
  const reasons: string[] = []
  const r = m.ai.readiness
  const level = typeof r?.level === 'number' ? r.level : r?.ready === true ? 7 : r?.ready === false ? 3 : null
  if (level == null) reasons.push('readiness unknown')
  else if (level < READY_LEVEL || r?.ready === false) reasons.push('not ready for a relationship yet')
  const score = Math.round((0.4 * ((level ?? 5) / 10) + 0.4 * intakePartnerQualities(m) + 0.2 * security(m)) * 100)
  if (score < ELIGIBLE_SCORE) reasons.push(`partnership readiness ${score} (needs ${ELIGIBLE_SCORE})`)
  return { ok: reasons.length === 0, score, reasons }
}

export function energyLevel(m: Member): number {
  return m.video?.energy ?? m.ai.personality?.extraversion ?? 5
}

export function energyAlignment(a: Member, b: Member): number {
  return Math.max(0, 1 - Math.abs(energyLevel(a) - energyLevel(b)) / 9)
}

// ---------- gates ----------

export interface GateResult { ok: boolean; reasons: string[] }

/** Gates that need no AI: run these first to keep AI evaluation to plausible pairs. */
export function basicGates(a: Member, b: Member): GateResult {
  const reasons: string[] = []
  if (a.id === b.id) reasons.push('same person')
  if (!a.cityKey || a.cityKey !== b.cityKey) reasons.push('different city')
  if (!interestedIn(a, b) || !interestedIn(b, a)) reasons.push('interest')
  if (!ageFits(a, b) || !ageFits(b, a)) reasons.push('age range')
  if (!fitsEthnicityPref(a.basics.ethnicityPref, b.basics.ethnicity) || !fitsEthnicityPref(b.basics.ethnicityPref, a.basics.ethnicity)) reasons.push('background preference')
  if (!eligibility(a).ok || !eligibility(b).ok) reasons.push('not eligible')
  if (!kidsCompatible(a, b)) reasons.push('kids')
  const ab = predictedAttraction(a, b)
  const ba = predictedAttraction(b, a)
  if (ab == null || ba == null) reasons.push('attraction data missing')
  else {
    if (ab < attractionBar(a.type?.personalityWeight ?? 0.3)) reasons.push('attraction (first person)')
    if (ba < attractionBar(b.type?.personalityWeight ?? 0.3)) reasons.push('attraction (second person)')
  }
  return { ok: reasons.length === 0, reasons }
}

/** Gates that come from the AI pair evaluation. `ev` is oriented so ev.a* belongs to `a`. */
export function evalGates(ev: PairEval): GateResult {
  const reasons: string[] = []
  if (ev.aDealbreakerHit) reasons.push('dealbreaker: ' + ev.aDealbreakerHit)
  if (ev.bDealbreakerHit) reasons.push('dealbreaker: ' + ev.bDealbreakerHit)
  if (ev.dealLevelValueConflict) reasons.push('deal-level value: ' + ev.dealLevelValueConflict)
  for (const m of ev.aMustHaves) if (!m.flexible && m.met < 1) reasons.push('must-have not met: ' + m.item)
  for (const m of ev.bMustHaves) if (!m.flexible && m.met < 1) reasons.push('must-have not met: ' + m.item)
  return { ok: reasons.length === 0, reasons }
}

/** Flip a pair evaluation so that `a` refers to the other person. */
export function flipEval(ev: PairEval): PairEval {
  return {
    ...ev,
    aMustHaves: ev.bMustHaves,
    bMustHaves: ev.aMustHaves,
    aDealbreakerHit: ev.bDealbreakerHit,
    bDealbreakerHit: ev.aDealbreakerHit,
    aRepeatType: ev.bRepeatType,
    bRepeatType: ev.aRepeatType,
    aPartnerFit: ev.bPartnerFit,
    bPartnerFit: ev.aPartnerFit,
  }
}

// ---------- scoring ----------

export type Components = Record<Component, number> // each 0..1

/** Components from a's point of view of b. Must-haves met by b count fully; no extra credit beyond "good enough". */
/**
 * Share of a's must-haves that b meets, weighted by a's own ranking: with n items,
 * rank 1 counts n times as much as rank n.
 */
export function mustHavesMet(a: Member, list: PairEval['aMustHaves']): number {
  if (!list.length) return 0.7
  const own = a.ai.mustHaves || []
  const n = list.length
  let total = 0
  let got = 0
  list.forEach((m, i) => {
    const o = own.find((x) => x.item === m.item)
    const rank = typeof o?.rank === 'number' && o.rank >= 1 ? Math.min(o.rank, n) : Math.min(i + 1, n)
    const w = n - rank + 1
    total += w
    got += w * Math.max(0, Math.min(1, m.met))
  })
  return total ? got / total : 0.7
}

export function directionalComponents(a: Member, b: Member, ev: PairEval): Components {
  const r = predictedAttraction(a, b)
  return {
    mustHaves: mustHavesMet(a, ev.aMustHaves),
    values: Math.max(0, Math.min(1, ev.valuesAlignment)),
    partnerFit: Math.max(0, Math.min(1, ev.aPartnerFit ?? 0.5)),
    energy: energyAlignment(a, b),
    attraction: r == null ? 0.5 : (r - 1) / 4,
  }
}

export function normalizeWeights(w: Partial<Weights> | undefined): Weights {
  // Weights saved before the components changed fall back to the current defaults.
  const valid = w && COMPONENTS.every((c) => typeof (w as any)[c] === 'number')
  const merged = { ...DEFAULT_WEIGHTS, ...(valid ? w : {}) }
  const total = COMPONENTS.reduce((s, c) => s + Math.max(0, merged[c]), 0) || 100
  const out = {} as Weights
  for (const c of COMPONENTS) out[c] = (Math.max(0, merged[c]) / total) * 100
  return out
}

export function directionalScore(weights: Weights, comps: Components): number {
  const w = normalizeWeights(weights)
  return COMPONENTS.reduce((s, c) => s + (w[c] * comps[c]), 0)
}

export interface PairResult {
  a: string
  b: string
  ok: boolean
  reasons: string[]
  score: number // 0..100
  points: Record<Component, number> // contribution of each component to the score
  aComps: Components
  bComps: Components
  aScore: number
  bScore: number
  flags: string[]
  why: string
  dateIdea: string
}

/** Full evaluation of a pair. `ev` must be oriented to (a, b). */
export function scorePair(a0: Member, b0: Member, ev: PairEval): PairResult {
  const a = withType(a0)
  const b = withType(b0)
  const g1 = basicGates(a, b)
  const g2 = evalGates(ev)
  const aComps = directionalComponents(a, b, ev)
  const bComps = directionalComponents(b, a, flipEval(ev))
  const aScore = directionalScore(a.weights, aComps)
  const bScore = directionalScore(b.weights, bComps)
  const wa = normalizeWeights(a.weights)
  const wb = normalizeWeights(b.weights)
  const points = {} as Record<Component, number>
  for (const c of COMPONENTS) points[c] = Math.round(((wa[c] * aComps[c] + wb[c] * bComps[c]) / 2) * 10) / 10
  const flags: string[] = []
  if (ev.aRepeatType >= REPEAT_TYPE_FLAG) flags.push(`${a.basics.firstName || 'First person'}: resembles the type behind past relationship problems`)
  if (ev.bRepeatType >= REPEAT_TYPE_FLAG) flags.push(`${b.basics.firstName || 'Second person'}: resembles the type behind past relationship problems`)
  return {
    a: a.id,
    b: b.id,
    ok: g1.ok && g2.ok,
    reasons: [...g1.reasons, ...g2.reasons],
    score: Math.round(((aScore + bScore) / 2) * 10) / 10,
    points,
    aComps,
    bComps,
    aScore: Math.round(aScore * 10) / 10,
    bScore: Math.round(bScore * 10) / 10,
    flags,
    why: ev.why,
    dateIdea: ev.dateIdea,
  }
}

// ---------- pairing ----------

/**
 * Best mutual pairs across the city: highest pair scores first, each person used once,
 * skipping pairs that already met. Only pairs that passed every gate are considered.
 */
export function pairUp(results: PairResult[], alreadyMet: Set<string> = new Set()): PairResult[] {
  const taken = new Set<string>()
  const chosen: PairResult[] = []
  const valid = results.filter((r) => r.ok && !alreadyMet.has(pairKey(r.a, r.b))).sort((x, y) => y.score - x.score)
  for (const r of valid) {
    if (taken.has(r.a) || taken.has(r.b)) continue
    taken.add(r.a)
    taken.add(r.b)
    chosen.push(r)
  }
  return chosen
}

export function pairKey(x: string, y: string): string {
  return x < y ? `${x}:${y}` : `${y}:${x}`
}

// ---------- learning ----------

export const LEARNING_RATE = 8
export const WEIGHT_MIN = 5
export const WEIGHT_MAX = 50

/**
 * After a debrief: shift weight toward the components that were high on a date the person rated well,
 * and away from them on a date they rated poorly. `overall` is 1..5.
 */
export function updateWeights(weights: Weights, comps: Components, overall: number): Weights {
  const w = normalizeWeights(weights)
  const signal = (Math.max(1, Math.min(5, overall)) - 3) / 2 // -1..1
  const mean = COMPONENTS.reduce((s, c) => s + comps[c], 0) / COMPONENTS.length
  const next = {} as Weights
  for (const c of COMPONENTS) {
    next[c] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, w[c] + LEARNING_RATE * signal * (comps[c] - mean)))
  }
  const normalized = normalizeWeights(next)
  for (const c of COMPONENTS) normalized[c] = Math.round(normalized[c] * 10) / 10
  return normalized
}
