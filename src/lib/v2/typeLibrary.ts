/**
 * Attraction without members ever seeing each other.
 *
 * 1. Each member rates example photos (free stock portraits, Pexels license) of the people they want to meet.
 *    Every example is tagged with visible characteristics (style, vibe, build, hair, facial hair, glasses, age band).
 * 2. A second, shorter round shows some of the same examples with a short personality snippet: half warm and
 *    engaging, half flat. How far the ratings move with the snippet measures how much personality drives
 *    attraction for this member, versus looks.
 * 3. Each member's own photos are tagged on the same characteristics by the AI.
 * 4. Attraction from A to B is predicted from A's learned preferences applied to B's characteristics.
 */
import library from './typeLibrary.json'
import type { AttractionData, Basics, Looks } from './types'

export interface Example { id: string; gender: 'woman' | 'man'; src: string; pexels: number; f: Required<Looks> }
export const EXAMPLES = library as Example[]

export const FEATURES: Array<keyof Looks> = ['age', 'style', 'vibe', 'build', 'hair', 'facialHair', 'glasses']
export const FEATURE_VALUES: Record<keyof Looks, string[]> = {
  age: ['20s', '30s', '40s', '50s'],
  style: ['polished', 'casual', 'edgy', 'outdoorsy', 'sporty'],
  vibe: ['warm', 'reserved', 'playful'],
  build: ['slim', 'average', 'athletic', 'fuller'],
  hair: ['long', 'medium', 'short', 'bald'],
  facialHair: ['none', 'stubble', 'beard'],
  glasses: ['yes', 'no'],
}

export const ROUND1_SIZE = 24
export const ROUND2_SIZE = 12
export const DEFAULT_PERSONALITY_WEIGHT = 0.3

