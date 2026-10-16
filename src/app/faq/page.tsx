import MarketingHeader from '@/components/MarketingHeader'
import MarketingFooter from '@/components/MarketingFooter'
export const metadata = { title: 'FAQ | Amorlay' }

const QA: Array<[string, React.ReactNode]> = [
  ['How does it work?', 'You have a conversation with our AI matchmaker, do a short video interview, add photos, and rate some example photos so we learn your type. Once we are matching in your city, we pick one person for you each month and plan the first date: who, when and where. There is no messaging and there are no photos beforehand. An AI date coach helps you prepare and talks it through with you afterward.'],
  ['Is my city open?', 'We are opening city by city. Set up your profile now and we will let you know as soon as we are matching where you live.'],
  ['How long does setup take?', 'About 20 minutes of conversation (type or tap the mic and talk), a 3 minute video interview, and about 5 minutes for photos and your type. You can stop and come back; everything saves as you go.'],
  ['Who reads my answers?', 'An AI built on Anthropic’s Claude reads the conversation and builds your matching profile. A person reviews every match before it goes out. The AI never introduces people on its own.'],
  ['What does my match see?', 'Your first name, age, and where and when to meet. Their date coach also tells them a few things that help you feel understood. They never see your photos or your conversation.'],
  ['Who sees my photos?', 'Only our matchmaker and the AI, which compares your look with the type your potential matches are drawn to. Other members never see them.'],
  ['How do you know who I will be attracted to?', 'You rate example photos of strangers, some of them again with a line about their personality, and then pick between faces side by side: face shape, eyes, jawline, nose, lips, brows and cheekbones, plus build, hair color and facial hair. That shows us the look you are drawn to and how much personality changes it for you. We then compare it with the look of each potential match.'],
  ['Can I choose the backgrounds of people I meet?', 'Yes, if you want to. You can share your own background and pick the backgrounds you would like to meet. If you pick any, you are only matched with people who shared a background on your list. Both are optional, and nothing is guessed from photos.'],
  ['Who gets matched?', 'Only people who are ready for a relationship. Then we check both people’s dealbreakers, and score how well the two of you fit: must-haves, values, how good a partner you would be for each other, energy, and attraction both ways.'],
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
