'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bot, Mail, MessageSquare, Building, Send, CheckCircle, MapPin, Phone } from 'lucide-react'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: 'general',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1000))

    setIsSubmitted(true)
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aurais-primary to-aurais-accent flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gradient">Aurais</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/features" className="text-gray-400 hover:text-white transition">Features</Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white transition">Pricing</Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition">Docs</Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Get in Touch</h1>
            <p className="text-xl text-gray-400">
              Have questions? We'd love to hear from you.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="glass rounded-xl p-6">
                <Mail className="w-6 h-6 text-aurais-primary mb-3" />
                <h3 className="font-semibold mb-1">Email</h3>
                <p className="text-gray-400 text-sm mb-2">For general inquiries</p>
                <a href="mailto:hello@aurais.net" className="text-aurais-primary hover:text-aurais-secondary">
                  hello@aurais.net
                </a>
              </div>

              <div className="glass rounded-xl p-6">
                <Building className="w-6 h-6 text-aurais-primary mb-3" />
                <h3 className="font-semibold mb-1">Sales</h3>
                <p className="text-gray-400 text-sm mb-2">For enterprise inquiries</p>
                <a href="mailto:sales@aurais.net" className="text-aurais-primary hover:text-aurais-secondary">
                  sales@aurais.net
                </a>
              </div>

              <div className="glass rounded-xl p-6">
                <MessageSquare className="w-6 h-6 text-aurais-primary mb-3" />
                <h3 className="font-semibold mb-1">Support</h3>
                <p className="text-gray-400 text-sm mb-2">For technical help</p>
                <a href="mailto:support@aurais.net" className="text-aurais-primary hover:text-aurais-secondary">
                  support@aurais.net
                </a>
              </div>
            </div>

            {/* Contact Form */}
            <div className="col-span-2 glass rounded-2xl p-8">
              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
                  <p className="text-gray-400 mb-6">
                    Thanks for reaching out. We'll get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => {
                      setIsSubmitted(false)
                      setFormData({ name: '', email: '', company: '', subject: 'general', message: '' })
                    }}
                    className="text-aurais-primary hover:text-aurais-secondary"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-2">Name</label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">Email</label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium mb-2">Company (optional)</label>
                      <input
                        id="company"
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none"
                        placeholder="Acme Corp"
                      />
                    </div>
                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium mb-2">Subject</label>
                      <select
                        id="subject"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none"
                      >
                        <option value="general">General Inquiry</option>
                        <option value="sales">Sales / Enterprise</option>
                        <option value="support">Technical Support</option>
                        <option value="partnership">Partnership</option>
                        <option value="press">Press / Media</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium mb-2">Message</label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none resize-none"
                      placeholder="How can we help?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Send Message <Send className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
