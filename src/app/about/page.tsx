export const metadata = { title: 'About - Amorlay' }

export default function Page() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-900">
      <h1 className="text-3xl font-bold mb-2">About Amorlay</h1>
      <p className="text-gray-600 mb-8">For people done with swiping.</p>
      <section className="space-y-4 text-sm leading-6 text-gray-700">
        <p>Amorlay does not show you a feed. You answer 21 thoughtful questions in your own words. The AI reads your answers carefully, a human matchmaker reviews every match before it goes out, and you get one introduction at a time with a memo explaining why we paired you.</p>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">Who it is for</h2>
        <p>Adults 18 and over who are tired of dating-app fatigue and want a slower, more intentional path. Currently building cohorts city by city.</p>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">What it is not</h2>
        <p>Not a swipe app. Not a chatroom. Not a lead-gen tool for matchmaking concierges who upsell you. The matchmaker is in the loop, not above the loop.</p>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">Status</h2>
        <p>Early access. Free during early access while we build the cohort. Pricing posted on <a className="text-rose-700 hover:underline" href="/pricing">/pricing</a>; safety on <a className="text-rose-700 hover:underline" href="/safety">/safety</a>; verification on <a className="text-rose-700 hover:underline" href="/verification">/verification</a>.</p>
      </section>
    </main>
  )
}
