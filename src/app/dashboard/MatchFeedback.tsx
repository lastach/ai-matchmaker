'use client'

import { useEffect, useState } from 'react'

export default function MatchFeedback({ matchPairId, onSubmitted }: { matchPairId: string; onSubmitted?: () => void }) {
  const [met, setMet] = useState<boolean | null>(null)
  const [secondDate, setSecondDate] = useState<boolean | null>(null)
  const [calibration, setCalibration] = useState<'spot-on' | 'close' | 'off' | null>(null)
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (met == null) { setErr('Did the date happen?'); return }
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/match/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ matchId: matchPairId, met: !!met, secondDate: !!secondDate, calibration, notes }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'failed'); return }
      setSubmitted(true)
      onSubmitted?.()
    } finally { setBusy(false) }
  }

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900">
        Thank you. Your feedback calibrates future matches.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <h3 className="font-semibold text-gray-900 mb-1">How did it go?</h3>
      <p className="text-xs text-gray-500 mb-3">Honest feedback only goes to the matching engine - not to the other person.</p>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Did you actually meet?</p>
          <div className="flex gap-2">
            <button onClick={() => setMet(true)} className={`text-xs font-medium px-3 py-1.5 rounded border ${met === true ? 'bg-rose-700 text-white border-rose-700' : 'border-gray-300 hover:bg-gray-50'}`}>Yes</button>
            <button onClick={() => setMet(false)} className={`text-xs font-medium px-3 py-1.5 rounded border ${met === false ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 hover:bg-gray-50'}`}>No, did not happen</button>
          </div>
        </div>

        {met === true && (
          <>
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">A second date in your future?</p>
              <div className="flex gap-2">
                <button onClick={() => setSecondDate(true)} className={`text-xs font-medium px-3 py-1.5 rounded border ${secondDate === true ? 'bg-emerald-700 text-white border-emerald-700' : 'border-gray-300 hover:bg-gray-50'}`}>Likely yes</button>
                <button onClick={() => setSecondDate(false)} className={`text-xs font-medium px-3 py-1.5 rounded border ${secondDate === false ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 hover:bg-gray-50'}`}>Probably not</button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">How well did the memo predict the actual person?</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { v: 'spot-on' as const, label: 'Spot on' },
                  { v: 'close' as const, label: 'Close, some misses' },
                  { v: 'off' as const, label: 'Off' },
                ].map(o => (
                  <button key={o.v} onClick={() => setCalibration(o.v)} className={`text-xs font-medium px-3 py-1.5 rounded border ${calibration === o.v ? 'bg-rose-700 text-white border-rose-700' : 'border-gray-300 hover:bg-gray-50'}`}>{o.label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Anything specific to calibrate? (private)</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="What surprised you, what was misread, what to watch for next time" className="w-full text-sm border rounded px-2 py-1.5" />
        </div>

        {err && <p className="text-xs text-red-700">{err}</p>}

        <button disabled={busy || met == null} onClick={submit} className="text-xs font-medium bg-rose-700 hover:bg-rose-800 text-white px-3 py-1.5 rounded disabled:opacity-50">{busy ? 'Sending...' : 'Send feedback'}</button>
      </div>
    </div>
  )
}
