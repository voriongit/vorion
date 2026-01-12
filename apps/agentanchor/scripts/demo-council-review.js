#!/usr/bin/env node
/**
 * Trust Bridge Council Review Demo
 *
 * Demonstrates the Council of Nine review workflow for elevated certifications:
 * 1. Submit a high-risk agent
 * 2. Process through testing (simulate high score)
 * 3. Agent goes to Council review
 * 4. Council approves/rejects
 * 5. Credential issued after Council approval
 *
 * Usage: node scripts/demo-council-review.js
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🏛️  COUNCIL OF NINE - Review Workflow Demo');
  console.log('  Trust Bridge elevated certification review process');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Connect to database to manually set up a "review" status submission
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Step 1: Create a submission that's already in "review" status
  console.log('📋 Step 1: Creating submission requiring Council review...\n');

  const trackingId = `TB-ENT-${Date.now().toString(36).toUpperCase()}-DEMO`;
  const submission = {
    name: 'EnterpriseSecurityBot',
    description: 'A critical infrastructure security agent for enterprise deployments. Requires Council review due to high risk category and elevated trust score.',
    version: '2.0.0',
    origin_platform: 'custom',
    capabilities: ['security_scanning', 'vulnerability_detection', 'incident_response', 'system_access'],
    risk_category: 'critical',
    contact_email: 'security@enterprise-corp.example',
    model_provider: 'claude-3-opus-20240229',
    organization: 'Enterprise Security Corp',
  };

  const testResults = {
    session_id: `sess-${Date.now()}`,
    total_score: 650, // Advanced tier (500-749), requires Council
    tests_passed: 85,
    tests_total: 100,
    category_scores: {
      prompt_injection: 175,
      jailbreak: 160,
      obfuscation: 95,
      goal_alignment: 140,
      data_handling: 80,
    },
    flags: ['elevated_risk', 'system_access_capability'],
    recommendations: ['Restrict to supervised environments', 'Enable audit logging'],
    duration_ms: 245000,
  };

  // Insert directly into database
  await client.query(`
    INSERT INTO trust_bridge_submissions
    (tracking_id, submission, status, test_results, submitted_at, started_at, completed_at, submitter_id, submitter_tier)
    VALUES ($1, $2, 'review', $3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', NOW(), 'demo-enterprise-user', 'enterprise')
  `, [trackingId, JSON.stringify(submission), JSON.stringify(testResults)]);

  console.log(`   Created submission: ${trackingId}`);
  console.log(`   Agent: ${submission.name}`);
  console.log(`   Risk: ${submission.risk_category.toUpperCase()}`);
  console.log(`   Score: ${testResults.total_score}/1000 (Advanced tier)`);
  console.log(`   Status: PENDING COUNCIL REVIEW\n`);

  // Step 2: Check Council review queue
  console.log('───────────────────────────────────────────────────────────────');
  console.log('📝 Step 2: Checking Council review queue...\n');

  const councilRes = await fetch(`${BASE_URL}/api/trust-bridge/council`);
  const councilQueue = await councilRes.json();

  console.log(`   Pending reviews: ${councilQueue.pending_count}\n`);

  if (councilQueue.pending_reviews?.length > 0) {
    councilQueue.pending_reviews.forEach((review, i) => {
      console.log(`   Review ${i + 1}:`);
      console.log(`   • Agent: ${review.agent_name}`);
      console.log(`   • Platform: ${review.origin_platform}`);
      console.log(`   • Risk: ${review.risk_category}`);
      console.log(`   • Score: ${review.test_score}`);
      console.log(`   • Proposed Tier: ${review.proposed_tier}`);
      console.log('');
    });
  }

  // Step 3: Simulate Council approval
  console.log('───────────────────────────────────────────────────────────────');
  console.log('🏛️  Step 3: Council of Nine review process...\n');

  console.log('   Council Member reviewing submission...');
  console.log('   • Verified test results');
  console.log('   • Checked organization credentials');
  console.log('   • Reviewed security capabilities');
  console.log('   • Assessed risk mitigations\n');

  // Submit Council approval
  console.log('   Submitting Council APPROVAL...\n');

  const approvalRes = await fetch(`${BASE_URL}/api/trust-bridge/council`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Council-Member-Id': 'council-member-001',
    },
    body: JSON.stringify({
      tracking_id: trackingId,
      decision: 'approve',
      notes: 'Agent passed all verification checks. Organization verified. Approved for Advanced tier with supervised deployment restriction.',
      restrictions: ['supervised_deployment', 'audit_logging_required', 'quarterly_review'],
    }),
  });

  const approvalResult = await approvalRes.json();

  if (approvalResult.success) {
    console.log('   ✅ COUNCIL APPROVED!');
    console.log(`   • Decision: ${approvalResult.decision.toUpperCase()}`);
    console.log(`   • Tier: ${approvalResult.tier}`);
    console.log(`   • Trust Score: ${approvalResult.trust_score}`);
    console.log(`   • Credential Issued: ${approvalResult.credential_issued ? 'Yes' : 'No'}\n`);
  } else {
    console.log('   ❌ Approval failed:', approvalResult.error);
  }

  // Step 4: Verify final status
  console.log('───────────────────────────────────────────────────────────────');
  console.log('📊 Step 4: Final certification status...\n');

  const statusRes = await fetch(`${BASE_URL}/api/trust-bridge/status/${trackingId}`);
  const status = await statusRes.json();

  if (status.success) {
    console.log(`   • Tracking ID: ${status.tracking_id}`);
    console.log(`   • Status: ${status.status?.toUpperCase()}`);

    if (status.certification) {
      console.log('\n   🏆 CERTIFICATION ISSUED:');
      console.log(`   • Tier: ${status.certification.tier?.toUpperCase()}`);
      console.log(`   • Trust Score: ${status.certification.trust_score}`);
      console.log(`   • Council Reviewed: ${status.certification.council_reviewed ? 'Yes' : 'No'}`);
      console.log(`   • Valid Until: ${status.certification.valid_until}`);

      // Step 5: Verify the credential
      console.log('\n───────────────────────────────────────────────────────────────');
      console.log('🔐 Step 5: Verifying Council-approved credential...\n');

      const verifyRes = await fetch(`${BASE_URL}/api/trust-bridge/verify`, {
        headers: {
          'X-Trust-Credential': status.certification.credential_token,
        },
      });

      const verifyResult = await verifyRes.json();

      if (verifyResult.valid) {
        console.log('   ✅ CREDENTIAL VERIFIED!');
        console.log(`   • Agent ID: ${verifyResult.agent_id}`);
        console.log(`   • Trust Score: ${verifyResult.trust_score}`);
        console.log(`   • Tier: ${verifyResult.tier?.toUpperCase()}`);
        console.log(`   • Council Reviewed: ${verifyResult.council_reviewed ? 'Yes' : 'No'}`);

        if (verifyResult.restrictions?.length > 0) {
          console.log(`   • Restrictions: ${verifyResult.restrictions.join(', ')}`);
        }
      }
    }
  }

  // Clean up
  await client.end();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  📋 COUNCIL REVIEW DEMO COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('  The Council of Nine review workflow demonstrated:');
  console.log('  ✓ High-risk agent submission');
  console.log('  ✓ Elevated certification requires Council review');
  console.log('  ✓ Council queue management');
  console.log('  ✓ Council approval with custom restrictions');
  console.log('  ✓ Credential issuance with council_reviewed flag');
  console.log('  ✓ Credential verification\n');

  console.log('  Council decisions are recorded on the Truth Chain for');
  console.log('  transparency and accountability.\n');
}

main().catch(err => {
  console.error('Demo error:', err.message);
  process.exit(1);
});
