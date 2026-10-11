'use client'

import { useEffect, useState } from 'react'
import { api, Button, Card, ErrorNote } from './ui'

/** Profile photos. Members in the same city rate these to learn who they are drawn to. */
export default function PhotosStep({ onDone }: { onDone: () => void }) {
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const r = await fetch('/api/photos/list', { credentials: 'include' })
      const d = await r.json()
      setPhotos((d.photos || []).filter((p: any) => p.slot === 'profile').map((p: any) => p.url))
    } catch {}
  }
  useEffect(() => { refresh() }, [])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const f of Array.from(files).slice(0, 3)) {
        const fd = new FormData()
        fd.append('file', f)
        fd.append('slot', 'profile')
        const r = await fetch('/api/photos/upload', { method: 'POST', body: fd, credentials: 'include' })
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.error || 'Upload failed')
        }
      }
      await refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const next = async () => {
    try {
      await api('/api/v2/profile', { method: 'POST', body: JSON.stringify({ step: 'ready' }) })
      onDone()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold text-[#1F2937]">Your photos</h1>
      <p className="text-sm text-[#6B7280] mt-1">One to three photos, with your face clearly visible in the first. Only members in your city see them, while rating who they’re drawn to, and your match sees one before your date.</p>
      <label className="mt-4 block border-2 border-dashed border-[#D4537E]/40 rounded-xl p-8 text-center cursor-pointer hover:border-[#D4537E]">
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <span className="text-[#B23F68] font-semibold">{busy ? 'Uploading…' : 'Choose photos'}</span>
      </label>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {photos.map((u, i) => <img key={i} src={u} alt={`Your photo ${i + 1}`} className="w-full aspect-square object-cover rounded-lg" />)}
        </div>
      )}
      <ErrorNote error={error} />
      <div className="mt-5 flex justify-end">
        <Button onClick={next} disabled={photos.length === 0 || busy}>Continue</Button>
      </div>
    </Card>
  )
}
