'use client';

import { useState } from 'react';
import Link from 'next/link';
import { urls } from '../../lib/config';

const tiers = [
  {
    name: 'Starter',
    description: 'For teams exploring AI governance',
    features: [
      'Up to 5 AI agents',
      'Basic trust scoring (L0-L3)',
      'Standard audit logs',
      'Community support',
      'Single environment',
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
  {
    name: 'Enterprise',
    description: 'For organizations deploying AI at scale',
    features: [
      'Unlimited AI agents',
      'Full trust scoring (L0-L5)',
      'Advanced capability gating',
      'Cryptographic proof chains',
      'Multi-environment support',
      'SSO & RBAC',
      'Dedicated support',
      'Custom SLAs',
    ],
    cta: 'Contact Sales',
    highlight: true,
  },
  {
    name: 'Custom',
    description: 'For unique enterprise requirements',
    features: [
      'Everything in Enterprise',
      'On-premise deployment',
      'Custom integrations',
      'Compliance certifications',
      'Dedicated success manager',
      'Training & onboarding',
      'Priority roadmap input',
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
];

export default function PricingPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    agentCount: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Construct mailto link with form data
    const subject = encodeURIComponent(`[AgentAnchor Pricing] Inquiry from ${formData.company}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\n` +
      `Email: ${formData.email}\n` +
      `Company: ${formData.company}\n` +
      `Expected Agents: ${formData.agentCount || 'Not specified'}\n\n` +
      `Message:\n${formData.message}`
    );

    // Open mailto link
    window.location.href = `mailto:sales@vorion.org?subject=${subject}&body=${body}`;

    // Show success state
    setStatus('success');
    setFormData({ name: '', email: '', company: '', agentCount: '', message: '' });
  };

  return (
    <main className="min-h-screen bg-[#05050a] text-gray-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#05050a]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-white">AgentAnchor</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-gray-400 hover:text-white transition text-sm font-medium">Home</Link>
              <Link href="/pricing" className="text-cyan-400 text-sm font-medium">Pricing</Link>
              <a href={urls.discord} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition text-sm font-medium">
                Discord
              </a>
              <a href={urls.app} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white rounded-lg transition text-sm font-medium">
                Launch App
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Enterprise Pricing
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Flexible plans designed for teams of all sizes. All plans include our core governance infrastructure with enterprise-grade security.
          </p>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-8 ${
                  tier.highlight
                    ? 'bg-gradient-to-b from-cyan-500/10 to-transparent border-2 border-cyan-500/50 relative'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-cyan-500 text-white text-sm font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-gray-400 mb-6">{tier.description}</p>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-gray-300">
                      <svg className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#contact"
                  className={`block w-full py-3 px-6 rounded-lg font-semibold text-center transition ${
                    tier.highlight
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">
            All Plans Include
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Trust Scoring', desc: '0-1000 credit-score model' },
              { title: 'Capability Gating', desc: 'ALLOW/DENY/ESCALATE decisions' },
              { title: 'Audit Trails', desc: 'Immutable proof chains' },
              { title: 'SDK Access', desc: 'TypeScript & Python support' },
            ].map((item) => (
              <div key={item.title} className="text-center p-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact" className="py-20 px-4 border-t border-white/5 scroll-mt-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-4">
              Contact Sales
            </h2>
            <p className="text-gray-400">
              Tell us about your AI governance needs and we'll get back to you within 24 hours.
            </p>
          </div>

          {status === 'success' ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-bold text-white mb-2">Email Draft Ready</h3>
              <p className="text-gray-400 mb-4">Your email client should have opened with your message. Send the email to complete your inquiry.</p>
              <button
                onClick={() => setStatus('idle')}
                className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition"
              >
                Submit another inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-8 space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Company *</label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Expected AI Agents</label>
                  <select
                    value={formData.agentCount}
                    onChange={(e) => setFormData({ ...formData, agentCount: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition"
                  >
                    <option value="" className="bg-gray-900">Select range</option>
                    <option value="1-5" className="bg-gray-900">1-5 agents</option>
                    <option value="6-20" className="bg-gray-900">6-20 agents</option>
                    <option value="21-50" className="bg-gray-900">21-50 agents</option>
                    <option value="51-100" className="bg-gray-900">51-100 agents</option>
                    <option value="100+" className="bg-gray-900">100+ agents</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">How can we help? *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition resize-none"
                  placeholder="Tell us about your AI governance requirements..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white rounded-lg font-semibold transition"
              >
                Request Pricing
              </button>
              <p className="text-xs text-gray-500 text-center">
                Opens your email client with a pre-filled message to sales@vorion.org
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Vorion Risk, LLC
          </p>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/" className="hover:text-white transition">Home</Link>
            <a href="https://vorion.org" className="hover:text-white transition">Vorion</a>
            <a href={urls.discord} className="hover:text-white transition">Discord</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
