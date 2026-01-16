import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Cpu, Shield, Database, Link2, FileText, BookOpen, AlertTriangle, CheckCircle, GitBranch } from 'lucide-react';

interface BasisLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  breadcrumb?: string;
}

export function BasisLayout({ children, title, description, breadcrumb }: BasisLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      {/* Navigation */}
      <nav className="fixed w-full border-b border-white/5 bg-neutral-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/vorion.png" alt="VORION" width={32} height={32} className="rounded" />
            <span className="font-bold text-xl tracking-tighter text-white">VORION<span className="text-indigo-500">.ORG</span></span>
          </Link>
          <div className="flex gap-6 text-sm font-medium text-neutral-400">
            <Link href="/basis" className="text-white">BASIS</Link>
            <Link href="https://cognigate.dev" className="hover:text-white transition-colors">Cognigate</Link>
            <Link href="https://github.com/voriongit/vorion" className="hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </nav>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 fixed h-[calc(100vh-4rem)] overflow-y-auto border-r border-white/5 p-6">
          <Link href="/basis" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to BASIS
          </Link>

          <div className="space-y-6">
            <NavSection title="Architecture">
              <NavLink href="/basis/spec" icon={<FileText className="w-4 h-4" />}>Core Specification</NavLink>
              <NavLink href="/basis/intent" icon={<Cpu className="w-4 h-4" />}>INTENT Layer</NavLink>
              <NavLink href="/basis/enforce" icon={<Shield className="w-4 h-4" />}>ENFORCE Layer</NavLink>
              <NavLink href="/basis/proof" icon={<Database className="w-4 h-4" />}>PROOF Layer</NavLink>
              <NavLink href="/basis/chain" icon={<Link2 className="w-4 h-4" />}>CHAIN Layer</NavLink>
            </NavSection>

            <NavSection title="Reference">
              <NavLink href="/basis/trust" icon={<CheckCircle className="w-4 h-4" />}>Trust Model</NavLink>
              <NavLink href="/basis/capabilities" icon={<BookOpen className="w-4 h-4" />}>Capabilities</NavLink>
              <NavLink href="/basis/schemas" icon={<FileText className="w-4 h-4" />}>JSON Schemas</NavLink>
              <NavLink href="/basis/errors" icon={<AlertTriangle className="w-4 h-4" />}>Error Codes</NavLink>
            </NavSection>

            <NavSection title="Operations">
              <NavLink href="/basis/threat-model" icon={<Shield className="w-4 h-4" />}>Threat Model</NavLink>
              <NavLink href="/basis/failure-modes" icon={<AlertTriangle className="w-4 h-4" />}>Failure Modes</NavLink>
              <NavLink href="/basis/compliance" icon={<CheckCircle className="w-4 h-4" />}>Compliance</NavLink>
              <NavLink href="/basis/migration" icon={<GitBranch className="w-4 h-4" />}>Migration Guide</NavLink>
            </NavSection>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-6 lg:p-12 max-w-4xl">
          {breadcrumb && (
            <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
              <Link href="/basis" className="hover:text-white transition-colors">BASIS</Link>
              <span>/</span>
              <span className="text-neutral-300">{breadcrumb}</span>
            </div>
          )}

          <h1 className="text-4xl font-bold text-white mb-4">{title}</h1>
          {description && (
            <p className="text-lg text-neutral-400 mb-8">{description}</p>
          )}

          <article className="prose prose-invert prose-neutral max-w-none">
            {children}
          </article>
        </main>
      </div>

      {/* Footer */}
      <footer className="lg:ml-64 border-t border-white/5 py-8 px-6">
        <div className="max-w-4xl text-sm text-neutral-500">
          <p>BASIS v1.0.0 | CC BY 4.0 | © 2026 Vorion Risk, LLC</p>
        </div>
      </footer>
    </div>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">{title}</h3>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
      >
        {icon}
        {children}
      </Link>
    </li>
  );
}
