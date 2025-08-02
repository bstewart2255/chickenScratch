#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_ROOT="$PROJECT_ROOT/backups"

BACKUP_NAME=""
PHASE=""
LIST_ONLY=false
FORCE=false

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --backup <name>     Rollback to specific backup (e.g., backup-20240315_120000)"
    echo "  --phase <number>    Rollback to migration phase (1-17)"
    echo "  --list              List available rollback points"
    echo "  --force             Skip confirmation prompt"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --list"
    echo "  $0 --backup backup-20240315_120000"
    echo "  $0 --phase 10"
    echo "  $0 --phase 10 --force"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --backup)
            BACKUP_NAME="$2"
            shift 2
            ;;
        --phase)
            PHASE="$2"
            shift 2
            ;;
        --list)
            LIST_ONLY=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

list_rollback_points() {
    echo "=== Available Rollback Points ==="
    echo ""
    
    echo "Git Tags (Migration Phases):"
    git tag -l "migration-*" | sort -V | while read tag; do
        commit=$(git rev-list -n 1 "$tag")
        date=$(git log -1 --format=%ai "$commit")
        echo "  $tag (commit: ${commit:0:8}, date: $date)"
    done
    
    echo ""
    echo "Backup Archives:"
    if [ -f "$BACKUP_ROOT/index.json" ]; then
        node -e "
        const index = JSON.parse(require('fs').readFileSync('$BACKUP_ROOT/index.json'));
        index.backups.forEach(b => {
            console.log(\`  \${b.filename} (phase: \${b.migration_phase}, date: \${b.date}, size: \${b.backup_size})\`);
        });
        "
    else
        ls -la "$BACKUP_ROOT"/backup-*.tar.gz 2>/dev/null || echo "  No backups found"
    fi
}

if [ "$LIST_ONLY" = true ]; then
    list_rollback_points
    exit 0
fi

if [ -z "$BACKUP_NAME" ] && [ -z "$PHASE" ]; then
    echo "Error: Either --backup or --phase must be specified"
    usage
fi

confirm_rollback() {
    local target="$1"
    echo "⚠️  WARNING: This will rollback the system to: $target"
    echo ""
    echo "This operation will:"
    echo "  - Stop any running services"
    echo "  - Restore database to backup state"
    echo "  - Reset code to target commit"
    echo "  - Restore configuration files"
    echo "  - Reset migration status"
    echo ""
    echo "Current state will be backed up first."
    echo ""
    
    if [ "$FORCE" != true ]; then
        read -p "Are you sure you want to continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Rollback cancelled."
            exit 1
        fi
    fi
}

rollback_to_backup() {
    local backup_file="$1"
    local backup_path="$BACKUP_ROOT/$backup_file"
    
    if [ ! -f "$backup_path" ]; then
        echo "Error: Backup file not found: $backup_path"
        exit 1
    fi
    
    confirm_rollback "backup $backup_file"
    
    echo "=== Starting Rollback to Backup: $backup_file ==="
    
    echo "1. Creating current state backup..."
    "$SCRIPT_DIR/create-migration-backup.sh"
    
    echo "2. Extracting backup..."
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    tar -xzf "$backup_path"
    BACKUP_DIR=$(ls -d backup-*)
    
    echo "3. Stopping services..."
    if [ -f "$PROJECT_ROOT/scripts/stop-services.sh" ]; then
        "$PROJECT_ROOT/scripts/stop-services.sh" || true
    fi
    
    echo "4. Restoring database..."
    if [ -f "$TEMP_DIR/$BACKUP_DIR/database/full_dump.sql" ]; then
        source "$PROJECT_ROOT/.env"
        if [ ! -z "$DATABASE_URL" ]; then
            DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
            DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')
            DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
            DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
            
            echo "Dropping and recreating database..."
            PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
                -c "DROP DATABASE IF EXISTS $DB_NAME;" \
                -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || {
                echo "Warning: Database operations require manual intervention"
            }
            
            echo "Restoring database backup..."
            PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                < "$TEMP_DIR/$BACKUP_DIR/database/full_dump.sql" 2>/dev/null || {
                echo "Warning: Database restore skipped"
            }
        fi
    fi
    
    echo "5. Restoring code..."
    if [ -f "$TEMP_DIR/$BACKUP_DIR/code/git-commit.txt" ]; then
        TARGET_COMMIT=$(cat "$TEMP_DIR/$BACKUP_DIR/code/git-commit.txt")
        cd "$PROJECT_ROOT"
        git reset --hard "$TARGET_COMMIT" || {
            echo "Warning: Git reset failed, extracting code archive"
            rm -rf "$PROJECT_ROOT"/{src,backend,frontend,tests,scripts}
            cd "$PROJECT_ROOT"
            tar -xzf "$TEMP_DIR/$BACKUP_DIR/code/source.tar.gz"
        }
    fi
    
    echo "6. Restoring configuration..."
    if [ -d "$TEMP_DIR/$BACKUP_DIR/config" ]; then
        cp -f "$TEMP_DIR/$BACKUP_DIR/config"/.env* "$PROJECT_ROOT/" 2>/dev/null || true
        cp -f "$TEMP_DIR/$BACKUP_DIR/config"/*.json "$PROJECT_ROOT/" 2>/dev/null || true
    fi
    
    echo "7. Restoring migration status..."
    if [ -d "$TEMP_DIR/$BACKUP_DIR/migration" ]; then
        cp -f "$TEMP_DIR/$BACKUP_DIR/migration"/.migration-*.json "$PROJECT_ROOT/" 2>/dev/null || true
        cp -rf "$TEMP_DIR/$BACKUP_DIR/migration/migration-logs" "$PROJECT_ROOT/" 2>/dev/null || true
    fi
    
    echo "8. Reinstalling dependencies..."
    cd "$PROJECT_ROOT"
    npm install
    
    echo "9. Running post-rollback verification..."
    if [ -f "$PROJECT_ROOT/scripts/verify-system.sh" ]; then
        "$PROJECT_ROOT/scripts/verify-system.sh" || true
    fi
    
    rm -rf "$TEMP_DIR"
    
    echo ""
    echo "✅ Rollback completed successfully!"
    echo "   Restored to: $backup_file"
    echo ""
    echo "Please verify system functionality and run tests."
}

rollback_to_phase() {
    local target_phase="$1"
    local git_tag="migration-v2-phase-$target_phase"
    
    if ! git rev-parse "$git_tag" >/dev/null 2>&1; then
        git_tag="migration-phase-$target_phase"
        if ! git rev-parse "$git_tag" >/dev/null 2>&1; then
            echo "Error: Migration phase tag not found: $target_phase"
            echo "Available phase tags:"
            git tag -l "migration-*phase-*" | sort -V
            exit 1
        fi
    fi
    
    confirm_rollback "phase $target_phase (tag: $git_tag)"
    
    echo "=== Starting Rollback to Phase: $target_phase ==="
    
    echo "1. Creating current state backup..."
    "$SCRIPT_DIR/create-migration-backup.sh"
    
    echo "2. Finding phase backup..."
    PHASE_BACKUP=""
    if [ -f "$BACKUP_ROOT/index.json" ]; then
        PHASE_BACKUP=$(node -e "
        const index = JSON.parse(require('fs').readFileSync('$BACKUP_ROOT/index.json'));
        const backup = index.backups.find(b => b.migration_phase === $target_phase);
        if (backup) console.log(backup.filename);
        ")
    fi
    
    if [ ! -z "$PHASE_BACKUP" ] && [ -f "$BACKUP_ROOT/$PHASE_BACKUP" ]; then
        echo "Found phase backup: $PHASE_BACKUP"
        rollback_to_backup "$PHASE_BACKUP"
    else
        echo "No backup found for phase $target_phase, using git rollback..."
        
        echo "3. Stopping services..."
        if [ -f "$PROJECT_ROOT/scripts/stop-services.sh" ]; then
            "$PROJECT_ROOT/scripts/stop-services.sh" || true
        fi
        
        echo "4. Rolling back code to $git_tag..."
        cd "$PROJECT_ROOT"
        git reset --hard "$git_tag"
        
        echo "5. Resetting migration status..."
        cat > "$PROJECT_ROOT/.migration-status.json" << EOF
{
  "phase": $target_phase,
  "status": "rolled_back",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "rollbackFrom": $(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/.migration-status.json')).phase || 0)" 2>/dev/null || echo "0")
}
EOF
        
        echo "6. Reinstalling dependencies..."
        npm install
        
        echo "7. Running database migrations (if needed)..."
        if [ -f "$PROJECT_ROOT/migrations/rollback-to-phase-$target_phase.sql" ]; then
            source "$PROJECT_ROOT/.env"
            if [ ! -z "$DATABASE_URL" ]; then
                psql "$DATABASE_URL" < "$PROJECT_ROOT/migrations/rollback-to-phase-$target_phase.sql" 2>/dev/null || {
                    echo "Warning: Database rollback script not found or failed"
                }
            fi
        fi
        
        echo ""
        echo "✅ Rollback completed successfully!"
        echo "   Restored to phase: $target_phase"
        echo "   Git tag: $git_tag"
        echo ""
        echo "Please verify system functionality and run tests."
    fi
}

start_time=$(date +%s)

if [ ! -z "$BACKUP_NAME" ]; then
    rollback_to_backup "$BACKUP_NAME.tar.gz"
elif [ ! -z "$PHASE" ]; then
    rollback_to_phase "$PHASE"
fi

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "Rollback completed in $duration seconds"

exit 0