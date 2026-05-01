'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/dashboard');
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        if (data.user) {
          router.push('/dashboard');
        }
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;
        try { fetch('/api/auth/welcome', { method: 'POST' }).catch(() => {}); } catch {}
        if (data.user) {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="min-h-screen bg-gradient-to-br from-[#2E1A47] via-[#3D2557] to-[#D4537E]/10" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2E1A47] via-[#3D2557] to-[#D4537E]/10 px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <img src="/logo.svg" alt="Amorlay" className="h-16 mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            One match. One memo. One date.
          </h1>
          <p className="text-xl text-[#D4537E]/80 mb-6">
            Replace swiping with science
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Left: Value prop */}
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-[#D4537E]/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[#D4537E] font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Answer 10 questions about who you are</h3>
                  <p className="text-white/60 text-sm">Not what you look like. What makes you tick, how you connect, what you need from a partner.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-[#D4537E]/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[#D4537E] font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Train your attraction model</h3>
                  <p className="text-white/60 text-sm">Rate photos so the algorithm learns your type. Upload pictures of people you find attractive for even better results.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-[#D4537E]/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[#D4537E] font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Get one great match per week</h3>
                  <p className="text-white/60 text-sm">No swiping. No endless browsing. One curated match with a compatibility memo explaining why you fit.</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <p className="text-white/80 text-sm leading-relaxed">
                Dating apps give you hundreds of options and zero insight.
                Amorlay gives you one match backed by real compatibility science:
                attachment style, communication patterns, values alignment, and mutual attraction.
              </p>
            </div>
          </div>

          {/* Right: Auth form */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
            <div className="flex gap-2 bg-[#F3F0ED] p-1.5 rounded-lg">
              <button
                onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                className={`flex-1 py-2.5 font-semibold rounded-md transition-all ${
                  isLogin ? 'bg-white text-[#2E1A47] shadow-md' : 'text-[#9CA3AF] hover:text-[#6B7280]'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
                className={`flex-1 py-2.5 font-semibold rounded-md transition-all ${
                  !isLogin ? 'bg-white text-[#2E1A47] shadow-md' : 'text-[#9CA3AF] hover:text-[#6B7280]'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-[#1F2937] mb-2">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E] focus:border-transparent" required />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-[#1F2937] mb-2">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;" className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E] focus:border-transparent" required />
              </div>
              {!isLogin && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[#1F2937] mb-2">Confirm Password</label>
                  <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;" className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4537E] focus:border-transparent" required />
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#D4537E] to-[#C04870] text-white font-semibold py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (isLogin ? 'Logging in...' : 'Creating account...') : isLogin ? 'Login' : 'Create Account'}
              </button>
            </form>

            <p className="text-xs text-center text-[#9CA3AF]">
              Free to try. No credit card required.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-white/40">
            Amorlay &bull; Privacy-first. Science-backed. No swiping.
          </p>
        </div>
      </div>
    </div>
  );
}
