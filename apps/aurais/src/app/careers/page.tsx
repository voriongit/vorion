import Link from 'next/link'
import { Bot, MapPin, Briefcase, Clock, ArrowRight, Heart, Zap, Globe, Users } from 'lucide-react'

const jobs = [
  {
    id: 'senior-backend',
    title: 'Senior Backend Engineer',
    team: 'Platform',
    location: 'Remote (US/EU)',
    type: 'Full-time',
    description: 'Build the core infrastructure for agent execution, trust scoring, and governance.',
  },
  {
    id: 'ml-engineer',
    title: 'ML Engineer - Trust Systems',
    team: 'AI Safety',
    location: 'Remote (US/EU)',
    type: 'Full-time',
    description: 'Develop and improve the ML models that power our 23-factor trust evaluation system.',
  },
  {
    id: 'frontend-engineer',
    title: 'Frontend Engineer',
    team: 'Product',
    location: 'Remote (US/EU)',
    type: 'Full-time',
    description: 'Build beautiful, performant interfaces for agent management and monitoring.',
  },
  {
    id: 'devrel',
    title: 'Developer Relations Engineer',
    team: 'Developer Experience',
    location: 'Remote (US/EU)',
    type: 'Full-time',
    description: 'Help developers succeed with Aurais through docs, tutorials, and community engagement.',
  },
  {
    id: 'security-engineer',
    title: 'Security Engineer',
    team: 'Security',
    location: 'Remote (US/EU)',
    type: 'Full-time',
    description: 'Ensure the security of our platform and help customers build secure agent deployments.',
  },
]

const benefits = [
  { icon: Globe, title: 'Remote First', desc: 'Work from anywhere in US or EU timezones' },
  { icon: Heart, title: 'Health & Wellness', desc: 'Comprehensive health, dental, and vision' },
  { icon: Zap, title: 'Learning Budget', desc: '$2,500/year for conferences and courses' },
  { icon: Users, title: 'Team Offsites', desc: 'Quarterly in-person team gatherings' },
]

export default function CareersPage() {
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
            Join us in building <span className="text-gradient">trusted AI</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            We're a small, focused team working on one of the most important problems in AI:
            making autonomous agents safe and accountable.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-4 gap-4">
            {benefits.map((benefit, i) => (
              <div key={i} className="glass rounded-xl p-6 text-center">
                <benefit.icon className="w-8 h-8 text-aurais-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-1">{benefit.title}</h3>
                <p className="text-sm text-gray-400">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Open Positions</h2>
          <div className="space-y-4">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/careers/${job.id}`}
                className="glass rounded-xl p-6 flex items-center gap-6 hover:bg-white/10 transition group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold group-hover:text-aurais-primary transition">
                      {job.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-aurais-primary/20 text-aurais-primary text-xs">
                      {job.team}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{job.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      {job.type}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-aurais-primary transition" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Don't see a fit? */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Don't see a perfect fit?</h2>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">
              We're always looking for exceptional people who are passionate about AI safety.
              Send us your resume and tell us how you'd like to contribute.
            </p>
            <Link
              href="mailto:careers@aurais.net"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium"
            >
              Get in Touch <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
