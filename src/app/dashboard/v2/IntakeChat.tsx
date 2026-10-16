'use client'

import { useEffect, useRef, useState } from 'react'
import MicButton from './MicButton'
import { api, Button, ErrorNote } from './ui'

type Msg = { role: 'user' | 'assistant'; content: string }

/**
 * Conversational intake. The member answers in their own words; the AI reads the answers,
 * builds the profile, and only asks about what is still missing.
 */
export default function IntakeChat({ initial, progress, onComplete }: { initial: Msg[]; progress: { covered: number; total: number }; onComplete: () => void }) {
  const [messages, setMessages] = useState<Msg[]>(initial)
  const [input, setInput] = useState('')
  const [heard, setHeard] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prog, setProg] = useState(progress)
  const [complete, setComplete] = useState(false)
  const [paused, setPaused] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const send = async (text: string) => {
    setError(null)
    setBusy(true)
    if (text) setMessages((m) => [...m, { role: 'user', content: text }])
    try {
      const d = await api<{ reply: string; complete: boolean; pause?: boolean; progress?: { covered: number; total: number } }>('/api/v2/intake', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })
      setMessages((m) => [...m, { role: 'assistant', content: d.reply }])
      if (d.progress) setProg(d.progress)
      if (d.pause) setPaused(true)
      if (d.complete) setComplete(true)
    } catch (e: any) {
      setError(e.message)
      if (text) {
        setMessages((m) => m.slice(0, -1))
        setInput(text)
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!started.current && initial.length === 0) {
      started.current = true
      send('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, busy])

  const submit = () => {
    const t = input.trim()
    if (!t || busy) return
    setInput('')
    send(t)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-170px)] min-h-[480px]">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-[#1F2937]">Let&apos;s talk</h1>
        <p className="text-xs text-[#6B7280]">{prog.covered} of {prog.total} areas covered</p>
      </div>
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-[#E8E2DA] p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${m.role === 'user' ? 'bg-[#D4537E] text-white' : 'bg-[#F4F1EE] text-[#1F2937]'}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="text-sm text-[#9CA3AF] px-2">…</div>}
        <div ref={endRef} />
      </div>
      <ErrorNote error={error} />
      {complete ? (
        <div className="mt-3 flex justify-end"><Button onClick={onComplete}>Continue to the video interview</Button></div>
      ) : paused ? null : (
        <div className="mt-3 flex gap-2 items-end">
          <MicButton disabled={busy} onInterim={setHeard} onText={(t) => setInput((v) => (v.trim() ? v.trimEnd() + ' ' : '') + t)} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            rows={2}
            placeholder={heard ? heard : 'Type, or tap the mic and talk'}
            className="flex-1 px-4 py-3 border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4537E] resize-none"
          />
          <Button onClick={submit} disabled={busy || !input.trim()}>Send</Button>
        </div>
      )}
      {heard && <p className="mt-1 text-sm italic text-[#6B7280]">{heard}</p>}
      <p className="text-[11px] text-[#9CA3AF] mt-2">Saved as you go. Nobody else sees this conversation. When you have a date, their date coach shares a few things with them, like what helps you feel understood, so they can show up well.</p>
    </div>
  )
}
