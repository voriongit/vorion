import Link from 'next/link'
import { Bot, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-aurais-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-aurais-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aurais-primary to-aurais-accent flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gradient">Aurais</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>

        {/* Content */}
        <div className="glass rounded-2xl p-8">
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-gray-400 mb-8">Last updated: January 28, 2026</p>

          <div className="prose prose-invert prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-gray-300">
                By accessing or using Aurais ("the Service"), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-gray-300">
                Aurais provides a platform for deploying, managing, and governing autonomous AI agents. Our service includes trust scoring, capability management, and execution monitoring based on the BASIS (Behavioral AI Safety & Integrity Standard) framework.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
              <ul className="list-disc pl-6 text-gray-300 space-y-2">
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You are responsible for maintaining the security of your account credentials</li>
                <li>You are responsible for all activities that occur under your account</li>
                <li>You must notify us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Agent Governance</h2>
              <p className="text-gray-300 mb-3">
                All agents deployed through Aurais are subject to our governance framework:
              </p>
              <ul className="list-disc pl-6 text-gray-300 space-y-2">
                <li>Agents start at T0 (Sandbox) tier with limited capabilities</li>
                <li>Trust scores are calculated based on 23 factors across the BASIS framework</li>
                <li>Capabilities are granted based on demonstrated trust and compliance</li>
                <li>We reserve the right to suspend or terminate agents that violate policies</li>
                <li>All agent actions are logged and auditable</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Acceptable Use</h2>
              <p className="text-gray-300 mb-3">You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 text-gray-300 space-y-2">
                <li>Deploy agents that harm, harass, or discriminate against individuals</li>
                <li>Circumvent trust scoring or governance mechanisms</li>
                <li>Access systems or data without authorization</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Deploy agents for malicious purposes including malware or fraud</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Intellectual Property</h2>
              <p className="text-gray-300">
                You retain ownership of agents and configurations you create. We retain ownership of the Aurais platform, BASIS framework, and all related intellectual property. You grant us a license to operate your agents within the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
              <p className="text-gray-300">
                Aurais is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the past 12 months.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Termination</h2>
              <p className="text-gray-300">
                We may terminate or suspend your account immediately, without prior notice, for any breach of these Terms. Upon termination, your right to use the Service will cease immediately. You may terminate your account at any time through your account settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Changes to Terms</h2>
              <p className="text-gray-300">
                We reserve the right to modify these terms at any time. We will notify you of significant changes via email or through the Service. Continued use of the Service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
              <p className="text-gray-300">
                If you have questions about these Terms, please contact us at{' '}
                <a href="mailto:legal@aurais.net" className="text-aurais-primary hover:text-aurais-secondary">
                  legal@aurais.net
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
