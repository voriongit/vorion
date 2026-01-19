/**
 * Verification Script: Task-to-Blackboard Synchronization
 *
 * This script verifies that the UnifiedWorkflowEngine correctly syncs
 * task lifecycle events (creation, completion, failure) to the Blackboard.
 *
 * Run with: npx ts-node scripts/verify-task-sync.ts
 */

import { UnifiedWorkflowEngine } from '../src/api/UnifiedWorkflowAPI.js';

async function verify() {
    console.log('='.repeat(60));
    console.log('Task-to-Blackboard Sync Verification');
    console.log('='.repeat(60));

    // Initialize the engine
    const engine = new UnifiedWorkflowEngine();
    const blackboard = (engine as unknown as { blackboard: { get: (id: string) => unknown; getAllEntries: () => unknown[] } }).blackboard;

    console.log('\n[1] Creating a test task...');
    const task = engine.createTask({
        title: 'Verification Test Task',
        description: 'This task tests blackboard synchronization',
        priority: 'MEDIUM',
    });

    console.log(`   Task created: ${task.id}`);
    console.log(`   Blackboard Entry ID: ${task.blackboardEntryId ?? 'NOT SET'}`);

    // Verify blackboard entry was created
    if (!task.blackboardEntryId) {
        console.error('   [FAIL] No blackboardEntryId on task!');
        process.exit(1);
    }

    const entry = blackboard.get(task.blackboardEntryId);
    if (!entry) {
        console.error('   [FAIL] Blackboard entry not found!');
        process.exit(1);
    }

    console.log('   [PASS] Blackboard entry created successfully');
    console.log(`   Entry status: ${(entry as { status: string }).status}`);

    // Step 2: Complete the task
    console.log('\n[2] Completing the task...');

    // Get a system token for the operation
    const security = (engine as unknown as { security: { generateToken: (p: { id: string; type: string; permissions: string[] }) => { token: string } } }).security;
    const token = security.generateToken({
        id: 'test-agent',
        type: 'AGENT',
        permissions: ['BLACKBOARD_POST'],
    });

    const completedTask = engine.completeTask(task.id, {
        summary: 'Task completed successfully',
        output: { verified: true },
    }, token.token);

    if (!completedTask) {
        console.error('   [FAIL] Task completion failed!');
        process.exit(1);
    }

    console.log(`   Task status: ${completedTask.status}`);

    // Verify blackboard was updated
    const updatedEntry = blackboard.get(task.blackboardEntryId) as {
        status: string;
        content: { result?: unknown };
        resolution?: string;
    };

    if (updatedEntry.status !== 'RESOLVED') {
        console.error(`   [FAIL] Blackboard entry status is ${updatedEntry.status}, expected RESOLVED`);
        process.exit(1);
    }

    if (!updatedEntry.content?.result) {
        console.error('   [FAIL] Blackboard entry content does not contain result');
        process.exit(1);
    }

    console.log('   [PASS] Blackboard entry updated with result');
    console.log(`   Entry status: ${updatedEntry.status}`);
    console.log(`   Entry has result: ${!!updatedEntry.content?.result}`);

    // Step 3: Create and fail another task
    console.log('\n[3] Creating and failing a task...');

    const failTask = engine.createTask({
        title: 'Task That Will Fail',
        description: 'This task will be marked as failed',
        priority: 'LOW',
    });

    const failedTask = engine.failTask(
        failTask.id,
        'Intentional failure for testing',
        token.token
    );

    if (!failedTask) {
        console.error('   [FAIL] Task failure call failed!');
        process.exit(1);
    }

    const failedEntry = blackboard.get(failTask.blackboardEntryId!) as {
        status: string;
        content: { error?: string };
    };

    if (failedEntry.status !== 'BLOCKED') {
        console.error(`   [FAIL] Blackboard entry status is ${failedEntry.status}, expected BLOCKED`);
        process.exit(1);
    }

    if (!failedEntry.content?.error) {
        console.error('   [FAIL] Blackboard entry content does not contain error');
        process.exit(1);
    }

    console.log('   [PASS] Failed task synced to blackboard');
    console.log(`   Entry status: ${failedEntry.status}`);
    console.log(`   Entry has error: ${!!failedEntry.content?.error}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(60));
    console.log('\nAll checks passed! Task lifecycle events are correctly');
    console.log('synchronized to the Blackboard.');

    // Show final blackboard state
    const allEntries = blackboard.getAllEntries() as { id: string; title: string; status: string }[];
    console.log(`\nBlackboard now contains ${allEntries.length} entries:`);
    allEntries.forEach((e, i) => {
        console.log(`  ${i + 1}. [${e.status}] ${e.title}`);
    });

    console.log('\n');
}

verify().catch((err) => {
    console.error('Verification failed with error:', err);
    process.exit(1);
});
