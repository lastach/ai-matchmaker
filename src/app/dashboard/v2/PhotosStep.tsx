'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { api, Button, Card, ErrorNote } from './ui'

const BUCKET = 'matchmaker-photos'
const MAX_EDGE = 1600

/** Re-encode as a JPEG no larger than MAX_EDGE on its long side, so every browser can show it. */
async function toJpeg(f: File): Promise<Blob> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(f)
  } catch {
    throw new Error('That photo format isn’t supported here. Please choose a JPG or PNG.')
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const out = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85))
  if (!out) throw new Error('Could not read that photo. Please try another.')
  return out
}

/** Profile photos, stored privately under the member's own folder. */
export default function PhotosStep({ onDone }: { onDone: () => void }) {
  const [photos, setPhotos] = useState<Array<{ path: string; url: string }>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (!uid) return
    const { data: rows } = await supabase.from('matchmaker_photos').select('storage_path, position').eq('user_id', uid).order('created_at')
    const list: Array<{ path: string; url: string }> = []
    for (const r of rows || []) {
      if (!String(r.storage_path).includes('/profile/')) continue
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(r.storage_path, 3600)
      if (data?.signedUrl) list.push({ path: r.storage_path, url: data.signedUrl })
    }
    setPhotos(list)
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
      for (const [i, f] of Array.from(files).slice(0, Math.max(0, 3 - photos.length)).entries()) {
        if (f.type && !f.type.startsWith('image/')) throw new Error('Photos only, please.')
        if (f.size > 25 * 1024 * 1024) throw new Error('Each photo must be under 25 MB.')
        const jpg = await toJpeg(f)
        const path = `${uid}/profile/${crypto.randomUUID()}.jpg`
        const up = await supabase.storage.from(BUCKET).upload(path, jpg, { contentType: 'image/jpeg', upsert: false })
        if (up.error) throw new Error(up.error.message)
        const ins = await supabase.from('matchmaker_photos').insert({ user_id: uid, storage_path: path, position: photos.length + i })
        if (ins.error) throw new Error(ins.error.message)
      }
      await refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (path: string) => {
    setBusy(true)
    setError(null)
    try {
      await supabase.storage.from(BUCKET).remove([path])
      const del = await supabase.from('matchmaker_photos').delete().eq('storage_path', path)
      if (del.error) throw new Error(del.error.message)
      await refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const [note, setNote] = useState<string | null>(null)
  const next = async () => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const r = await api<{ clearFace: boolean; note?: string }>('/api/v2/photos/analyze', { method: 'POST' })
      if (!r.clearFace) {
        setNote('Your first photo should clearly show your face, just you. Swap it if you can, or continue.')
        setBusy(false)
        return
      }
      await api('/api/v2/profile', { method: 'POST', body: JSON.stringify({ step: 'type' }) })
      onDone()
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }
  const skipCheck = async () => {
    try {
      await api('/api/v2/profile', { method: 'POST', body: JSON.stringify({ step: 'type' }) })
      onDone()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold text-[#1F2937]">Your photos</h1>
      <p className="text-sm text-[#6B7280] mt-1">One to three recent photos, with your face clearly visible in the first. Other members never see them, not even your match before your date. Only our matchmaker and the AI do, to compare your look with what your potential matches are drawn to.</p>
      <label className="mt-4 block border-2 border-dashed border-[#D4537E]/40 rounded-xl p-8 text-center cursor-pointer hover:border-[#D4537E]">
        <input type="file" accept="image/*" multiple className="hidden" disabled={busy || photos.length >= 3} onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        <span className="text-[#B23F68] font-semibold">{busy ? 'Working…' : photos.length >= 3 ? 'Three photos added. Remove one to change it.' : 'Choose photos'}</span>
      </label>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {photos.map((p, i) => (
            <div key={p.path} className="relative">
              <img src={p.url} alt={`Your photo ${i + 1}`} className="w-full aspect-square object-cover rounded-lg" />
              <button type="button" onClick={() => remove(p.path)} disabled={busy} aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-white/90 text-[#1F2937] text-sm shadow hover:bg-white">✕</button>
            </div>
          ))}
        </div>
      )}
      <ErrorNote error={error} />
      {note && <p className="mt-3 text-sm text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">{note} <button className="underline" onClick={skipCheck}>Continue anyway</button></p>}
      <div className="mt-5 flex justify-end">
        <Button onClick={next} disabled={photos.length === 0 || busy}>{busy ? 'One moment…' : 'Continue'}</Button>
      </div>
    </Card>
  )
}
