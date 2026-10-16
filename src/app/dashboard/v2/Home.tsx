'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DateCard, { type Match } from './DateCard'
import { api, Button, Card, ErrorNote } from './ui'

export type ProfileState = {
  step: string
  basics: any
  intakeComplete: boolean
  videoDone: boolean
  looksDone?: boolean
  typeDone?: boolean
  cohort: { city: string | null; count: number; threshold: number; open: boolean }
}

export default function Home({ state, goTo, reload }: { state: ProfileState; goTo: (step: string, restart?: boolean) => void; reload: () => void }) {
  const [match, setMatch] = useState<Match | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMatch = async () => {
    try {
      const d = await api<{ match: Match | null }>('/api/v2/match')
      setMatch(d.match)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoaded(true)
    }
  }
  useEffect(() => { loadMatch() }, [])

  const { cohort } = state
  return (
    <div className="space-y-4">
      {loaded && match && <DateCard match={match} onChange={loadMatch} />}

      {!state.videoDone && (
        <Card>
          <h2 className="text-lg font-bold text-[#1F2937]">Finish your video interview</h2>
          <p className="text-sm text-[#6B7280] mt-1">Four light questions. We use it to match energy and warmth.</p>
          <div className="mt-3"><Button onClick={() => goTo('video')}>Do it now</Button></div>
        </Card>
      )}

      {loaded && !match && (
        <Card>
          <h2 className="text-lg font-bold text-[#1F2937]">You’re all set</h2>
          <p className="text-[15px] text-[#4B5563] mt-1">
            We’re opening city by city and aren’t matching in {cohort.city || 'your city'} yet. We’ll let you know as soon as we are.
            When we have a match for you, it arrives here as a planned date: who, when and where. No messaging back and forth, and no photos beforehand.
          </p>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-bold text-[#1F2937]">Your profile</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => goTo('basics')}>Basics and filters</Button>
          <Button variant="secondary" onClick={() => goTo('intake')}>Continue the conversation</Button>
          <Button variant="secondary" onClick={() => { if (confirm('Start the conversation over? Your earlier answers will be replaced.')) goTo('intake', true) }}>Start it over</Button>
          {state.videoDone && <Button variant="secondary" onClick={() => goTo('video')}>Redo video</Button>}
          <Button variant="secondary" onClick={() => goTo('photos')}>Photos</Button>
        </div>
        <details className="mt-5 text-xs text-[#6B7280]">
          <summary className="cursor-pointer">Account and data</summary>
          <button
            className="mt-2 text-[#B42318] underline"
            onClick={async () => {
              if (!confirm('Delete your Amorlay profile, conversation, photos and video? This cannot be undone.')) return
              const r = await fetch('/api/account/delete', { method: 'POST', credentials: 'include' })
              if (r.ok) { await supabase.auth.signOut().catch(() => {}); window.location.href = '/' }
              else setError('Could not delete your data. Please email support@amorlay.com.')
            }}
          >
            Delete my profile and all my data
          </button>
        </details>
        <ErrorNote error={error} />
      </Card>
    </div>
  )
}
