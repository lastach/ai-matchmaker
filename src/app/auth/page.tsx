'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(() => { if (typeof window === 'undefined') return false; return new URLSearchParams(window.location.search).get('signup') === '1' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (isSignUp) {
        const { data, error } = await getSupabase().auth.signUp({ email, password })
        if (error) throw error
        if (data.session) {
          router.push('/dashboard')
          return
        }
        setMessage('Check your email for a confirmation link.')
      } else {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto px-6">
        <h1 className="text-3xl font-bold text-[#3D1820] mb-2 text-center">Amorlay</h1>
                <p className="text-gray-500 text-sm mb-8 text-center">{isSignUp ? 'One match. One memo. One date. Free during research preview.' : 'Welcome back. Your match might be brewing.'}</p>p>
      </p><form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" placeholder="Min 6 characters" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}
          <button type="submit" disabled={loading} className="w-full bg-[#3D1820] text-white py-2.5 rounded-lg font-medium text-sm hover:bg-[#2a0f16] transition disabled:opacity-50">{loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}</button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }} className="text-rose-700 font-medium hover:underline">{isSignUp ? 'Sign in' : 'Sign up'}</button>
        </p>
        <p className="text-center text-xs text-gray-400 mt-8"><a href="/" className="hover:underline">← Back home</a></p>
      </div>
    </main>
  )
}
