'use client'

import { useEffect, useRef, useState } from 'react'
import { api, Button, Card, ErrorNote } from './ui'

const QUESTIONS = [
  'Introduce yourself the way you would to someone you just met at a friend’s dinner.',
  'What’s something you’ve been excited about lately?',
  'What do your friends come to you for?',
  'Describe a really good Saturday.',
]
const MAX_SECONDS = 45

/**
 * Short AI video interview. The AI reads warmth, energy and expressiveness from still frames
 * and what the member says. Frames are analyzed and discarded; nothing is recorded or shown to anyone.
 */
export default function VideoInterview({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<any>(null)
  const framesRef = useRef<string[]>([])
  const transcriptRef = useRef('')
  const timersRef = useRef<number[]>([])

  const [ready, setReady] = useState(false)
  const [qIdx, setQIdx] = useState(0)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [answers, setAnswers] = useState<Array<{ question: string; transcript: string }>>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const speechSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      timersRef.current.forEach((t) => clearTimeout(t))
    }
  }, [])

  const startCamera = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setReady(true)
    } catch {
      setError('Camera or microphone access was blocked. Allow access in your browser and try again.')
    }
  }

  const grabFrame = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth || framesRef.current.length >= 6) return
    const c = document.createElement('canvas')
    const w = 480
    c.width = w
    c.height = Math.round((v.videoHeight / v.videoWidth) * w)
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height)
    framesRef.current.push(c.toDataURL('image/jpeg', 0.7))
  }

  const startAnswer = () => {
    transcriptRef.current = ''
    setSeconds(0)
    setRecording(true)
    // Speech-to-text where the browser supports it.
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = false
      rec.lang = navigator.language || 'en-US'
      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) transcriptRef.current += e.results[i][0].transcript + ' '
      }
      rec.onerror = () => {}
      try { rec.start() } catch {}
      recRef.current = rec
    }
    // Two frames per answer for the first three answers.
    if (qIdx < 3) {
      timersRef.current.push(window.setTimeout(grabFrame, 4000))
      timersRef.current.push(window.setTimeout(grabFrame, 15000))
    }
    const tick = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    timersRef.current.push(tick)
  }


  const stopAnswer = () => {
    timersRef.current.forEach((t) => { clearTimeout(t); clearInterval(t) })
    timersRef.current = []
    if (framesRef.current.length === 0 || (qIdx < 3 && framesRef.current.length < (qIdx + 1) * 2)) grabFrame()
    try { recRef.current?.stop() } catch {}
    setRecording(false)
    // Give the recognizer a moment to flush its last result.
    window.setTimeout(() => {
      setAnswers((a) => [...a, { question: QUESTIONS[qIdx], transcript: transcriptRef.current.trim() }])
      setQIdx((i) => i + 1)
    }, 600)
  }

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) stopAnswer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, seconds])

  const finish = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await api('/api/v2/video', { method: 'POST', body: JSON.stringify({ frames: framesRef.current, answers }) })
      streamRef.current?.getTracks().forEach((t) => t.stop())
      onDone()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const done = qIdx >= QUESTIONS.length
  return (
    <Card>
      <h1 className="text-2xl font-bold text-[#1F2937]">A short video interview</h1>
      <p className="text-sm text-[#6B7280] mt-1">Four light questions, up to 45 seconds each. It helps us match energy and warmth, which a written answer can’t show. Nothing is recorded or shown to anyone; a few still frames are analyzed and then discarded.</p>
      {!speechSupported && <p className="text-xs text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2 mt-3">This browser can’t transcribe speech, so the AI will rely on video only. Chrome or Safari works best.</p>}
      <div className="mt-4 rounded-xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover -scale-x-100" />
      </div>
      {!ready && (
        <div className="mt-4 flex gap-3 items-center">
          <Button onClick={startCamera}>Turn on camera</Button>
          <Button variant="ghost" onClick={onSkip}>My camera isn’t working, do this later</Button>
        </div>
      )}
      {ready && !done && (
        <div className="mt-4">
          <p className="text-xs text-[#6B7280]">Question {qIdx + 1} of {QUESTIONS.length}</p>
          <p className="text-lg font-semibold text-[#1F2937] mt-1">{QUESTIONS[qIdx]}</p>
          <div className="mt-3 flex items-center gap-3">
            {!recording ? <Button onClick={startAnswer}>Start answering</Button> : <Button onClick={stopAnswer}>Done ({MAX_SECONDS - seconds}s left)</Button>}
            {recording && <span className="inline-flex items-center gap-1.5 text-sm text-[#B42318]"><span className="h-2 w-2 rounded-full bg-[#B42318] animate-pulse" />Recording</span>}
          </div>
        </div>
      )}
      {done && (
        <div className="mt-4 flex justify-end">
          <Button onClick={finish} disabled={submitting}>{submitting ? 'Analyzing…' : 'Finish'}</Button>
        </div>
      )}
      <ErrorNote error={error} />
    </Card>
  )
}
