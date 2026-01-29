import Link from 'next/link'
import { Bot, Shield, Users, Globe, Heart, ArrowRight, Linkedin, Twitter } from 'lucide-react'

const team = [
  { name: 'Alex Chen', role: 'CEO & Co-founder', image: '/team/alex.jpg' },
  { name: 'Sarah Williams', role: 'CTO & Co-founder', image: '/team/sarah.jpg' },
  { name: 'Michael Torres', role: 'Head of AI Safety', image: '/team/michael.jpg' },
  { name: 'Emily Johnson', role: 'Head of Engineering', image: '/team/emily.jpg' },
]

const values = [
  {
    icon: Shield,
    title: 'Safety First',
    description: 'We believe AI agents must be safe by design, not as an afterthought. Every feature we build prioritizes safety.',
  },
  {
    icon: Users,
    title: 'Human-Centered',
    description: 'AI should augment human capabilities, not replace human judgment. We keep humans in the loop at every level.',
  },
  {
    icon: Globe,
    title: 'Open Standards',
    description: 'The BASIS framework is open. We believe trust in AI requires transparency and community participation.',
  },
  {
    icon: Heart,
    title: 'Responsible Innovation',
    description: 'We move carefully and build things that matter. Speed without safety is not progress.',
  },
]

export default function AboutPage() {
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

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            Building the future of <span className="text-gradient">trusted AI</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Aurais is on a mission to make autonomous AI agents safe, transparent, and accountable.
            We're building the infrastructure for AI you can trust.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">Our Story</h2>
          <div className="prose prose-invert prose-lg max-w-none">
            <p className="text-gray-300">
              Aurais was founded in 2025 with a simple observation: as AI agents become more capable,
              we need better ways to verify they're acting in our interests. The existing approaches—either
              giving agents full access or restricting them to narrow tasks—weren't working.
            </p>
            <p className="text-gray-300">
              We developed the BASIS (Behavioral AI Safety & Integrity Standard) framework to solve this.
              Instead of binary trust decisions, BASIS evaluates agents across 23 factors and grants
              capabilities progressively as trust is earned and demonstrated.
            </p>
            <p className="text-gray-300">
              Today, Aurais powers AI agents for companies ranging from startups to Fortune 500 enterprises.
              Our platform ensures that as AI becomes more autonomous, it remains aligned with human values
              and accountable for its actions.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-4 bg-aurais-primary/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
          <div className="grid grid-cols-2 gap-6">
            {values.map((value, i) => (
              <div key={i} className="glass rounded-2xl p-8">
                <value.icon className="w-10 h-10 text-aurais-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3">{value.title}</h3>
                <p className="text-gray-400">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Leadership Team</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Our team combines deep expertise in AI safety, distributed systems, and enterprise software.
          </p>
          <div className="grid grid-cols-4 gap-6">
            {team.map((person, i) => (
              <div key={i} className="glass rounded-2xl p-6 text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-aurais-primary/20 to-aurais-accent/20 mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-10 h-10 text-aurais-primary" />
                </div>
                <h3 className="font-semibold">{person.name}</h3>
                <p className="text-sm text-gray-400 mb-3">{person.role}</p>
                <div className="flex items-center justify-center gap-2">
                  <a href="#" className="p-2 rounded-lg hover:bg-white/10 transition">
                    <Linkedin className="w-4 h-4 text-gray-400" />
                  </a>
                  <a href="#" className="p-2 rounded-lg hover:bg-white/10 transition">
                    <Twitter className="w-4 h-4 text-gray-400" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Join us in building trusted AI</h2>
          <p className="text-gray-400 mb-8">We're hiring across engineering, research, and go-to-market.</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/careers" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium">
              View Open Roles <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/contact" className="px-6 py-3 rounded-xl glass glass-hover transition font-medium">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
