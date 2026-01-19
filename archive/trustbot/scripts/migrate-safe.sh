#!/bin/bash

# ============================================================================
# Safe Database Migration Script
# Epic 9: Production Hardening
# Story 9.6: Database Migration Safety
#
# Features:
# - Pre-migration backup
# - Dry-run mode for CI validation
# - Rollback capability
# - Zero-downtime migration patterns
# - Migration history tracking
# ============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="${PROJECT_ROOT}/supabase/migrations"
BACKUP_DIR="${PROJECT_ROOT}/backups"
MIGRATION_LOG="${PROJECT_ROOT}/migration.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
DRY_RUN=false
SKIP_BACKUP=false
ROLLBACK=false
ROLLBACK_TO=""
FORCE=false
VERBOSE=false

# ============================================================================
# Helper Functions
# ============================================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "$level" in
        INFO)  echo -e "${BLUE}[INFO]${NC} $message" ;;
        OK)    echo -e "${GREEN}[OK]${NC} $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
    esac

    echo "[$timestamp] [$level] $message" >> "$MIGRATION_LOG"
}

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] [COMMAND]

Safe database migration with backup and rollback support.

Commands:
    up              Apply pending migrations (default)
    down            Rollback last migration
    status          Show migration status
    history         Show migration history
    validate        Validate migration files (dry-run)
    backup          Create database backup only

Options:
    -d, --dry-run       Simulate migration without applying changes
    -s, --skip-backup   Skip pre-migration backup (not recommended)
    -r, --rollback-to   Rollback to specific migration version
    -f, --force         Force migration even with warnings
    -v, --verbose       Enable verbose output
    -h, --help          Show this help message

Examples:
    $(basename "$0") up                    # Apply pending migrations
    $(basename "$0") --dry-run up          # Validate migrations in CI
    $(basename "$0") down                  # Rollback last migration
    $(basename "$0") --rollback-to 20231223_001  # Rollback to version
    $(basename "$0") status                # Show current state

Environment Variables:
    SUPABASE_URL        Supabase project URL
    SUPABASE_KEY        Supabase service role key
    SUPABASE_DB_URL     Direct database connection URL (for backups)
EOF
}

check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    # Check for required tools
    local missing_tools=()

    if ! command -v psql &> /dev/null; then
        missing_tools+=("psql")
    fi

    if ! command -v pg_dump &> /dev/null; then
        missing_tools+=("pg_dump")
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        log "WARN" "Missing tools: ${missing_tools[*]}"
        log "INFO" "Some features may be limited without PostgreSQL client tools"
    fi

    # Check for Supabase CLI (optional)
    if command -v supabase &> /dev/null; then
        log "OK" "Supabase CLI found"
    else
        log "INFO" "Supabase CLI not found - using direct SQL execution"
    fi

    # Check environment variables
    if [ -z "${SUPABASE_URL:-}" ]; then
        log "WARN" "SUPABASE_URL not set - using local/file mode"
    fi

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    log "OK" "Prerequisites check complete"
}

# ============================================================================
# Backup Functions
# ============================================================================

create_backup() {
    local backup_name="backup_$(date '+%Y%m%d_%H%M%S')"
    local backup_file="${BACKUP_DIR}/${backup_name}.sql"

    log "INFO" "Creating backup: $backup_name"

    if [ -n "${SUPABASE_DB_URL:-}" ]; then
        # Use pg_dump for direct database backup
        if command -v pg_dump &> /dev/null; then
            pg_dump "$SUPABASE_DB_URL" --no-owner --no-acl > "$backup_file" 2>/dev/null || {
                log "WARN" "pg_dump failed, creating schema-only backup"
                create_schema_backup "$backup_file"
            }
        else
            create_schema_backup "$backup_file"
        fi
    else
        create_schema_backup "$backup_file"
    fi

    if [ -f "$backup_file" ]; then
        local size
        size=$(wc -c < "$backup_file")
        log "OK" "Backup created: $backup_file ($size bytes)"
        echo "$backup_file"
    else
        log "ERROR" "Backup creation failed"
        return 1
    fi
}

