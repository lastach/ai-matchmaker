import Link from 'next/link'
import MarketingHeader from '@/components/MarketingHeader'
import MarketingFooter from '@/components/MarketingFooter'
export const metadata = { title: 'Pricing | Amorlay' }
export default function Pricing() {
  return (
    <>
      <main className="min-h-screen bg-white">
      <MarketingHeader />
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Pricing</h1>
        <p className="text-lg text-gray-600 mb-10">Free during early access while we build each city.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border-2 border-[#C8102E] rounded-xl p-6">
            <p className="text-xs uppercase tracking-wider text-[#C8102E] font-semibold mb-2">Early access</p>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
            <p className="text-sm text-gray-600 mb-6">Everything below, free while we build each city. No card.</p>
            <ul className="text-sm text-gray-700 space-y-2 mb-6 list-disc pl-5">
              <li>A conversation in your own words, typed or spoken; the AI only follows up on what is missing</li>
              <li>A short video interview so matches line up on energy and warmth</li>
              <li>Show us your type with example photos, so every match is attraction both ways</li>
              <li>We let you know as soon as we are matching in your city</li>
              <li>An AI date coach before and after each date</li>
            </ul>
            <Link href="/auth?signup=1" className="block text-center bg-[#C8102E] hover:bg-[#A50D26] text-white px-5 py-2.5 rounded-lg font-semibold">Get started</Link>
          </div>
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">After GA (target Q1 2027)</p>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">$1,000 / 3 months</h3>
            <p className="text-sm text-gray-600 mb-4">Human matchmakers charge thousands. Here is what three months includes:</p>
            <ul className="text-sm text-gray-700 space-y-2 mb-6">
              <li><strong>One match a month</strong>, picked for must-haves, values, partner fit, energy and mutual attraction</li>
              <li><strong>A planned date, not a chat</strong>: we tell you who, when and where</li>
              <li><strong>An AI date coach</strong>: a brief before each date and a debrief after, which also sharpens your next match</li>
            </ul>
            <p className="text-xs text-gray-500">Preview users get their first 2 matches free at GA.</p>
          </div>
        </div>
        <div className="mt-12 border-t pt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">FAQ</h2>
          <div className="space-y-4 text-sm text-gray-700">
            <details open><summary className="cursor-pointer font-medium">When will I get a match?</summary><p className="mt-2">We are opening city by city. Set up your profile now and we will let you know as soon as we are matching where you live.</p></details>
            <details open><summary className="cursor-pointer font-medium">Can I get a refund?</summary><p className="mt-2">Yes. After GA, full refund within 7 days of paying if you have not yet received a match.</p></details>
            <details open><summary className="cursor-pointer font-medium">What about safety and verification?</summary><p className="mt-2">See our <Link href="/safety" className="text-rose-700 hover:underline">Safety page</Link> for how dates are set up and what we share.</p></details>
          </div>
        </div>
      </section>
    </main>
      <MarketingFooter />
    </>
  )
}
