'use client';

import { useState } from 'react';
import { Navbar, HeroSection, NexusChat } from '@/components/nexus';
import { Button } from '@/components/ui/button';
import { BookOpen, Layers, FileCode, Cpu, Shield, Zap, GraduationCap, Award, Map, ArrowRight, Sparkles, Target, Users } from 'lucide-react';
import Link from 'next/link';

// Learning journey steps for beginners
const learningJourney = [
  {
    step: 1,
    title: 'Understand the Basics',
    description: 'Start with core concepts like trust scores, capability gating, and the ACI specification.',
    icon: BookOpen,
    action: 'Browse Lexicon',
    href: '/lexicon?difficulty=beginner',
    color: 'cyan',
  },
  {
    step: 2,
    title: 'Follow a Learning Path',
    description: 'Structured courses take you from fundamentals to advanced topics step-by-step.',
    icon: Map,
    action: 'View Paths',
    href: '/paths',
    color: 'purple',
  },
  {
    step: 3,
    title: 'Test Your Knowledge',
    description: 'Take quizzes to reinforce learning and earn certificates to showcase your expertise.',
    icon: Award,
    action: 'My Certificates',
    href: '/certificates',
    color: 'green',
  },
];

const features = [
  {
    icon: BookOpen,
    title: 'Knowledge Lexicon',
    description: 'Searchable dictionary of 50+ AI governance terms with difficulty levels.',
    href: '/lexicon',
    color: 'cyan',
  },
  {
    icon: Map,
    title: 'Learning Paths',
    description: 'Structured courses from beginner to expert with progress tracking.',
    href: '/paths',
    color: 'purple',
  },
  {
    icon: Award,
    title: 'Certificates',
    description: 'Earn verified certificates by completing quizzes and demonstrating mastery.',
    href: '/certificates',
    color: 'green',
  },
  {
    icon: FileCode,
    title: 'Documentation',
    description: 'Technical guides on ACI specification, agent architecture, and protocols.',
    href: '/docs',
    color: 'orange',
  },
];

const ecosystemLinks = [
  {
    icon: Shield,
    title: 'ACI Specification',
    description: 'Agent Capability Interface - the open standard for AI governance',
    href: 'https://npmjs.com/package/@vorionsys/aci-spec',
  },
  {
    icon: Zap,
    title: 'AgentAnchor',
    description: 'Enterprise AI governance platform with trust scoring and certification',
    href: 'https://agentanchorai.com',
  },
  {
    icon: Cpu,
    title: 'Vorion Systems',
    description: 'Organization building the future of AI governance infrastructure',
    href: 'https://vorion.org',
  },
];

export default function HomePage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Navbar onActivateChat={() => setChatOpen(true)} />

      <main className="flex-grow pt-24 pb-12 px-4 max-w-7xl mx-auto w-full">
        <HeroSection />

        {/* New to AI Governance? - Beginner Section */}
        <section className="mt-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm mb-4">
              <Sparkles className="w-4 h-4" />
              New to AI Governance?
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Your Learning Journey Starts Here
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              AI governance ensures AI systems operate safely and predictably. Whether you&apos;re a developer,
              executive, or curious learner, we&apos;ll guide you from basics to mastery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {learningJourney.map((item) => (
              <div
                key={item.step}
                className="relative glass p-6 rounded-xl border border-gray-700/50 hover:border-cyan-500/30 transition-all group"
              >
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-black font-bold text-sm">
                  {item.step}
                </div>
                <div className={`w-12 h-12 rounded-lg bg-${item.color}-500/20 flex items-center justify-center mb-4`}>
                  <item.icon className={`w-6 h-6 text-${item.color}-400`} />
                </div>
                <h3 className="font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 mb-4">{item.description}</p>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                >
                  {item.action}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Features Grid */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Explore Resources
          </h2>
          <p className="text-gray-400 text-center mb-8">
            Everything you need to understand and implement AI governance
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(feature => (
              <Link
                key={feature.title}
                href={feature.href}
                className="glass p-6 rounded-lg hover:bg-white/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400">{feature.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* What You'll Learn - Quick Overview */}
        <section className="mt-16 glass p-8 rounded-xl border border-gray-700/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">
                What You&apos;ll Learn
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Target className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    <strong className="text-white">Trust Scores</strong> - How AI agents earn trust from T0 (untrusted) to T5 (autonomous)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    <strong className="text-white">Capability Gating</strong> - Matching AI permissions to their trust levels
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    <strong className="text-white">Circuit Breakers</strong> - Safety systems that prevent runaway AI behavior
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <FileCode className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    <strong className="text-white">ACI Specification</strong> - The open standard powering it all
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Who This Is For
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    <strong className="text-white">Developers</strong> - Build safer AI systems with proper governance
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    <strong className="text-white">Executives</strong> - Understand AI risk management for your organization
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    <strong className="text-white">Security Teams</strong> - Learn to audit and monitor AI systems
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    <strong className="text-white">Curious Minds</strong> - Anyone interested in safe AI deployment
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Ecosystem Links */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Part of the Vorion Ecosystem
          </h2>
          <p className="text-gray-400 text-center mb-8">
            Learn.vorion.org is the educational hub for these technologies
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ecosystemLinks.map(link => (
              <a
                key={link.title}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="glass p-6 rounded-lg hover:bg-white/5 transition-all group border-l-2 border-cyan-500"
              >
                <div className="flex items-center gap-3 mb-3">
                  <link.icon className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-white">{link.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{link.description}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Quick Start CTA */}
        <section className="mt-16 glass p-8 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Ready to start learning?
              </h2>
              <p className="text-gray-400">
                Begin with our recommended beginner path or explore the lexicon at your own pace.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/paths">
                <Button
                  variant="neon"
                  size="lg"
                  className="font-mono"
                >
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Start Learning
                </Button>
              </Link>
              <Link href="/lexicon">
                <Button variant="outline" size="lg">
                  Browse Lexicon
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Vorion Risk, LLC. Content licensed under CC BY 4.0.
          </p>
          <div className="flex gap-4 text-sm text-gray-500">
            <a href="https://vorion.org" className="hover:text-cyan-400 transition-colors">
              Vorion
            </a>
            <a href="https://vorion.org/basis" className="hover:text-cyan-400 transition-colors">
              BASIS
            </a>
            <a href="https://discord.gg/basis-protocol" className="hover:text-cyan-400 transition-colors">
              Discord
            </a>
            <a href="https://github.com/voriongit" className="hover:text-cyan-400 transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* NEXUS Chat */}
      <NexusChat isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </>
  );
}
