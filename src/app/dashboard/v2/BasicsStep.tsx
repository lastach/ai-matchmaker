'use client'

import { useState } from 'react'
import type { Basics } from '@/lib/v2/types'
import { api, Button, Card, ErrorNote } from './ui'

const INTERESTS = [
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'nonbinary', label: 'Nonbinary people' },
  { key: 'anyone', label: 'Anyone' },
] as const

export default function BasicsStep({ initial, onDone }: { initial: Basics; onDone: () => void }) {
  const [b, setB] = useState<Basics>({ ageMin: 28, ageMax: 45, interestedIn: [], ...initial })
  const [adult, setAdult] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Basics>) => setB((x) => ({ ...x, ...patch }))
  const toggleInterest = (k: any) => {
    const cur = new Set(b.interestedIn || [])
    if (k === 'anyone') { set({ interestedIn: cur.has('anyone') ? [] : ['anyone'] }); return }
    cur.delete('anyone')
    if (cur.has(k)) cur.delete(k); else cur.add(k)
    set({ interestedIn: Array.from(cur) as any })
  }

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      const gender = b.gender === 'self' ? (b.genderSelfDescribe || '').trim().toLowerCase() || 'self-described' : b.gender
      await api('/api/v2/profile', { method: 'POST', body: JSON.stringify({ basics: { ...b, gender } }) })
      onDone()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full mt-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E]'
  return (
    <Card>
      <h1 className="text-2xl font-bold text-[#1F2937]">First, the basics</h1>
      <p className="text-sm text-[#6B7280] mt-1">Just the logistics. Everything about who you are and who you want comes next, in a conversation.</p>
      <p className="text-sm text-[#4B5563] mt-3 bg-[#FDF0F4] border border-[#F5D0DC] rounded-lg px-3 py-2">We’re opening city by city. Set up your profile now and we’ll let you know as soon as we’re matching where you live.</p>
      <div className="mt-5 grid gap-4">
        <label className="text-sm font-medium text-[#1F2937]">First name
          <input className={input} value={b.firstName || ''} onChange={(e) => set({ firstName: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-[#1F2937]">Birth date
          <input type="date" className={input} value={b.birthDate || ''} onChange={(e) => set({ birthDate: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-[#1F2937]">City
          <input className={input} placeholder="Boston, MA" value={b.city || ''} onChange={(e) => set({ city: e.target.value })} />
        </label>
        <div className="text-sm font-medium text-[#1F2937]">I am
          <div className="flex flex-wrap gap-2 mt-2">
            {[['woman', 'A woman'], ['man', 'A man'], ['nonbinary', 'Nonbinary'], ['self', 'Let me describe']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => set({ gender: k })} className={`px-3 py-2 rounded-lg border text-sm ${b.gender === k ? 'bg-[#2E1A47] text-white border-[#2E1A47]' : 'border-[#E5E7EB] text-[#374151]'}`}>{l}</button>
            ))}
          </div>
          {b.gender === 'self' && <input className={input} placeholder="In your words" value={b.genderSelfDescribe || ''} onChange={(e) => set({ genderSelfDescribe: e.target.value })} />}
        </div>
        <div className="text-sm font-medium text-[#1F2937]">I want to meet
          <div className="flex flex-wrap gap-2 mt-2">
            {INTERESTS.map((o) => (
              <button key={o.key} type="button" onClick={() => toggleInterest(o.key)} className={`px-3 py-2 rounded-lg border text-sm ${(b.interestedIn || []).includes(o.key) ? 'bg-[#2E1A47] text-white border-[#2E1A47]' : 'border-[#E5E7EB] text-[#374151]'}`}>{o.label}</button>
            ))}
          </div>
        </div>
        <div className="text-sm font-medium text-[#1F2937]">Ages
          <div className="flex items-center gap-2 mt-1">
            <input type="number" min={18} max={99} className={input} value={b.ageMin ?? ''} onChange={(e) => set({ ageMin: Number(e.target.value) })} />
            <span className="text-[#6B7280]">to</span>
            <input type="number" min={18} max={99} className={input} value={b.ageMax ?? ''} onChange={(e) => set({ ageMax: Number(e.target.value) })} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-[#4B5563]">
          <input type="checkbox" className="mt-1" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          I confirm I am 18 or older.
        </label>
      </div>
      <ErrorNote error={error} />
      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={!adult || saving}>{saving ? 'Saving…' : 'Start the conversation'}</Button>
      </div>
    </Card>
  )
}
