'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'intake', label: 'Conversation' },
  { key: 'video', label: 'Video' },
  { key: 'photos', label: 'Photos' },
  { key: 'type', label: 'Your type' },
  { key: 'ready', label: 'Matching' },
] as const

export function Shell({ step, onSignOut, children, wide }: { step?: string; onSignOut: () => void; children: ReactNode; wide?: boolean }) {
  const idx = STEPS.findIndex((s) => s.key === step)
  return (
    <div className="min-h-screen bg-[#FBF9F7]">
      <header className="bg-white border-b border-[#E8E2DA]">
        <div className={`${wide ? 'max-w-4xl' : 'max-w-2xl'} mx-auto px-4 py-4 flex items-center justify-between`}>
          <Link href="/" className="flex-shrink-0"><img src="/logo.svg" alt="Amorlay" className="h-8 sm:h-9" /></Link>
          <button onClick={onSignOut} className="text-sm text-[#4B5563] hover:text-[#1F2937] border border-[#E5E7EB] hover:border-[#9CA3AF] rounded-md px-3 py-1.5">
            Sign out
          </button>
        </div>
        {idx >= 0 && idx < STEPS.length - 1 && (
          <div className={`${wide ? 'max-w-4xl' : 'max-w-2xl'} mx-auto px-4 pb-4`}>
            <div className="flex gap-1.5">
              {STEPS.slice(0, -1).map((s, i) => (
                <div key={s.key} className="flex-1">
                  <div className={`h-1.5 rounded-full ${i <= idx ? 'bg-[#D4537E]' : 'bg-[#EDE7E0]'}`} />
                  <p className={`mt-1 text-[11px] ${i === idx ? 'text-[#1F2937] font-medium' : 'text-[#9CA3AF]'}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>
      <main className={`${wide ? 'max-w-4xl' : 'max-w-2xl'} mx-auto px-4 py-6`}>{children}</main>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-[#E8E2DA] shadow-sm p-5 sm:p-6 ${className}`}>{children}</div>
}

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost'; type?: 'button' | 'submit' }) {
  const styles = {
    primary: 'bg-[#D4537E] hover:bg-[#C04870] text-white',
    secondary: 'border border-[#D4537E] text-[#B23F68] hover:bg-[#FDF0F4]',
    ghost: 'text-[#6B7280] hover:text-[#1F2937]',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${styles}`}>
      {children}
    </button>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return <p className="mt-3 text-sm text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-lg px-3 py-2">{error}</p>
}

export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d?.error || `Request failed (${r.status})`)
  return d as T
}
