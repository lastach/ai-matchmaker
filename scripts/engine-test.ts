/**
 * Synthetic-profile test of the v2 matching engine. Run: npx tsx scripts/engine-test.ts
 * No database or AI calls: pair evaluations are simulated from the synthetic profiles.
 */
import assert from 'node:assert/strict'
import {
  attractionBar, basicGates, COMPONENTS, directionalScore, normalizeWeights, pairKey, pairUp,
  personalityWeight, scorePair, updateWeights, type Member, type RatingMap,
} from '../src/lib/v2/engine'
import { parseJsonObject } from '../src/lib/v2/ai'
import { DEFAULT_WEIGHTS, type PairEval } from '../src/lib/v2/types'

let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
const r10 = () => 1 + Math.round(rand() * 9)

const N = 80
const members: Member[] = Array.from({ length: N }, (_, i) => {
  const gender = i % 2 === 0 ? 'woman' : 'man'
  const age = 28 + Math.floor(rand() * 15)
  return {
    id: `u${String(i).padStart(3, '0')}`,
    basics: { firstName: `P${i}`, gender, interestedIn: [gender === 'woman' ? 'men' : 'women'], ageMin: age - 6, ageMax: age + 6, city: 'Boston' },
    age,
    cityKey: rand() < 0.95 ? 'boston' : 'chicago',
    ai: {
      readiness: { level: rand() < 0.85 ? 7 + Math.floor(rand() * 4) : 3, ready: true },
      kids: { stance: pick(['yes', 'no', 'maybe', 'have-and-done'] as const), flexible: rand() < 0.3 },
      mustHaves: [{ item: 'kind', flexible: false }, { item: 'active', flexible: true }],
      personality: { agreeableness: r10(), conscientiousness: r10(), neuroticism: r10(), extraversion: r10() },
    },
    video: { warmth: r10(), energy: r10(), agreeableness: r10(), neuroticism: r10(), at: 'x' },
    weights: { ...DEFAULT_WEIGHTS },
  }
})

// Everyone rates everyone they could plausibly see; a third also rate again with video.
const ratings: RatingMap = {}
for (const a of members) for (const b of members) {
  if (a.id === b.id || a.basics.gender === b.basics.gender) continue
  const photo = 1 + Math.floor(rand() * 5)
  const video = rand() < 0.35 ? Math.max(1, Math.min(5, photo + pick([-2, -1, 0, 1, 1, 2]))) : null
  ;(ratings[a.id] ||= {})[b.id] = { photo, video }
}

// Simulated AI evaluation: must-have "kind" met when the other's agreeableness >= 5.
function simEval(a: Member, b: Member): PairEval {
  const kindB = (b.ai.personality?.agreeableness || 5) >= 5 ? 1 : 0
  const kindA = (a.ai.personality?.agreeableness || 5) >= 5 ? 1 : 0
  return {
    aMustHaves: [{ item: 'kind', met: kindB, flexible: false }, { item: 'active', met: 0.5, flexible: true }],
    bMustHaves: [{ item: 'kind', met: kindA, flexible: false }, { item: 'active', met: 1, flexible: true }],
    aDealbreakerHit: rand() < 0.05 ? 'smokes' : null,
    bDealbreakerHit: null,
    valuesAlignment: rand(),
    dealLevelValueConflict: rand() < 0.05 ? 'faith' : null,
    aRepeatType: rand(),
    bRepeatType: rand(),
    why: 'test',
    dateIdea: 'pottery class',
  }
}

const results = []
let gated = 0
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
  const [a, b] = members[i].id < members[j].id ? [members[i], members[j]] : [members[j], members[i]]
  if (!basicGates(a, b, ratings).ok) { gated++; continue }
  results.push(scorePair(a, b, simEval(a, b), ratings))
}
const valid = results.filter((r) => r.ok)
const already = new Set([pairKey(valid[0]?.a ?? 'x', valid[0]?.b ?? 'y')])
const chosen = pairUp(results, already)

// Invariants
const seen = new Set<string>()
for (const c of chosen) {
  assert.ok(c.ok, 'only fully gated pairs are matched')
  assert.ok(!seen.has(c.a) && !seen.has(c.b), 'one match per person')
  seen.add(c.a); seen.add(c.b)
  assert.ok(c.score >= 0 && c.score <= 100, 'score in range')
  assert.ok(!already.has(pairKey(c.a, c.b)), 'never the same pair twice')
  const sumPts = COMPONENTS.reduce((s, k) => s + c.points[k], 0)
  assert.ok(Math.abs(sumPts - c.score) < 0.6, `points add up to the score (${sumPts} vs ${c.score})`)
  const A = members.find((m) => m.id === c.a)!, B = members.find((m) => m.id === c.b)!
  assert.ok(A.cityKey === B.cityKey, 'same city')
  assert.ok((A.ai.readiness?.level ?? 0) >= 6 && (B.ai.readiness?.level ?? 0) >= 6, 'both ready')
}
for (let i = 1; i < chosen.length; i++) assert.ok(chosen[i - 1].score >= chosen[i].score, 'best pairs first')

// Weights and learning
const w = normalizeWeights({ mustHaves: 30, values: 25, attraction: 20, goodPartner: 15, energy: 10 })
assert.equal(Math.round(COMPONENTS.reduce((s, k) => s + w[k], 0)), 100)
const comps = { mustHaves: 1, values: 0.2, attraction: 0.9, goodPartner: 0.5, energy: 0.5 }
const up = updateWeights(DEFAULT_WEIGHTS, comps, 5)
const down = updateWeights(DEFAULT_WEIGHTS, comps, 1)
assert.ok(up.mustHaves > DEFAULT_WEIGHTS.mustHaves && up.values < DEFAULT_WEIGHTS.values, 'good date raises weight on what was high')
assert.ok(down.mustHaves < DEFAULT_WEIGHTS.mustHaves && down.values > DEFAULT_WEIGHTS.values, 'bad date lowers it')
assert.ok(Math.abs(COMPONENTS.reduce((s, k) => s + up[k], 0) - 100) < 0.5, 'weights stay at 100')
assert.equal(Math.round(directionalScore(DEFAULT_WEIGHTS, { mustHaves: 1, values: 1, attraction: 1, goodPartner: 1, energy: 1 })), 100)

// Personality weight and attraction bar
assert.equal(personalityWeight({ a: { photo: 2, video: 4 }, b: { photo: 1, video: 3 }, c: { photo: 3, video: 5 } }), 1)
assert.equal(personalityWeight({ a: { photo: 3, video: 3 }, b: { photo: 4, video: 4 }, c: { photo: 2, video: 2 } }), 0)
assert.equal(attractionBar(1), 2)
assert.equal(attractionBar(0), 3)

// JSON parsing of model replies
assert.deepEqual(parseJsonObject('Here you go:\n```json\n{"reply":"hi {there}","n":1}\n```'), { reply: 'hi {there}', n: 1 })
assert.deepEqual(parseJsonObject('{"a":{"b":"}"}} trailing'), { a: { b: '}' } })
assert.equal(parseJsonObject('no json'), null)

const flagged = chosen.filter((c) => c.flags.length).length
console.log(JSON.stringify({ members: N, pairsGatedOut: gated, pairsScored: results.length, passedAllGates: valid.length, matched: chosen.length * 2, pairs: chosen.length, flaggedPairs: flagged, topScore: chosen[0]?.score, lowestChosen: chosen[chosen.length - 1]?.score, weightsAfterGreatDate: up }, null, 1))
console.log('ALL ENGINE TESTS PASSED')
