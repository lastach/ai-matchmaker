export const metadata = { title: 'FAQ - Amorlay' }

export default function Page() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-900">
      <h1 className="text-3xl font-bold mb-2">FAQ</h1>
      <section className="space-y-6 text-sm leading-6 text-gray-700">
        <details><summary className="cursor-pointer font-medium text-gray-900">Who reviews my answers?</summary><p className="mt-2">An AI built on Anthropic Claude reads each answer to write a reflection back to you. A human matchmaker reviews any match brief before it is sent. The AI does not introduce people on its own.</p></details>
        <details><summary className="cursor-pointer font-medium text-gray-900">How long does the intake take?</summary><p className="mt-2">21 questions. About 20 to 30 minutes if you take it seriously. Most are open-ended; a handful require at least 20 words because the AI cannot read intent from a sentence fragment.</p></details>
        <details><summary className="cursor-pointer font-medium text-gray-900">When do I get matched?</summary><p className="mt-2">When there are enough thoughtful intakes in your area to find a real candidate. We tell you your position on the cohort waitlist. No fake "thousands nearby" claims.</p></details>
        <details><summary className="cursor-pointer font-medium text-gray-900">What gets shared with my match?</summary><p className="mt-2">Only the 1-page brief and your first name. Raw answers are never shared with another user without your explicit consent. Photos shared only after both opt in.</p></details>
        <details><summary className="cursor-pointer font-medium text-gray-900">Is there ID verification?</summary><p className="mt-2">At GA, yes: gov ID + selfie liveness + photo verification. During research preview, accounts are email-verified only and no matches are delivered. See <a className="text-rose-700 hover:underline" href="/verification">/verification</a>.</p></details>
        <details><summary className="cursor-pointer font-medium text-gray-900">What is it going to cost?</summary><p className="mt-2">Free during preview. After GA, $45 per match (refunded if the other person declines), or $99 per quarter, or a Concierge tier with deeper matchmaker review. <a className="text-rose-700 hover:underline" href="/pricing">/pricing</a>.</p></details>
      </section>
    </main>
  )
}
