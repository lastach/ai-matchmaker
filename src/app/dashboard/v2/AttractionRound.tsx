'use client'

import { useEffect, useState } from 'react'
import { api, Button, Card, ErrorNote } from './ui'

type Item = { id: string; firstName: string; age: number | null; photoUrl: string; clipUrl?: string | null; about?: string | null }

const SCALE = [
  { v: 1, label: 'Not for me' },
  { v: 2, label: 'Probably not' },
  { v: 3, label: 'Maybe' },
  { v: 4, label: 'Drawn to' },
  { v: 5, label: 'Very drawn to' },
]

/**
 * Two short rounds on real members of the city cohort:
 * 1. photos alone (learns their type), 2. the same people with their intro clip or "about"
 * (measures how much personality moves them).
 */
export default function AttractionRound({ onFinished }: { onFinished?: () => void }) {
  const [stage, setStage] = useState<'photo' | 'video'>('photo')
  const [items, setItems] = useState<Item[]>([])
  const [remaining, setRemaining] = useState(0)
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (s: 'photo' | 'video') => {
    setLoading(true)
    setError(null)
    try {
      const d = await api<{ items: Item[]; remaining: number }>(`/api/v2/attraction?stage=${s}`)
      if (s === 'photo' && d.items.length === 0) {
        setStage('video')
        const v = await api<{ items: Item[]; remaining: number }>('/api/v2/attraction?stage=video')
        setItems(v.items)
        setRemaining(v.remaining)
      } else {
        setStage(s)
        setItems(d.items)
        setRemaining(d.remaining)
      }
      setIdx(0)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load('photo') }, [])

  const rate = async (v: number) => {
    const it = items[idx]
    if (!it) return
    try {
      await api('/api/v2/attraction', { method: 'POST', body: JSON.stringify({ targetId: it.id, stage, rating: v }) })
      if (idx + 1 < items.length) setIdx(idx + 1)
      else await load(stage)
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <Card><p className="text-sm text-[#6B7280]">Loading…</p></Card>
  const it = items[idx]
  if (!it) {
    return (
      <Card>
        <h2 className="text-lg font-bold text-[#1F2937]">You’re all caught up</h2>
        <p className="text-sm text-[#6B7280] mt-1">We’ll ask you to rate new members as they join your city.</p>
        {onFinished && <div className="mt-3"><Button variant="secondary" onClick={onFinished}>Back</Button></div>}
        <ErrorNote error={error} />
      </Card>
    )
  }
  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-[#B23F68] font-semibold">{stage === 'photo' ? 'Round 1: first impressions' : 'Round 2: same people, a little more of them'}</p>
      <p className="text-sm text-[#6B7280] mt-1">{stage === 'photo' ? 'Go with your gut. Nobody sees your ratings.' : 'Rate again now that you can see more of who they are.'} {remaining} to go.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <img src={it.photoUrl} alt={it.firstName} className="w-full aspect-[4/5] object-cover rounded-xl" />
        {stage === 'video' && (
          <div className="flex flex-col gap-3">
            {it.clipUrl ? <video src={it.clipUrl} controls playsInline className="w-full rounded-xl bg-black" /> : null}
            {it.about ? <p className="text-[15px] text-[#1F2937] bg-[#F4F1EE] rounded-xl p-4">{it.about}</p> : null}
          </div>
        )}
      </div>
      <p className="mt-3 font-semibold text-[#1F2937]">{it.firstName}{it.age ? `, ${it.age}` : ''}</p>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {SCALE.map((s) => (
          <button key={s.v} onClick={() => rate(s.v)} className="rounded-lg border border-[#E5E7EB] hover:border-[#D4537E] hover:bg-[#FDF0F4] px-1 py-2 text-xs text-[#374151]">{s.label}</button>
        ))}
      </div>
      <ErrorNote error={error} />
    </Card>
  )
}
