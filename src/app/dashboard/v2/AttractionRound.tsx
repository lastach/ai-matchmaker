'use client'

import { useEffect, useState } from 'react'
import { api, Button, Card, ErrorNote } from './ui'

type Item = { id: string; src: string; snippet?: string }
type Side = { value: string; label: string; faces: string[] }
type Features = {
  comparisons: Array<{ feature: string; label: string; a: Side; b: Side }>
  chips: Array<{ feature: string; label: string; options: string[] }>
}
type Batch = { stage: 'photo' | 'about' | 'features' | 'done'; items: Item[]; features?: Features; done: number; total: number }

const SCALE = [
  { v: 1, label: 'Not for me' },
  { v: 2, label: 'Probably not' },
  { v: 3, label: 'Maybe' },
  { v: 4, label: 'Drawn to' },
  { v: 5, label: 'Very drawn to' },
]

/**
 * "Your type": rate example photos (stock portraits, never other members).
 * Round 1 learns the look someone is drawn to; round 2 adds a short personality snippet
 * to see how much personality moves them.
 */
export default function AttractionRound({ onFinished }: { onFinished: () => void }) {
  const [batch, setBatch] = useState<Batch | null>(null)
  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const d = await api<Batch>('/api/v2/attraction')
      setBatch(d)
      setIdx(0)
    } catch (e: any) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  // Preload the next photo so it appears instantly.
  useEffect(() => {
    const next = batch?.items[idx + 1]
    if (next) { const im = new Image(); im.src = next.src }
  }, [batch, idx])

  const rate = async (v: number) => {
    const it = batch?.items[idx]
    if (!it || busy || !batch) return
    setBusy(true)
    try {
      await api('/api/v2/attraction', { method: 'POST', body: JSON.stringify({ exampleId: it.id, stage: batch.stage, rating: v }) })
      if (idx + 1 < batch.items.length) {
        setIdx(idx + 1)
        setBatch({ ...batch, done: batch.done + 1 })
      } else await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    setBusy(true)
    try {
      await api('/api/v2/attraction', { method: 'POST', body: JSON.stringify({ finish: true }) })
      onFinished()
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (!batch) return <Card><p className="text-sm text-[#6B7280]">Loading…</p><ErrorNote error={error} /></Card>

  if (batch.stage === 'features' && batch.features) {
    return <FeaturesStep features={batch.features} onSaved={load} />
  }

  if (batch.stage === 'done') {
    return (
      <Card>
        <h1 className="text-2xl font-bold text-[#1F2937]">Got it</h1>
        <p className="text-[15px] text-[#4B5563] mt-2">We now have a good read on the look and the kind of personality you’re drawn to. Nobody sees your ratings, and these were example photos, not members.</p>
        <div className="mt-5 flex justify-end"><Button onClick={finish} disabled={busy}>Continue</Button></div>
        <ErrorNote error={error} />
      </Card>
    )
  }

  const it = batch.items[idx]
  const pct = Math.round((batch.done / Math.max(1, batch.total)) * 100)
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#1F2937]">{batch.stage === 'photo' ? 'Show us your type' : 'Now with a little personality'}</h1>
        <span className="text-xs text-[#6B7280] whitespace-nowrap">{batch.done} of {batch.total}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#EDE7E0]"><div className="h-1.5 rounded-full bg-[#D4537E] transition-all" style={{ width: `${pct}%` }} /></div>
      <p className="text-sm text-[#6B7280] mt-3">
        {batch.stage === 'photo'
          ? 'These are example photos, not members. Go with your gut on each one. Nobody sees your ratings.'
          : 'Some of the same people, with a line about them. Rate again with that in mind.'}
      </p>
      <div className={`mt-4 grid gap-3 ${it.snippet ? 'sm:grid-cols-2' : ''}`}>
        <img src={it.src} alt="Example person" className={`w-full ${it.snippet ? 'aspect-[4/5]' : 'max-h-[56vh] aspect-[4/5]'} object-cover rounded-xl bg-[#F4F1EE]`} />
        {it.snippet && <p className="text-[17px] leading-relaxed text-[#1F2937] bg-[#F4F1EE] rounded-xl p-5 self-start">“{it.snippet}”</p>}
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {SCALE.map((s) => (
          <button key={s.v} onClick={() => rate(s.v)} disabled={busy}
            className="rounded-lg border border-[#E5E7EB] hover:border-[#D4537E] hover:bg-[#FDF0F4] px-1 py-3 text-xs sm:text-sm text-[#374151] disabled:opacity-50">{s.label}</button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[#9CA3AF]">Example photos from Pexels.</p>
      <ErrorNote error={error} />
    </Card>
  )
}

const CHIP_LABELS: Record<string, string> = {
  slim: 'Slim', average: 'Average', athletic: 'Athletic', fuller: 'Fuller',
  black: 'Black', brown: 'Brown', blonde: 'Blonde', red: 'Red', gray: 'Gray',
  none: 'Clean shaven', stubble: 'Stubble', beard: 'Beard',
}

/** Faces side by side, one feature at a time, then build, hair color and facial hair. */
function FeaturesStep({ features, onSaved }: { features: Features; onSaved: () => void }) {
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const n = features.comparisons.length
  const c = features.comparisons[i]

  const choose = (v: string) => {
    setAnswers((a) => ({ ...a, [c.feature]: v }))
    setI(i + 1)
  }
  const toggle = (feature: string, v: string) => setAnswers((a) => {
    const list: string[] = Array.isArray(a[feature]) ? a[feature] : []
    return { ...a, [feature]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] }
  })
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await api('/api/v2/attraction', { method: 'POST', body: JSON.stringify({ stage: 'features', answers }) })
      onSaved()
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  const SideCard = ({ side, pick }: { side: Side; pick: () => void }) => (
    <button type="button" onClick={pick} className="rounded-xl border border-[#E5E7EB] hover:border-[#D4537E] hover:bg-[#FDF0F4] p-2 text-left">
      <div className="grid grid-cols-3 gap-1">
        {side.faces.map((f) => <img key={f} src={f} alt="" className="w-full aspect-square object-cover rounded-md bg-[#F4F1EE]" />)}
      </div>
      <p className="mt-2 text-sm font-medium text-[#1F2937] text-center">{side.label}</p>
    </button>
  )

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#1F2937]">What draws you in</h1>
        <span className="text-xs text-[#6B7280] whitespace-nowrap">{Math.min(i + 1, n + 1)} of {n + 1}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#EDE7E0]"><div className="h-1.5 rounded-full bg-[#D4537E] transition-all" style={{ width: `${Math.round((i / (n + 1)) * 100)}%` }} /></div>
      {c ? (
        <>
          <p className="text-sm text-[#6B7280] mt-3">{c.label}: which are you more drawn to? These are example faces, not members.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SideCard side={c.a} pick={() => choose(c.a.value)} />
            <SideCard side={c.b} pick={() => choose(c.b.value)} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" className="text-sm text-[#6B7280] underline disabled:opacity-40" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
            <Button variant="secondary" onClick={() => choose('none')}>No preference</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-[#6B7280] mt-3">Anything else you’re drawn to? Pick any that apply, or leave a row empty for no preference.</p>
          <div className="mt-4 space-y-4">
            {features.chips.map((g) => (
              <div key={g.feature}>
                <p className="text-sm font-medium text-[#1F2937]">{g.label}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {g.options.map((o) => {
                    const on = (answers[g.feature] || []).includes(o)
                    return (
                      <button key={o} type="button" onClick={() => toggle(g.feature, o)}
                        className={`px-3 py-2 rounded-lg border text-sm ${on ? 'bg-[#2E1A47] text-white border-[#2E1A47]' : 'border-[#E5E7EB] text-[#374151]'}`}>{CHIP_LABELS[o] || o}</button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <button type="button" className="text-sm text-[#6B7280] underline" onClick={() => setI(n - 1)}>Back</button>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Continue'}</Button>
          </div>
        </>
      )}
      <p className="mt-3 text-[11px] text-[#9CA3AF]">Example photos from Pexels. Nobody sees your answers.</p>
      <ErrorNote error={error} />
    </Card>
  )
}
