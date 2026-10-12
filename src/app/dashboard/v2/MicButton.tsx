'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Speech to text with the browser's built-in recognition (Chrome, Edge, Safari).
 * Finished phrases are passed to onText; the button hides itself where unsupported.
 */
export default function MicButton({ onText, onInterim, disabled }: { onText: (text: string) => void; onInterim?: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<any>(null)
  const onTextRef = useRef(onText)
  const onInterimRef = useRef(onInterim)
  useEffect(() => { onTextRef.current = onText; onInterimRef.current = onInterim })

  useEffect(() => {
    const SR = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    setSupported(!!SR)
    return () => { try { recRef.current?.stop() } catch {} }
  }, [])

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    setError(null)
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = navigator.language || 'en-US'
    rec.onresult = (e: any) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onTextRef.current(r[0].transcript.trim())
        else live += r[0].transcript
      }
      setInterim(live)
      onInterimRef.current?.(live)
    }
    rec.onerror = (e: any) => {
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') setError('Microphone access is blocked. Allow it in your browser to talk instead of type.')
    }
    rec.onend = () => { setListening(false); setInterim(''); onInterimRef.current?.('') }
    try {
      rec.start()
      recRef.current = rec
      setListening(true)
    } catch {}
  }

  const stop = () => { try { recRef.current?.stop() } catch {} }

  if (!supported) return null
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-label={listening ? 'Stop talking' : 'Talk instead of typing'}
        title={listening ? 'Stop' : 'Talk instead of typing'}
        className={`h-11 w-11 rounded-full flex items-center justify-center border transition disabled:opacity-50 ${listening ? 'bg-[#D4537E] border-[#D4537E] text-white animate-pulse' : 'bg-white border-[#E5E7EB] text-[#B23F68] hover:border-[#D4537E]'}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </svg>
      </button>
      {listening && <span className="text-[11px] text-[#B23F68]">Listening</span>}
      {interim && <span className="sr-only">{interim}</span>}
      {error && <span className="text-[11px] text-[#B42318] max-w-[160px] text-center">{error}</span>}
    </div>
  )
}
