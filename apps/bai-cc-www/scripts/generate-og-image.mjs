import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const width = 1200;
const height = 630;

// Create SVG with the design
const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Grid pattern -->
  <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#334155" stroke-width="0.5" opacity="0.3"/>
  </pattern>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>

  <!-- Gradient orb top right -->
  <circle cx="1000" cy="100" r="300" fill="#6366f1" opacity="0.1"/>
  <circle cx="200" cy="500" r="250" fill="#06b6d4" opacity="0.08"/>

  <!-- Logo V shape -->
  <g transform="translate(80, 240)">
    <path d="M0 0 L40 80 L80 0" stroke="url(#vGrad)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="40" cy="95" r="5" fill="#10b981"/>
  </g>

  <!-- Title -->
  <text x="180" y="270" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="700" fill="#ffffff">BAI Command Center</text>

  <!-- Subtitle with gradient effect -->
  <text x="180" y="330" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="600" fill="url(#accent)">Building the Future of AI Governance</text>

  <!-- Description -->
  <text x="180" y="390" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#94a3b8">Enterprise trust, compliance, and oversight for autonomous AI systems</text>

  <!-- Trust level badges -->
  <g transform="translate(180, 440)">
    <rect x="0" y="0" width="80" height="36" rx="8" fill="#334155"/>
    <text x="40" y="24" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#94a3b8" text-anchor="middle">L0</text>

    <rect x="90" y="0" width="80" height="36" rx="8" fill="#334155"/>
    <text x="130" y="24" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#94a3b8" text-anchor="middle">L1</text>

    <rect x="180" y="0" width="80" height="36" rx="8" fill="#6366f1"/>
    <text x="220" y="24" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">L2</text>

    <rect x="270" y="0" width="80" height="36" rx="8" fill="#6366f1"/>
    <text x="310" y="24" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">L3</text>

    <rect x="360" y="0" width="80" height="36" rx="8" fill="#10b981"/>
    <text x="400" y="24" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">L4</text>

    <rect x="450" y="0" width="80" height="36" rx="8" fill="#10b981"/>
    <text x="490" y="24" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#ffffff" text-anchor="middle">L5</text>
  </g>

  <!-- 6-Tier Trust label -->
  <text x="180" y="520" font-family="system-ui, sans-serif" font-size="14" fill="#64748b">6-Tier Trust Architecture  •  BASIS Standard  •  Open Source</text>

  <!-- Bottom bar -->
  <rect x="0" y="590" width="${width}" height="40" fill="#1e293b"/>
  <text x="80" y="617" font-family="system-ui, sans-serif" font-size="16" fill="#64748b">bai-cc.com</text>

  <!-- Status indicator -->
  <circle cx="1050" cy="610" r="6" fill="#10b981"/>
  <text x="1070" y="617" font-family="system-ui, sans-serif" font-size="14" fill="#10b981">4 Platforms Live</text>
</svg>
`;

async function generateOgImage() {
  const outputPath = join(__dirname, '..', 'public', 'og-image.png');

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`OG image generated: ${outputPath}`);
}

generateOgImage().catch(console.error);
