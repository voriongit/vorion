#!/usr/bin/env npx ts-node
/**
 * Tier Consistency Checker
 *
 * Validates that trust tier definitions are consistent across the codebase.
 * Run as part of CI to catch tier drift early.
 *
 * Usage: npx ts-node scripts/check-tier-consistency.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface TierDefinition {
  level: number;
  name: string;
  minScore: number;
  maxScore: number;
}

interface TierSource {
  file: string;
  tiers: TierDefinition[];
}

// Canonical tier definitions from @vorion/contracts
const CANONICAL_RUNTIME_TIERS: TierDefinition[] = [
  { level: 0, name: 'Sandbox', minScore: 0, maxScore: 99 },
  { level: 1, name: 'Provisional', minScore: 100, maxScore: 299 },
  { level: 2, name: 'Standard', minScore: 300, maxScore: 499 },
  { level: 3, name: 'Trusted', minScore: 500, maxScore: 699 },
  { level: 4, name: 'Certified', minScore: 700, maxScore: 899 },
  { level: 5, name: 'Autonomous', minScore: 900, maxScore: 1000 },
];

const CANONICAL_CERTIFICATION_TIERS: TierDefinition[] = [
  { level: 0, name: 'Unverified', minScore: 0, maxScore: 99 },
  { level: 1, name: 'Registered', minScore: 100, maxScore: 299 },
  { level: 2, name: 'Tested', minScore: 300, maxScore: 499 },
  { level: 3, name: 'Certified', minScore: 500, maxScore: 699 },
  { level: 4, name: 'Verified', minScore: 700, maxScore: 899 },
  { level: 5, name: 'Sovereign', minScore: 900, maxScore: 1000 },
];

// Files to check for tier definitions
const TIER_FILES = [
  'packages/atsf-core/src/trust-engine/index.ts',
  'packages/contracts/src/aci/tiers.ts',
  'docs/GLOSSARY.md',
  'docs/basis-docs/docs/spec/trust-scoring.md',
];

function extractTiersFromTrustEngine(content: string): TierDefinition[] {
  const thresholds: TierDefinition[] = [];

  // Match TRUST_THRESHOLDS definition
  const thresholdMatch = content.match(/TRUST_THRESHOLDS[^{]*{([^}]+)}/s);
  if (thresholdMatch) {
    const thresholdBlock = thresholdMatch[1];
    const tierMatches = thresholdBlock.matchAll(/(\d+):\s*{\s*min:\s*(\d+),\s*max:\s*(\d+)\s*}/g);

    for (const match of tierMatches) {
      thresholds.push({
        level: parseInt(match[1]),
        name: '', // Will be filled from names
        minScore: parseInt(match[2]),
        maxScore: parseInt(match[3]),
      });
    }
  }

  // Match TRUST_LEVEL_NAMES definition
  const namesMatch = content.match(/TRUST_LEVEL_NAMES[^{]*{([^}]+)}/s);
  if (namesMatch) {
    const namesBlock = namesMatch[1];
    const nameMatches = namesBlock.matchAll(/(\d+):\s*['"]([^'"]+)['"]/g);

    for (const match of nameMatches) {
      const level = parseInt(match[1]);
      const tier = thresholds.find((t) => t.level === level);
      if (tier) {
        tier.name = match[2];
      }
    }
  }

  return thresholds;
}

function extractTiersFromMarkdown(content: string): TierDefinition[] {
  const tiers: TierDefinition[] = [];

  // Match markdown table rows like: | L0 | Sandbox | 0-99 | ... |
  const tableMatches = content.matchAll(
    /\|\s*L?(\d+)\s*\|\s*([A-Za-z]+)\s*\|\s*(\d+)-(\d+)\s*\|/g
  );

  for (const match of tableMatches) {
    tiers.push({
      level: parseInt(match[1]),
      name: match[2],
      minScore: parseInt(match[3]),
      maxScore: parseInt(match[4]),
    });
  }

  return tiers;
}

function compareTiers(
  source: TierDefinition[],
  canonical: TierDefinition[],
  tierType: string
): string[] {
  const errors: string[] = [];

  for (const canonicalTier of canonical) {
    const sourceTier = source.find((t) => t.level === canonicalTier.level);

    if (!sourceTier) {
      errors.push(`Missing ${tierType} tier L${canonicalTier.level}`);
      continue;
    }

    if (sourceTier.name !== canonicalTier.name) {
      errors.push(
        `${tierType} L${canonicalTier.level} name mismatch: ` +
          `expected "${canonicalTier.name}", got "${sourceTier.name}"`
      );
    }

    if (sourceTier.minScore !== canonicalTier.minScore) {
      errors.push(
        `${tierType} L${canonicalTier.level} minScore mismatch: ` +
          `expected ${canonicalTier.minScore}, got ${sourceTier.minScore}`
      );
    }

    if (sourceTier.maxScore !== canonicalTier.maxScore) {
      errors.push(
        `${tierType} L${canonicalTier.level} maxScore mismatch: ` +
          `expected ${canonicalTier.maxScore}, got ${sourceTier.maxScore}`
      );
    }
  }

  return errors;
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  let hasErrors = false;
  const allErrors: { file: string; errors: string[] }[] = [];

  console.log('🔍 Checking tier consistency across codebase...\n');

  for (const filePath of TIER_FILES) {
    const fullPath = path.join(rootDir, filePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipping ${filePath} (not found)`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    let tiers: TierDefinition[] = [];

    if (filePath.endsWith('.ts')) {
      tiers = extractTiersFromTrustEngine(content);
    } else if (filePath.endsWith('.md')) {
      tiers = extractTiersFromMarkdown(content);
    }

    if (tiers.length === 0) {
      console.log(`⚠️  No tier definitions found in ${filePath}`);
      continue;
    }

    // Check against canonical RuntimeTiers (most files use this)
    const errors = compareTiers(tiers, CANONICAL_RUNTIME_TIERS, 'RuntimeTier');

    if (errors.length > 0) {
      hasErrors = true;
      allErrors.push({ file: filePath, errors });
      console.log(`❌ ${filePath}`);
      for (const error of errors) {
        console.log(`   - ${error}`);
      }
    } else {
      console.log(`✅ ${filePath}`);
    }
  }

  console.log('\n' + '='.repeat(60));

  if (hasErrors) {
    console.log('\n❌ Tier consistency check FAILED\n');
    console.log('The following files have tier definitions that differ from canonical:');
    for (const { file, errors } of allErrors) {
      console.log(`\n  ${file}:`);
      for (const error of errors) {
        console.log(`    - ${error}`);
      }
    }
    console.log('\nCanonical definitions are in: packages/contracts/src/aci/tiers.ts');
    console.log('Please update the inconsistent files to match.\n');
    process.exit(1);
  } else {
    console.log('\n✅ Tier consistency check PASSED\n');
    console.log('All tier definitions match canonical values.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error running tier consistency check:', err);
  process.exit(1);
});
