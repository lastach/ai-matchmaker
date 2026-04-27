export const metadata = {
  title: 'Privacy Policy | Amorlay',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800 leading-relaxed">
      <a href="/" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back</a>
      <h1 className="text-3xl font-bold mt-4 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-6">Effective April 24, 2026</p>

      <p>
        Amorlay (Laurie Stach Holdings LLC, &ldquo;we,&rdquo; &ldquo;us&rdquo;) operates an AI-assisted matchmaking service that helps adults 18+ identify high-quality potential partners at www.amorlay.com. This page explains what we collect, how we use it, and the rights you have.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">What we collect</h2>
      <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>Account info: your email and password (handled via Supabase Authentication).</li>
          <li>Profile info: name, date of birth, gender, pronouns, dating preferences, own stance on children, and an optional self-description.</li>
          <li>Preference info: location and flexibility, age range preferences, attraction importance, dealbreakers, and free-text answers to five deeper conversational questions.</li>
          <li>Attraction signals: ratings you give sample portraits during training, and any reference photos you upload.</li>
          <li>Profile photos: images you upload of yourself.</li>
          <li>Diagnostic logs: application error logs (not personally identifiable) and sign-in events.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">How we use it</h2>
      <p className="text-sm">
        We use your data to operate Amorlay: sign you in, save your profile, render your dashboard, and deliver the feature set of the product you&apos;re using. We do not use your data to target ads.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">What we share</h2>
      <p className="text-sm">We do not sell your data. We do not share your data with advertisers. Profile info is only shared with other users we match you with, and only the specific fields we disclose in the app UI at the moment of match.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Third parties we use</h2>
      <p className="text-sm">Supabase (authentication + data storage) and Vercel (hosting). Both are bound by data-processing agreements.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Retention</h2>
      <p className="text-sm">
        We retain your account data for as long as your account exists. If you delete your account, we delete your personal data within 30 days, except where we are legally required to keep records (e.g., tax records for invoices, or abuse/fraud logs).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Your rights</h2>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Access and download your data by emailing support@amorlay.com.</li>
        <li>Correct or update your data from inside the app.</li>
        <li>Delete your account from Settings. Deletion is immediate; processor copies are purged within 30 days.</li>
        <li>If you are in the EEA or UK, object to processing or lodge a complaint with your data protection authority.</li>
        <li>If you are in California, request details of any disclosure of your personal information in the past 12 months. We disclose only to the processors listed above for the purpose of operating the service.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">Children</h2>
      <p className="text-sm">
        Amorlay is not intended for anyone under 13 (or 16 in the EEA/UK). We do not knowingly collect data from children. If you believe a child has created an account, email support@amorlay.com and we will delete it.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Google API Services User Data Policy</h2>
      <p className="text-sm">
        Amorlay&apos;s use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements. We do not share Google user data with third parties, do not use it for advertising, and do not allow humans to read it except where necessary for security, to comply with law, or with your explicit consent.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Contact</h2>
      <p className="text-sm">
        Privacy questions: support@amorlay.com<br/>
        Mailing address: c/o DelawareRegisteredAgent.com, 8 The Green, Suite A, Dover, DE 19901
      </p>

      <p className="text-xs text-gray-400 mt-10">
        Values shown in curly-brace placeholders will be replaced with real legal entity information before public release.
      </p>
    </main>
  );
}
