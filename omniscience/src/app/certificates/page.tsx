'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/nexus';
import { Certificate } from '@/components/certificate';
import {
  Award,
  ArrowRight,
  Trophy,
  BookOpen,
  Shield,
  Star,
  Crown,
  Sparkles,
} from 'lucide-react';
import { useProgressContext } from '@/contexts';
import { getAllPaths } from '@/lib/learning-paths';
import { getAllCertificatesForPath, getCertificateById } from '@/lib/certificates';
import type { CertificateLevel } from '@/types';

const levelIcons: Record<CertificateLevel, React.ComponentType<{ className?: string }>> = {
  foundation: Shield,
  practitioner: Award,
  expert: Star,
  master: Crown,
};

export default function CertificatesPage() {
  const { certificates, isLoaded, getCertProgress } = useProgressContext();
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);

  const paths = getAllPaths();

  // Get certificate progress for all paths
  const pathsWithProgress = paths.map(path => {
    const progress = getCertProgress(path.slug, path.modules.length);
    const earnedCert = certificates.find(c => c.pathSlug === path.slug);
    const availableCerts = getAllCertificatesForPath(path.slug);

    return {
      path,
      progress,
      earnedCert,
      availableCerts,
    };
  });

  // Separate earned and available
  const earnedCertificates = pathsWithProgress.filter(p => p.earnedCert);
  const availablePaths = pathsWithProgress.filter(p => !p.earnedCert);

  const selectedCert = selectedCertId ? getCertificateById(selectedCertId) : null;
  const selectedEarned = selectedCertId
    ? certificates.find(c => c.certificateId === selectedCertId)
    : null;

  if (!isLoaded) {
    return (
      <>
        <Navbar />
        <main className="flex-grow pt-24 pb-12 px-4 max-w-6xl mx-auto w-full">
          <div className="text-center text-gray-400">Loading...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="flex-grow pt-24 pb-12 px-4 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/20 mb-6">
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Certificates
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Earn certificates by completing learning paths and passing quizzes.
            Each certificate validates your knowledge and can be shared with others.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">{certificates.length}</p>
            <p className="text-sm text-gray-400">Earned</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-cyan-400">{paths.length}</p>
            <p className="text-sm text-gray-400">Available Paths</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-400">
              {earnedCertificates.filter(p =>
                p.earnedCert && ['expert', 'master'].includes(
                  getCertificateById(p.earnedCert.certificateId)?.level || ''
                )
              ).length}
            </p>
            <p className="text-sm text-gray-400">Expert+</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-400">
              {earnedCertificates.filter(p =>
                p.earnedCert && getCertificateById(p.earnedCert.certificateId)?.level === 'master'
              ).length}
            </p>
            <p className="text-sm text-gray-400">Master</p>
          </div>
        </div>

        {/* Certificate Levels Explanation */}
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 mb-12">
          <h2 className="text-lg font-bold text-white mb-4">Certificate Levels</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['foundation', 'practitioner', 'expert', 'master'] as CertificateLevel[]).map(level => {
              const Icon = levelIcons[level];
              const requirements = {
                foundation: { score: 70, modules: 50 },
                practitioner: { score: 80, modules: 75 },
                expert: { score: 90, modules: 90 },
                master: { score: 95, modules: 100 },
              }[level];

              return (
                <div key={level} className="text-center">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                    level === 'foundation' ? 'bg-blue-500/20' :
                    level === 'practitioner' ? 'bg-green-500/20' :
                    level === 'expert' ? 'bg-purple-500/20' :
                    'bg-yellow-500/20'
                  }`}>
                    <Icon className={`w-6 h-6 ${
                      level === 'foundation' ? 'text-blue-400' :
                      level === 'practitioner' ? 'text-green-400' :
                      level === 'expert' ? 'text-purple-400' :
                      'text-yellow-400'
                    }`} />
                  </div>
                  <p className="text-sm font-medium text-white capitalize">{level}</p>
                  <p className="text-xs text-gray-500">
                    {requirements.score}% score, {requirements.modules}% modules
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Earned Certificates */}
        {earnedCertificates.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Your Certificates ({earnedCertificates.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {earnedCertificates.map(({ path, earnedCert }) => {
                if (!earnedCert) return null;
                const cert = getCertificateById(earnedCert.certificateId);
                if (!cert) return null;

                return (
                  <div
                    key={earnedCert.certificateId}
                    onClick={() => setSelectedCertId(earnedCert.certificateId)}
                    className="cursor-pointer transform hover:scale-[1.02] transition-transform"
                  >
                    <Certificate certificate={cert} earned={earnedCert} showActions={false} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Available Paths */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Earn More Certificates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availablePaths.map(({ path, progress }) => (
              <Link
                key={path.slug}
                href={`/paths/${path.slug}`}
                className="bg-gray-800/30 border border-gray-700/50 hover:border-gray-600 rounded-xl p-6 transition-colors group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-gray-700/50">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-cyan-400 transition-colors" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2 group-hover:text-cyan-300 transition-colors">
                  {path.title}
                </h3>
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                  {path.description}
                </p>
                {progress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Progress</span>
                      <span className="text-gray-400">{progress.modulesCompletedPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 transition-all"
                        style={{ width: `${progress.modulesCompletedPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* Selected Certificate Modal */}
        {selectedCert && selectedEarned && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCertId(null)}
          >
            <div
              className="max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <Certificate certificate={selectedCert} earned={selectedEarned} />
              <button
                onClick={() => setSelectedCertId(null)}
                className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
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
