'use client';
import MarketingHeader from '@/components/MarketingHeader'

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <MarketingHeader />

      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16">
        <p className="font-serif italic text-base text-[#C8102E] mb-8">For people done with swiping.</p>
        <h1 className="font-serif text-5xl md:text-7xl font-normal text-gray-900 leading-[1.05] mb-8 tracking-tight">
          One match.<br /><span className="italic">One date.</span><br />A coach for both.
        </h1>
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          Tell us about you in your own words, by typing or talking. Once a month we pick one person for you
          and plan the date: who, when and where. No profiles to browse and no messaging back and forth.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/auth?signup=1" className="bg-[#C8102E] hover:bg-[#A50D26] text-white px-7 py-3 rounded-lg font-semibold text-base transition text-center">
            Get started
          </Link>
          <Link href="#how-it-works" className="text-gray-700 hover:text-gray-900 px-5 py-3 rounded-lg font-medium border border-gray-300 hover:border-gray-400 text-center">
            How it works &rarr;
          </Link>
        </div>
        <p className="text-xs text-gray-500 mt-4">Free during early access. 18+ only.</p>
        <p className="text-xs text-gray-500 mt-1">The matchmaker you talk with is an AI. A person reviews every match before it goes out.</p>
      </section>

      <section id="how-it-works" className="bg-rose-50/40 border-y border-rose-100 py-16 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">How it works</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">About 30 minutes to set up. After that, one planned date a month.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              ['Talk it through', 'A conversation about your life, who you want and what you want the relationship to be. It follows your lead and only asks about what is still missing.'],
              ['A short video interview', 'Four light questions on camera. It helps us match energy and warmth, which a written profile can’t show.'],
              ['Photos and your type', 'Add a few photos, then rate members in your city. Every match is attraction both ways, and nobody sees your ratings.'],
              ['Your date, planned', 'One match a month arrives as a planned date. Your AI date coach preps you before and debriefs with you after, and each debrief sharpens your next match.'],
            ].map(([t, d], i) => (
              <div key={t} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center mb-4 text-rose-700 font-bold">{i + 1}</div>
                <h3 className="font-bold text-gray-900 mb-2">{t}</h3>
                <p className="text-sm text-gray-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-serif text-3xl font-normal text-gray-900 mb-2 text-center">What we match on</h2>
          <p className="text-center text-gray-600 mb-10">Your dealbreakers are checked first, both ways. Then each possible match is scored out of 100.</p>
          <div className="border border-rose-200 rounded-2xl divide-y divide-rose-100 bg-rose-50/30">
            {[
              ['Your must-haves', '30', 'The things you ranked as most important, met at the level you called good enough'],
              ['Values', '25', 'How well your core values fit for a shared life'],
              ['Mutual attraction', '20', 'How you each rated the other'],
              ['A good partner', '15', 'Warmth, kindness, reliability and calm'],
              ['Energy', '10', 'How close your energy levels are'],
            ].map(([t, n, d]) => (
              <div key={t} className="flex items-start gap-4 p-4">
                <span className="text-xl font-bold text-[#C8102E] w-12 flex-shrink-0">{n}%</span>
                <div>
                  <p className="font-semibold text-gray-900">{t}</p>
                  <p className="text-sm text-gray-600">{d}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-500 mt-6">After each date, the weights shift toward what actually worked for you.</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-20 text-center border-t border-rose-100">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">No browsing. No performance. Just a good first date.</h2>
        <p className="text-gray-600 mb-8">Built for people who already know dating apps don&apos;t work for them.</p>
        <Link href="/auth?signup=1" className="inline-block bg-[#C8102E] hover:bg-[#A50D26] text-white px-8 py-3 rounded-lg font-semibold transition">
          Get started
        </Link>
        <p className="text-xs text-gray-500 mt-4">Free during early access. 18+ only. No credit card.</p>
      </section>

      <footer className="border-t border-gray-200 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row gap-3 justify-between text-xs text-gray-500">
          <span>&copy; 2026 Amorlay</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
            <Link href="/safety" className="hover:text-gray-700">Safety</Link>
            <Link href="/faq" className="hover:text-gray-700">FAQ</Link>
            <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-700">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
