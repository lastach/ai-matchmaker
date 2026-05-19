'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function MarketingHeader() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="border-b border-rose-100 bg-[#FBF9F7]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <Link href="/" className="flex-shrink-0"><img src="/logo.svg" alt="Amorlay" className="h-8 sm:h-9" /></Link>
        <div className="hidden md:flex items-center gap-5">
          <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">Pricing</Link>
          <Link href="/safety" className="text-sm font-medium text-gray-600 hover:text-gray-900">Safety</Link>
          <Link href="/verification" className="text-sm font-medium text-gray-600 hover:text-gray-900">Verification</Link>
          <Link href="/integrations" className="text-sm font-medium text-gray-600 hover:text-gray-900">Integrations</Link>
          <Link href="/faq" className="text-sm font-medium text-gray-600 hover:text-gray-900">FAQ</Link>
          <Link href="/auth" className="text-sm font-semibold text-gray-900 hover:text-red-600">Sign in</Link>
        </div>
        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 -mr-2 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            <Link href="/pricing" onClick={() => setOpen(false)} className="block py-2 text-sm text-gray-700 hover:text-gray-900">Pricing</Link>
            <Link href="/safety" onClick={() => setOpen(false)} className="block py-2 text-sm text-gray-700 hover:text-gray-900">Safety</Link>
            <Link href="/verification" onClick={() => setOpen(false)} className="block py-2 text-sm text-gray-700 hover:text-gray-900">Verification</Link>
            <Link href="/integrations" onClick={() => setOpen(false)} className="block py-2 text-sm text-gray-700 hover:text-gray-900">Integrations</Link>
            <Link href="/faq" onClick={() => setOpen(false)} className="block py-2 text-sm text-gray-700 hover:text-gray-900">FAQ</Link>
            <Link href="/auth" onClick={() => setOpen(false)} className="block py-2 text-sm font-semibold text-gray-900 hover:text-red-600">Sign in</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
