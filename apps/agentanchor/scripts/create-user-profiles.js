/**
 * Create profiles for existing Supabase Auth users
 *
 * This script:
 * 1. Lists users from Supabase Auth
 * 2. Creates matching profiles in the profiles table
 * 3. Links them via auth_user_id
 */

const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  console.log('═'.repeat(60));
  console.log('   🔗 Create User Profiles');
  console.log('═'.repeat(60));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('\n❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
    console.log('   SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
    process.exit(1);
  }

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Get all auth users
  console.log('\n📥 Fetching auth users...\n');
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Failed to list auth users:', authError.message);
    process.exit(1);
  }

  const authUsers = authData?.users || [];
  console.log(`   Found ${authUsers.length} auth users:\n`);

  for (const user of authUsers) {
    console.log(`   • ${user.email} (${user.id})`);
    console.log(`     Created: ${user.created_at}`);
    console.log(`     Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log('');
  }

  if (authUsers.length === 0) {
    console.log('   No auth users found. Users need to sign up first.');
    process.exit(0);
  }

  // Connect to database
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Create profiles for each auth user
    console.log('📝 Creating profiles...\n');

    for (const user of authUsers) {
      try {
        // Check if profile exists
        const existing = await client.query(
          'SELECT id, email FROM profiles WHERE auth_user_id = $1 OR email = $2',
          [user.id, user.email]
        );

        if (existing.rows.length > 0) {
          const profile = existing.rows[0];
          console.log(`   ⏭️  ${user.email} - profile exists (${profile.id})`);

          // Update auth_user_id if missing
          if (!profile.auth_user_id) {
            await client.query(
              'UPDATE profiles SET auth_user_id = $1, updated_at = NOW() WHERE id = $2',
              [user.id, profile.id]
            );
            console.log(`      → Linked auth_user_id`);
          }
          continue;
        }

        // Create new profile
        const result = await client.query(`
          INSERT INTO profiles (
            auth_user_id, email, full_name, role,
            subscription_tier, notification_preferences,
            created_at, updated_at
          ) VALUES ($1, $2, $3, 'both', 'free', '{"email": true, "in_app": true}', NOW(), NOW())
          RETURNING id
        `, [
          user.id,
          user.email,
          user.user_metadata?.full_name || user.email.split('@')[0]
        ]);

        console.log(`   ✅ ${user.email} - profile created (${result.rows[0].id})`);

      } catch (err) {
        console.log(`   ❌ ${user.email}: ${err.message}`);
      }
    }

    // Verify linkage
    console.log('\n' + '─'.repeat(50));
    console.log('📋 Profile Summary:\n');

    const profiles = await client.query(`
      SELECT id, email, auth_user_id, role, created_at
      FROM profiles
      WHERE auth_user_id IS NOT NULL
      ORDER BY created_at DESC
    `);

    for (const p of profiles.rows) {
      console.log(`   ${p.email}`);
      console.log(`     ID: ${p.id}`);
      console.log(`     Auth ID: ${p.auth_user_id}`);
      console.log(`     Role: ${p.role}`);
      console.log('');
    }

    console.log('═'.repeat(60));
    console.log('   ✨ Done! Users can now sign in and see their profiles.');
    console.log('═'.repeat(60) + '\n');

  } finally {
    await client.end();
  }
}

main().catch(console.error);
