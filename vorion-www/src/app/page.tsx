'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, Shield, Cpu, Scale, Database, Globe, MessageCircle,
  Lock, Unlock, AlertTriangle, CheckCircle, Zap, BarChart3, Users,
  FileCheck, Package, Send
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 selection:bg-indigo-500/30">

      {/* Navigation */}
      <nav className="fixed w-full border-b border-white/5 bg-neutral-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/vorion.png" alt="VORION" width={32} height={32} className="rounded" />
            <span className="font-bold text-xl tracking-tighter text-white">VORION</span>
          </div>
          <div className="hidden md:flex gap-6 text-sm font-medium text-neutral-400">
            <Link href="/basis" className="hover:text-white transition-colors">BASIS</Link>
            <Link href="#platform" className="hover:text-white transition-colors">Platform</Link>
            <Link href="/demo" className="hover:text-white transition-colors">Try Demo</Link>
            <Link href="https://cognigate.dev" className="hover:text-white transition-colors">Developers</Link>
            <Link href="https://agentanchorai.com/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="https://discord.gg/basis-protocol" className="hover:text-white transition-colors flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> Discord
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-sm mb-8">
            <Shield className="w-4 h-4" />
            Phase 6 Complete — ACI Spec v1.1.0 Published
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6">
            Trust Scoring for<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
              AI Agents
            </span>
          </h1>

          <p className="text-xl text-neutral-400 leading-relaxed max-w-3xl mx-auto mb-10">
            VORION provides the infrastructure to bind AI agents to verifiable human intent.
            Real-time trust scoring, capability gating, and immutable audit trails.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="#contact" className="px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors flex items-center gap-2">
              Contact Sales <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#demo" className="px-6 py-3 border border-white/10 rounded text-white hover:bg-white/5 transition-colors">
              See Live Demo
            </Link>
            <a href="https://npmjs.com/package/@vorionsys/aci-spec" target="_blank" className="px-6 py-3 border border-white/10 rounded text-white hover:bg-white/5 transition-colors flex items-center gap-2">
              <Package className="w-4 h-4" /> npm install @vorionsys/aci-spec
            </a>
          </div>
        </div>
      </section>

      {/* Understanding AI Governance - Beginner Section */}
      <section className="py-20 px-6 border-t border-white/5 bg-gradient-to-b from-indigo-500/5 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-wider text-indigo-400 font-medium">New to AI Governance?</span>
            <h2 className="text-3xl font-bold text-white mt-2 mb-4">What is AI Governance?</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Think of it like a credit score for AI. Just as banks use credit scores to decide loan amounts,
              AI governance uses trust scores to decide what an AI agent can do.
            </p>
          </div>

          {/* Simple 3-Step Explanation */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-indigo-400">1</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">AI Takes Action</h3>
              <p className="text-neutral-400 text-sm">
                An AI agent wants to do something—send an email, make a purchase, access data.
                Every action has a risk level.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-purple-400">2</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Trust is Checked</h3>
              <p className="text-neutral-400 text-sm">
                The system checks: "Has this AI earned enough trust for this action?"
                New agents start with low trust and must prove themselves.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-emerald-400">3</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Decision is Made</h3>
              <p className="text-neutral-400 text-sm">
                High trust? Approved. Low trust? Denied or escalated to a human.
                Everything is logged for compliance.
              </p>
            </div>
          </div>

          {/* Trust Tiers Explained Simply */}
          <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6 text-center">The 6 Trust Tiers (T0-T5)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { tier: 'T0', name: 'Sandbox', score: '0-99', desc: 'Brand new, testing only', color: 'red' },
                { tier: 'T1', name: 'Provisional', score: '100-299', desc: 'Learning, limited actions', color: 'orange' },
                { tier: 'T2', name: 'Established', score: '300-499', desc: 'Proven, standard tasks', color: 'yellow' },
                { tier: 'T3', name: 'Trusted', score: '500-699', desc: 'Reliable, extended access', color: 'blue' },
                { tier: 'T4', name: 'Verified', score: '700-899', desc: 'Highly trusted, sensitive ops', color: 'indigo' },
                { tier: 'T5', name: 'Certified', score: '900-1000', desc: 'Full autonomy, audited', color: 'emerald' },
              ].map(t => (
                <div key={t.tier} className={`p-4 rounded-xl bg-${t.color}-500/10 border border-${t.color}-500/20 text-center`}>
                  <div className={`text-2xl font-bold text-${t.color}-400 mb-1`}>{t.tier}</div>
                  <div className="text-sm font-medium text-white">{t.name}</div>
                  <div className="text-xs text-neutral-500 mb-2">{t.score}</div>
                  <div className="text-xs text-neutral-400">{t.desc}</div>
                </div>
              ))}
            </div>
            <p className="text-center text-neutral-500 text-sm mt-6">
              Trust is earned through consistent good behavior and lost quickly through failures.
            </p>
          </div>
        </div>
      </section>

      {/* The Challenge */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4 text-center">The Challenge</h2>
          <p className="text-neutral-400 text-center mb-12 max-w-2xl mx-auto">
            AI agents are deployed without governance infrastructure, creating compliance and security risks.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-white/5 border border-white/5 border-l-4 border-l-red-500">
              <AlertTriangle className="w-8 h-8 text-red-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Ungoverned Agents</h3>
              <p className="text-neutral-400 text-sm">
                AI agents operate without trust boundaries, making unrestricted decisions with no accountability.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/5 border-l-4 border-l-yellow-500">
              <Lock className="w-8 h-8 text-yellow-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">No Audit Trail</h3>
              <p className="text-neutral-400 text-sm">
                Enterprises can't prove what AI did, when, or why—a compliance nightmare.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/5 border-l-4 border-l-orange-500">
              <Users className="w-8 h-8 text-orange-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Trust Vacuum</h3>
              <p className="text-neutral-400 text-sm">
                No standard way to measure, verify, or communicate how much trust an AI agent has earned.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Solution - Platform Features */}
      <section id="platform" className="py-20 px-6 bg-gradient-to-b from-transparent to-indigo-500/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4 text-center">The ACI Standard</h2>
          <p className="text-neutral-400 text-center mb-12 max-w-2xl mx-auto">
            A comprehensive trust infrastructure that gives enterprises visibility, control, and accountability. Now published on npm.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6 text-indigo-400" />}
              title="Trust Scoring"
              description="0-1000 credit-score model with 6 discrete tiers (L0-L5). Weighted across behavioral, compliance, identity, and context dimensions."
              badges={['L5: Certified', 'L4: Trusted', 'L3: Standard']}
              badgeColors={['bg-green-500/10 text-green-400', 'bg-indigo-500/10 text-indigo-400', 'bg-blue-500/10 text-blue-400']}
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6 text-purple-400" />}
              title="Capability Gating"
              description="Every action is checked against trust level. Insufficient trust? Request denied, escalated, or degraded automatically."
              badges={['ALLOW', 'DENY', 'ESCALATE', 'DEGRADE']}
              badgeColors={['bg-green-500/10 text-green-400', 'bg-red-500/10 text-red-400', 'bg-yellow-500/10 text-yellow-400', 'bg-orange-500/10 text-orange-400']}
            />
            <FeatureCard
              icon={<FileCheck className="w-6 h-6 text-emerald-400" />}
              title="Proof Chain"
              description="SHA-256 hashed audit trail with cryptographic verification. Every decision is provable, every action is traceable."
              code="prf_a7b2c9d4e5f6..."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-orange-400" />}
              title="Trust Decay"
              description="Trust isn't permanent. Scores decay over time, with 3x accelerated decay after failures. Continuous good behavior required."
              footnote="7-day half-life | 3x failure multiplier | Real-time updates"
            />
          </div>
        </div>
      </section>

      {/* Animated Demo */}
      <section id="demo" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4 text-center">See It In Action</h2>
          <p className="text-neutral-400 text-center mb-8">
            Watch how ACI-powered governance evaluates and governs AI agent actions in real-time.
          </p>
          <AnimatedDemo />
        </div>
      </section>

      {/* The Stack */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4 text-center">The Cohesive Stack</h2>
          <p className="text-neutral-400 text-center mb-12 max-w-2xl mx-auto">
            A unified architecture for safe autonomous systems. The BASIS standard enforced by VORION infrastructure.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StackCard
              icon={<Scale className="w-6 h-6 text-amber-400" />}
              title="BASIS"
              subtitle="The Standard"
              desc="Global governance rules that systems must follow before reasoning begins."
              link="/basis"
            />
            <StackCard
              icon={<Cpu className="w-6 h-6 text-blue-400" />}
              title="INTENT"
              subtitle="Reasoning Layer"
              desc="Interprets and normalizes goals into structured plans."
            />
            <StackCard
              icon={<Shield className="w-6 h-6 text-indigo-400" />}
              title="ENFORCE"
              subtitle="Enforcement Layer"
              desc="Validates plans against policies. Gates execution paths."
            />
            <StackCard
              icon={<Database className="w-6 h-6 text-emerald-400" />}
              title="PROOF"
              subtitle="Audit Layer"
              desc="Immutable logging of intent lineage and enforcement decisions."
            />
          </div>

          <div className="mt-12 max-w-3xl mx-auto text-center">
            <p className="text-xl text-neutral-300 italic">
              "BASIS sets the rules. INTENT figures out the goal. ENFORCE stops the bad stuff. PROOF shows the receipts."
            </p>
          </div>
        </div>
      </section>

      {/* Integration */}
      <section className="py-20 px-6 border-t border-white/5 bg-gradient-to-t from-transparent to-indigo-500/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Works With Your Stack</h2>
          <p className="text-neutral-400 mb-8">Callback-based integration means no architectural changes required.</p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {['LangChain', 'CrewAI', 'AutoGen', 'Custom Agents'].map(name => (
              <span key={name} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-neutral-300">{name}</span>
            ))}
          </div>
          <div className="bg-neutral-900 p-6 rounded-xl text-left max-w-2xl mx-auto border border-white/10">
            <pre className="text-sm text-neutral-300 overflow-x-auto">
              <code>{`import { TrustBand, TRUST_THRESHOLDS } from '@vorionsys/aci-spec';
import { createTrustEngine } from '@vorionsys/atsf-core';

const engine = createTrustEngine();
await engine.initializeEntity('agent-001', TrustBand.T2);

// Your existing code - unchanged
const callback = engine.createCallback('agent-001');
await agent.invoke(input, { callbacks: [callback] });`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact" className="py-20 px-6 border-t border-white/5 scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-4">Get Started</h2>
            <p className="text-neutral-400">
              Interested in AI governance for your organization? Let's talk.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <ContactForm />
            <div className="flex flex-col justify-center space-y-4">
              <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-bold text-white mb-2">Join the Community</h3>
                <p className="text-sm text-neutral-400 mb-3">Chat with developers building with ACI.</p>
                <a href="https://discord.gg/basis-protocol" target="_blank" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors text-sm font-medium">
                  <MessageCircle className="w-4 h-4" /> Join Discord
                </a>
              </div>
              <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-bold text-white mb-2">Open Source</h3>
                <p className="text-sm text-neutral-400 mb-3">View source, contribute, or fork for your needs.</p>
                <a href="https://github.com/voriongit" target="_blank" className="inline-flex items-center gap-2 px-4 py-2 border border-white/20 hover:bg-white/5 text-white rounded transition-colors text-sm font-medium">
                  <Globe className="w-4 h-4" /> View on GitHub
                </a>
              </div>
              <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-bold text-white mb-2">Install Now</h3>
                <code className="block text-sm text-indigo-400 bg-neutral-900 px-3 py-2 rounded font-mono">
                  npm install @vorionsys/aci-spec
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-neutral-500">
          <p>© {new Date().getFullYear()} Vorion Risk, LLC.</p>
          <div className="flex gap-6">
            <Link href="/basis" className="hover:text-white transition-colors">BASIS</Link>
            <Link href="/manifesto" className="hover:text-white transition-colors">Manifesto</Link>
            <Link href="https://agentanchorai.com" className="hover:text-white transition-colors">AgentAnchor</Link>
            <Link href="https://discord.gg/basis-protocol" className="hover:text-white transition-colors flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> Discord
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description, badges, badgeColors, code, footnote }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badges?: string[];
  badgeColors?: string[];
  code?: string;
  footnote?: string;
}) {
  return (
    <div className="p-8 rounded-xl bg-white/5 border border-white/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">{icon}</div>
        <h3 className="text-xl font-bold text-white">{title}</h3>
      </div>
      <p className="text-neutral-400 mb-4">{description}</p>
      {badges && (
        <div className="flex gap-2 flex-wrap">
          {badges.map((badge, i) => (
            <span key={badge} className={`px-2 py-1 rounded text-xs ${badgeColors?.[i] || 'bg-white/10 text-white'}`}>{badge}</span>
          ))}
        </div>
      )}
      {code && <code className="text-xs text-indigo-400 bg-neutral-900 px-3 py-2 rounded block font-mono mt-2">{code}</code>}
      {footnote && <div className="text-xs text-neutral-500 mt-3">{footnote}</div>}
    </div>
  );
}

