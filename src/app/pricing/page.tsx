import Link from 'next/link'
export const metadata = { title: 'Pricing - Amorlay' }
export default function Pricing() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-rose-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/"><img src="/logo.svg" alt="Amorlay" className="h-9" /></Link>
          <Link href="/auth" className="text-sm font-medium text-gray-600 hover:text-gray-900">Sign in</Link>
        </div>
      </nav>
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Pricing</h1>
        <p className="text-lg text-gray-600 mb-10">Honest about where this is. Free during early access while we build the cohort.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border-2 border-[#C8102E] rounded-xl p-6">
            <p className="text-xs uppercase tracking-wider text-[#C8102E] font-semibold mb-2">Early access</p>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
            <p className="text-sm text-gray-600 mb-6">Full intake, you stay on the waitlist until your local cohort opens. No card.</p>
            <ul className="text-sm text-gray-700 space-y-2 mb-6">
              <li>- 21-question conversational intake (AI-led, human-reviewed). 5-6 deep questions ask for at least 20 words; the rest are quick.</li>
              <li>- Cohort waitlist with location and supply-pool transparency</li>
              <li>- Matching engine scores candidates on life-shape / posture / overlap / depth</li>
              <li>- Both-parties-must-accept partner-side flow</li>
              <li>- ID + photo verification before matches deliver</li>
              <li>- Crisis-disclosure handling and report/block tools</li>
              <li>- Post-date feedback loop calibrates future matches</li>
            </ul>
            <Link href="/auth?signup=1" className="block text-center bg-[#C8102E] hover:bg-[#A50D26] text-white px-5 py-2.5 rounded-lg font-semibold">Start the conversation</Link>
          </div>
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">After GA (target Q1 2027)</p>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">$45 / match</h3>
            <p className="text-sm text-gray-600 mb-4">Pay only when a match is generated and you accept the introduction. Indicative:</p>
            <ul className="text-sm text-gray-700 space-y-2 mb-6">
              <li><strong>Per-match</strong> - $45 each, refunded if the other person doesn't accept</li>
              <li><strong>Quarterly</strong> - $99/quarter, includes up to 3 matches</li>
              <li><strong>Concierge</strong> - higher tier with human matchmaker review on every match</li>
            </ul>
            <p className="text-xs text-gray-500">Preview users get their first 2 matches free at GA.</p>
          </div>
        </div>
        <div className="mt-12 border-t pt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">FAQ</h2>
          <div className="space-y-4 text-sm text-gray-700">
            <details><summary className="cursor-pointer font-medium">What does the cohort waitlist mean?</summary><p className="mt-2">Matches are generated when there are enough thoughtful intakes in your area to find a real candidate. Until then, you wait. We tell you your position. No "5,000 active singles in your area" claims here.</p></details>
            <details><summary className="cursor-pointer font-medium">Can I get a refund?</summary><p className="mt-2">Yes - if the other person declines the introduction, your match credit refunds automatically. After GA, full refund within 7 days of paying if you have not yet received a match.</p></details>
            <details><summary className="cursor-pointer font-medium">What about safety and verification?</summary><p className="mt-2">See our <Link href="/safety" className="text-rose-700 hover:underline">Safety page</Link> for the full posture.</p></details>
          </div>
        </div>
      </section>
    </main>
  )
}
