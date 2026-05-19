import Link from 'next/link'
import MarketingHeader from '@/components/MarketingHeader'
import MarketingFooter from '@/components/MarketingFooter'

export const metadata = { title: 'Page not found - Amorlay' }

export default function NotFound() {
  return (
    <>
      <MarketingHeader />
      <main className="max-w-2xl mx-auto px-6 py-16 text-gray-900">
        <p className="text-xs uppercase tracking-widest text-rose-700 font-semibold mb-3">404</p>
        <h1 className="text-3xl font-bold mb-3">That page does not exist</h1>
        <p className="text-gray-600 mb-8">The link may have changed or never existed. Here is where you can go from here:</p>
        <ul className="space-y-2 text-sm text-gray-700 mb-8">
          <li><Link href="/" className="text-rose-700 hover:underline">Home</Link></li>
          <li><Link href="/pricing" className="text-rose-700 hover:underline">Pricing</Link></li>
          <li><Link href="/faq" className="text-rose-700 hover:underline">FAQ</Link></li>
          <li><Link href="/auth" className="text-rose-700 hover:underline">Sign in or create an account</Link></li>
        </ul>
        <p className="text-sm text-gray-600">If you think this is a bug, email <a className="text-rose-700 hover:underline" href="mailto:support@amorlay.com">support@amorlay.com</a>.</p>
      </main>
      <MarketingFooter />
    </>
  )
}
