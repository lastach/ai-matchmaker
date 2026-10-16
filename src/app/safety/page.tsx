import MarketingHeader from '@/components/MarketingHeader'
import MarketingFooter from '@/components/MarketingFooter'
export const metadata = { title: 'Safety | Amorlay' }

const ITEMS: Array<[string, string]> = [
  ['A person reviews every match', 'The AI scores possible matches, and a person reviews each one before it goes out. Nobody is introduced automatically.'],
  ['First dates are in public', 'Every first date is planned at a public place. Meet there, tell a friend where you will be, and leave whenever you want to.'],
  ['What your match sees', 'Your first name, age, one photo and a two line “about you”. Your full conversation is never shared with another member.'],
  ['Reporting', 'If anything about a date felt unsafe, tell your date coach in the debrief or email support@amorlay.com. A person reads every report, and that member is not matched again while we look into it.'],
  ['If you are going through something hard', 'If you mention being in danger or thoughts of harming yourself during the conversation, it pauses and points you to the 988 Suicide and Crisis Lifeline (call or text 988) and the National Domestic Violence Hotline (1-800-799-7233). None of that is used for matching.'],
  ['What we do not do yet', 'During early access there is no ID verification and no background check. Use the same care you would with anyone you have not met.'],
]

export default function Safety() {
  return (
    <>
      <MarketingHeader />
      <main className="min-h-screen bg-white">
        <section className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Safety</h1>
          <p className="text-lg text-gray-600 mb-10">How we handle what you share, and how dates are set up.</p>
          <div className="space-y-8 text-[15px] text-gray-800 leading-7">
            {ITEMS.map(([h, p]) => (
              <div key={h}><h2 className="text-lg font-semibold mb-2">{h}</h2><p>{p}</p></div>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