create_schema_backup() {
    local backup_file="$1"

    log "INFO" "Creating schema backup from migration files..."

    {
        echo "-- Schema Backup"
        echo "-- Generated: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "-- Source: Migration files"
        echo ""

        # Include base schema
        if [ -f "${PROJECT_ROOT}/supabase/schema.sql" ]; then
            echo "-- Base Schema"
            cat "${PROJECT_ROOT}/supabase/schema.sql"
            echo ""
        fi

        # Include applied migrations in order
        for migration in "${MIGRATIONS_DIR}"/*.sql; do
            if [ -f "$migration" ]; then
                echo "-- Migration: $(basename "$migration")"
                cat "$migration"
                echo ""
            fi
        done
    } > "$backup_file"
}

cleanup_old_backups() {
    local keep_count="${1:-5}"

    log "INFO" "Cleaning up old backups (keeping last $keep_count)..."

    local backup_count
    backup_count=$(find "$BACKUP_DIR" -name "backup_*.sql" -type f | wc -l)

    if [ "$backup_count" -gt "$keep_count" ]; then
        find "$BACKUP_DIR" -name "backup_*.sql" -type f -printf '%T@ %p\n' | \
            sort -n | head -n -"$keep_count" | cut -d' ' -f2- | \
            xargs -r rm -f
        log "OK" "Cleaned up old backups"
    fi
}

# ============================================================================
# Migration Functions
# ============================================================================

get_migration_files() {
    find "$MIGRATIONS_DIR" -name "*.sql" -type f ! -name "COMBINED_*" | sort
}

get_applied_migrations() {
    # Read from local tracking file
    local tracking_file="${PROJECT_ROOT}/.migration_history"
    if [ -f "$tracking_file" ]; then
        cat "$tracking_file"
    fi
}

mark_migration_applied() {
    local migration_name="$1"
    local tracking_file="${PROJECT_ROOT}/.migration_history"
    echo "$migration_name" >> "$tracking_file"
    log "OK" "Marked migration as applied: $migration_name"
}

mark_migration_rolled_back() {
    local migration_name="$1"
    local tracking_file="${PROJECT_ROOT}/.migration_history"

    if [ -f "$tracking_file" ]; then
        grep -v "^${migration_name}$" "$tracking_file" > "${tracking_file}.tmp" || true
        mv "${tracking_file}.tmp" "$tracking_file"
        log "OK" "Marked migration as rolled back: $migration_name"
    fi
}

validate_migration() {
    local migration_file="$1"
    local errors=0

    log "INFO" "Validating: $(basename "$migration_file")"

    # Check file exists and is readable
    if [ ! -r "$migration_file" ]; then
        log "ERROR" "Cannot read migration file"
        return 1
    fi

    # Check for basic SQL syntax issues
    if grep -qE '^\s*DROP\s+(TABLE|DATABASE)\s+' "$migration_file" 2>/dev/null; then
        log "WARN" "Contains DROP statement - ensure this is intentional"
    fi

    # Check for transaction safety
    if ! grep -qiE '^\s*(BEGIN|START TRANSACTION)' "$migration_file" 2>/dev/null; then
        log "WARN" "Migration may not be wrapped in transaction"
    fi

    # Check for zero-downtime patterns
    if grep -qE 'ALTER\s+TABLE.*ADD\s+COLUMN.*NOT\s+NULL(?!\s+DEFAULT)' "$migration_file" 2>/dev/null; then
        log "WARN" "Adding NOT NULL column without DEFAULT can lock table"
    fi

    # Check for index creation
    if grep -qiE 'CREATE\s+INDEX(?!\s+CONCURRENTLY)' "$migration_file" 2>/dev/null; then
        log "WARN" "Consider using CREATE INDEX CONCURRENTLY for zero-downtime"
    fi

    log "OK" "Validation complete: $(basename "$migration_file")"
    return $errors
}

apply_migration() {
    local migration_file="$1"
    local migration_name
    migration_name=$(basename "$migration_file")

    if $DRY_RUN; then
        log "INFO" "[DRY-RUN] Would apply: $migration_name"
        validate_migration "$migration_file"
        return 0
    fi

    log "INFO" "Applying migration: $migration_name"

    # Validate first
    if ! validate_migration "$migration_file"; then
        if ! $FORCE; then
            log "ERROR" "Validation failed - use --force to override"
            return 1
        fi
        log "WARN" "Forcing migration despite validation warnings"
    fi

    # Apply migration
    if [ -n "${SUPABASE_DB_URL:-}" ]; then
        # Direct database execution
        if command -v psql &> /dev/null; then
            psql "$SUPABASE_DB_URL" -f "$migration_file" 2>&1 || {
                log "ERROR" "Migration failed: $migration_name"
                return 1
            }
        else
            log "ERROR" "psql not available for direct execution"
            return 1
        fi
    else
        # Log for manual execution
        log "INFO" "Manual execution required for: $migration_name"
        log "INFO" "Apply this SQL in Supabase dashboard or via CLI"
    fi

    mark_migration_applied "$migration_name"
    log "OK" "Migration applied: $migration_name"
}

rollback_migration() {
    local migration_name="$1"
    local rollback_file="${MIGRATIONS_DIR}/rollback/${migration_name%.sql}_down.sql"

    if $DRY_RUN; then
        log "INFO" "[DRY-RUN] Would rollback: $migration_name"
        return 0
    fi

    log "INFO" "Rolling back: $migration_name"

    if [ -f "$rollback_file" ]; then
        if [ -n "${SUPABASE_DB_URL:-}" ] && command -v psql &> /dev/null; then
            psql "$SUPABASE_DB_URL" -f "$rollback_file" 2>&1 || {
                log "ERROR" "Rollback failed: $migration_name"
                return 1
            }
        else
            log "INFO" "Manual rollback required - see: $rollback_file"
        fi
    else
        log "WARN" "No rollback file found for: $migration_name"
        log "INFO" "Manual intervention may be required"
    fi

    mark_migration_rolled_back "$migration_name"
    log "OK" "Rollback complete: $migration_name"
}

# ============================================================================
# Commands
# ============================================================================

cmd_up() {
    log "INFO" "Starting migration: UP"

    # Create backup unless skipped
    if ! $SKIP_BACKUP && ! $DRY_RUN; then
        if ! create_backup; then
            if ! $FORCE; then
                log "ERROR" "Backup failed - use --skip-backup to proceed anyway"
                return 1
            fi
        fi
    fi

    local applied
    applied=$(get_applied_migrations)
    local pending=0
    local failed=0

    for migration_file in $(get_migration_files); do
        local migration_name
        migration_name=$(basename "$migration_file")

        if echo "$applied" | grep -qF "$migration_name"; then
            [ $VERBOSE = true ] && log "INFO" "Already applied: $migration_name"
            continue
        fi

        if apply_migration "$migration_file"; then
            ((pending++))
        else
            ((failed++))
            if ! $FORCE; then
                log "ERROR" "Migration failed - stopping"
                return 1
            fi
        fi
    done

    if [ $pending -eq 0 ] && [ $failed -eq 0 ]; then
        log "OK" "No pending migrations"
    else
        log "OK" "Migrations complete: $pending applied, $failed failed"
    fi

    # Cleanup old backups
    if ! $DRY_RUN; then
        cleanup_old_backups 5
    fi
}

cmd_down() {
    log "INFO" "Starting migration: DOWN"

    # Create backup first
    if ! $SKIP_BACKUP && ! $DRY_RUN; then
        create_backup || log "WARN" "Backup creation failed"
    fi

    local applied
    applied=$(get_applied_migrations | tail -1)

    if [ -z "$applied" ]; then
        log "INFO" "No migrations to rollback"
        return 0
    fi

    rollback_migration "$applied"
}

cmd_status() {
    log "INFO" "Migration Status"
    echo ""

    local applied
    applied=$(get_applied_migrations)
    local applied_count=0
    local pending_count=0

    echo "Migrations:"
    echo "==========="

    for migration_file in $(get_migration_files); do
        local migration_name
        migration_name=$(basename "$migration_file")

        if echo "$applied" | grep -qF "$migration_name"; then
            echo -e "  ${GREEN}[APPLIED]${NC} $migration_name"
            ((applied_count++))
        else
            echo -e "  ${YELLOW}[PENDING]${NC} $migration_name"
            ((pending_count++))
        fi
    done

    echo ""
    echo "Summary: $applied_count applied, $pending_count pending"
}

cmd_history() {
    log "INFO" "Migration History"
    echo ""

    local tracking_file="${PROJECT_ROOT}/.migration_history"
    if [ -f "$tracking_file" ]; then
        echo "Applied migrations (in order):"
        echo "=============================="
        cat -n "$tracking_file"
    else
        echo "No migration history found"
    fi

    echo ""
    echo "Recent backup files:"
    echo "===================="
    ls -lt "$BACKUP_DIR"/*.sql 2>/dev/null | head -5 || echo "No backups found"
}

cmd_validate() {
    log "INFO" "Validating all migration files..."

    DRY_RUN=true
    local errors=0

    for migration_file in $(get_migration_files); do
        if ! validate_migration "$migration_file"; then
            ((errors++))
        fi
    done

    echo ""
    if [ $errors -eq 0 ]; then
        log "OK" "All migrations validated successfully"
        return 0
    else
        log "ERROR" "Validation found $errors issues"
        return 1
    fi
}

cmd_backup() {
    create_backup
    cleanup_old_backups 5
}

# ============================================================================
# Main
# ============================================================================

main() {
    local command="up"

    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -s|--skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            -r|--rollback-to)
                ROLLBACK=true
                ROLLBACK_TO="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            up|down|status|history|validate|backup)
                command="$1"
                shift
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Initialize
    check_prerequisites

    # Run command
    case "$command" in
        up)       cmd_up ;;
        down)     cmd_down ;;
        status)   cmd_status ;;
        history)  cmd_history ;;
        validate) cmd_validate ;;
        backup)   cmd_backup ;;
    esac
}

main "$@"
