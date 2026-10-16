import MarketingHeader from '@/components/MarketingHeader'
import MarketingFooter from '@/components/MarketingFooter'
export const metadata = { title: 'FAQ | Amorlay' }

const QA: Array<[string, React.ReactNode]> = [
  ['How does it work?', 'You have a conversation with our AI matchmaker, do a short video interview, and add photos. Once a month we pick one person for you and plan the first date: who, when and where. There is no messaging beforehand. An AI date coach helps you prepare and talks it through with you afterward.'],
  ['How long does setup take?', 'About 20 minutes of conversation (type or tap the mic and talk), a 3 minute video interview, and a few minutes for photos. You can stop and come back; everything saves as you go.'],
  ['Who reads my answers?', 'An AI built on Anthropic’s Claude reads the conversation and builds your matching profile. A person reviews every match before it goes out. The AI never introduces people on its own.'],
  ['What does my match see?', 'Your first name, age, one photo, and a two line “about you” written from your conversation. Your date coach also tells them what helps you feel understood. Nothing else you say is shared.'],
  ['Who sees my photos?', 'Members in your city who could be a match for you, while they rate who they are drawn to, and your match before your date. Nobody sees how you rated anyone.'],
  ['When do I get matched?', 'When there is someone in your city who clears both of your dealbreakers and scores well both ways. Your page shows where your city stands.'],
  ['What happens if we both want a second date?', 'After the date, each of you tells your coach how it went. If you both want to see each other again, you each see the contact details the other chose to share.'],
  ['What will it cost?', <>Free during early access. After that, $1,000 for 3 months: one planned date a month plus the date coach. See <a className="text-rose-700 hover:underline" href="/pricing">pricing</a>.</>],
]

export default function Page() {
  return (
    <>
      <MarketingHeader />
      <main className="max-w-3xl mx-auto px-6 py-12 text-gray-900">
        <h1 className="text-3xl font-bold mb-6">FAQ</h1>
        <section className="space-y-6 text-[15px] leading-7 text-gray-700">
          {QA.map(([q, a]) => (
            <details key={q} open><summary className="cursor-pointer font-medium text-gray-900">{q}</summary><p className="mt-2">{a}</p></details>
          ))}
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
