/**
 * Synthetic-profile test of the v2 matching engine. Run: npx tsx scripts/engine-test.ts
 * No database or AI calls: pair evaluations are simulated from the synthetic profiles.
 */
import assert from 'node:assert/strict'
import {
  attractionBar, basicGates, COMPONENTS, directionalScore, eligibility, flipEval, normalizeWeights, pairKey, pairUp,
  predictedAttraction, scorePair, updateWeights, withType, type Member,
} from '../src/lib/v2/engine'
import { parseJsonObject } from '../src/lib/v2/ai'
import { cleanExplicit, EXAMPLES, examplesFor, FEATURE_VALUES, featuresFor, learnType, predictAttraction, round2For } from '../src/lib/v2/typeLibrary'
import { fitsEthnicityPref } from '../src/lib/v2/ethnicity'
import { DEFAULT_WEIGHTS, type AttractionData, type Looks, type PairEval } from '../src/lib/v2/types'

let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
const r10 = () => 1 + Math.round(rand() * 9)

// Each synthetic member has a hidden taste: likes one vibe, dislikes one style. They rate the example
// library from it (plus noise), and half of them are moved by personality snippets in round 2.
function simulateRatings(id: string, basics: any, likesVibe: string, dislikesStyle: string, personalityLed: boolean): AttractionData {
  const ratings: AttractionData['ratings'] = {}
  for (const e of examplesFor(id, basics)) {
    const base = 3 + (e.f.vibe === likesVibe ? 1.2 : 0) - (e.f.style === dislikesStyle ? 1.2 : 0) + (rand() - 0.5)
    ratings[e.id] = { photo: Math.max(1, Math.min(5, Math.round(base))) }
  }
  for (const r of round2For(id, basics)) {
    const p = ratings[r.example.id]!.photo!
    const shift = personalityLed ? (r.variant === 'warm' ? 1.5 : -1.5) : 0
    ratings[r.example.id] = { ...ratings[r.example.id], about: Math.max(1, Math.min(5, Math.round(p + shift))), variant: r.variant }
  }
  return { ratings, done: true }
}
function randomLooks(gender: string): Looks {
  const l: Looks = {}
  for (const [f, vals] of Object.entries(FEATURE_VALUES)) (l as any)[f] = pick(vals)
  if (gender === 'woman') l.facialHair = 'none'
  return l
}

const N = 80
const members: Member[] = Array.from({ length: N }, (_, i) => {
  const gender = i % 2 === 0 ? 'woman' : 'man'
  const age = 28 + Math.floor(rand() * 15)
  const id = `u${String(i).padStart(3, '0')}`
  const basics: any = { firstName: `P${i}`, gender, interestedIn: [gender === 'woman' ? 'men' : 'women'], ageMin: age - 6, ageMax: age + 6, city: 'Boston' }
  const attraction = simulateRatings(id, basics, pick(['warm', 'reserved', 'playful']), pick(['polished', 'casual', 'edgy']), rand() < 0.5)
  attraction.looks = randomLooks(gender)
  return {
    id,
    basics,
    age,
    cityKey: rand() < 0.95 ? 'boston' : 'chicago',
    ai: {
      readiness: { level: rand() < 0.85 ? 7 + Math.floor(rand() * 4) : 3, ready: true },
      kids: { stance: pick(['yes', 'no', 'maybe', 'have-and-done'] as const), flexible: rand() < 0.3 },
      mustHaves: [{ item: 'kind', flexible: false }, { item: 'active', flexible: true }],
      personality: { agreeableness: 3 + r10() * 0.7, conscientiousness: 3 + r10() * 0.7, neuroticism: r10(), extraversion: r10() },
      attachment: { anxiety: r10(), avoidance: r10() },
    },
    video: { warmth: 3 + r10() * 0.7, energy: r10(), agreeableness: r10(), neuroticism: r10(), at: 'x' },
    weights: { ...DEFAULT_WEIGHTS },
    attraction,
  }
}).map(withType)

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
    aPartnerFit: rand(),
    bPartnerFit: rand(),
    why: 'test',
    dateIdea: 'pottery class',
  }
}

const results = []
let gated = 0
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
  const [a, b] = members[i].id < members[j].id ? [members[i], members[j]] : [members[j], members[i]]
  if (!basicGates(a, b).ok) { gated++; continue }
  results.push(scorePair(a, b, simEval(a, b)))
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
  assert.ok(eligibility(A).ok && eligibility(B).ok, 'both eligible')
  assert.ok(predictedAttraction(A, B)! >= attractionBar(A.type!.personalityWeight) && predictedAttraction(B, A)! >= attractionBar(B.type!.personalityWeight), 'predicted attraction both ways')
}
for (let i = 1; i < chosen.length; i++) assert.ok(chosen[i - 1].score >= chosen[i].score, 'best pairs first')