/** Personality snippets for round 2. Gender neutral, first person. */
export const WARM_SNIPPETS = [
  'I teach kids to sail in the summer, and I still get excited every time one of them figures out the wind.',
  'My friends call me when they need a second opinion and a good laugh, usually in that order.',
  'I just learned to make fresh pasta and I am now inviting everyone I know over to eat my mistakes.',
  'Ask me about the time I got lost in Lisbon and ended up at a stranger’s birthday party.',
  'I volunteer at the animal shelter on Saturdays. The old dogs are my favorites.',
  'I will always say yes to a long walk, a good question, or a second dessert.',
  'I am happiest when I am building something with my hands, or listening to someone talk about what they love.',
  'I keep a list of places I want to take people I like. It is a long list.',
  'I am the friend who remembers your coffee order and your mom’s name.',
  'Big fan of slow Sunday mornings, honest conversations, and dancing badly in the kitchen.',
  'I got into rock climbing at 35 and it made me braver about everything else too.',
  'I like people who are curious. Tell me something you changed your mind about.',
]
export const FLAT_SNIPPETS = [
  'I work in an office. I watch TV in the evenings.',
  'Not sure what to write here. Just ask.',
  'I like food and movies. Normal stuff.',
  'Looking for someone. No drama.',
  'I have a job and an apartment. That is about it.',
  'I do not really have hobbies. I go to work and come home.',
  'Message me if you want. Or not.',
  'I like sleeping in. I do not go out much.',
  'Just seeing what is out there.',
  'I am pretty average. Nothing special to say.',
  'Work keeps me busy. Weekends I rest.',
  'Don’t really know what to put here.',
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

const AGE_BANDS: Record<string, [number, number]> = { '20s': [20, 29], '30s': [30, 39], '40s': [40, 49], '50s': [50, 99] }

/** Examples of the people this member wants to meet, roughly within their age range, in a stable per-member order. */
export function examplesFor(userId: string, basics: Basics): Example[] {
  const wants = (basics.interestedIn || []).map((x) => String(x).toLowerCase())
  const any = wants.includes('anyone') || wants.includes('nonbinary') || wants.length === 0
  const lo = (basics.ageMin ?? 18) - 3
  const hi = (basics.ageMax ?? 99) + 3
  const fits = (e: Example) => {
    if (!any && !wants.includes(e.gender === 'woman' ? 'women' : 'men')) return false
    const [a, b] = AGE_BANDS[e.f.age] || [18, 99]
    return b >= lo && a <= hi
  }
  let pool = EXAMPLES.filter(fits)
  // Too few in their age range: widen to everyone of the right gender.
  if (pool.length < 12) pool = EXAMPLES.filter((e) => any || wants.includes(e.gender === 'woman' ? 'women' : 'men'))
  return [...pool].sort((x, y) => hash(userId + x.id) - hash(userId + y.id)).slice(0, ROUND1_SIZE)
}

/** Round 2: some of the round 1 examples, each paired with a warm or flat snippet (balanced). */
export function round2For(userId: string, basics: Basics): Array<{ example: Example; variant: 'warm' | 'flat'; snippet: string }> {
  const picks = examplesFor(userId, basics).slice(0, ROUND2_SIZE)
  return picks.map((example, i) => {
    const variant: 'warm' | 'flat' = (i + (hash(userId) % 2)) % 2 === 0 ? 'warm' : 'flat'
    const list = variant === 'warm' ? WARM_SNIPPETS : FLAT_SNIPPETS
    return { example, variant, snippet: list[hash(userId + example.id + variant) % list.length] }
  })
}

export interface TypeModel {
  mean: number // average photo rating, 1..5
  prefs: Record<string, number> // "feature:value" -> rating shift
  personalityWeight: number // 0..1, how much personality moved their ratings
  n: number
}

/** Learn what this member is drawn to from their ratings of the examples. */
export function learnType(data: AttractionData | undefined): TypeModel | null {
  const ratings = data?.ratings || {}
  const byId = new Map(EXAMPLES.map((e) => [e.id, e]))
  const rated = Object.entries(ratings).filter(([id, r]) => typeof r.photo === 'number' && byId.has(id))
  if (rated.length < 8) return null
  const mean = rated.reduce((s, [, r]) => s + (r.photo as number), 0) / rated.length
  const sums: Record<string, { s: number; n: number }> = {}
  for (const [id, r] of rated) {
    const e = byId.get(id)!
    for (const f of FEATURES) {
      const k = `${f}:${e.f[f]}`
      const x = (sums[k] ||= { s: 0, n: 0 })
      x.s += (r.photo as number) - mean
      x.n += 1
    }
  }
  const prefs: Record<string, number> = {}
  // Shrink toward zero when a characteristic was seen only a few times.
  for (const [k, { s, n }] of Object.entries(sums)) prefs[k] = s / (n + 2)

  const warm: number[] = []
  const flat: number[] = []
  for (const [, r] of rated) {
    if (typeof r.about !== 'number' || !r.variant) continue
    ;(r.variant === 'warm' ? warm : flat).push(r.about - (r.photo as number))
  }
  let personalityWeight = DEFAULT_PERSONALITY_WEIGHT
  if (warm.length >= 3 && flat.length >= 3) {
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    personalityWeight = Math.max(0, Math.min(1, (avg(warm) - avg(flat)) / 2))
  }
  return { mean, prefs, personalityWeight, n: rated.length }
}

/** Predicted 1..5 rating from this member's type, applied to someone's looks. */
export function predictAttraction(model: TypeModel, looks: Looks): number {
  let shift = 0
  for (const f of FEATURES) {
    const v = looks[f]
    if (v) shift += model.prefs[`${f}:${v}`] || 0
  }
  return Math.max(1, Math.min(5, model.mean + shift))
}

/** Clean the AI's description of a member's own photo onto the library's characteristics. */
export function cleanLooks(raw: any): Looks {
  const out: Looks = {}
  for (const f of FEATURES) {
    const v = String(raw?.[f] ?? '').toLowerCase().trim()
    if (FEATURE_VALUES[f].includes(v)) out[f] = v
  }
  return out
}
