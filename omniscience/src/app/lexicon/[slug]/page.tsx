'use client';

import { useParams, notFound } from 'next/navigation';
import { Navbar, TermDetail } from '@/components/nexus';
import { getTermBySlug } from '@/lib/lexicon-data';
import Link from 'next/link';

export default function LexiconTermPage() {
  const params = useParams();
  const slug = params.slug as string;

  const term = getTermBySlug(slug);

  if (!term) {
    notFound();
  }

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-24 pb-12 px-4 max-w-7xl mx-auto w-full">
        <TermDetail term={term} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Vorion Risk, LLC. Content licensed under CC BY 4.0.
          </p>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/lexicon" className="hover:text-cyan-400 transition-colors">
              Lexicon
            </Link>
            <Link href="/paths" className="hover:text-cyan-400 transition-colors">
              Paths
            </Link>
            <Link href="/docs" className="hover:text-cyan-400 transition-colors">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