// Weights and learning
const w = normalizeWeights({ mustHaves: 30, values: 25, attraction: 20, partnerFit: 15, energy: 10 })
assert.equal(Math.round(COMPONENTS.reduce((s, k) => s + w[k], 0)), 100)
assert.deepEqual(normalizeWeights({ mustHaves: 30, values: 25, attraction: 20, goodPartner: 15, energy: 10 } as any), normalizeWeights(DEFAULT_WEIGHTS), 'old saved weights fall back to the defaults')
const comps = { mustHaves: 1, values: 0.2, attraction: 0.9, partnerFit: 0.5, energy: 0.5 }
const up = updateWeights(DEFAULT_WEIGHTS, comps, 5)
const down = updateWeights(DEFAULT_WEIGHTS, comps, 1)
assert.ok(up.mustHaves > DEFAULT_WEIGHTS.mustHaves && up.values < DEFAULT_WEIGHTS.values, 'good date raises weight on what was high')
assert.ok(down.mustHaves < DEFAULT_WEIGHTS.mustHaves && down.values > DEFAULT_WEIGHTS.values, 'bad date lowers it')
assert.ok(Math.abs(COMPONENTS.reduce((s, k) => s + up[k], 0) - 100) < 0.5, 'weights stay at 100')
assert.equal(Math.round(directionalScore(DEFAULT_WEIGHTS, { mustHaves: 1, values: 1, attraction: 1, partnerFit: 1, energy: 1 })), 100)

// Partner fit is specific to the pair and direction
const ev0 = simEval(members[0], members[1])
assert.equal(flipEval(ev0).aPartnerFit, ev0.bPartnerFit)

// Type learning recovers a known taste
const basicsT: any = { gender: 'woman', interestedIn: ['men'], ageMin: 25, ageMax: 60 }
const likesWarm = learnType(simulateRatings('t1', basicsT, 'warm', 'edgy', false))!
assert.ok(likesWarm.prefs['vibe:warm'] > likesWarm.prefs['vibe:reserved'], 'learns the vibe they like')
assert.ok((likesWarm.prefs['style:edgy'] ?? 0) < (likesWarm.prefs['style:casual'] ?? 0), 'learns the style they dislike')
assert.ok(likesWarm.personalityWeight < 0.2, 'looks-led member: personality barely moves ratings')
const persLed = learnType(simulateRatings('t2', basicsT, 'warm', 'edgy', true))!
assert.ok(persLed.personalityWeight > 0.8, 'personality-led member detected')
assert.equal(attractionBar(1), 2)
assert.equal(attractionBar(0), 3)
const manWarm = { ...members[1], attraction: { looks: { vibe: 'warm', style: 'casual' } } }
const manEdgy = { ...members[1], attraction: { looks: { vibe: 'reserved', style: 'edgy' } } }
const tester = { ...members[0], type: likesWarm }
assert.ok(predictedAttraction(tester, manWarm)! > predictedAttraction(tester, manEdgy)!, 'predicts higher attraction for their type')
assert.ok(EXAMPLES.length >= 60 && examplesFor('x', basicsT).every((e) => e.gender === 'man'), 'examples match who they want to meet')

// Stated face preferences move the prediction
const withJaw = { ...likesWarm, explicit: cleanExplicit({ jawline: 'defined', lips: 'full', build: ['athletic'] }) }
const base = { vibe: 'warm', style: 'casual' }
assert.ok(predictAttraction(withJaw, { ...base, jawline: 'defined', lips: 'full', build: 'athletic' }) > predictAttraction(withJaw, { ...base, jawline: 'soft', lips: 'thin', build: 'slim' }), 'stated features raise attraction')
assert.deepEqual(cleanExplicit({ jawline: 'weird', build: ['athletic', 'x'] }), { build: ['athletic'], hairColor: [], facialHair: [] }, 'unknown answers dropped')
const fx = featuresFor('u1', basicsT)
assert.equal(fx.comparisons.length, 7)
assert.ok(fx.comparisons.every((c) => c.a.faces.length >= 2 && c.b.faces.length >= 2), 'every comparison has faces on both sides')
assert.ok(fx.chips.some((c) => c.feature === 'facialHair'), 'facial hair offered when meeting men')
const r1 = examplesFor('u1', { ...basicsT, ageMin: 35, ageMax: 50 })
assert.ok(new Set(r1.map((e) => e.f.age)).size >= 3, 'round 1 spans several age bands')

// Background filter (self-described, optional)
assert.equal(fitsEthnicityPref([], undefined), true, 'no filter: open to everyone')
assert.equal(fitsEthnicityPref(['hispanic'], ['hispanic', 'white']), true)
assert.equal(fitsEthnicityPref(['hispanic'], ['white']), false)
assert.equal(fitsEthnicityPref(['hispanic'], undefined), false, 'filter excludes people who did not share')
const filt = { ...members[0], basics: { ...members[0].basics, ethnicityPref: ['east-asian'] } }
assert.ok(basicGates(filt, members[1]).reasons.includes('background preference'))

// Eligibility filter
const notReady = { ...members[0], ai: { ...members[0].ai, readiness: { level: 4, ready: true } } }
assert.equal(eligibility(notReady).ok, false)

// JSON parsing of model replies
assert.deepEqual(parseJsonObject('Here you go:\n```json\n{"reply":"hi {there}","n":1}\n```'), { reply: 'hi {there}', n: 1 })
assert.deepEqual(parseJsonObject('{"a":{"b":"}"}} trailing'), { a: { b: '}' } })
assert.equal(parseJsonObject('no json'), null)

const flagged = chosen.filter((c) => c.flags.length).length
console.log(JSON.stringify({ members: N, eligible: members.filter((m) => eligibility(m).ok).length, pairsGatedOut: gated, pairsScored: results.length, passedAllGates: valid.length, matched: chosen.length * 2, pairs: chosen.length, flaggedPairs: flagged, topScore: chosen[0]?.score, lowestChosen: chosen[chosen.length - 1]?.score, weightsAfterGreatDate: up }, null, 1))
console.log('ALL ENGINE TESTS PASSED')
