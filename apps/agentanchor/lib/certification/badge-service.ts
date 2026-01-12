/**
 * Badge Service
 * Story 18-4: Generate and manage certification badges
 *
 * Creates embeddable, verifiable badges that agents can display
 * to prove their A3I certification status.
 */

import { CertificationTier, CERTIFICATION_TIERS, TierDefinition } from './certification-tiers';
import { urls } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

export type BadgeFormat = 'svg' | 'png' | 'html' | 'json';
export type BadgeSize = 'small' | 'medium' | 'large' | 'full';
export type BadgeStyle = 'standard' | 'minimal' | 'detailed' | 'banner';

export interface CertificationBadge {
  id: string;
  certificateId: string;
  agentId: string;
  tier: CertificationTier;
  issuedAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'revoked' | 'suspended';

  // Display info
  agentName: string;
  agentCategory: string;
  trainerName?: string;

  // Verification
  verificationUrl: string;
  verificationCode: string;
  qrCodeData: string;

  // Rendering
  embedCode: string;
  directUrl: string;
}

export interface BadgeRenderOptions {
  format: BadgeFormat;
  size: BadgeSize;
  style: BadgeStyle;
  includeQr: boolean;
  includeVerificationUrl: boolean;
  darkMode: boolean;
  customColors?: {
    background?: string;
    text?: string;
    accent?: string;
  };
}

export interface BadgeVerification {
  valid: boolean;
  certificateId: string;
  agentId: string;
  agentName: string;
  tier: CertificationTier;
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  issuedAt: Date;
  expiresAt: Date;
  verifiedAt: Date;
  message: string;
}

export interface EmbedOptions {
  width: number;
  height: number;
  responsive: boolean;
  showVerifyButton: boolean;
  showExpiry: boolean;
}

// ============================================================================
// Badge Dimensions
// ============================================================================

const BADGE_DIMENSIONS: Record<BadgeSize, { width: number; height: number }> = {
  small: { width: 120, height: 40 },
  medium: { width: 200, height: 60 },
  large: { width: 300, height: 90 },
  full: { width: 400, height: 120 },
};

// ============================================================================
// Badge Generation
// ============================================================================

/**
 * Generate a certification badge
 */
export async function generateBadge(
  certificate: {
    id: string;
    agentId: string;
    tier: CertificationTier;
    issuedAt: Date;
    expiresAt: Date;
    status: 'active' | 'expired' | 'revoked' | 'suspended';
    agentName: string;
    agentCategory: string;
    trainerName?: string;
  }
): Promise<CertificationBadge> {
  const badgeId = `BADGE-${certificate.id}-${Date.now()}`;
  const verificationCode = generateVerificationCode(certificate.id);
  const verificationUrl = `${urls.verify}/${certificate.id}`;
  const qrCodeData = generateQrCodeData(verificationUrl);

  // Generate embed code
  const embedCode = generateEmbedCode(badgeId, certificate.tier, {
    width: 200,
    height: 60,
    responsive: true,
    showVerifyButton: true,
    showExpiry: true,
  });

  const directUrl = `${urls.badges}/${badgeId}`;

  return {
    id: badgeId,
    certificateId: certificate.id,
    agentId: certificate.agentId,
    tier: certificate.tier,
    issuedAt: certificate.issuedAt,
    expiresAt: certificate.expiresAt,
    status: certificate.status,
    agentName: certificate.agentName,
    agentCategory: certificate.agentCategory,
    trainerName: certificate.trainerName,
    verificationUrl,
    verificationCode,
    qrCodeData,
    embedCode,
    directUrl,
  };
}

/**
 * Generate verification code for a certificate
 */
