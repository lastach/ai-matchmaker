import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/isAdmin'
import { basicGates, pairKey, pairUp, scorePair, type PairResult } from '@/lib/v2/engine'
import { evaluatePair, versionKey } from '@/lib/v2/pairEval'
import { loadCity, loadRatings, toMember } from '@/lib/v2/pool'
import { errorResponse, requireService, requireUser } from '@/lib/v2/server'
import type { PairEval, ProfileRow } from '@/lib/v2/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const EVALS_PER_CALL = 30
const CONCURRENCY = 6

function cycleNow(): string {
  return new Date().toISOString().slice(0, 7)
}

/**
 * POST /api/v2/admin/run  body: { city: string (city key), dryRun?: boolean }
 * Runs the monthly matching for one city:
 *   1. basic gates on every pair (interest, age, city, readiness, kids, attraction both ways)
 *   2. AI evaluation of surviving pairs (cached; up to 30 new evaluations per call, so call again while remaining > 0)
 *   3. score, flag and pair up: best mutual pairs, one per person per month, never the same pair twice
 *   4. save proposals for the matchmaker to review and schedule
 */
export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  if (!(await isAdmin(auth.user.email, auth.session))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const svc = requireService()
  if (svc instanceof NextResponse) return svc
  try {
    const { city, dryRun } = await req.json().catch(() => ({} as any))
    if (!city) return NextResponse.json({ error: 'city required' }, { status: 400 })
    const cycle = cycleNow()

    const rows = await loadCity(svc, String(city))
    const byId = new Map(rows.map((r) => [r.user_id, r]))
    const members = rows.map(toMember)
    const ratings = await loadRatings(svc, members.map((m) => m.id))

    // Members already matched this cycle, and pairs that already happened.
    const { data: existing } = await svc
      .from('amorlay_matches')
      .select('user_a, user_b, cycle, status')
      .eq('city_key', city)
      .neq('status', 'cancelled')
    const busy = new Set<string>()
    const alreadyMet = new Set<string>()
    for (const m of existing || []) {
      alreadyMet.add(pairKey(m.user_a, m.user_b))
      if (m.cycle === cycle) {
        busy.add(m.user_a)
        busy.add(m.user_b)
      }
    }

    // 1. Basic gates
    const candidates: Array<[ProfileRow, ProfileRow]> = []
    let gatedOut = 0
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const [x, y] = members[i].id < members[j].id ? [members[i], members[j]] : [members[j], members[i]]
        if (busy.has(x.id) || busy.has(y.id) || alreadyMet.has(pairKey(x.id, y.id))) continue
        if (!basicGates(x, y, ratings).ok) { gatedOut++; continue }
        candidates.push([byId.get(x.id)!, byId.get(y.id)!])
      }
    }

    // 2. AI evaluations (cached)
    const keys = candidates.map(([a, b]) => pairKey(a.user_id, b.user_id))
    const cached = new Map<string, { version_key: string; eval: PairEval }>()
    for (let i = 0; i < keys.length; i += 200) {
      const { data } = await svc.from('amorlay_pair_evals').select('pair_key, version_key, eval').in('pair_key', keys.slice(i, i + 200))
      for (const r of data || []) cached.set(r.pair_key, { version_key: r.version_key, eval: r.eval })
    }
    const needed = candidates.filter(([a, b]) => cached.get(pairKey(a.user_id, b.user_id))?.version_key !== versionKey(a, b))
    const batch = needed.slice(0, EVALS_PER_CALL)
    let failed = 0
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      await Promise.all(
        batch.slice(i, i + CONCURRENCY).map(async ([a, b]) => {
          try {
            const ev = await evaluatePair(a, b)
            const k = pairKey(a.user_id, b.user_id)
            const vk = versionKey(a, b)
            await svc.from('amorlay_pair_evals').upsert({ pair_key: k, version_key: vk, eval: ev, created_at: new Date().toISOString() }, { onConflict: 'pair_key' })
            cached.set(k, { version_key: vk, eval: ev })
          } catch {
            failed++
          }
        })
      )
    }
    const remaining = needed.length - batch.length + failed
    if (remaining > 0) {
      return NextResponse.json({ done: false, remaining, evaluated: batch.length - failed, members: members.length, pairsAfterGates: candidates.length })
    }

    // 3. Score and pair
    const results: PairResult[] = []
    for (const [a, b] of candidates) {
      const ev = cached.get(pairKey(a.user_id, b.user_id))?.eval
      if (!ev) continue
      results.push(scorePair(toMember(a), toMember(b), ev, ratings))
    }
    const chosen = pairUp(results, alreadyMet)

    // 4. Save proposals
    if (!dryRun && chosen.length) {
      const rowsToInsert = chosen.map((r) => ({
        cycle,
        city_key: city,
        user_a: r.a,
        user_b: r.b,
        score: r.score,
        breakdown: { points: r.points, aComps: r.aComps, bComps: r.bComps, aScore: r.aScore, bScore: r.bScore, flags: r.flags, why: r.why },
        date_idea: r.dateIdea,
        status: 'proposed',
      }))
      const { error } = await svc.from('amorlay_matches').insert(rowsToInsert)
      if (error) throw new Error(error.message)
    }

    const unmatched = members.filter((m) => !busy.has(m.id) && !chosen.some((c) => c.a === m.id || c.b === m.id)).length
    return NextResponse.json({
      done: true,
      members: members.length,
      pairsAfterGates: candidates.length,
      gatedOut,
      validPairs: results.filter((r) => r.ok).length,
      proposed: chosen.length,
      unmatched,
      dryRun: !!dryRun,
    })
  } catch (e) {
    return errorResponse(e)
  }
}
