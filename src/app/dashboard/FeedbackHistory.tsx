'use client'

import { useEffect, useState } from 'react'

type Summary = {
  total_feedback: number
  met_count: number
  second_date_count: number
  off_count: number
  close_count: number
  spot_on_count: number
  last_feedback_at: string | null
}

export default function FeedbackHistory() {
  const [s, setS] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/match/feedback/summary').then(async r => {
      const d = await r.json().catch(() => null)
      if (cancelled) return
      if (r.ok && d) setS(d)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return null
  if (!s || s.total_feedback === 0) return null

  const meetRate = s.total_feedback ? Math.round((s.met_count / s.total_feedback) * 100) : 0
  const secondRate = s.met_count ? Math.round((s.second_date_count / s.met_count) * 100) : 0
  const calibTotal = s.spot_on_count + s.close_count + s.off_count
  const calibQuality = calibTotal ? Math.round(((s.spot_on_count * 1 + s.close_count * 0.5) / calibTotal) * 100) : null

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
      <h3 className="font-semibold text-gray-900 mb-1">Where you stand</h3>
      <p className="text-xs text-gray-500 mb-3">Your post-date feedback, summarized. The matching engine reads this to calibrate your next match.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
          <p className="text-[11px] text-rose-700">Matches with feedback</p>
          <p className="text-2xl font-semibold text-rose-900">{s.total_feedback}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border">
          <p className="text-[11px] text-gray-600">Met up</p>
          <p className="text-2xl font-semibold text-gray-900">{meetRate}%</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border">
          <p className="text-[11px] text-gray-600">Second date when met</p>
          <p className="text-2xl font-semibold text-gray-900">{secondRate}%</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border">
          <p className="text-[11px] text-gray-600">Calibration quality</p>
          <p className="text-2xl font-semibold text-gray-900">{calibQuality != null ? `${calibQuality}%` : '-'}</p>
        </div>
      </div>
      {s.last_feedback_at && (
        <p className="text-[11px] text-gray-400 mt-2">Last feedback: {new Date(s.last_feedback_at).toLocaleDateString()}</p>
      )}
    </div>
  )
}