function generateVerificationCode(certificateId: string): string {
  // Generate a short, human-readable verification code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const hash = certificateId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);

  let code = '';
  let value = Math.abs(hash);
  for (let i = 0; i < 8; i++) {
    code += chars[value % chars.length];
    value = Math.floor(value / chars.length) + (i + 1) * 7;
  }

  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

/**
 * Generate QR code data URL placeholder
 */
function generateQrCodeData(url: string): string {
  // In production, this would generate an actual QR code
  // For now, return a data structure that can be used by a QR library
  return JSON.stringify({
    type: 'qr',
    data: url,
    errorCorrection: 'M',
    size: 200,
  });
}

/**
 * Generate HTML embed code for badge
 */
function generateEmbedCode(
  badgeId: string,
  tier: CertificationTier,
  options: EmbedOptions
): string {
  const tierDef = CERTIFICATION_TIERS[tier];
  const width = options.responsive ? '100%' : `${options.width}px`;
  const maxWidth = `${options.width}px`;

  return `<!-- A3I Certification Badge -->
<div class="a3i-badge" style="width:${width};max-width:${maxWidth};">
  <a href="${urls.badges}/${badgeId}" target="_blank" rel="noopener">
    <img src="${urls.apiBadges}/${badgeId}/image"
         alt="A3I ${tierDef.displayName} Certified"
         style="width:100%;height:auto;" />
  </a>
</div>
<script src="${urls.badges}/verify.js" async></script>`;
}

// ============================================================================
// Badge Rendering
// ============================================================================

/**
 * Render badge to SVG
 */
export function renderBadgeToSvg(
  badge: CertificationBadge,
  options: BadgeRenderOptions
): string {
  const tierDef = CERTIFICATION_TIERS[badge.tier];
  const dims = BADGE_DIMENSIONS[options.size];
  const colors = getBadgeColors(tierDef, options);

  if (options.style === 'minimal') {
    return renderMinimalBadge(badge, tierDef, dims, colors);
  } else if (options.style === 'detailed') {
    return renderDetailedBadge(badge, tierDef, dims, colors, options);
  } else if (options.style === 'banner') {
    return renderBannerBadge(badge, tierDef, dims, colors);
  }

  return renderStandardBadge(badge, tierDef, dims, colors, options);
}

function getBadgeColors(
  tierDef: TierDefinition,
  options: BadgeRenderOptions
): { bg: string; text: string; accent: string; border: string } {
  if (options.darkMode) {
    return {
      bg: options.customColors?.background || '#1a1a1a',
      text: options.customColors?.text || '#ffffff',
      accent: options.customColors?.accent || tierDef.badge.color,
      border: tierDef.badge.borderColor,
    };
  }

  return {
    bg: options.customColors?.background || '#ffffff',
    text: options.customColors?.text || '#333333',
    accent: options.customColors?.accent || tierDef.badge.color,
    border: tierDef.badge.borderColor,
  };
}

function renderStandardBadge(
  badge: CertificationBadge,
  tierDef: TierDefinition,
  dims: { width: number; height: number },
  colors: { bg: string; text: string; accent: string; border: string },
  options: BadgeRenderOptions
): string {
  const iconPath = getIconPath(tierDef.badge.icon);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${dims.width} ${dims.height}">
  <defs>
    <linearGradient id="tierGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.accent};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.border};stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${dims.width}" height="${dims.height}" rx="8" fill="${colors.bg}" stroke="${colors.border}" stroke-width="2"/>

  <!-- Tier accent bar -->
  <rect width="8" height="${dims.height}" rx="8 0 0 8" fill="url(#tierGradient)"/>

  <!-- Icon -->
  <g transform="translate(20, ${dims.height / 2 - 12})">
    ${iconPath}
  </g>

  <!-- Text -->
  <text x="52" y="${dims.height / 2 - 6}" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="${colors.text}">
    A3I ${tierDef.displayName}
  </text>
  <text x="52" y="${dims.height / 2 + 10}" font-family="system-ui, sans-serif" font-size="11" fill="${colors.text}" opacity="0.8">
    Certified
  </text>

  ${options.includeVerificationUrl ? `
  <text x="${dims.width - 10}" y="${dims.height - 8}" font-family="system-ui, sans-serif" font-size="8" fill="${colors.text}" opacity="0.5" text-anchor="end">
    ${badge.verificationCode}
  </text>
  ` : ''}
</svg>`;
}

function renderMinimalBadge(
  _badge: CertificationBadge,
  tierDef: TierDefinition,
  dims: { width: number; height: number },
  colors: { bg: string; text: string; accent: string; border: string }
): string {
  // Minimal badge - just icon and tier name
  const smallDims = { width: Math.round(dims.width * 0.6), height: Math.round(dims.height * 0.7) };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${smallDims.width}" height="${smallDims.height}" viewBox="0 0 ${smallDims.width} ${smallDims.height}">
  <rect width="${smallDims.width}" height="${smallDims.height}" rx="4" fill="${colors.accent}"/>
  <text x="${smallDims.width / 2}" y="${smallDims.height / 2 + 4}" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle">
    A3I ${tierDef.displayName}
  </text>
</svg>`;
}

function renderDetailedBadge(
  badge: CertificationBadge,
  tierDef: TierDefinition,
  dims: { width: number; height: number },
  colors: { bg: string; text: string; accent: string; border: string },
  options: BadgeRenderOptions
): string {
  // Detailed badge with agent info and expiry
  const largeDims = { width: dims.width * 1.5, height: dims.height * 1.5 };
  const iconPath = getIconPath(tierDef.badge.icon);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largeDims.width}" height="${largeDims.height}" viewBox="0 0 ${largeDims.width} ${largeDims.height}">
  <defs>
    <linearGradient id="tierGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.accent};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.border};stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${largeDims.width}" height="${largeDims.height}" rx="12" fill="${colors.bg}" stroke="${colors.border}" stroke-width="2"/>

  <!-- Header bar -->
  <rect width="${largeDims.width}" height="40" rx="12 12 0 0" fill="url(#tierGradient)"/>
  <text x="20" y="26" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="white">
    A3I ${tierDef.displayName} Certified
  </text>

  <!-- Icon -->
  <g transform="translate(20, 55)">
    ${iconPath}
  </g>

  <!-- Agent info -->
  <text x="60" y="65" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="${colors.text}">
    ${badge.agentName}
  </text>
  <text x="60" y="82" font-family="system-ui, sans-serif" font-size="11" fill="${colors.text}" opacity="0.7">
    ${badge.agentCategory}
  </text>

  <!-- Validity -->
  <text x="20" y="${largeDims.height - 35}" font-family="system-ui, sans-serif" font-size="10" fill="${colors.text}" opacity="0.6">
    Valid until: ${badge.expiresAt.toLocaleDateString()}
  </text>

  <!-- Verification code -->
  <text x="20" y="${largeDims.height - 15}" font-family="system-ui, sans-serif" font-size="10" fill="${colors.text}" opacity="0.5">
    Verify: ${badge.verificationCode}
  </text>

  ${options.includeQr ? `
  <!-- QR placeholder -->
  <rect x="${largeDims.width - 70}" y="${largeDims.height - 70}" width="60" height="60" fill="#f0f0f0" rx="4"/>
  <text x="${largeDims.width - 40}" y="${largeDims.height - 35}" font-family="system-ui, sans-serif" font-size="8" fill="#666" text-anchor="middle">
    QR
  </text>
  ` : ''}
</svg>`;
}

function renderBannerBadge(
  badge: CertificationBadge,
  tierDef: TierDefinition,
  _dims: { width: number; height: number },
  colors: { bg: string; text: string; accent: string; border: string }
): string {
  // Wide banner format
  const bannerDims = { width: 468, height: 60 };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bannerDims.width}" height="${bannerDims.height}" viewBox="0 0 ${bannerDims.width} ${bannerDims.height}">
  <defs>
    <linearGradient id="bannerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${colors.accent};stop-opacity:1" />
      <stop offset="50%" style="stop-color:${colors.border};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.accent};stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${bannerDims.width}" height="${bannerDims.height}" rx="8" fill="${colors.bg}" stroke="${colors.border}" stroke-width="2"/>

  <!-- Decorative elements -->
  <rect x="0" y="0" width="6" height="${bannerDims.height}" fill="url(#bannerGradient)"/>
  <rect x="${bannerDims.width - 6}" y="0" width="6" height="${bannerDims.height}" fill="url(#bannerGradient)"/>

  <!-- Main content -->
  <text x="20" y="25" font-family="system-ui, sans-serif" font-size="11" fill="${colors.text}" opacity="0.7">
    ${badge.agentName} is
  </text>
  <text x="20" y="45" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="${colors.accent}">
    A3I ${tierDef.displayName} Certified
  </text>

  <!-- Verification -->
  <text x="${bannerDims.width - 20}" y="30" font-family="system-ui, sans-serif" font-size="10" fill="${colors.text}" opacity="0.5" text-anchor="end">
    Verify: ${badge.verificationCode}
  </text>
  <text x="${bannerDims.width - 20}" y="45" font-family="system-ui, sans-serif" font-size="9" fill="${colors.text}" opacity="0.4" text-anchor="end">
    ${new URL(urls.verify).host}${new URL(urls.verify).pathname}
  </text>
</svg>`;
}

