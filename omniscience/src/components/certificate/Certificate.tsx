'use client';

import { useRef } from 'react';
import {
  Award,
  Shield,
  Star,
  Crown,
  Download,
  Share2,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Bot,
  Wrench,
  Users,
  Rocket,
  ClipboardCheck,
  Brain,
  Lock,
  FileCode,
} from 'lucide-react';
import type { Certificate as CertificateType, EarnedCertificate, CertificateLevel } from '@/types';
import { getCertificateLevelColor, formatCertificateLevel } from '@/lib/certificates';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  MessageSquare,
  Bot,
  Wrench,
  Users,
  Shield,
  Rocket,
  ClipboardCheck,
  Brain,
  Lock,
  FileCode,
  Award,
};

// Level icons
const levelIcons: Record<CertificateLevel, React.ComponentType<{ className?: string }>> = {
  foundation: Shield,
  practitioner: Award,
  expert: Star,
  master: Crown,
};

interface CertificateProps {
  certificate: CertificateType;
  earned?: EarnedCertificate;
  showActions?: boolean;
}

export function Certificate({ certificate, earned, showActions = true }: CertificateProps) {
  const certRef = useRef<HTMLDivElement>(null);

  const PathIcon = iconMap[certificate.icon] || Award;
  const LevelIcon = levelIcons[certificate.level];
  const levelColor = getCertificateLevelColor(certificate.level);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  const handleShare = async () => {
    if (!earned) return;

    const shareData = {
      title: `${certificate.title} Certificate`,
      text: `I earned the ${certificate.title} certificate from Omniscience Learning! Verification: ${earned.verificationCode}`,
      url: `${window.location.origin}/certificates/verify?code=${earned.verificationCode}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(
        `${shareData.text}\n${shareData.url}`
      );
      alert('Certificate link copied to clipboard!');
    }
  };

  return (
    <div
      ref={certRef}
      className={`relative overflow-hidden rounded-2xl border-2 ${
        earned
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-yellow-500/50'
          : 'bg-gray-800/50 border-gray-700/50'
      }`}
    >
      {/* Decorative background pattern */}
      {earned && (
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="cert-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cert-pattern)" />
          </svg>
        </div>
      )}

      {/* Certificate content */}
      <div className="relative p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${earned ? 'bg-yellow-500/20' : 'bg-gray-700/50'}`}>
              <PathIcon className={`w-6 h-6 ${earned ? 'text-yellow-400' : 'text-gray-400'}`} />
            </div>
            <span className={`text-xs px-3 py-1 rounded-full border font-medium ${levelColor}`}>
              {formatCertificateLevel(certificate.level)}
            </span>
          </div>
          {earned && (
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          )}
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className={`p-4 rounded-full ${earned ? 'bg-yellow-500/20' : 'bg-gray-700/30'}`}>
              <LevelIcon className={`w-12 h-12 ${earned ? 'text-yellow-400' : 'text-gray-500'}`} />
            </div>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${earned ? 'text-white' : 'text-gray-400'}`}>
            {certificate.title}
          </h2>
          <p className="text-gray-400 text-sm">{certificate.description}</p>
        </div>

        {/* Earned details */}
        {earned && (
          <div className="bg-black/30 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-cyan-400">{earned.quizScore}%</p>
                <p className="text-xs text-gray-500">Quiz Score</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{earned.modulesCompleted}</p>
                <p className="text-xs text-gray-500">Modules Completed</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700/50 text-center">
              <p className="text-xs text-gray-500 mb-1">Earned on</p>
              <p className="text-sm text-white">{formatDate(earned.earnedAt)}</p>
            </div>
          </div>
        )}

        {/* Requirements (if not earned) */}
        {!earned && (
          <div className="space-y-3 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Requirements</p>
            {certificate.requirements.map((req, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center">
                  {req.current !== undefined && req.current >= req.threshold ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-600" />
                  )}
                </div>
                <span className="text-gray-400">{req.description}</span>
                {req.current !== undefined && (
                  <span className={`ml-auto text-xs ${
                    req.current >= req.threshold ? 'text-green-400' : 'text-gray-500'
                  }`}>
                    {req.current}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Verification code */}
        {earned && (
          <div className="bg-black/20 rounded-lg p-3 text-center mb-6">
            <p className="text-xs text-gray-500 mb-1">Verification Code</p>
            <p className="font-mono text-lg text-cyan-400 tracking-wider">{earned.verificationCode}</p>
          </div>
        )}

        {/* Actions */}
        {showActions && earned && (
          <div className="flex gap-3">
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors text-sm"
              onClick={() => window.print()}
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        )}
      </div>

      {/* Corner ribbons for earned certificates */}
      {earned && (
        <>
          <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden">
            <div className="absolute top-3 right-[-35px] w-[170px] transform rotate-45 bg-yellow-500 text-center text-black text-xs font-bold py-1">
              CERTIFIED
            </div>
          </div>
        </>
      )}
    </div>
  );
}
