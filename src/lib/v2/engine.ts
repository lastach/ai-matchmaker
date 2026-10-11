/**
 * Amorlay v2 matching engine (pure functions, no I/O).
 *
 * 1. Gates (pass/fail, checked both ways): interest, age range, city, readiness,
 *    kids, dealbreakers, deal-level values, inflexible must-haves, attraction bar.
 * 2. Match score out of 100, from each person's own learned weights
 *    (defaults: must-haves 30, values 25, attraction 20, good partner 15, energy 10).
 *    The pair score is the average of the two directional scores.
 * 3. Flags: a candidate who resembles the type behind someone's past problems.
 * 4. Pairing: best mutual pairs across the city, one per person per cycle.
 * 5. Learning: each debrief nudges that person's weights.
 */
import { DEFAULT_WEIGHTS, type AiProfile, type Basics, type PairEval, type VideoAssessment, type Weights } from './types'

export interface Member {
  id: string
  basics: Basics
  age: number | null
  cityKey: string | null
  ai: AiProfile
  video: VideoAssessment
  weights: Weights
}

export interface Rating { photo?: number | null; video?: number | null }
export type RatingMap = Record<string, Record<string, Rating>> // rater -> target -> rating

export type Component = keyof Weights
export const COMPONENTS: Component[] = ['mustHaves', 'values', 'attraction', 'goodPartner', 'energy']

export const READY_LEVEL = 6
export const REPEAT_TYPE_FLAG = 0.6
export const DEFAULT_PERSONALITY_WEIGHT = 0.3

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

/** How much personality (clip or about text) moves this person's attraction ratings, 0..1. */
export function personalityWeight(raterRatings: Record<string, Rating> | undefined): number {
  if (!raterRatings) return DEFAULT_PERSONALITY_WEIGHT
  const shifts: number[] = []
  for (const r of Object.values(raterRatings)) {
    if (typeof r.photo === 'number' && typeof r.video === 'number') shifts.push(Math.abs(r.video - r.photo))
  }
  if (shifts.length < 3) return DEFAULT_PERSONALITY_WEIGHT
  const mean = shifts.reduce((s, x) => s + x, 0) / shifts.length
  return Math.max(0, Math.min(1, mean / 2))
}

/** Attraction bar on the 1..5 scale: 3 for looks-led raters, down to 2 for personality-led raters. */
export function attractionBar(pw: number): number {
  return 3 - pw
}

export function attractionRating(r: Rating | undefined): number | null {
  if (!r) return null
  if (typeof r.video === 'number') return r.video
  if (typeof r.photo === 'number') return r.photo
  return null
}

function avg(xs: Array<number | undefined | null>): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

/** 0..1: warm, agreeable, conscientious, calm (from conversation and video). */
export function goodPartner(m: Member): number {
  const p = m.ai.personality || {}
  const v = m.video || {}
  const agree = avg([p.agreeableness, v.agreeableness])
  const neuro = avg([p.neuroticism, v.neuroticism])
  const parts = [v.warmth, agree, p.conscientiousness, neuro == null ? null : 11 - neuro]
  const a = avg(parts)
  return a == null ? 0.5 : Math.max(0, Math.min(1, (a - 1) / 9))
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
export function basicGates(a: Member, b: Member, ratings: RatingMap): GateResult {
  const reasons: string[] = []
  if (a.id === b.id) reasons.push('same person')
  if (!a.cityKey || a.cityKey !== b.cityKey) reasons.push('different city')
  if (!interestedIn(a, b) || !interestedIn(b, a)) reasons.push('interest')
  if (!ageFits(a, b) || !ageFits(b, a)) reasons.push('age range')
  if (!isReady(a) || !isReady(b)) reasons.push('readiness')
  if (!kidsCompatible(a, b)) reasons.push('kids')
  const rab = attractionRating(ratings[a.id]?.[b.id])
  const rba = attractionRating(ratings[b.id]?.[a.id])
  if (rab == null || rba == null) reasons.push('attraction not rated both ways')
  else {
    if (rab < attractionBar(personalityWeight(ratings[a.id]))) reasons.push('attraction (first person)')
    if (rba < attractionBar(personalityWeight(ratings[b.id]))) reasons.push('attraction (second person)')
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
  }
}

// ---------- scoring ----------

export type Components = Record<Component, number> // each 0..1

/** Components from a's point of view of b. Must-haves met by b count fully; no extra credit beyond "good enough". */
export function directionalComponents(a: Member, b: Member, ev: PairEval, ratings: RatingMap): Components {
  const met = ev.aMustHaves.length ? ev.aMustHaves.reduce((s, m) => s + Math.max(0, Math.min(1, m.met)), 0) / ev.aMustHaves.length : 0.7
  const r = attractionRating(ratings[a.id]?.[b.id])
  return {
    mustHaves: met,
    values: Math.max(0, Math.min(1, ev.valuesAlignment)),
    attraction: r == null ? 0.5 : (r - 1) / 4,
    goodPartner: goodPartner(b),
    energy: energyAlignment(a, b),
  }
}

export function normalizeWeights(w: Partial<Weights> | undefined): Weights {
  const merged = { ...DEFAULT_WEIGHTS, ...(w || {}) }
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
export function scorePair(a: Member, b: Member, ev: PairEval, ratings: RatingMap): PairResult {
  const g1 = basicGates(a, b, ratings)
  const g2 = evalGates(ev)
  const aComps = directionalComponents(a, b, ev, ratings)
  const bComps = directionalComponents(b, a, flipEval(ev), ratings)
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
