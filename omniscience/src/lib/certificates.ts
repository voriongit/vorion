import type { Certificate, CertificateLevel, EarnedCertificate, CertificateRequirement } from '@/types';
import { getAllPaths, getPathBySlug } from './learning-paths';

/**
 * Certificate definitions for each learning path
 * Users earn certificates by completing quizzes with passing scores
 */

// Generate a unique verification code
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  const segments = [];
  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(segment);
  }
  return segments.join('-');
}

// Certificate level thresholds
const LEVEL_THRESHOLDS: Record<CertificateLevel, { minScore: number; minModules: number }> = {
  foundation: { minScore: 70, minModules: 50 },
  practitioner: { minScore: 80, minModules: 75 },
  expert: { minScore: 90, minModules: 90 },
  master: { minScore: 95, minModules: 100 },
};

// Certificate level metadata
const LEVEL_META: Record<CertificateLevel, { title: string; description: string }> = {
  foundation: {
    title: 'Foundation',
    description: 'Demonstrated foundational understanding of core concepts',
  },
  practitioner: {
    title: 'Practitioner',
    description: 'Achieved practical proficiency with strong comprehension',
  },
  expert: {
    title: 'Expert',
    description: 'Mastered advanced concepts with excellent performance',
  },
  master: {
    title: 'Master',
    description: 'Achieved mastery with near-perfect understanding',
  },
};

/**
 * Get certificate definition for a learning path
 */
export function getCertificateForPath(pathSlug: string, level: CertificateLevel): Certificate | null {
  const path = getPathBySlug(pathSlug);
  if (!path) return null;

  const thresholds = LEVEL_THRESHOLDS[level];
  const meta = LEVEL_META[level];

  return {
    id: `cert-${pathSlug}-${level}`,
    pathSlug,
    pathTitle: path.title,
    level,
    title: `${path.title} - ${meta.title}`,
    description: meta.description,
    icon: path.icon,
    color: path.color,
    requirements: [
      {
        type: 'quiz_score',
        description: `Score ${thresholds.minScore}% or higher on the path quiz`,
        threshold: thresholds.minScore,
      },
      {
        type: 'modules_completed',
        description: `Complete ${thresholds.minModules}% of modules`,
        threshold: thresholds.minModules,
      },
    ],
  };
}

/**
 * Get all certificate levels for a path
 */
export function getAllCertificatesForPath(pathSlug: string): Certificate[] {
  const levels: CertificateLevel[] = ['foundation', 'practitioner', 'expert', 'master'];
  return levels
    .map(level => getCertificateForPath(pathSlug, level))
    .filter((cert): cert is Certificate => cert !== null);
}

/**
 * Check if user qualifies for a certificate
 */
export function checkCertificateEligibility(
  pathSlug: string,
  quizScore: number,
  modulesCompletedPercent: number,
  termsMasteredPercent: number
): { eligible: boolean; level: CertificateLevel | null; requirements: CertificateRequirement[] } {
  const levels: CertificateLevel[] = ['master', 'expert', 'practitioner', 'foundation'];

  for (const level of levels) {
    const thresholds = LEVEL_THRESHOLDS[level];
    const requirements: CertificateRequirement[] = [
      {
        type: 'quiz_score',
        description: `Score ${thresholds.minScore}% or higher`,
        threshold: thresholds.minScore,
        current: quizScore,
      },
      {
        type: 'modules_completed',
        description: `Complete ${thresholds.minModules}% of modules`,
        threshold: thresholds.minModules,
        current: modulesCompletedPercent,
      },
    ];

    const meetsAll = requirements.every(req => (req.current ?? 0) >= req.threshold);

    if (meetsAll) {
      return { eligible: true, level, requirements };
    }
  }

  // Return foundation requirements as progress target
  const foundationReqs: CertificateRequirement[] = [
    {
      type: 'quiz_score',
      description: 'Score 70% or higher',
      threshold: 70,
      current: quizScore,
    },
    {
      type: 'modules_completed',
      description: 'Complete 50% of modules',
      threshold: 50,
      current: modulesCompletedPercent,
    },
  ];

  return { eligible: false, level: null, requirements: foundationReqs };
}

/**
 * Create an earned certificate record
 */
export function createEarnedCertificate(
  pathSlug: string,
  level: CertificateLevel,
  quizScore: number,
  modulesCompleted: number,
  termsMastered: number
): EarnedCertificate {
  const cert = getCertificateForPath(pathSlug, level);
  if (!cert) {
    throw new Error(`Certificate not found for path: ${pathSlug}, level: ${level}`);
  }

  return {
    certificateId: cert.id,
    pathSlug,
    earnedAt: new Date(),
    quizScore,
    modulesCompleted,
    termsMastered,
    verificationCode: generateVerificationCode(),
  };
}

/**
 * Get certificate by ID
 */
export function getCertificateById(certificateId: string): Certificate | null {
  // Parse certificate ID: cert-{pathSlug}-{level}
  const match = certificateId.match(/^cert-(.+)-(foundation|practitioner|expert|master)$/);
  if (!match) return null;

  const [, pathSlug, level] = match;
  return getCertificateForPath(pathSlug, level as CertificateLevel);
}

/**
 * Format certificate level for display
 */
export function formatCertificateLevel(level: CertificateLevel): string {
  return LEVEL_META[level].title;
}

/**
 * Get level color class
 */
export function getCertificateLevelColor(level: CertificateLevel): string {
  const colors: Record<CertificateLevel, string> = {
    foundation: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    practitioner: 'text-green-400 bg-green-500/20 border-green-500/30',
    expert: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
    master: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  };
  return colors[level];
}

/**
 * Get all available certificates across all paths
 */
export function getAllAvailableCertificates(): Certificate[] {
  const paths = getAllPaths();
  return paths.flatMap(path => getAllCertificatesForPath(path.slug));
}

/**
 * Verify a certificate by verification code
 */
export function verifyCertificate(
  verificationCode: string,
  earnedCertificates: EarnedCertificate[]
): EarnedCertificate | null {
  return earnedCertificates.find(cert => cert.verificationCode === verificationCode) ?? null;
}
