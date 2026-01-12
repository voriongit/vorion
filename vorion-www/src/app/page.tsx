import React from 'react';
import Image from 'next/image';
import { ArrowRight, Shield, Cpu, Scale, Database, Globe } from 'lucide-react';
import Link from 'next/link';
import GovernancePlayground from '@/components/GovernancePlayground';

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 selection:bg-indigo-500/30">

      {/* Navigation */}
      <nav className="fixed w-full border-b border-white/5 bg-neutral-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/vorion.png" alt="VORION" width={32} height={32} className="rounded" />
            <span className="font-bold text-xl tracking-tighter text-white">VORION<span className="text-indigo-500">.ORG</span></span>
          </div>
          <div className="flex gap-6 text-sm font-medium text-neutral-400">
            <Link href="https://basis.vorion.org" className="hover:text-white transition-colors">Standard (BASIS)</Link>
            <Link href="https://learn.vorion.org" className="hover:text-white transition-colors">Learn (Omniscience)</Link>
            <Link href="https://cognigate.dev" className="hover:text-white transition-colors">Developer Engine</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto border-b border-white/5">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-indigo-400 mb-6">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            V1 CANONICAL STACK DEFINED
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6">
            Governance for the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
              Autonomous Age.
            </span>
          </h1>
          <p className="text-xl text-neutral-400 leading-relaxed max-w-2xl">
            VORION is the commercial steward of the BASIS standard. We provide the infrastructure to bind artificial intelligence to verifiable human intent.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="https://cognigate.dev/docs" className="px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors flex items-center gap-2">
              Access Cognigate Engine <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/manifesto" className="px-6 py-3 border border-white/10 rounded text-white hover:bg-white/5 transition-colors">
              Read the Manifesto
            </Link>
          </div>

          {/* Live Governance Playground */}
          <div className="mt-16">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">Try the Governance Engine</h2>
              <p className="text-sm text-neutral-500">Test how BASIS evaluates autonomous commands in real-time.</p>
            </div>
            <GovernancePlayground />
          </div>
        </div>
      </section>

      {/* The Stack Architecture */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">The Cohesive Stack</h2>
          <p className="text-neutral-400 max-w-2xl">
            A unified architecture for safe autonomous systems. Separating the standard (BASIS) from the commercial enforcer (VORION).
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* BASIS */}
          <Card
            icon={<Scale className="w-6 h-6 text-amber-400" />}
            title="BASIS"
            subtitle="The Standard"
            desc="Baseline Authority for Safe & Interoperable Systems. The global governance rules that systems must follow before reasoning begins."
            link="https://basis.vorion.org"
          />

          {/* INTENT */}
          <Card
            icon={<Cpu className="w-6 h-6 text-blue-400" />}
            title="INTENT"
            subtitle="Reasoning Layer"
            desc="Interprets and normalizes goals into structured plans. Surfaces risk and constraint pressure without executing actions."
          />

          {/* ENFORCE */}
          <Card
            icon={<Shield className="w-6 h-6 text-indigo-400" />}
            title="ENFORCE"
            subtitle="Enforcement Layer"
            desc="Validates plans against BASIS policies. Gates execution paths and mandates human approval when boundaries are tested."
          />

          {/* PROOF */}
          <Card
            icon={<Database className="w-6 h-6 text-emerald-400" />}
            title="PROOF"
            subtitle="Audit Layer"
            desc="Persistent Record of Operational Facts. Immutable logging that records intent lineage and enforcement decisions."
          />

        </div>
      </section>

      {/* The Pitch */}
      <section className="py-24 px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-light text-neutral-300 leading-relaxed">
            &ldquo;BASIS sets the rules. INTENT figures out the goal. ENFORCE stops the bad stuff. PROOF shows the receipts.&rdquo;
          </p>
          <p className="mt-6 text-neutral-500 font-mono text-sm">— The Vorion Stack</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-neutral-500">
          <p>© 2026 Vorion Risk, LLC.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="https://github.com/vorion-org" className="hover:text-white transition-colors flex items-center gap-2">
              <Globe className="w-3 h-3" /> GitHub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface CardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  desc: string;
  link?: string;
}

function Card({ icon, title, subtitle, desc, link }: CardProps) {
  const Content = (
    <div className="p-6 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/50 transition-colors h-full flex flex-col">
      <div className="mb-4 p-3 bg-white/5 rounded-lg w-fit">{icon}</div>
      <div className="mb-1 font-mono text-xs text-indigo-400 uppercase">{subtitle}</div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed flex-grow">{desc}</p>
    </div>
  );

  return link ? <Link href={link}>{Content}</Link> : <>{Content}</>;
}
