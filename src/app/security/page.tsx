export const metadata = { title: 'Security - Amorlay' }

export default function SecurityPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-900">
      <h1 className="text-3xl font-bold mb-2">Security and data handling</h1>
      <p className="text-gray-600 mb-8">
        Matchmaking takes deeply personal disclosures. Here is how the bytes are handled.
      </p>

      <section className="space-y-4 text-sm leading-6 text-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 mt-6">Where your answers live</h2>
        <p>
          Application data is stored in Supabase (US East), encrypted at rest. Connections to
          our app and to Supabase use TLS 1.2 or higher. Each member can read only their own
          intake.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-6">Who reads your answers</h2>
        <p>
          The conversational intake runs on Anthropic Claude. Claude reads each answer to write
          a reflection back to you and to compose a 1-page brief if and when you are matched.
          Anthropic does not retain your text for model training (zero-day retention by API
          default). A human matchmaker reviews the brief before it goes to anyone.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-6">What gets shared with another member</h2>
        <p>
          Only the 1-page brief and your first name. Raw answers are never shared with another
          member without your explicit consent. Photos are shared only after both members opt in
          to introduction.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-6">Compliance posture (honest read)</h2>
        <p>
          We are an early-access product run by a single founder. We are not SOC 2 certified yet, and
          we do not currently offer EU data residency. We follow least-privilege access, audit
          logging, encryption in transit and at rest, and access reviews. SOC 2 Type 1 is on the
          roadmap before general availability.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-6">Account deletion</h2>
        <p>
          Email <a className="text-rose-700 hover:underline" href="mailto:laurie.stach@gmail.com">laurie.stach@gmail.com</a> to delete
          your account. Intake answers, brief drafts, and any sent briefs are removed within 30
          days.
        </p>

        <p className="text-xs text-gray-500 mt-8">
          See also <a className="text-rose-700 hover:underline" href="/safety">Safety</a> and
          <a className="text-rose-700 hover:underline" href="/verification"> Verification</a>.
        </p>
      </section>
    </main>
  )
}
