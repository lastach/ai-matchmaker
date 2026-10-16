import MarketingHeader from '@/components/MarketingHeader'
import MarketingFooter from '@/components/MarketingFooter'
export const metadata = { title: 'About | Amorlay' }

export default function Page() {
  return (
    <>
      <MarketingHeader />
      <main className="max-w-3xl mx-auto px-6 py-12 text-gray-900">
        <h1 className="text-3xl font-bold mb-2">About Amorlay</h1>
        <p className="text-gray-600 mb-8">For people done with swiping.</p>
        <section className="space-y-4 text-[15px] leading-7 text-gray-700">
          <p>Amorlay does not show you a feed. You tell us about yourself in your own words, typed or spoken, and the AI only asks about what it still needs. Once a month we pick one person for you and plan the date. A person reviews every match before it goes out.</p>
          <h2 className="text-lg font-semibold text-gray-900 mt-6">Who it is for</h2>
          <p>Adults who want a relationship and are tired of dating apps. We open city by city.</p>
          <h2 className="text-lg font-semibold text-gray-900 mt-6">Status</h2>
          <p>Early access, and free while we build each city. See <a className="text-rose-700 hover:underline" href="/pricing">pricing</a> and <a className="text-rose-700 hover:underline" href="/safety">safety</a>.</p>
          <h2 className="text-lg font-semibold text-gray-900 mt-6">Contact</h2>
          <p>Questions or feedback? Email <a className="text-rose-700 hover:underline" href="mailto:support@amorlay.com">support@amorlay.com</a>.</p>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
