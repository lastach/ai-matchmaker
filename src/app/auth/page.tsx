'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/** Where to go after signing in: a same-site path from ?next=, otherwise onboarding. */
function nextPath(): string {
  if (typeof window === 'undefined') return '/start'
  const n = new URLSearchParams(window.location.search).get('next') || ''
  return n.startsWith('/') && !n.startsWith('//') ? n : '/start'
}

function friendly(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match. Check both and try again.'
  if (/already registered|already exists/i.test(msg)) return 'There’s already an account with this email. Sign in instead.'
  if (/password should be at least|weak password/i.test(msg)) return 'Use a password of at least 8 characters.'
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Wait a minute and try again.'
  return msg
}

export default function AuthPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('signup') === '1') setIsSignUp(true)
    // Already signed in: skip the form.
    supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace(nextPath()) })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (isSignUp && password.length < 8) { setError('Use a password of at least 8 characters.'); return }
    setLoading(true)
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + '/start' },
        })
        if (error) throw error
        // An existing email comes back as a user with no identities.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error('already exists')
        }
        if (data.session) { router.push(nextPath()); return }
        setMessage('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        router.push(nextPath())
      }
    } catch (err: any) {
      setError(friendly(err?.message || 'Something went wrong'))
    } finally {
      setLoading(false)
    }
  }

  async function emailLink() {
    setError('')
    setMessage('')
    if (!email.trim()) { setError('Enter your email first.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + nextPath() },
      })
      if (error) throw error
      setMessage('Check your email for a sign-in link.')
    } catch {
      setError('We couldn’t email a link to this address. Sign in with your password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto px-6 py-10">
        <a href="/" aria-label="Amorlay home" className="mb-6 flex justify-center"><img src="/logo.svg" alt="Amorlay" className="h-10" /></a>
        <h1 className="text-2xl font-semibold text-[#3D1820] mb-2 text-center">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
        <p className="text-gray-500 text-sm mb-8 text-center">{isSignUp ? 'Free during early access. 18+ only.' : 'Sign in to continue.'}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-3 py-2.5 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-rose-300" placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input id="password" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={isSignUp ? 8 : 6}
              className="w-full px-3 py-2.5 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder={isSignUp ? 'At least 8 characters' : 'Your password'} />
          </div>
          <div role="status" aria-live="polite" className="min-h-[1.5rem]">
            {message && <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2.5 text-sm text-green-800">{message}</div>}
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#3D1820] text-white py-3 rounded-lg font-medium hover:bg-[#2a0f16] transition disabled:opacity-50">
            {loading ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {!isSignUp && (
          <button type="button" onClick={emailLink} disabled={loading} className="mt-3 w-full text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50">
            Email me a sign-in link instead
          </button>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          {isSignUp ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }} className="text-rose-700 font-medium hover:underline">
            {isSignUp ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        <p className="text-center text-xs text-gray-400 mt-8"><a href="/" className="hover:underline">Back to home</a></p>
      </div>
    </main>
  )
}
