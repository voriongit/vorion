import Link from 'next/link'
import { Bot, Calendar, Clock, ArrowRight, Tag } from 'lucide-react'

const posts = [
  {
    slug: 'introducing-basis-framework',
    title: 'Introducing the BASIS Trust Framework',
    excerpt: 'A comprehensive approach to AI agent governance with 23 trust factors and 8 progressive tiers.',
    date: '2026-01-15',
    readTime: '8 min',
    category: 'Announcements',
    featured: true,
  },
  {
    slug: 'trust-tiers-explained',
    title: 'Understanding Trust Tiers: From Sandbox to Autonomous',
    excerpt: 'Deep dive into the 8-tier trust model and how agents progress through capability levels.',
    date: '2026-01-10',
    readTime: '12 min',
    category: 'Technical',
    featured: true,
  },
  {
    slug: 'life-critical-factors',
    title: 'Life-Critical Trust Factors for Healthcare AI',
    excerpt: 'How the 8 life-critical factors prepare AI agents for high-stakes medical applications.',
    date: '2026-01-05',
    readTime: '10 min',
    category: 'Research',
    featured: false,
  },
  {
    slug: 'building-multi-agent-workflows',
    title: 'Building Multi-Agent Workflows with Aurais',
    excerpt: 'Tutorial on orchestrating complex workflows across multiple AI agents with trust boundaries.',
    date: '2025-12-20',
    readTime: '15 min',
    category: 'Tutorial',
    featured: false,
  },
  {
    slug: 'agent-marketplace-launch',
    title: 'Launching the Aurais Agent Marketplace',
    excerpt: 'Discover, deploy, and share trust-verified AI agents with the new marketplace.',
    date: '2025-12-15',
    readTime: '5 min',
    category: 'Announcements',
    featured: false,
  },
  {
    slug: 'security-audit-results',
    title: 'SOC 2 Type II Certification Complete',
    excerpt: 'Aurais achieves SOC 2 Type II certification, demonstrating enterprise-grade security.',
    date: '2025-12-01',
    readTime: '4 min',
    category: 'Security',
    featured: false,
  },
]

const categories = ['All', 'Announcements', 'Technical', 'Research', 'Tutorial', 'Security']

export default function BlogPage() {
  const featuredPosts = posts.filter(p => p.featured)
  const recentPosts = posts.filter(p => !p.featured)

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
      <section className="pt-32 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-gray-400">
            Insights on AI safety, agent governance, and building trusted autonomous systems.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="px-4 mb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                  cat === 'All'
                    ? 'bg-aurais-primary text-white'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Posts */}
      <section className="px-4 mb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Featured</h2>
          <div className="grid grid-cols-2 gap-6">
            {featuredPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="glass rounded-2xl p-8 hover:bg-white/10 transition group"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full bg-aurais-primary/20 text-aurais-primary text-xs font-medium">
                    {post.category}
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-aurais-primary transition">
                  {post.title}
                </h3>
                <p className="text-gray-400 mb-4">{post.excerpt}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {post.readTime}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Posts */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Recent</h2>
          <div className="space-y-4">
            {recentPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="glass rounded-xl p-6 flex items-center gap-6 hover:bg-white/10 transition group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-400 text-xs">
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-500">{post.date}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-1 group-hover:text-aurais-primary transition">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-400">{post.excerpt}</p>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  {post.readTime}
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-aurais-primary transition" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
