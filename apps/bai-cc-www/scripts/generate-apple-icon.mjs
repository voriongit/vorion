import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const size = 180;

const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="40" fill="url(#bg)"/>

  <!-- V shape -->
  <g transform="translate(${size/2 - 45}, ${size/2 - 35})">
    <path d="M0 0 L45 70 L90 0" stroke="url(#vGrad)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="45" cy="85" r="8" fill="#10b981"/>
  </g>
</svg>
`;

async function generateAppleIcon() {
  const outputPath = join(__dirname, '..', 'public', 'apple-touch-icon.png');

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Apple touch icon generated: ${outputPath}`);
}

generateAppleIcon().catch(console.error);
