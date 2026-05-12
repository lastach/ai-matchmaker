'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface User {
  user_id: string
  name?: string
  location?: string
  intake_completed_at?: string
  top_value?: string
  top_life_goal?: string
  attachment_self?: string
  priority_choice?: string
  profile_strength?: number
  updated_at?: string
}

interface Candidate {
  candidate: any
  score: number
  breakdown: any
  notes: string[]
}

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [poolSize, setPoolSize] = useState(0)
  const [approveBusy, setApproveBusy] = useState<string | null>(null)
  const [approveStatus, setApproveStatus] = useState<string>('')

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/auth?next=/admin'
        return
      }
      const r = await fetch('/api/admin/users')
      if (r.status === 403) {
        setAuthorized(false)
        setAuthChecked(true)
        return
      }
      const d = await r.json()
      setUsers(d.users || [])
      setAuthorized(true)
      setAuthChecked(true)
    })()
  }, [])

  async function loadCandidates(userId: string) {
    setSelectedUserId(userId)
    setLoading(true)
    setCandidates([])
    try {
      const r = await fetch(`/api/admin/candidates?userId=${encodeURIComponent(userId)}`)
      const d = await r.json()
      setCandidates(d.candidates || [])
      setPoolSize(d.pool || 0)
    } finally {
      setLoading(false)
    }
  }

  async function approve(candidateUserId: string, score: number) {
    if (!selectedUserId) return
    setApproveBusy(candidateUserId)
    setApproveStatus('')
    try {
      const r = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, candidateUserId, score }),
      })
      const d = await r.json()
      if (r.ok) setApproveStatus(`Match approved. Brief generation queued.`)
      else setApproveStatus(`Failed: ${d.error || 'unknown'}`)
    } finally {
      setApproveBusy(null)
    }
  }

  if (!authChecked) return <main className="p-12 text-gray-500">Loading...</main>
  if (!authorized) {
    return (
      <main className="p-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Not authorized</h1>
        <p className="text-gray-600">Your account is not on the admin list.</p>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto p-6 text-gray-900">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Amorlay admin</h1>
        <p className="text-gray-600 mt-1">Review intakes, score candidates, approve a match. Approved matches enter the brief-generation queue.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 bg-white rounded-xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-900 mb-3">Members ({users.length})</h2>
          {users.length === 0 && !loading && (
            <div className="mb-3 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded p-3">
              <p className="font-semibold text-amber-900 mb-1">No members visible</p>
              <p>If you've completed intakes and still see zero, the most common cause is that SUPABASE_SERVICE_ROLE_KEY is missing on the Vercel env for ai-matchmaker. With it set, this admin view bypasses RLS and shows all rows. Without it, RLS restricts you to your own user_profiles row only.</p>
            </div>
          )}
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {users.map((u) => (
              <button
                key={u.user_id}
                onClick={() => loadCandidates(u.user_id)}
                className={`w-full text-left p-3 rounded-lg border transition ${selectedUserId === u.user_id ? 'border-rose-500 bg-rose-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
              >
                <p className="text-sm font-medium">{u.name || u.user_id.slice(0, 8)}</p>
                <p className="text-xs text-gray-500">{u.location || 'no location'}</p>
                <p className="text-xs text-gray-400">strength: {u.profile_strength ?? '?'} - updated {u.updated_at ? new Date(u.updated_at).toISOString().slice(0, 10) : '?'}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-900 mb-3">
            Candidates {selectedUserId ? `(pool: ${poolSize})` : ''}
          </h2>
          {!selectedUserId && <p className="text-sm text-gray-500">Pick a member on the left to compute their top 3.</p>}
          {loading && <p className="text-sm text-gray-500">Scoring...</p>}
          {approveStatus && <p className={`text-sm mb-3 ${approveStatus.startsWith('Failed') ? 'text-red-700' : 'text-emerald-700'}`}>{approveStatus}</p>}
          {!loading && selectedUserId && candidates.length === 0 && (
            <p className="text-sm text-gray-500">No candidates yet. Pool may be empty or all candidates filtered out by hard rules (age window, gender preference, children stance).</p>
          )}
          <div className="space-y-3">
            {candidates.map((c, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="font-semibold">{c.candidate.name} <span className="text-xs text-gray-500">({c.candidate.age}, {c.candidate.location})</span></p>
                  <p className="text-lg font-bold text-rose-700">{c.score.toFixed(0)} <span className="text-xs text-gray-500">/100</span></p>
                </div>
                <div className="grid grid-cols-5 gap-2 text-xs text-gray-600 mb-3">
                  <div><div className="font-medium">Values</div><div>{c.breakdown.values.toFixed(0)}</div></div>
                  <div><div className="font-medium">Attach</div><div>{c.breakdown.attachment.toFixed(0)}</div></div>
                  <div><div className="font-medium">Comms</div><div>{c.breakdown.communication.toFixed(0)}</div></div>
                  <div><div className="font-medium">Goals</div><div>{c.breakdown.lifeGoals.toFixed(0)}</div></div>
                  <div><div className="font-medium">Priority</div><div>{c.breakdown.relationshipPriority.toFixed(0)}</div></div>
                </div>
                {c.notes.length > 0 && (
                  <ul className="text-xs text-gray-700 list-disc list-inside mb-3">
                    {c.notes.slice(0, 4).map((n, j) => <li key={j}>{n}</li>)}
                  </ul>
                )}
                <button
                  onClick={() => approve(c.candidate.userId, c.score)}
                  disabled={approveBusy === c.candidate.userId}
                  className="text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-4 py-2 rounded"
                >
                  {approveBusy === c.candidate.userId ? 'Approving...' : 'Approve match'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
