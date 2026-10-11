'use client'

import { useEffect, useState } from 'react'
import AttractionRound from './AttractionRound'
import DateCard, { type Match } from './DateCard'
import { api, Button, Card, ErrorNote } from './ui'

export type ProfileState = {
  step: string
  basics: any
  intakeComplete: boolean
  videoDone: boolean
  hasClip: boolean
  cohort: { city: string | null; count: number; threshold: number; open: boolean }
}

export default function Home({ state, goTo, reload }: { state: ProfileState; goTo: (step: string, restart?: boolean) => void; reload: () => void }) {
  const [match, setMatch] = useState<Match | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [rating, setRating] = useState(false)
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

  if (rating) return <AttractionRound onFinished={() => setRating(false)} />

  const { cohort } = state
  const remaining = Math.max(0, cohort.threshold - cohort.count)
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
          <h2 className="text-lg font-bold text-[#1F2937]">{cohort.open ? `Matching is open in ${cohort.city}` : `You’re on the list for ${cohort.city || 'your city'}`}</h2>
          <p className="text-sm text-[#6B7280] mt-1">
            {cohort.open
              ? 'One match a month. When we find yours, it arrives here as a planned date: who, when and where. No messaging back and forth.'
              : `We open a city once ${cohort.threshold} members have finished. ${cohort.count} have so far${remaining ? `, ${remaining} to go` : ''}.`}
          </p>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-bold text-[#1F2937]">Who you’re drawn to</h2>
        <p className="text-sm text-[#6B7280] mt-1">Rate members in your city so every match is mutual attraction. Nobody sees your ratings.</p>
        <div className="mt-3"><Button variant="secondary" onClick={() => setRating(true)}>Rate members</Button></div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-[#1F2937]">Your profile</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => goTo('intake')}>Continue the conversation</Button>
          <Button variant="secondary" onClick={() => { if (confirm('Start the conversation over? Your earlier answers will be replaced.')) goTo('intake', true) }}>Start it over</Button>
          {state.videoDone && <Button variant="secondary" onClick={() => goTo('video')}>Redo video</Button>}
          <Button variant="secondary" onClick={() => goTo('photos')}>Photos</Button>
          {state.hasClip && (
            <Button variant="ghost" onClick={async () => { await api('/api/v2/video/clip', { method: 'DELETE' }); reload() }}>Delete my intro clip</Button>
          )}
        </div>
        <details className="mt-5 text-xs text-[#6B7280]">
          <summary className="cursor-pointer">Account and data</summary>
          <button
            className="mt-2 text-[#B42318] underline"
            onClick={async () => {
              if (!confirm('Permanently delete your account and all your data? This cannot be undone.')) return
              const r = await fetch('/api/account/delete', { method: 'POST', credentials: 'include' })
              if (r.ok) window.location.href = '/'
              else alert('Could not delete your account. Please contact support.')
            }}
          >
            Delete my account and all my data
          </button>
        </details>
        <ErrorNote error={error} />
      </Card>
    </div>
  )
}
