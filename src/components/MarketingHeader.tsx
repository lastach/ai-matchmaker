import Link from 'next/link'

export default function MarketingHeader() {
  return (
    <nav className="border-b border-rose-100 bg-[#FBF9F7]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/"><img src="/logo.svg" alt="Amorlay" className="h-9" /></Link>
        <div className="flex items-center gap-5">
          <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">Pricing</Link>
          <Link href="/safety" className="text-sm font-medium text-gray-600 hover:text-gray-900">Safety</Link>
          <Link href="/verification" className="text-sm font-medium text-gray-600 hover:text-gray-900">Verification</Link>
          <Link href="/faq" className="text-sm font-medium text-gray-600 hover:text-gray-900">FAQ</Link>
          <Link href="/auth" className="text-sm font-semibold text-gray-900 hover:text-red-600">Sign in</Link>
        </div>
      </div>
    </nav>
  )
}
