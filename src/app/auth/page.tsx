'use client'

import { useState, useEffect } from 'react'
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
  const [isSignUp, setIsSignUp] = useState(false) // Hydration-safe: server renders with false, useEffect re-reads URL post-mount and flips if ?signup=1

  // Robust signup default: re-read the URL after mount in case the lazy
  // initializer was hydrated from server state where window was unavailable.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const wantsSignup = new URLSearchParams(window.location.search).get('signup') === '1'
    if (wantsSignup) setIsSignUp(true)
  }, [])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleMagicSignIn() {
    setError('')
    setMessage('')
    if (!email) { setError('Enter your email first.'); return }
    setLoading(true)
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined,
        },
      })
      if (error) throw error
      setMessage('Check your email - we sent you a one-click sign-in link.')
    } catch (err: any) {
      const msg = (err && err.message) || 'Could not send sign-in link'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (isSignUp) {
        // Magic-link signup. The link in the email confirms + signs in at once. No password.
        const { error } = await getSupabase().auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined,
          },
        })
        if (error) throw error
        setMessage('Check your email - we sent you a one-click sign-in link. No password needed.')
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
                <p className="text-gray-500 text-sm mb-8 text-center">{isSignUp ? 'One match. One memo. One date. Free during early access.' : 'Sign in to continue. New here? Use the Sign up link below.'}</p>
        <button
          type="button"
          onClick={async () => {
            setError('');
            setLoading(true);
            try {
              const { data, error } = await getSupabase().auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined,
                  skipBrowserRedirect: true,
                },
              });
              if (error) throw error;
              if (!data?.url) throw new Error('Could not start Google sign-in');
              // Pre-flight: detect provider-not-enabled before navigating
              try {
                const head = await fetch(data.url, { method: 'HEAD', redirect: 'manual' });
                // Supabase returns 400 with JSON when provider is not enabled
                if (head.status >= 400 && head.status < 500) {
                  throw new Error('Google sign-in is not yet enabled. Use email + password for now, or contact support.');
                }
              } catch (preflightErr: any) {
                if (preflightErr?.message?.includes('Google sign-in is not yet enabled')) throw preflightErr;
                // Network/CORS error on preflight is OK; proceed to redirect
              }
              if (typeof window !== 'undefined') window.location.href = data.url;
            } catch (err: any) {
              setError(err?.message || 'Could not start Google sign-in');
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="w-full mb-4 flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC04"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

      <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <p className="text-xs text-gray-500 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">No password needed to sign up. We'll email you a one-click sign-in link.</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" placeholder="you@example.com" />
          </div>
          {!isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" placeholder="Min 6 characters" />
            </div>
          )}
          {!isSignUp && (
            <button
              type="button"
              onClick={handleMagicSignIn}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-700 underline text-center w-full disabled:opacity-50"
            >
              Or send me a one-click sign-in link instead
            </button>
          )}
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
