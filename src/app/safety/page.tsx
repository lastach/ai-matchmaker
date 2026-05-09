import Link from 'next/link'
export const metadata = { title: 'Safety - Amorlay' }
export default function Safety() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-rose-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/"><img src="/logo.svg" alt="Amorlay" className="h-9" /></Link>
          <Link href="/auth" className="text-sm font-medium text-gray-600 hover:text-gray-900">Sign in</Link>
        </div>
      </nav>
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Safety</h1>
        <p className="text-lg text-gray-600 mb-10">Matchmaking takes deeply personal disclosures. Here is how we handle them, and where we are vs. where we still need to be.</p>
        <div className="space-y-8 text-sm text-gray-800 leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold mb-2">Verification (we are building this)</h2>
            <p>Every Amorlay account at GA will go through ID verification (gov ID + selfie liveness check) and photo verification (selfies cross-checked against profile photos) before any match is delivered. During the research preview, accounts are email-verified only - no IDs. We do not deliver matches during preview without manual matchmaker review.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Who is "the I" you are talking to</h2>
            <p>The conversational intake is an AI built on Anthropic's Claude. It reads your answers carefully and writes back specific reactions. A human matchmaker reviews every match before it is sent - the AI does not introduce people on its own.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">What gets shared with your match</h2>
            <p>Only the brief - a 1-page summary of why we paired you, written in our voice. Your raw intake answers are never shared with another user without your explicit consent. First names only until you both opt in to fuller disclosure.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Reporting and blocking</h2>
            <p>Every match has Report and Block buttons. Reports go to a human within 24 hours. Confirmed bad-faith behavior results in account closure with no refund. We share with law enforcement only when legally compelled.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Crisis disclosure handling</h2>
            <p>If you disclose self-harm, suicidal ideation, or active abuse during intake, the conversation pauses and we provide direct links to 988 (US Suicide and Crisis Lifeline), the National Domestic Violence Hotline (1-800-799-7233), and the Crisis Text Line (text HOME to 741741). We never use crisis disclosures in your match brief.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Background checks (we do not do these)</h2>
            <p>Amorlay does not run criminal background checks on users. We are not a substitute for caution on a first date - meet in public, tell a friend, trust your gut. We will surface warning signals from our own system (multiple reports, inconsistent intake answers) but cannot guarantee anyone's character.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Honest read on where we are</h2>
            <p>Amorlay is in research preview. ID verification, photo verification, and the human matchmaker review queue are scaffolded but not all live yet. We are honest about this; we will not deliver matches before the safety floor is in place.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
