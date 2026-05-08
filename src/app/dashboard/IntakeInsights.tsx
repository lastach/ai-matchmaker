'use client'

import { useEffect, useState } from 'react'

interface Props {
  profileData: any
  coreIntakeData: any
}

export default function IntakeInsights({ profileData, coreIntakeData }: Props) {
  const [insights, setInsights] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrored(false)
    fetch('/api/intake/insights', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileData, coreIntakeData }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok || !Array.isArray(d?.insights) || d.insights.length === 0) {
          setErrored(true)
          setInsights([])
          return
        }
        setInsights(d.insights)
      })
      .catch(() => {
        if (cancelled) return
        setErrored(true)
        setInsights([])
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="bg-white/95 rounded-2xl shadow p-6 mb-4 border border-[#D4537E]/20">
        <h3 className="text-lg font-semibold text-[#3D1820] mb-1">What I noticed about you</h3>
        <p className="text-sm text-[#6B7280]">Reading your answers carefully…</p>
      </div>
    )
  }

  if (errored || !insights || insights.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 mb-4 border border-[#D4537E]/30">
      <h3 className="text-lg font-semibold text-[#3D1820] mb-3">What I noticed about you</h3>
      <ul className="space-y-3">
        {insights.map((insight, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#D4537E]/10 text-[#D4537E] text-xs font-semibold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <p className="text-sm text-[#1F2937] leading-relaxed">{insight}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[#9CA3AF] mt-4 italic">Generated from your intake answers — feeds the brief on whoever I match you with.</p>
    </div>
  )
}
