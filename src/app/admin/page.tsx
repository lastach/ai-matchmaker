'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Person = { id: string; firstName?: string; age?: number | null; photoUrl?: string | null }
type MatchRow = {
  id: string
  cycle: string
  city_key: string
  score: number
  status: string
  date_idea?: string
  venue_name?: string
  venue_address?: string
  date_at?: string
  a_attending?: string | null
  b_attending?: string | null
  breakdown: { points?: Record<string, number>; flags?: string[]; why?: string; aScore?: number; bScore?: number }
  a: Person
  b: Person
}

const LABELS: Record<string, string> = { mustHaves: 'Must-haves', values: 'Values', attraction: 'Attraction', goodPartner: 'Good partner', energy: 'Energy' }

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [cities, setCities] = useState<Record<string, { members: number; complete: number }>>({})
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const load = async () => {
    const r = await fetch('/api/v2/admin/matches', { credentials: 'include' })
    if (r.status === 403) { setAuthorized(false); setAuthChecked(true); return }
    const d = await r.json()
    setCities(d.cities || {})
    setMatches(d.matches || [])
    setAuthorized(r.ok)
    setAuthChecked(true)
    if (!r.ok) setStatus(d.error || 'Could not load')
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth?next=/admin'; return }
      await load()
    })()
  }, [])

  const run = async (city: string) => {
    setRunning(city)
    setStatus('Running matching for ' + city + '…')
    try {
      for (let i = 0; i < 100; i++) {
        const r = await fetch('/api/v2/admin/run', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city }) })
        const d = await r.json()
        if (!r.ok) { setStatus('Failed: ' + (d.error || r.status)); break }
        if (d.done) {
          setStatus(`${city}: ${d.members} members, ${d.pairsAfterGates} pairs passed the basic gates, ${d.validPairs} passed every gate, ${d.proposed} matches proposed, ${d.unmatched} unmatched this month.`)
          break
        }
        setStatus(`${city}: evaluating pairs, ${d.remaining} to go…`)
      }
      await load()
    } finally {
      setRunning(null)
    }
  }

  if (!authChecked) return <main className="p-12 text-gray-500">Loading…</main>
  if (!authorized) {
    return (
      <main className="p-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Not authorized</h1>
        <p className="text-gray-600">{status || 'Your account is not on the admin list.'}</p>
      </main>
    )
  }

  const proposed = matches.filter((m) => m.status === 'proposed')
  const upcoming = matches.filter((m) => m.status !== 'proposed')
  return (
    <main className="max-w-6xl mx-auto p-6 text-gray-900">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Amorlay matchmaker</h1>
        <p className="text-gray-600 mt-1">Run the monthly matching per city, review each proposed pair, then set the date both people will see.</p>
      </header>

      <section className="bg-white rounded-xl p-5 shadow-sm border mb-6">
        <h2 className="font-semibold mb-3">Cities</h2>
        {Object.keys(cities).length === 0 && <p className="text-sm text-gray-500">No members yet.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(cities).sort((a, b) => b[1].complete - a[1].complete).map(([city, c]) => (
            <div key={city} className="border rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium capitalize">{city}</p>
                <p className="text-xs text-gray-500">{c.complete} finished intake, {c.members} signed up</p>
              </div>
              <button onClick={() => run(city)} disabled={!!running} className="shrink-0 text-sm bg-[#2E1A47] text-white px-3 py-1.5 rounded disabled:opacity-50">
                {running === city ? 'Running…' : 'Run matching'}
              </button>
            </div>
          ))}
        </div>
        {status && <p className="text-sm text-gray-700 mt-3">{status}</p>}
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-3">Proposed matches ({proposed.length})</h2>
        <div className="space-y-4">
          {proposed.map((m) => <Proposal key={m.id} m={m} onDone={load} />)}
          {proposed.length === 0 && <p className="text-sm text-gray-500">None waiting for review.</p>}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Scheduled dates ({upcoming.length})</h2>
        <div className="space-y-2">
          {upcoming.map((m) => (
            <div key={m.id} className="bg-white border rounded-lg p-3 text-sm flex flex-wrap items-center justify-between gap-2">
              <span><b>{m.a.firstName}</b> and <b>{m.b.firstName}</b>, {m.date_at ? new Date(m.date_at).toLocaleString() : 'no time'} at {m.venue_name}</span>
              <span className="text-xs text-gray-600">
                {m.status === 'needs_reschedule' ? 'Needs a new time' : m.status} · {m.a.firstName}: {m.a_attending || 'not confirmed'} · {m.b.firstName}: {m.b_attending || 'not confirmed'}
              </span>
              {m.status === 'needs_reschedule' && <Reschedule m={m} onDone={load} />}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function ScheduleForm({ m, onDone, label }: { m: MatchRow; onDone: () => void; label: string }) {
  const [venue, setVenue] = useState(m.venue_name || '')
  const [address, setAddress] = useState(m.venue_address || '')
  const [when, setWhen] = useState('')
  const [err, setErr] = useState('')
  const post = async (action: string) => {
    setErr('')
    const r = await fetch('/api/v2/admin/matches', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matchId: m.id, action, venueName: venue, venueAddress: address, dateAt: when ? new Date(when).toISOString() : '' }),
    })
    const d = await r.json()
    if (!r.ok) setErr(d.error || 'failed')
    else onDone()
  }
  return (
    <div className="mt-3 grid sm:grid-cols-4 gap-2 items-end">
      <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" className="border rounded px-2 py-1.5 text-sm" />
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="border rounded px-2 py-1.5 text-sm" />
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
      <div className="flex gap-2">
        <button onClick={() => post('schedule')} className="text-sm bg-[#D4537E] text-white px-3 py-1.5 rounded">{label}</button>
        <button onClick={() => post('cancel')} className="text-sm text-gray-600 underline">Drop</button>
      </div>
      {err && <p className="text-xs text-red-700 sm:col-span-4">{err}</p>}
    </div>
  )
}

function Reschedule({ m, onDone }: { m: MatchRow; onDone: () => void }) {
  return <div className="w-full"><ScheduleForm m={m} onDone={onDone} label="Set new time" /></div>
}

function Proposal({ m, onDone }: { m: MatchRow; onDone: () => void }) {
  const pts = m.breakdown?.points || {}
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-4">
        {[m.a, m.b].map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <div className="h-14 w-14 rounded-lg bg-gray-100" />}
            <div><p className="font-semibold">{p.firstName}</p><p className="text-xs text-gray-500">{p.age ?? '?'}</p></div>
          </div>
        ))}
        <p className="ml-auto text-2xl font-bold text-[#B23F68]">{Math.round(m.score)}<span className="text-xs text-gray-500"> / 100</span></p>
      </div>
      <div className="grid grid-cols-5 gap-2 text-xs text-gray-600 mt-3">
        {Object.keys(LABELS).map((k) => <div key={k}><div className="font-medium">{LABELS[k]}</div><div>{(pts[k] ?? 0).toFixed(1)}</div></div>)}
      </div>
      {m.breakdown?.why && <p className="text-sm text-gray-800 mt-3">{m.breakdown.why}</p>}
      {(m.breakdown?.flags || []).map((f, i) => <p key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">Flag: {f}</p>)}
      {m.date_idea && <p className="text-sm text-gray-600 mt-2">Date idea: {m.date_idea}</p>}
      <ScheduleForm m={m} onDone={onDone} label="Schedule date" />
    </div>
  )
}
