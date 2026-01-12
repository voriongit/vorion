#!/usr/bin/env node
/**
 * Generate Birth Certificates for All Agents
 *
 * Creates immutable, content-addressed identities for all agents
 * that don't yet have birth certificates.
 *
 * Usage:
 *   node generate-birth-certificates.js              # Live generation
 *   node generate-birth-certificates.js --dry-run    # Preview only
 *   node generate-birth-certificates.js --batch=100  # Custom batch size
 */
require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const { Client } = require('pg');
const jose = require('jose');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] || '100');

// ============================================================================
// Cryptographic Functions (mirrors lib/credentials/birth-certificate.ts)
// ============================================================================

/**
 * Generate deterministic fingerprint from birth data
 */
function generateFingerprint(data) {
  const content = [
    data.name,
    data.creatorId,
    data.bornAt.toISOString(),
    data.initialConfigHash,
    data.level || '',
    data.type || ''
  ].join('|');

  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate canonical ID from fingerprint
 */
function generateCanonicalId(fingerprint) {
  return `aa:${fingerprint.slice(0, 16)}`;
}

/**
 * Hash agent configuration
 */
function hashAgentConfig(config) {
  const normalized = JSON.stringify(config, Object.keys(config).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Truth chain state
let truthChainState = {
  sequence: 0,
  lastHash: null
};

/**
 * Get next truth chain entry
 */
function getNextTruthChainEntry(fingerprint) {
  const sequence = truthChainState.sequence + 1;
  const prevHash = truthChainState.lastHash;

  const chainContent = [
    prevHash || 'genesis',
    sequence.toString(),
    fingerprint
  ].join('|');

  const hash = crypto.createHash('sha256').update(chainContent).digest('hex');

  // Update state
  truthChainState.sequence = sequence;
  truthChainState.lastHash = hash;

  return { sequence, prevHash, hash };
}

// ============================================================================
// JWT Signing
// ============================================================================

let keyPair = null;

async function getKeyPair() {
  if (!keyPair) {
    // In production, use env vars. For dev/scripts, generate ephemeral keys
    if (process.env.CREDENTIAL_SIGNING_PRIVATE_KEY) {
      const privateKey = await jose.importPKCS8(
        process.env.CREDENTIAL_SIGNING_PRIVATE_KEY,
        'ES256'
      );
      const publicKey = await jose.importSPKI(
        process.env.CREDENTIAL_SIGNING_PUBLIC_KEY,
        'ES256'
      );
      keyPair = { privateKey, publicKey };
    } else {
      console.log('  ⚠️  No signing keys configured, generating ephemeral keys...');
      keyPair = await jose.generateKeyPair('ES256');
    }
  }
  return keyPair;
}

function getCurrentKeyId() {
  const year = new Date().getFullYear();
  return `aa_key_${year}_001`;
}

/**
 * Sign a birth certificate
 */
async function signBirthCertificate(payload) {
  const { privateKey } = await getKeyPair();
  const keyId = getCurrentKeyId();

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'BC',
      kid: keyId
    })
    .sign(privateKey);

  return jwt;
}

// ============================================================================
// Birth Certificate Generation
// ============================================================================

/**
 * Generate birth certificate for an agent
 */
async function generateBirthCertificate(agent) {
  // Parse metadata
  const metadata = typeof agent.metadata === 'string'
    ? JSON.parse(agent.metadata)
    : agent.metadata || {};

  // Build config for hashing
  const config = {
    name: agent.name,
    type: metadata.type || 'general',
    level: metadata.level || 'L1',
    system_prompt: agent.system_prompt,
    metadata: metadata
  };

  // Generate fingerprint
  const fingerprint = generateFingerprint({
    name: agent.name,
    creatorId: agent.owner_id,
    bornAt: new Date(agent.created_at),
    initialConfigHash: hashAgentConfig(config),
    level: metadata.level,
    type: metadata.type
  });

  const canonicalId = generateCanonicalId(fingerprint);

  // Get truth chain entry
  const truthChain = getNextTruthChainEntry(fingerprint);

  // Build payload
  const certificateId = `bc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const bornAt = new Date(agent.created_at);

  const payload = {
    iss: 'https://agentanchorai.com',
    sub: canonicalId,
    iat: Math.floor(bornAt.getTime() / 1000),
    jti: certificateId,

    birth: {
      name: agent.name,
      creator_id: agent.owner_id,
      born_at: bornAt.toISOString(),
      initial_config_hash: hashAgentConfig(config),
      level: metadata.level,
      type: metadata.type
    },

    fingerprint,

    truth_chain: {
      sequence: truthChain.sequence,
      prev_hash: truthChain.prevHash,
      hash: truthChain.hash
    }
  };

  // Sign the certificate
  const jwt = await signBirthCertificate(payload);

  return {
    canonicalId,
    fingerprint,
    jwt,
    payload,
    truthChainSequence: truthChain.sequence,
    truthChainHash: truthChain.hash,
    truthChainPrevHash: truthChain.prevHash
  };
}

// ============================================================================
// Main
// ============================================================================

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('═'.repeat(70));
  console.log('Birth Certificate Generator - Immutable Agent Identity System');
  console.log('═'.repeat(70));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🚀 LIVE'}`);
  console.log(`Batch Size: ${BATCH_SIZE}\n`);

  // Step 1: Find agents without birth certificates
  console.log('Step 1: Finding agents without birth certificates...\n');

  const needsCerts = await client.query(`
    SELECT id, name, owner_id, created_at, system_prompt, metadata
    FROM agents
    WHERE canonical_id IS NULL OR birth_certificate IS NULL
    ORDER BY created_at ASC
  `);

  console.log(`  Found ${needsCerts.rows.length} agents needing birth certificates\n`);

  if (needsCerts.rows.length === 0) {
    console.log('  ✅ All agents have birth certificates!\n');
    await client.end();
    return;
  }

  // Step 2: Initialize truth chain from last sequence
  console.log('Step 2: Initializing truth chain...\n');

  const lastCert = await client.query(`
    SELECT truth_chain_sequence, truth_chain_hash
    FROM agent_birth_registry
    ORDER BY truth_chain_sequence DESC
    LIMIT 1
  `);

  if (lastCert.rows.length > 0) {
    truthChainState.sequence = lastCert.rows[0].truth_chain_sequence;
    truthChainState.lastHash = lastCert.rows[0].truth_chain_hash;
    console.log(`  Resuming from sequence ${truthChainState.sequence}\n`);
  } else {
    console.log('  Starting fresh truth chain (genesis)\n');
  }

  // Step 3: Generate certificates in batches
  console.log('Step 3: Generating birth certificates...\n');

  let generated = 0;
  let errors = 0;
  const agents = needsCerts.rows;

  for (let i = 0; i < agents.length; i += BATCH_SIZE) {
    const batch = agents.slice(i, i + BATCH_SIZE);

    for (const agent of batch) {
      try {
        const cert = await generateBirthCertificate(agent);

        if (!DRY_RUN) {
          // Update agent record
          await client.query(`
            UPDATE agents SET
              canonical_id = $1,
              fingerprint = $2,
              birth_certificate = $3,
              updated_at = NOW()
            WHERE id = $4
          `, [
            cert.canonicalId,
            cert.fingerprint,
            JSON.stringify({
              jwt: cert.jwt,
              issued_at: new Date().toISOString(),
              truth_chain_sequence: cert.truthChainSequence,
              truth_chain_hash: cert.truthChainHash
            }),
            agent.id
          ]);

          // Insert into birth registry (if table exists)
          try {
            await client.query(`
              INSERT INTO agent_birth_registry (
                canonical_id, fingerprint, agent_id, agent_name, creator_id,
                born_at, initial_config_hash, birth_jwt,
                truth_chain_sequence, truth_chain_prev_hash, truth_chain_hash
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (canonical_id) DO NOTHING
            `, [
              cert.canonicalId,
              cert.fingerprint,
              agent.id,
              agent.name,
              agent.owner_id,
              agent.created_at,
              cert.payload.birth.initial_config_hash,
              cert.jwt,
              cert.truthChainSequence,
              cert.truthChainPrevHash,
              cert.truthChainHash
            ]);
          } catch (regErr) {
            // Registry table might not exist yet - that's OK
            if (!regErr.message.includes('does not exist')) {
              console.error(`    Registry error: ${regErr.message}`);
            }
          }
        }

        generated++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`    Error for ${agent.name}: ${err.message}`);
        }
      }
    }

    const progress = Math.min(i + BATCH_SIZE, agents.length);
    console.log(`    Progress: ${progress}/${agents.length} (${generated} generated, ${errors} errors)`);
  }

  // Final summary
  console.log('\n' + '═'.repeat(70));
  console.log('Summary');
  console.log('═'.repeat(70));
  console.log(`  ${DRY_RUN ? 'Would generate' : 'Generated'}: ${generated} certificates`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Truth chain now at sequence: ${truthChainState.sequence}`);

  // Verify counts
  if (!DRY_RUN) {
    const withCerts = await client.query(`
      SELECT COUNT(*) FROM agents WHERE canonical_id IS NOT NULL
    `);
    const total = await client.query('SELECT COUNT(*) FROM agents');

    console.log(`\n  Agents with certificates: ${withCerts.rows[0].count}/${total.rows[0].count}`);
  }

  console.log('═'.repeat(70));

  await client.end();
}

run().catch(console.error);
