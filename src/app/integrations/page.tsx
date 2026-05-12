export const metadata = { title: 'Integrations - Amorlay' }

export default function Page() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-900">
      <h1 className="text-3xl font-bold mb-2">Integrations</h1>
      <section className="space-y-6 text-sm leading-6 text-gray-700">
        <h2 className="text-lg font-semibold text-gray-900">Live</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Anthropic Claude</strong> for the conversational intake.</li>
          <li><strong>Supabase</strong> for storage and auth.</li>
          <li><strong>Resend</strong> for match-brief email delivery.</li>
        </ul>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">Roadmap</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>ID verification provider (Stripe Identity or Veriff, decision pending).</li>
          <li>Cal.com or Calendly for first-date scheduling once both members opt in.</li>
          <li>SMS notifications via Twilio for match-brief alerts.</li>
        </ul>
        <p className="text-xs text-gray-500 mt-8">Questions: <a className="text-rose-700 hover:underline" href="mailto:support@amorlay.com">support@amorlay.com</a>.</p>
      </section>
    </main>
  )
}