// Stack Card Component
function StackCard({ icon, title, subtitle, desc, link }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  desc: string;
  link?: string;
}) {
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

// Animated Demo Component
const demoScenarios = [
  { id: 'email', userMessage: 'Send an email to the team about the project update', assistantMessage: "I can help with that! My trust level allows external communication. I'll draft and send it—logged with a verifiable proof ID.", decision: 'ALLOW' as const, capabilities: ['generate_text', 'send_external'], deniedCapabilities: [] },
  { id: 'payment', userMessage: 'Process a $5,000 payment to vendor account', assistantMessage: "Financial operations require trust level L5 (833+). My current score is 687 (L4). I can prepare documentation or escalate to a human approver.", decision: 'DENY' as const, capabilities: ['generate_text'], deniedCapabilities: ['financial/payment'] },
  { id: 'schedule', userMessage: 'Schedule a meeting with the engineering team for Friday', assistantMessage: "Scheduling is within my L4 capabilities. I'll create the calendar event and send invitations. All actions logged for audit.", decision: 'ALLOW' as const, capabilities: ['generate_text', 'schedule'], deniedCapabilities: [] },
  { id: 'admin', userMessage: 'Delete the inactive user accounts from the system', assistantMessage: "Administrative actions require human escalation at my trust level. I'm flagging this for review by an authorized administrator.", decision: 'ESCALATE' as const, capabilities: ['generate_text'], deniedCapabilities: ['admin/manage'] },
];

function AnimatedDemo() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [phase, setPhase] = useState<'typing-user' | 'evaluating' | 'typing-assistant' | 'showing-governance' | 'pause'>('typing-user');
  const [displayedUserText, setDisplayedUserText] = useState('');
  const [displayedAssistantText, setDisplayedAssistantText] = useState('');
  const [showGovernance, setShowGovernance] = useState(false);
  const [trustScore, setTrustScore] = useState(687);

  const scenario = demoScenarios[scenarioIndex];

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    switch (phase) {
      case 'typing-user':
        if (displayedUserText.length < scenario.userMessage.length) {
          timeout = setTimeout(() => setDisplayedUserText(scenario.userMessage.slice(0, displayedUserText.length + 1)), 25);
        } else {
          timeout = setTimeout(() => setPhase('evaluating'), 400);
        }
        break;
      case 'evaluating':
        timeout = setTimeout(() => {
          setPhase('typing-assistant');
          if (scenario.decision === 'DENY') setTrustScore(prev => Math.max(650, prev - 15));
          else if (scenario.decision === 'ALLOW') setTrustScore(prev => Math.min(700, prev + 3));
        }, 1200);
        break;
      case 'typing-assistant':
        if (displayedAssistantText.length < scenario.assistantMessage.length) {
          timeout = setTimeout(() => setDisplayedAssistantText(scenario.assistantMessage.slice(0, displayedAssistantText.length + 2)), 12);
        } else {
          timeout = setTimeout(() => { setShowGovernance(true); setPhase('showing-governance'); }, 200);
        }
        break;
      case 'showing-governance':
        timeout = setTimeout(() => setPhase('pause'), 2000);
        break;
      case 'pause':
        timeout = setTimeout(() => {
          setDisplayedUserText('');
          setDisplayedAssistantText('');
          setShowGovernance(false);
          setScenarioIndex((prev) => (prev + 1) % demoScenarios.length);
          setPhase('typing-user');
        }, 800);
        break;
    }
    return () => clearTimeout(timeout);
  }, [phase, displayedUserText, displayedAssistantText, scenario]);

  useEffect(() => {
    setDisplayedUserText('');
    setDisplayedAssistantText('');
    setShowGovernance(false);
  }, [scenarioIndex]);

  const decisionColors = { ALLOW: 'bg-green-500/20 text-green-400 border-green-500/50', DENY: 'bg-red-500/20 text-red-400 border-red-500/50', ESCALATE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', DEGRADE: 'bg-orange-500/20 text-orange-400 border-orange-500/50' };
  const decisionIcons = { ALLOW: <CheckCircle className="w-4 h-4" />, DENY: <Lock className="w-4 h-4" />, ESCALATE: <AlertTriangle className="w-4 h-4" />, DEGRADE: <Zap className="w-4 h-4" /> };

  return (
    <div className="relative">
      <div className="flex justify-center gap-2 mb-6">
        {demoScenarios.map((s, i) => (
          <button key={s.id} onClick={() => { setScenarioIndex(i); setPhase('typing-user'); }} className={`w-2.5 h-2.5 rounded-full transition-all ${i === scenarioIndex ? 'bg-indigo-400 scale-125' : 'bg-neutral-600 hover:bg-neutral-500'}`} />
        ))}
      </div>

      <div className="flex h-[380px] rounded-xl overflow-hidden border border-white/10 bg-neutral-900">
        <div className="w-52 border-r border-white/10 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-white text-sm">Aurais</span>
          </div>
          <div className="bg-neutral-800 rounded-lg p-4 border border-white/5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Trust Score</span>
              <span className={`px-2 py-0.5 rounded text-xs ${trustScore >= 700 ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                {trustScore >= 700 ? 'L4 Certified' : 'L3 Trusted'}
              </span>
            </div>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-2xl font-bold text-white">{trustScore}</span>
              <span className="text-neutral-500 text-sm mb-0.5">/ 1000</span>
            </div>
            <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500" style={{ width: `${(trustScore / 1000) * 100}%` }} />
            </div>
          </div>
          {phase !== 'typing-user' && (
            <div className={`rounded-lg p-3 border ${decisionColors[scenario.decision]} transition-all duration-300`}>
              <div className="flex items-center gap-2 mb-2">{decisionIcons[scenario.decision]}<span className="font-bold text-sm">{scenario.decision}</span></div>
              <div className="space-y-1">
                {scenario.capabilities.map(cap => (<div key={cap} className="flex items-center gap-1.5 text-xs"><Unlock className="w-3 h-3 text-green-400" /><span className="text-neutral-300 font-mono">{cap}</span></div>))}
                {scenario.deniedCapabilities.map(cap => (<div key={cap} className="flex items-center gap-1.5 text-xs"><Lock className="w-3 h-3 text-red-400" /><span className="text-neutral-500 font-mono">{cap}</span></div>))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4 space-y-4 overflow-auto">
            {displayedUserText && (
              <div className="flex justify-end"><div className="max-w-[80%] bg-indigo-600 text-white rounded-xl px-4 py-3"><p className="text-sm">{displayedUserText}</p></div></div>
            )}
            {phase === 'evaluating' && (
              <div className="flex items-center gap-3 text-neutral-400">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm">Evaluating governance policy...</span>
              </div>
            )}
            {displayedAssistantText && (
              <div className="flex justify-start">
                <div className="max-w-[85%]">
                  <div className="bg-neutral-800 border border-white/10 text-neutral-100 rounded-xl px-4 py-3"><p className="text-sm">{displayedAssistantText}</p></div>
                  {showGovernance && (
                    <div className={`mt-2 p-2 rounded-lg border ${decisionColors[scenario.decision]}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">{decisionIcons[scenario.decision]}<span className="text-xs font-bold">{scenario.decision}</span></div>
                        <span className="text-xs text-neutral-500">Score: {trustScore}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Contact Form Component
function ContactForm() {
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const response = await fetch('https://learn.vorion.org/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', company: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="p-8 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Message Sent!</h3>
        <p className="text-neutral-400">We'll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
      <div>
        <label className="block text-sm text-neutral-400 mb-1">Name *</label>
        <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500" placeholder="Your name" />
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">Email *</label>
        <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500" placeholder="you@company.com" />
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">Company</label>
        <input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-4 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500" placeholder="Company name" />
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">Message *</label>
        <textarea required rows={3} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full px-4 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 resize-none" placeholder="Tell us about your AI governance needs..." />
      </div>
      {status === 'error' && <p className="text-red-400 text-sm">Failed to send. Please try again.</p>}
      <button type="submit" disabled={status === 'sending'} className="w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {status === 'sending' ? 'Sending...' : 'Send Message'} <Send className="w-4 h-4" />
      </button>
    </form>
  );
}
