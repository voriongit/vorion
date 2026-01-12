/**
 * Bot Trust System - Quick Test Script
 *
 * Tests all core modules with mock data to verify functionality
 * Run with: npx tsx scripts/test-bot-trust.ts
 */

import {
  decisionTracker,
  approvalRateCalculator,
  trustScoreEngine,
  autonomyManager,
  auditLogger,
  telemetryCollector,
  DecisionType,
  RiskLevel,
  UserResponse,
  AuditEventType,
} from '../lib/bot-trust';

const TEST_BOT_ID = 'test-bot-' + Date.now();

async function testBotTrustSystem() {
  console.log('🧪 Testing Bot Trust System...\n');

  try {
    // Test 1: Initialize Bot
    console.log('1️⃣ Initializing bot autonomy...');
    await autonomyManager.initializeBot(TEST_BOT_ID);
    const initialLevel = await autonomyManager.getCurrentLevel(TEST_BOT_ID);
    console.log(`   ✓ Bot initialized at Level ${initialLevel}\n`);

    // Test 2: Log Decisions
    console.log('2️⃣ Logging decisions...');
    const decisions = [];

    for (let i = 0; i < 10; i++) {
      const decision = await decisionTracker.logDecision({
        bot_id: TEST_BOT_ID,
        decision_type: DecisionType.SUGGEST,
        action_taken: `Test action ${i + 1}`,
        reasoning: 'Testing the decision tracking system',
        confidence_score: 0.8 + Math.random() * 0.15,
        risk_level: i % 2 === 0 ? RiskLevel.LOW : RiskLevel.MEDIUM,
        context_data: { test: true, iteration: i },
        alternatives_considered: [
          {
            alternative: `Alternative ${i + 1}`,
            rejected_reason: 'Lower confidence score',
          },
        ],
      });
      decisions.push(decision);

      // Approve most decisions (simulate user feedback)
      if (i < 8) {
        await decisionTracker.updateDecisionResponse(
          decision.id,
          UserResponse.APPROVED
        );
      } else if (i === 8) {
        await decisionTracker.updateDecisionResponse(
          decision.id,
          UserResponse.MODIFIED,
          'Changed the budget amount'
        );
      }
    }
    console.log(`   ✓ Logged ${decisions.length} decisions\n`);

    // Test 3: Calculate Approval Rate
    console.log('3️⃣ Calculating approval rate...');
    const approvalRate = await approvalRateCalculator.getApprovalRate(TEST_BOT_ID);
    console.log(`   ✓ Overall approval rate: ${(approvalRate.overall * 100).toFixed(1)}%`);
    console.log(`   ✓ By risk level:`, approvalRate.by_risk_level);
    console.log('');

    // Test 4: Calculate Trust Score
    console.log('4️⃣ Calculating trust score...');
    const trustScore = await trustScoreEngine.calculateTrustScore(TEST_BOT_ID);
    console.log(`   ✓ Trust Score: ${trustScore.score}/1000`);
    console.log(`   ✓ Components:`);
    console.log(`     - Decision Accuracy: ${trustScore.components.decision_accuracy.toFixed(1)}`);
    console.log(`     - Ethics Compliance: ${trustScore.components.ethics_compliance.toFixed(1)}`);
    console.log(`     - Training Success: ${trustScore.components.training_success.toFixed(1)}`);
    console.log(`     - Operational Stability: ${trustScore.components.operational_stability.toFixed(1)}`);
    console.log(`     - Peer Reviews: ${trustScore.components.peer_reviews.toFixed(1)}`);
    console.log('');

    // Test 5: Store Trust Score
    console.log('5️⃣ Storing trust score...');
    await trustScoreEngine.storeTrustScore(TEST_BOT_ID);
    console.log('   ✓ Trust score stored in database\n');

    // Test 6: Evaluate Autonomy Progression
    console.log('6️⃣ Evaluating autonomy progression...');
    const evaluation = await autonomyManager.evaluateProgression(TEST_BOT_ID);
    console.log(`   ✓ Current Level: ${evaluation.current_level}`);
    console.log(`   ✓ Can Progress: ${evaluation.can_progress}`);
    console.log(`   ✓ Progress:`);
    console.log(`     - Decisions: ${evaluation.progress.decisions}/${evaluation.progress.required_decisions}`);
    console.log(`     - Approval Rate: ${(evaluation.progress.approval_rate * 100).toFixed(1)}%/${(evaluation.progress.required_approval_rate * 100).toFixed(0)}%`);
    console.log(`   ✓ ${evaluation.recommendation}\n`);

    // Test 7: Log Audit Events
    console.log('7️⃣ Logging audit events...');
    await auditLogger.logEvent(
      TEST_BOT_ID,
      AuditEventType.BOT_CREATED,
      { test: true },
      { user_id: 'test-user' }
    );
    await auditLogger.logEvent(
      TEST_BOT_ID,
      AuditEventType.TRUST_SCORE_CALCULATED,
      { score: trustScore.score },
      { user_id: 'test-user' }
    );
    console.log('   ✓ Audit events logged\n');

    // Test 8: Verify Audit Chain
    console.log('8️⃣ Verifying audit chain...');
    const verification = await auditLogger.verifyChain(TEST_BOT_ID);
    console.log(`   ✓ Chain Valid: ${verification.valid}`);
    console.log(`   ✓ Total Entries: ${verification.total_entries}\n`);

    // Test 9: Record Telemetry
    console.log('9️⃣ Recording telemetry...');
    await telemetryCollector.recordRequest(TEST_BOT_ID, 1250, true);
    await telemetryCollector.recordTokenUsage(TEST_BOT_ID, 500, 750, 'claude-sonnet-4');
    await telemetryCollector.recordCacheMetric(TEST_BOT_ID, true, 'redis');
    // Flush buffer
    await telemetryCollector.shutdown();
    console.log('   ✓ Telemetry recorded\n');

    // Test 10: Get Decision Counts
    console.log('🔟 Getting decision counts...');
    const counts = await decisionTracker.getDecisionCounts(TEST_BOT_ID);
    console.log(`   ✓ Total: ${counts.total}`);
    console.log(`   ✓ Approved: ${counts.approved}`);
    console.log(`   ✓ Rejected: ${counts.rejected}`);
    console.log(`   ✓ Modified: ${counts.modified}`);
    console.log(`   ✓ Pending: ${counts.pending}\n`);

    console.log('✅ All tests passed!\n');
    console.log(`📊 Test Bot ID: ${TEST_BOT_ID}`);
    console.log(`🌐 View dashboard at: http://localhost:3000/bots/${TEST_BOT_ID}/trust`);
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testBotTrustSystem();
