export const metadata = {
  title: 'Terms of Service | Amorlay',
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800 leading-relaxed">
      <a href="/" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back</a>
      <h1 className="text-3xl font-bold mt-4 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-6">Effective April 24, 2026</p>

      <p>
        These terms are a contract between you and Laurie Stach Holdings LLC for use of Amorlay (the &ldquo;Service&rdquo;). By creating an account or using the Service, you accept these terms.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Eligibility</h2>
      <p className="text-sm">
        You must be 18 or older to use the Service. You must provide accurate account information.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Your account</h2>
      <p className="text-sm">
        You are responsible for keeping your account credentials secure. Notify us at support@amorlay.com immediately if you suspect unauthorized access. You may delete your account at any time from Settings.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Your content</h2>
      <p className="text-sm">
        You retain ownership of the content you submit to the Service (profile info, documents, uploads). You grant us a limited license to store, process, and display that content only to operate the Service for you.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Acceptable use</h2>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Do not use the Service for anything illegal, fraudulent, or harmful to others.</li>
        <li>Do not upload content that infringes copyright or other rights.</li>
        <li>Do not attempt to reverse-engineer, probe for vulnerabilities, or overwhelm the Service.</li>
        <li>Do not impersonate another person or misrepresent your affiliation.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">Beta status</h2>
      <p className="text-sm">
        Amorlay is currently in active development. Features may change, data may be reset during maintenance windows, and downtime is possible. We will give reasonable notice of any destructive changes.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">No professional advice</h2>
      <p className="text-sm">
        The Service is not a substitute for legal, medical, financial, or other professional advice. Amorlay may generate drafts or suggestions, but you are solely responsible for reviewing, correcting, and acting on any output.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Disclaimer of warranties</h2>
      <p className="text-sm">
        The Service is provided &ldquo;as is,&rdquo; without warranties of any kind, express or implied. We do not warrant that it will be uninterrupted, error-free, or meet your specific requirements.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Limitation of liability</h2>
      <p className="text-sm">
        To the maximum extent permitted by law, our total liability for any claim arising from or relating to the Service is capped at the amount you have paid us in the 12 months preceding the claim (or $100 if that amount is zero). We are not liable for indirect, incidental, or consequential damages.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Termination</h2>
      <p className="text-sm">
        We may suspend or terminate accounts that violate these terms or that we believe to be fraudulent or harmful. You may close your account at any time.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Governing law</h2>
      <p className="text-sm">
        These terms are governed by the laws of the State of Delaware, without regard to conflict-of-law rules.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Changes to these terms</h2>
      <p className="text-sm">
        We will post changes to these terms at www.amorlay.com/terms. If the changes are material we will also email active users. Continued use after the change takes effect means you accept the updated terms.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Contact</h2>
      <p className="text-sm">Questions: support@amorlay.com</p>

      <p className="text-xs text-gray-400 mt-10">
        Values shown in curly-brace placeholders will be replaced with real legal entity information before public release.
      </p>
    </main>
  );
}
