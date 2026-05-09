'use client'

import { useEffect, useState } from 'react'

type Pool = {
  region?: string | null
  verified_in_window: number
  cohort_size: number
  recent_join_velocity_7d: number
  open_match_requests: number
  wait_time_estimate_days: number | null
  last_updated: string
}

export default function SupplyPool() {
  const [pool, setPool] = useState<Pool | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/supply-pool', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'failed'); return }
      setPool(d)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="bg-white rounded-xl border p-5 text-sm text-gray-500">Loading cohort data...</div>
  if (err) return <div className="bg-white rounded-xl border p-5 text-sm text-gray-500">Cohort data not available yet ({err}).</div>
  if (!pool) return null

  const slim = pool.verified_in_window < 5
  const wait = pool.wait_time_estimate_days

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">Cohort in {pool.region || 'your area'}</h3>
          <p className="text-xs text-gray-500 mt-0.5">Honest pool counts so you know what is actually available. No inflation.</p>
        </div>
        <button onClick={load} className="text-[11px] font-medium border border-gray-300 hover:bg-gray-50 px-2 py-1 rounded">Refresh</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-3 rounded-lg border ${slim ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className="text-[11px] text-gray-600">Verified in your window</p>
          <p className="text-2xl font-semibold text-gray-900">{pool.verified_in_window}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border">
          <p className="text-[11px] text-gray-600">Region cohort</p>
          <p className="text-2xl font-semibold text-gray-900">{pool.cohort_size}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border">
          <p className="text-[11px] text-gray-600">7-day join velocity</p>
          <p className="text-2xl font-semibold text-gray-900">{pool.recent_join_velocity_7d}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border">
          <p className="text-[11px] text-gray-600">Open requests in region</p>
          <p className="text-2xl font-semibold text-gray-900">{pool.open_match_requests}</p>
        </div>
      </div>

      {wait != null && (
        <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
          <p className="text-xs text-rose-900 font-medium">Estimated wait for next match: ~{wait} days</p>
          <p className="text-[11px] text-rose-700 mt-0.5">Estimate based on candidates in your window divided by open requests, and on a conservative 0.5 matches per requester per week. Actual time depends on dealbreakers and acceptance rates.</p>
        </div>
      )}

      {slim && (
        <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
          The pool in your window is currently slim. You can widen the age range, expand metro radius, or relax dealbreakers to surface more candidates. We will not match you with anyone who fails your hard rules.
        </div>
      )}

      <p className="mt-3 text-[10px] text-gray-400">Last updated {new Date(pool.last_updated).toLocaleString()}</p>
    </div>
  )
}
