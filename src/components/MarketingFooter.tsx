import Link from 'next/link'

export default function MarketingFooter() {
  return (
    <footer className="border-t border-gray-200 py-6 mt-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row sm:justify-between gap-3 text-xs text-gray-500">
        <span>&copy; 2026 Amorlay</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
          <Link href="/safety" className="hover:text-gray-700">Safety</Link>
          <Link href="/verification" className="hover:text-gray-700">Verification</Link>
          <Link href="/integrations" className="hover:text-gray-700">Integrations</Link>
          <Link href="/faq" className="hover:text-gray-700">FAQ</Link>
          <Link href="/about" className="hover:text-gray-700">About</Link>
          <a href="mailto:support@amorlay.com" className="hover:text-gray-700">Contact</a>
          <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-700">Terms</Link>
        </div>
      </div>
    </footer>
  )
}