function getIconPath(icon: string): string {
  const icons: Record<string, string> = {
    'shield-check': `<path d="M12 2l9 4v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V6l9-4zm-2 14l7-7-1.41-1.41L10 13.17l-2.59-2.58L6 12l4 4z" fill="currentColor"/>`,
    'shield-star': `<path d="M12 2l9 4v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V6l9-4zm0 4l-1.5 3H7l2.5 2-1 3.5 3.5-2 3.5 2-1-3.5 2.5-2h-3.5L12 6z" fill="currentColor"/>`,
    'award': `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="currentColor"/>`,
    'crown': `<path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z" fill="currentColor"/>`,
  };

  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="${CERTIFICATION_TIERS.gold.badge.color}">
    ${icons[icon] || icons['shield-check']}
  </svg>`;
}

// ============================================================================
// Badge Verification
// ============================================================================

/**
 * Verify a badge is valid
 */
export async function verifyBadge(
  badgeIdOrCode: string
): Promise<BadgeVerification> {
  // In production, this would query the database
  // For now, return a mock verification

  const now = new Date();

  // Simulate verification logic
  const isValidFormat =
    badgeIdOrCode.startsWith('BADGE-') ||
    /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(badgeIdOrCode);

  if (!isValidFormat) {
    return {
      valid: false,
      certificateId: '',
      agentId: '',
      agentName: '',
      tier: 'bronze',
      status: 'revoked',
      issuedAt: now,
      expiresAt: now,
      verifiedAt: now,
      message: 'Invalid badge ID or verification code format',
    };
  }

  // Mock successful verification
  return {
    valid: true,
    certificateId: 'CERT-DEMO-001',
    agentId: 'agent-demo-001',
    agentName: 'Demo Agent',
    tier: 'gold',
    status: 'active',
    issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    verifiedAt: now,
    message: 'Badge verified successfully. This agent holds valid A3I Gold certification.',
  };
}

/**
 * Check if a badge is expired
 */
export function isBadgeExpired(badge: CertificationBadge): boolean {
  return new Date() > badge.expiresAt;
}

/**
 * Check if a badge is valid (not expired, revoked, or suspended)
 */
export function isBadgeValid(badge: CertificationBadge): boolean {
  if (badge.status !== 'active') return false;
  if (isBadgeExpired(badge)) return false;
  return true;
}

// ============================================================================
// Badge Management
// ============================================================================

/**
 * Revoke a badge
 */
export async function revokeBadge(
  badgeId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  // In production, this would update the database
  console.log(`Revoking badge ${badgeId}: ${reason}`);

  return {
    success: true,
    message: `Badge ${badgeId} has been revoked. Reason: ${reason}`,
  };
}

/**
 * Suspend a badge temporarily
 */
export async function suspendBadge(
  badgeId: string,
  reason: string,
  until: Date
): Promise<{ success: boolean; message: string }> {
  console.log(`Suspending badge ${badgeId} until ${until.toISOString()}: ${reason}`);

  return {
    success: true,
    message: `Badge ${badgeId} has been suspended until ${until.toLocaleDateString()}. Reason: ${reason}`,
  };
}

/**
 * Reactivate a suspended badge
 */
export async function reactivateBadge(
  badgeId: string
): Promise<{ success: boolean; message: string }> {
  console.log(`Reactivating badge ${badgeId}`);

  return {
    success: true,
    message: `Badge ${badgeId} has been reactivated.`,
  };
}

/**
 * Renew an expiring badge
 */
export async function renewBadge(
  badge: CertificationBadge,
  newExpiryDate: Date
): Promise<CertificationBadge> {
  return {
    ...badge,
    expiresAt: newExpiryDate,
    status: 'active',
  };
}

// ============================================================================
// Widget Generation
// ============================================================================

/**
 * Generate a JavaScript widget for dynamic badge display
 */
export function generateBadgeWidget(badgeId: string): string {
  return `
(function() {
  var badge = document.createElement('div');
  badge.id = 'a3i-badge-${badgeId}';
  badge.innerHTML = '<a href="${urls.badges}/${badgeId}" target="_blank">Loading A3I Badge...</a>';

  var script = document.currentScript;
  script.parentNode.insertBefore(badge, script);

  fetch('${urls.apiBadges}/${badgeId}')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.valid) {
        badge.innerHTML = data.svg;
      } else {
        badge.innerHTML = '<span style="color:red">Badge Invalid</span>';
      }
    })
    .catch(function() {
      badge.innerHTML = '<span style="color:orange">Unable to verify badge</span>';
    });
})();
  `.trim();
}

/**
 * Generate an iframe embed for badge
 */
export function generateBadgeIframe(
  badgeId: string,
  size: BadgeSize = 'medium'
): string {
  const dims = BADGE_DIMENSIONS[size];

  return `<iframe
  src="${urls.badges}/${badgeId}/embed"
  width="${dims.width}"
  height="${dims.height}"
  frameborder="0"
  scrolling="no"
  title="A3I Certification Badge"
></iframe>`;
}

/**
 * Generate markdown badge syntax
 */
export function generateMarkdownBadge(badge: CertificationBadge): string {
  const tierDef = CERTIFICATION_TIERS[badge.tier];

  return `[![A3I ${tierDef.displayName} Certified](${urls.apiBadges}/${badge.id}/image)](${urls.badges}/${badge.id})`;
}
