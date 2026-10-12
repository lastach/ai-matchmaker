'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { api, Button, Card, ErrorNote } from './ui'

const BUCKET = 'matchmaker-photos'

/** Profile photos, stored privately under the member's own folder. */
export default function PhotosStep({ onDone }: { onDone: () => void }) {
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (!uid) return
    const { data: rows } = await supabase.from('matchmaker_photos').select('storage_path, position').eq('user_id', uid).order('created_at')
    const urls: string[] = []
    for (const r of rows || []) {
      if (!String(r.storage_path).includes('/profile/')) continue
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(r.storage_path, 3600)
      if (data?.signedUrl) urls.push(data.signedUrl)
    }
    setPhotos(urls)
  }
  useEffect(() => { refresh() }, [])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) throw new Error('Please sign in again.')
      for (const f of Array.from(files).slice(0, 3)) {
        if (!f.type.startsWith('image/')) throw new Error('Photos only, please.')
        if (f.size > 8 * 1024 * 1024) throw new Error('Each photo must be under 8 MB.')
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) || 'jpg'
        const path = `${uid}/profile/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false })
        if (up.error) throw new Error(up.error.message)
        const ins = await supabase.from('matchmaker_photos').insert({ user_id: uid, storage_path: path, position: photos.length })
        if (ins.error) throw new Error(ins.error.message)
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
