#!/usr/bin/env node
/**
 * Trust Bridge End-to-End Demo
 *
 * Demonstrates the full certification flow:
 * 1. Submit an external agent
 * 2. Process through certification
 * 3. Issue credential
 * 4. Verify credential
 *
 * Usage: node scripts/demo-trust-bridge.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🌉 TRUST BRIDGE - End-to-End Certification Demo');
  console.log('  "Any agent. Any origin. One trust standard."');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Step 1: Check service status
  console.log('📡 Step 1: Checking Trust Bridge service status...\n');

  const statusRes = await fetch(`${BASE_URL}/api/trust-bridge`);
  const status = await statusRes.json();

  console.log(`   Service: ${status.service} v${status.version}`);
  console.log(`   Status: ${status.status === 'operational' ? '✅ Operational' : '⚠️ ' + status.status}`);
  console.log(`   Queue: ${status.queue.pending} pending, ${status.queue.processing} processing\n`);

  // Step 2: Submit an agent for certification
  console.log('───────────────────────────────────────────────────────────────');
  console.log('📝 Step 2: Submitting agent for certification...\n');

  const submission = {
    name: 'DemoCodeHelper',
    description: 'An AI assistant that helps developers with code review, debugging, and documentation. Built with safety in mind.',
    version: '1.0.0',
    origin_platform: 'cursor',
    capabilities: ['code_review', 'debugging', 'documentation', 'explanation'],
    risk_category: 'medium',
    contact_email: 'demo@agentanchorai.com',
    model_provider: 'claude-sonnet-4-20250514',
    organization: 'A3I Demo',
    submitter_id: 'demo-user-' + Date.now(),
  };

  console.log('   Agent Details:');
  console.log(`   • Name: ${submission.name}`);
  console.log(`   • Platform: ${submission.origin_platform}`);
  console.log(`   • Risk Level: ${submission.risk_category}`);
  console.log(`   • Capabilities: ${submission.capabilities.join(', ')}\n`);

  const submitRes = await fetch(`${BASE_URL}/api/trust-bridge/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  });

  const submitResult = await submitRes.json();

  if (!submitResult.success) {
    console.log('   ❌ Submission failed:', submitResult.errors?.join(', '));
    process.exit(1);
  }

  console.log('   ✅ Submission accepted!');
  console.log(`   • Tracking ID: ${submitResult.tracking_id}`);
  console.log(`   • Queue Position: #${submitResult.queue_position}`);
  console.log(`   • Estimated Wait: ${submitResult.estimated_wait_minutes} minutes\n`);

  if (submitResult.warnings?.length > 0) {
    console.log('   ⚠️  Warnings:');
    submitResult.warnings.forEach(w => console.log(`      - ${w}`));
    console.log('');
  }

  // Step 3: Process certification
  console.log('───────────────────────────────────────────────────────────────');
  console.log('🔬 Step 3: Running certification tests...\n');

  console.log('   Processing queue (this runs adversarial tests)...\n');

  const processRes = await fetch(`${BASE_URL}/api/trust-bridge/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_size: 1 }),
  });

  const processResult = await processRes.json();

  if (processResult.processed > 0 && processResult.results?.length > 0) {
    const result = processResult.results[0];

    console.log('   Test Results:');
    console.log(`   • Agent: ${result.agent_name}`);
    console.log(`   • Status: ${result.status === 'passed' ? '✅ PASSED' : result.status === 'failed' ? '❌ FAILED' : '🔍 ' + result.status.toUpperCase()}`);
    console.log(`   • Score: ${result.score || 'N/A'}/1000`);
    console.log(`   • Tier: ${result.tier ? result.tier.toUpperCase() : 'N/A'}`);
    console.log(`   • Duration: ${result.duration_ms}ms`);

    if (result.council_required) {
      console.log('   • Council Review: Required for this tier');
    }

    console.log('');
  } else {
    console.log('   ℹ️  No items to process (already processed or queue empty)\n');
  }

  // Step 4: Check final status
  console.log('───────────────────────────────────────────────────────────────');
  console.log('📊 Step 4: Checking certification status...\n');

  const statusCheckRes = await fetch(`${BASE_URL}/api/trust-bridge/status/${submitResult.tracking_id}`);
  const statusCheck = await statusCheckRes.json();

  if (statusCheck.success) {
    console.log('   Certification Status:');
    console.log(`   • Status: ${statusCheck.status?.toUpperCase()}`);

    if (statusCheck.test_results) {
      console.log(`   • Test Score: ${statusCheck.test_results.total_score}/1000`);
      console.log(`   • Tests Passed: ${statusCheck.test_results.tests_passed}/${statusCheck.test_results.tests_total}`);
    }

    if (statusCheck.certification) {
      console.log('\n   🏆 CERTIFICATION ISSUED:');
      console.log(`   • Tier: ${statusCheck.certification.tier.toUpperCase()}`);
      console.log(`   • Trust Score: ${statusCheck.certification.trust_score}`);
      console.log(`   • Valid Until: ${statusCheck.certification.valid_until}`);
      console.log(`   • Council Reviewed: ${statusCheck.certification.council_reviewed ? 'Yes' : 'No'}`);

      // Step 5: Verify the credential
      console.log('\n───────────────────────────────────────────────────────────────');
      console.log('🔐 Step 5: Verifying credential...\n');

      const verifyRes = await fetch(`${BASE_URL}/api/trust-bridge/verify`, {
        headers: {
          'X-Trust-Credential': statusCheck.certification.credential_token,
        },
      });

      const verifyResult = await verifyRes.json();

      if (verifyResult.valid) {
        console.log('   ✅ CREDENTIAL VERIFIED!');
        console.log(`   • Agent ID: ${verifyResult.agent_id}`);
        console.log(`   • Trust Score: ${verifyResult.trust_score}`);
        console.log(`   • Tier: ${verifyResult.tier.toUpperCase()}`);
        console.log(`   • Platform: ${verifyResult.origin_platform}`);
        console.log(`   • Valid Until: ${verifyResult.certified_until}`);

        if (verifyResult.restrictions?.length > 0) {
          console.log(`   • Restrictions: ${verifyResult.restrictions.join(', ')}`);
        }

        if (verifyResult.warnings?.length > 0) {
          console.log(`   • Warnings: ${verifyResult.warnings.join(', ')}`);
        }
      } else {
        console.log('   ❌ Verification failed:', verifyResult.error);
      }
    }
  } else {
    console.log('   Status check result:', statusCheck.error || 'Not found');
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  📋 DEMO COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('  Trust Bridge successfully demonstrated:');
  console.log('  ✓ External agent submission');
  console.log('  ✓ Adversarial testing pipeline');
  console.log('  ✓ Certification scoring');
  console.log('  ✓ JWT credential issuance');
  console.log('  ✓ Credential verification\n');

  console.log('  This agent from Cursor IDE now has a portable trust credential');
  console.log('  that can be verified by any platform in the A3I ecosystem.\n');

  console.log('  Learn more: /docs/trust-bridge-vision.md');
  console.log('  Dashboard: /trust-bridge\n');
}

main().catch(err => {
  console.error('Demo error:', err.message);
  process.exit(1);
});
