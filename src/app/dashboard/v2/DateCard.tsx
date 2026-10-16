'use client'

import { useEffect, useRef, useState } from 'react'
import MicButton from './MicButton'
import { api, Button, Card, ErrorNote } from './ui'

export type Match = {
  id: string
  status: string
  dateAt: string | null
  venueName: string | null
  venueAddress: string | null
  dateIdea: string | null
  myAttending: 'yes' | 'no' | null
  partnerConfirmed: boolean
  partner: { firstName: string; age: number | null }
  debriefOpen: boolean
  debriefDone: boolean
  mutualSecondDate: boolean
  partnerContact: string | null
}

type Prep = { why: string; feelUnderstood: string; questions: string[]; reminders: string[]; note: string }

function when(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** The match arrives as a planned date. No messaging beforehand. */
export default function DateCard({ match, onChange }: { match: Match; onChange: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [prep, setPrep] = useState<Prep | null>(null)
  const [prepLoading, setPrepLoading] = useState(false)

  const attend = async (a: 'yes' | 'no') => {
    setError(null)
    try {
      await api('/api/v2/match', { method: 'POST', body: JSON.stringify({ matchId: match.id, attending: a }) })
      onChange()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const loadPrep = async () => {
    setPrepLoading(true)
    setError(null)
    try {
      const d = await api<{ prep: Prep }>(`/api/v2/coach/prep?matchId=${match.id}`)
      setPrep(d.prep)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPrepLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-[#D4537E]/40">
        <p className="text-xs uppercase tracking-wider text-[#B23F68] font-semibold">You have a match</p>
        <div className="mt-3">
          <div>
            <p className="text-xl font-bold text-[#1F2937]">{match.partner.firstName}{match.partner.age ? `, ${match.partner.age}` : ''}</p>
            {match.status === 'needs_reschedule' ? (
              <p className="text-sm text-[#6B7280] mt-1">We’re finding a new time and will update this.</p>
            ) : (
              <>
                <p className="text-[15px] text-[#1F2937] mt-1">Your date is <b>{when(match.dateAt)}</b></p>
                <p className="text-[15px] text-[#1F2937]">at <b>{match.venueName}</b>{match.venueAddress ? `, ${match.venueAddress}` : ''}</p>
                <p className="text-sm text-[#6B7280] mt-2">You won’t see each other’s photos before the date. When you arrive, ask for the reservation under “Amorlay.”</p>
              </>
            )}
          </div>
        </div>
        {!match.debriefOpen && match.status !== 'needs_reschedule' && (
          <div className="mt-4">
            {match.myAttending === 'yes' ? (
              <p className="text-sm text-[#166534]">You’re confirmed{match.partnerConfirmed ? ', and so is ' + match.partner.firstName : '. Waiting on ' + match.partner.firstName + ' to confirm'}.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => attend('yes')}>I’ll be there</Button>
                <Button variant="secondary" onClick={() => attend('no')}>I can’t make this time</Button>
              </div>
            )}
          </div>
        )}
        <ErrorNote error={error} />
      </Card>

      {!match.debriefOpen && match.status !== 'needs_reschedule' && (
        <Card>
          <h2 className="text-lg font-bold text-[#1F2937]">Your date coach</h2>
          {!prep ? (
            <div className="mt-2">
              <p className="text-sm text-[#6B7280]">A short brief to help you both have a good time.</p>
              <div className="mt-3"><Button onClick={loadPrep} disabled={prepLoading}>{prepLoading ? 'Preparing…' : 'Get my brief'}</Button></div>
            </div>
          ) : (
            <div className="mt-3 space-y-4 text-[15px] text-[#1F2937]">
              <section><p className="font-semibold">Why you two</p><p className="mt-1">{prep.why}</p></section>
              {prep.feelUnderstood && <section><p className="font-semibold">What helps {match.partner.firstName} feel understood</p><p className="mt-1">{prep.feelUnderstood}</p></section>}
              {prep.questions.length > 0 && (
                <section><p className="font-semibold">Questions to go past small talk</p>
                  <ul className="mt-1 list-disc pl-5 space-y-1">{prep.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></section>
              )}
              <section><p className="font-semibold">Keep in mind</p>
                <ul className="mt-1 list-disc pl-5 space-y-1">{prep.reminders.map((q, i) => <li key={i}>{q}</li>)}</ul></section>
              {prep.note && <p className="text-sm text-[#6B7280]">{prep.note}</p>}
            </div>
          )}
        </Card>
      )}

      {match.debriefOpen && <Debrief match={match} onChange={onChange} />}
    </div>
  )
}

function Debrief({ match, onChange }: { match: Match; onChange: () => void }) {
  type Msg = { role: 'user' | 'assistant'; content: string }
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(match.debriefDone)
  const [outcome, setOutcome] = useState<any>(null)
  const [contact, setContact] = useState('')
  const [savedContact, setSavedContact] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const send = async (text: string) => {
    setBusy(true)
    setError(null)
    if (text) setMessages((m) => [...m, { role: 'user', content: text }])
    try {
      const d = await api<{ reply: string; done: boolean; outcome?: any }>('/api/v2/coach/debrief', { method: 'POST', body: JSON.stringify({ matchId: match.id, message: text }) })
      setMessages((m) => [...m, { role: 'assistant', content: d.reply }])
      if (d.done) { setDone(true); setOutcome(d.outcome) }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (!started.current && !match.debriefDone) { started.current = true; send('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveContact = async () => {
    try {
      await api('/api/v2/coach/debrief', { method: 'POST', body: JSON.stringify({ matchId: match.id, shareContact: contact }) })
      setSavedContact(true)
      onChange()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const wantsSecond = outcome?.secondDate
  return (
    <Card>
      <h2 className="text-lg font-bold text-[#1F2937]">How did it go?</h2>
      {match.mutualSecondDate && (
        <p className="mt-2 text-[15px] text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-3">
          You both want a second date. {match.partnerContact ? `${match.partner.firstName} shared: ${match.partnerContact}` : `${match.partner.firstName} hasn’t added contact details yet.`}
        </p>
      )}
      {messages.length > 0 && (
        <div className="mt-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] ${m.role === 'user' ? 'bg-[#D4537E] text-white' : 'bg-[#F4F1EE] text-[#1F2937]'}`}>{m.content}</div>
            </div>
          ))}
        </div>
      )}
      {!done && (
        <div className="mt-3 flex gap-2 items-end">
          <MicButton disabled={busy} onText={(t) => setInput((v) => (v.trim() ? v.trimEnd() + ' ' : '') + t)} />
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Type, or tap the mic and talk"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim()) { const t = input.trim(); setInput(''); send(t) } } }}
            className="flex-1 px-4 py-3 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4537E] resize-none" />
          <Button onClick={() => { const t = input.trim(); if (t) { setInput(''); send(t) } }} disabled={busy || !input.trim()}>Send</Button>
        </div>
      )}
      {done && (wantsSecond || match.debriefDone) && !match.mutualSecondDate && !savedContact && (
        <div className="mt-4">
          <p className="text-sm text-[#1F2937]">If {match.partner.firstName} also wants a second date, we’ll show them this (an email or handle you’re comfortable sharing):</p>
          <div className="mt-2 flex gap-2">
            <input value={contact} onChange={(e) => setContact(e.target.value)} className="flex-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg" placeholder="you@example.com" />
            <Button onClick={saveContact} disabled={!contact.trim()}>Save</Button>
          </div>
        </div>
      )}
      {savedContact && <p className="mt-3 text-sm text-[#6B7280]">Saved. If it’s mutual, you’ll both see each other’s details here.</p>}
      <p className="mt-3 text-xs text-[#9CA3AF]">Felt unsafe? <a href="/safety" className="underline">Report it here</a>.</p>
      <ErrorNote error={error} />
    </Card>
  )
}
