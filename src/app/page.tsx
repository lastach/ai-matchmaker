'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Always show the marketing homepage. Logged-in users can navigate to
    // /dashboard explicitly via the nav.
    setChecking(false);
  }, []);

  if (checking) return <div className="min-h-screen bg-white" />;

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-rose-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src="/logo.svg" alt="Amorlay" className="h-9" />
          <div className="flex items-center gap-5"><Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link><Link href="/safety" className="text-sm text-gray-600 hover:text-gray-900">Safety</Link><Link href="/auth" className="text-sm font-medium text-gray-600 hover:text-gray-900">Sign in</Link></div>
        </div>
      </nav>

      {/* Editorial hero - typography-led, no card-shaped mock above the fold */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16">
        <p className="font-serif italic text-base text-[#C8102E] mb-8">For people done with swiping.</p>
        <h1 className="font-serif text-5xl md:text-7xl font-normal text-gray-900 leading-[1.05] mb-8 tracking-tight">
          One match.<br /><span className="italic">One memo.</span><br />One date.
        </h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Tell me about you in your own words - not a profile, a conversation. When enough thoughtful
            people in your area have done the same, I introduce you to one of them with a written memo
            explaining why I think it's worth your night.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/auth" className="bg-[#C8102E] hover:bg-[#A50D26] text-white px-7 py-3 rounded-lg font-semibold text-base transition">
              Start the conversation
            </Link>
            <Link href="/auth" className="text-gray-700 hover:text-gray-900 px-5 py-3 rounded-lg font-medium border border-gray-300 hover:border-gray-400">
              See how matching works &rarr;
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-4">No swiping. No infinite scroll. 18+. Free during research preview.</p>
          <p className="text-xs text-gray-500 mt-1"><strong>The "I" you talk to is an AI</strong> trained to read your answers carefully. A human reviews every match before it's sent.</p>

        </section>

      {/* Value props */}
      <section className="bg-rose-50/40 border-y border-rose-100 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">A different shape than every other app.</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Not endless options. Not a brand of yourself you have to maintain. Slow on purpose.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center mb-4 text-rose-700 font-bold">1</div>
              <h3 className="font-bold text-gray-900 mb-2">You answer in your own words</h3>
              <p className="text-sm text-gray-600">
                Open-ended questions about your life, your past, what you want. No bio to write, no
                witty hooks. The intake takes 10-15 minutes and feels like a real conversation.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center mb-4 text-rose-700 font-bold">2</div>
              <h3 className="font-bold text-gray-900 mb-2">Cohorts open by area</h3>
              <p className="text-sm text-gray-600">
                Once enough thoughtful people in your area have signed up, your cohort opens. We email
                you when it does. You see your waitlist position any time.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center mb-4 text-rose-700 font-bold">3</div>
              <h3 className="font-bold text-gray-900 mb-2">One match, one memo</h3>
              <p className="text-sm text-gray-600">
                We pick one person we think you should meet and write you a memo explaining why -
                and where to be careful. You decide whether to open the intro.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">No browsing. No performance. Just a thoughtful intro when it&apos;s ready.</h2>
        <p className="text-gray-600 mb-8">Built for people who already know dating apps don&apos;t work for them.</p>
        <Link href="/auth" className="inline-block bg-[#C8102E] hover:bg-[#A50D26] text-white px-8 py-3 rounded-lg font-semibold transition">
          Start the conversation
        </Link>
        <p className="text-xs text-gray-500 mt-4">Free during research preview. 18+ only. No credit card.</p>
      </section>

      <footer className="border-t border-gray-200 py-6">
        <div className="max-w-6xl mx-auto px-6 flex justify-between text-xs text-gray-500">
          <span>&copy; 2026 Amorlay</span>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
            <Link href="/safety" className="hover:text-gray-700">Safety</Link>
            <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-700">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
