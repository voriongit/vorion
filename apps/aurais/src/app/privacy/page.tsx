import Link from 'next/link'
import { Bot, ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-gray-400 mb-8">Last updated: January 28, 2026</p>

          <div className="prose prose-invert prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-gray-300">
                Aurais ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI agent platform and services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
              <p className="text-gray-300 mb-3">We collect information in the following ways:</p>
              <ul className="list-disc pl-6 text-gray-300 space-y-2">
                <li><strong>Account Information:</strong> Name, email address, company name, and payment information when you create an account.</li>
                <li><strong>Agent Data:</strong> Configuration, trust scores, execution logs, and performance metrics for your AI agents.</li>
                <li><strong>Usage Data:</strong> How you interact with our platform, including features used, time spent, and actions taken.</li>
                <li><strong>Technical Data:</strong> IP address, browser type, device information, and cookies.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 text-gray-300 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Calculate trust scores and enforce governance policies</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Analyze usage patterns to improve user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
              <p className="text-gray-300">
                We implement appropriate technical and organizational measures to protect your personal information, including encryption, access controls, and regular security assessments. All agent operations are logged and auditable through our Cognigate governance system.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
              <p className="text-gray-300">
                We retain your information for as long as your account is active or as needed to provide services. Agent execution logs are retained according to your tier's compliance requirements. You may request deletion of your data at any time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
              <p className="text-gray-300 mb-3">You have the right to:</p>
              <ul className="list-disc pl-6 text-gray-300 space-y-2">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Opt out of marketing communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Contact Us</h2>
              <p className="text-gray-300">
                If you have questions about this Privacy Policy or our data practices, please contact us at{' '}
                <a href="mailto:privacy@aurais.net" className="text-aurais-primary hover:text-aurais-secondary">
                  privacy@aurais.net
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
