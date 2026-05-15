import MarketingHeader from '@/components/MarketingHeader'
export const metadata = { title: 'Verification - Amorlay' }

export default function VerificationPage() {
  return (
    <>
      <MarketingHeader />
      <main className="max-w-3xl mx-auto px-6 py-12 text-gray-900">
      <h1 className="text-3xl font-bold mb-2">Verification</h1>
      <p className="text-gray-600 mb-8">
        How we will verify members at general availability, and what we are doing during early access.
      </p>

      <section className="space-y-4 text-sm leading-6 text-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 mt-6">During early access</h2>
        <p>
          Accounts are email-verified only. We are not delivering matches yet, so no identity or
          photo verification is required to enter the intake. The cohort is opt-in and small.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-6">At general availability</h2>
        <p>
          Before any match is delivered, every member will pass two checks:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Government ID + selfie liveness check (provider TBD; SOC 2 vendors short-listed).</li>
          <li>Photo verification: a moderator-reviewed selfie compared against the photos in your profile.</li>
        </ul>
        <p>
          Members who fail either check do not enter the matching pool. We will not show you to
          someone, or show someone to you, who has not passed both.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-6">What we will not do</h2>
        <p>
          We will not require background checks, social media handles, or financial documents. We
          will not use facial recognition to surveil members between sessions.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-6">Reporting and removal</h2>
        <p>
          A reported member is paused immediately. We review, and if we find anything that suggests
          misrepresentation or harm, the account is removed and any pending match is cancelled.
          See <a className="text-rose-700 hover:underline" href="/safety">Safety</a> for the full
          posture.
        </p>

        <p className="text-xs text-gray-500 mt-8">
          Amorlay is in early access, run by a single founder. This is an evolving page; tell us
          what is missing.
        </p>
      </section>
    </main>
    </>
  )
}
