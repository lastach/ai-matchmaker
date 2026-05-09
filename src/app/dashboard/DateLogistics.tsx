'use client'

import { useEffect, useState } from 'react'

type Plan = {
  id: string
  match_pair_id: string
  proposed_by_user_id: string
  venue_name?: string
  venue_address?: string
  scheduled_at: string
  notes?: string
  who_books?: 'me' | 'them' | 'split'
  who_pays?: 'me' | 'them' | 'split'
  status: 'proposed' | 'counter' | 'confirmed' | 'cancelled'
  confirmed_at?: string
  created_at: string
}

export default function DateLogistics({ matchPairId, currentUserId }: { matchPairId: string; currentUserId: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showProposeForm, setShowProposeForm] = useState(false)
  const [form, setForm] = useState({
    venue_name: '',
    venue_address: '',
    scheduled_at: '',
    notes: '',
    who_books: 'me',
    who_pays: 'split',
  })

  async function load() {
    setLoading(true); setErr(null)
    try {
      const r = await fetch(`/api/date/plan?match_pair_id=${matchPairId}`)
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'failed'); return }
      setPlans(d.plans || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [matchPairId])

  async function propose(action: 'propose' | 'counter') {
    if (!form.scheduled_at) { alert('Please pick a date and time.'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/date/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, action, match_pair_id: matchPairId }),
      })
      const d = await r.json()
      if (!r.ok) { alert(d.error || 'failed'); return }
      setShowProposeForm(false)
      setForm({ venue_name: '', venue_address: '', scheduled_at: '', notes: '', who_books: 'me', who_pays: 'split' })
      await load()
    } finally { setBusy(false) }
  }

  async function respond(planId: string, action: 'confirm' | 'cancel') {
    setBusy(true)
    try {
      const r = await fetch('/api/date/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, plan_id: planId, match_pair_id: matchPairId }),
      })
      const d = await r.json()
      if (!r.ok) { alert(d.error || 'failed'); return }
      await load()
    } finally { setBusy(false) }
  }

  const latest = plans[0]
  const confirmed = plans.find(p => p.status === 'confirmed')

  if (loading) return <div className="bg-white rounded-xl border p-4 text-sm text-gray-500">Loading date plans...</div>
  if (err === 'not in pair or both must accept first') {
    return (
      <div className="bg-white rounded-xl border p-4 text-sm text-gray-600">
        Date logistics unlock once you both accept the match.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">Plan your first meeting</h3>
          <p className="text-xs text-gray-500 mt-0.5">Pick a place and time. The other person confirms or counter-proposes.</p>
        </div>
        {!confirmed && !showProposeForm && (
          <button onClick={() => setShowProposeForm(true)} className="text-xs font-medium bg-rose-700 hover:bg-rose-800 text-white px-3 py-1.5 rounded">Propose</button>
        )}
      </div>

      {confirmed && (
        <div className="mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <p className="text-sm font-semibold text-emerald-900">Confirmed</p>
          <p className="text-sm text-gray-900 mt-1">{new Date(confirmed.scheduled_at).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
          {confirmed.venue_name && <p className="text-sm text-gray-700">{confirmed.venue_name}{confirmed.venue_address ? ` - ${confirmed.venue_address}` : ''}</p>}
          {confirmed.who_books && <p className="text-xs text-gray-600 mt-1">Booking: {confirmed.who_books === 'me' ? 'you' : confirmed.who_books === 'them' ? 'them' : 'split'} · Pays: {confirmed.who_pays === 'me' ? 'you' : confirmed.who_pays === 'them' ? 'them' : 'split'}</p>}
          {confirmed.notes && <p className="text-xs text-gray-600 mt-1 italic">{confirmed.notes}</p>}
          <button onClick={() => respond(confirmed.id, 'cancel')} disabled={busy} className="mt-2 text-[11px] text-red-700 hover:underline">Cancel this plan</button>
        </div>
      )}

      {showProposeForm && (
        <div className="mb-3 p-3 rounded-lg border bg-gray-50 space-y-2">
          <input placeholder="Venue (cafe, bar, restaurant, etc.)" value={form.venue_name} onChange={e => setForm({ ...form, venue_name: e.target.value })} className="w-full text-sm border rounded px-2 py-1.5" />
          <input placeholder="Address (optional)" value={form.venue_address} onChange={e => setForm({ ...form, venue_address: e.target.value })} className="w-full text-sm border rounded px-2 py-1.5" />
          <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} className="w-full text-sm border rounded px-2 py-1.5" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-700">Who books
              <select value={form.who_books} onChange={e => setForm({ ...form, who_books: e.target.value })} className="w-full text-sm border rounded px-2 py-1 mt-1">
                <option value="me">I will book</option>
                <option value="them">They book</option>
                <option value="split">Either is fine</option>
              </select>
            </label>
            <label className="text-xs text-gray-700">Who pays
              <select value={form.who_pays} onChange={e => setForm({ ...form, who_pays: e.target.value })} className="w-full text-sm border rounded px-2 py-1 mt-1">
                <option value="me">I will cover</option>
                <option value="them">They cover</option>
                <option value="split">Split</option>
              </select>
            </label>
          </div>
          <textarea placeholder="Anything they should know (parking, allergies, time constraints)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full text-sm border rounded px-2 py-1.5" rows={2} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => propose('propose')} className="text-xs font-medium bg-rose-700 hover:bg-rose-800 text-white px-3 py-1.5 rounded disabled:opacity-50">{busy ? 'Sending...' : 'Send proposal'}</button>
            <button onClick={() => setShowProposeForm(false)} className="text-xs font-medium border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded">Cancel</button>
          </div>
        </div>
      )}

      {plans.length === 0 && !showProposeForm && (
        <p className="text-sm text-gray-500 italic">No proposals yet. Be the first to suggest a place and time.</p>
      )}

      {plans.length > 0 && !confirmed && (
        <div className="space-y-2">
          {plans.map(p => {
            const fromMe = p.proposed_by_user_id === currentUserId
            const canConfirm = !fromMe && p.status === 'proposed'
            const canCounter = !fromMe && (p.status === 'proposed' || p.status === 'counter')
            return (
              <div key={p.id} className={`p-3 rounded-lg border ${p.status === 'confirmed' ? 'border-emerald-200 bg-emerald-50' : p.status === 'cancelled' ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${p.status === 'proposed' ? 'bg-rose-100 text-rose-800' : p.status === 'counter' ? 'bg-amber-100 text-amber-800' : p.status === 'cancelled' ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-800'}`}>{p.status}</span>
                      <span className="text-[11px] text-gray-500">{fromMe ? 'You proposed' : 'They proposed'}</span>
                    </div>
                    <p className="text-sm text-gray-900 mt-1">{new Date(p.scheduled_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    {p.venue_name && <p className="text-sm text-gray-700">{p.venue_name}{p.venue_address ? ` - ${p.venue_address}` : ''}</p>}
                    {(p.who_books || p.who_pays) && (
                      <p className="text-[11px] text-gray-500 mt-0.5">Booking: {p.who_books || '-'} · Pays: {p.who_pays || '-'}</p>
                    )}
                    {p.notes && <p className="text-xs text-gray-600 mt-1 italic">{p.notes}</p>}
                  </div>
                </div>
                {(canConfirm || canCounter) && (
                  <div className="flex gap-2 mt-2">
                    {canConfirm && <button disabled={busy} onClick={() => respond(p.id, 'confirm')} className="text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded disabled:opacity-50">Confirm</button>}
                    {canCounter && <button disabled={busy} onClick={() => setShowProposeForm(true)} className="text-xs font-medium border border-gray-300 hover:bg-gray-50 px-3 py-1 rounded">Counter-propose</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
