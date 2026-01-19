# Database Migration Safety Guide

## Overview

This guide covers safe database migration practices for the TrustBot project, including backup procedures, rollback strategies, and zero-downtime migration patterns.

## Quick Start

```bash
# Validate migrations (CI/CD dry-run)
./scripts/migrate-safe.sh --dry-run validate

# Apply pending migrations with backup
./scripts/migrate-safe.sh up

# Check migration status
./scripts/migrate-safe.sh status

# Rollback last migration
./scripts/migrate-safe.sh down
```

## Migration Script Commands

| Command | Description |
|---------|-------------|
| `up` | Apply pending migrations (default) |
| `down` | Rollback last migration |
| `status` | Show migration status |
| `history` | Show migration history |
| `validate` | Validate migration files |
| `backup` | Create database backup only |

## Options

| Option | Description |
|--------|-------------|
| `-d, --dry-run` | Simulate without applying changes |
| `-s, --skip-backup` | Skip pre-migration backup |
| `-r, --rollback-to VERSION` | Rollback to specific version |
| `-f, --force` | Force migration despite warnings |
| `-v, --verbose` | Enable verbose output |

## Zero-Downtime Migration Patterns

### Adding Columns

**Unsafe:**
```sql
-- Locks table, can cause downtime
ALTER TABLE agents ADD COLUMN new_field VARCHAR(255) NOT NULL;
```

**Safe:**
```sql
-- Step 1: Add nullable column
ALTER TABLE agents ADD COLUMN new_field VARCHAR(255);

-- Step 2: Backfill data (in batches if large table)
UPDATE agents SET new_field = 'default_value' WHERE new_field IS NULL;

-- Step 3: Add NOT NULL constraint (separate migration)
ALTER TABLE agents ALTER COLUMN new_field SET NOT NULL;
```

### Creating Indexes

**Unsafe:**
```sql
-- Locks table during index creation
CREATE INDEX idx_agents_status ON agents(status);
```

**Safe:**
```sql
-- Non-blocking index creation
CREATE INDEX CONCURRENTLY idx_agents_status ON agents(status);
```

### Renaming Columns

**Unsafe:**
```sql
-- Immediate rename breaks running queries
ALTER TABLE agents RENAME COLUMN old_name TO new_name;
```

**Safe (multi-step):**
```sql
-- Step 1: Add new column
ALTER TABLE agents ADD COLUMN new_name VARCHAR(255);

-- Step 2: Sync data with trigger
CREATE OR REPLACE FUNCTION sync_column_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.new_name := NEW.old_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_name_trigger
    BEFORE INSERT OR UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION sync_column_name();

-- Step 3: Backfill existing data
UPDATE agents SET new_name = old_name;

-- Step 4: Update application to use new column
-- Step 5: Drop old column (separate migration after deploy)
ALTER TABLE agents DROP COLUMN old_name;
```

### Dropping Tables

**Unsafe:**
```sql
-- Immediate drop
DROP TABLE old_table;
```

**Safe:**
```sql
-- Step 1: Rename table (keeps data for rollback)
ALTER TABLE old_table RENAME TO old_table_deprecated;

-- Step 2: Wait for monitoring period (1 week)
-- Step 3: Drop in separate migration
DROP TABLE IF EXISTS old_table_deprecated;
```

## Rollback Procedures

### Creating Rollback Scripts

For each migration, create a corresponding rollback script:

```
supabase/migrations/
├── 20231223_001_add_rls_policies.sql
├── rollback/
│   └── 20231223_001_add_rls_policies_down.sql
```

**Example rollback script:**
```sql
-- Rollback: 20231223_001_add_rls_policies
-- Reverses the RLS policy additions

DROP POLICY IF EXISTS "agents_read_own" ON agents;
DROP POLICY IF EXISTS "agents_write_own" ON agents;

ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
```

### Manual Rollback Steps

1. **Stop the application** (if possible)
2. **Create backup** of current state
3. **Apply rollback script**
4. **Verify database state**
5. **Restart application with previous version**

## Backup Procedures

### Automatic Backups

The migration script creates automatic backups before each migration:

```bash
# Backups stored in
./backups/backup_YYYYMMDD_HHMMSS.sql
```

### Manual Backup

```bash
# Create backup only
./scripts/migrate-safe.sh backup

# Using pg_dump directly
pg_dump $SUPABASE_DB_URL --no-owner --no-acl > backup.sql
```

### Restoring from Backup

```bash
# Restore to database
psql $SUPABASE_DB_URL < backup.sql

# Or via Supabase dashboard
# 1. Go to Database > Backups
# 2. Upload backup file
# 3. Restore
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Migration Validation

on:
  pull_request:
    paths:
      - 'supabase/migrations/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate Migrations
        run: |
          chmod +x ./scripts/migrate-safe.sh
          ./scripts/migrate-safe.sh --dry-run validate
```

### Pre-Deploy Checklist

- [ ] Migration validated with `--dry-run`
- [ ] Rollback script exists
- [ ] Zero-downtime patterns used
- [ ] Backup created
- [ ] Monitoring alerts configured
- [ ] Team notified of migration

## Troubleshooting

### Migration Failed Mid-Way

1. Check migration log: `./migration.log`
2. Identify failed migration in status: `./scripts/migrate-safe.sh status`
3. Fix the issue or rollback: `./scripts/migrate-safe.sh down`
4. Restore from backup if needed

### Lock Timeout

If migration times out due to locks:

```sql
-- Check active locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Kill blocking queries (with caution)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle in transaction' AND query_start < NOW() - INTERVAL '5 minutes';
```

### Connection Issues

Ensure environment variables are set:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_KEY="your-service-role-key"
export SUPABASE_DB_URL="postgresql://postgres:password@host:port/postgres"
```

## Best Practices

1. **Always create rollback scripts** for destructive operations
2. **Use CONCURRENTLY** for index operations
3. **Split large migrations** into smaller steps
4. **Test migrations** on staging first
5. **Monitor after deployment** for performance issues
6. **Keep backups** for at least 7 days
7. **Document breaking changes** in migration comments
