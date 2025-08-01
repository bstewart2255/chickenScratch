#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_ROOT="$PROJECT_ROOT/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/backup-$TIMESTAMP"

echo "=== Migration Backup Creation Script ==="
echo "Creating backup at: $BACKUP_DIR"

mkdir -p "$BACKUP_DIR"/{database,code,config,migration}

echo "1. Backing up database..."
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
    
    if [ ! -z "$DATABASE_URL" ]; then
        DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
        
        PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            > "$BACKUP_DIR/database/full_dump.sql" 2>/dev/null || {
            echo "Warning: Database backup skipped (pg_dump not available or database not accessible)"
        }
        
        PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --schema-only > "$BACKUP_DIR/database/schema_only.sql" 2>/dev/null || {
            echo "Warning: Schema backup skipped"
        }
    else
        echo "Warning: DATABASE_URL not found, skipping database backup"
    fi
else
    echo "Warning: .env file not found, skipping database backup"
fi

echo "2. Backing up code..."
cd "$PROJECT_ROOT"
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "no-git")
echo "$CURRENT_COMMIT" > "$BACKUP_DIR/code/git-commit.txt"

git archive --format=tar.gz -o "$BACKUP_DIR/code/source.tar.gz" HEAD 2>/dev/null || {
    echo "Warning: Git archive failed, using tar instead"
    tar -czf "$BACKUP_DIR/code/source.tar.gz" \
        --exclude=node_modules \
        --exclude=dist \
        --exclude=backups \
        --exclude=.git \
        .
}

echo "3. Backing up configuration..."
if [ -f "$PROJECT_ROOT/.env" ]; then
    cp "$PROJECT_ROOT/.env" "$BACKUP_DIR/config/.env.backup"
fi

if [ -f "$PROJECT_ROOT/config-overrides.json" ]; then
    cp "$PROJECT_ROOT/config-overrides.json" "$BACKUP_DIR/config/"
fi

for env_file in "$PROJECT_ROOT"/.env.*; do
    if [ -f "$env_file" ]; then
        filename=$(basename "$env_file")
        cp "$env_file" "$BACKUP_DIR/config/$filename.backup"
    fi
done

echo "4. Backing up migration status..."
if [ -f "$PROJECT_ROOT/.migration-status.json" ]; then
    cp "$PROJECT_ROOT/.migration-status.json" "$BACKUP_DIR/migration/"
fi

if [ -f "$PROJECT_ROOT/.migration-validation.json" ]; then
    cp "$PROJECT_ROOT/.migration-validation.json" "$BACKUP_DIR/migration/"
fi

if [ -d "$PROJECT_ROOT/migration-logs" ]; then
    cp -r "$PROJECT_ROOT/migration-logs" "$BACKUP_DIR/migration/"
fi

echo "5. Creating backup manifest..."
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_commit": "$CURRENT_COMMIT",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "migration_phase": $(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/.migration-status.json')).currentPhase || 0)" 2>/dev/null || echo "0"),
  "node_version": "$(node --version)",
  "npm_version": "$(npm --version)",
  "backup_size": "0",
  "files": {
    "database": $(ls -la "$BACKUP_DIR/database/" 2>/dev/null | grep -c "\.sql$" || echo "0"),
    "code": $([ -f "$BACKUP_DIR/code/source.tar.gz" ] && echo "1" || echo "0"),
    "config": $(find "$BACKUP_DIR/config/" -type f \( -name "*.backup" -o -name "*.json" \) 2>/dev/null | wc -l | tr -d ' ' || echo "0"),
    "migration": $(ls -la "$BACKUP_DIR/migration/" 2>/dev/null | grep -c "\.json$" || echo "0")
  }
}
EOF

echo "6. Compressing backup..."
cd "$BACKUP_ROOT"
tar -czf "backup-$TIMESTAMP.tar.gz" "backup-$TIMESTAMP"
BACKUP_SIZE=$(du -h "backup-$TIMESTAMP.tar.gz" | cut -f1)

cd "$PROJECT_ROOT"
node -e "
const fs = require('fs');
const manifestPath = '$BACKUP_DIR/manifest.json';
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.backup_size = '$BACKUP_SIZE';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
} catch (e) {
  console.error('Failed to update manifest size');
}
" || true

echo "7. Creating backup index..."
if [ ! -f "$BACKUP_ROOT/index.json" ]; then
cat > "$BACKUP_ROOT/index.json" << EOF
{
  "backups": []
}
EOF
fi

node "$SCRIPT_DIR/update-backup-index.js" "$BACKUP_ROOT" "$TIMESTAMP" || echo "Warning: Failed to update backup index"

echo ""
echo "✅ Backup completed successfully!"
echo "   Location: $BACKUP_DIR"
echo "   Archive: $BACKUP_ROOT/backup-$TIMESTAMP.tar.gz"
echo "   Size: $BACKUP_SIZE"
echo ""
echo "To verify this backup, run:"
echo "  ./scripts/backup/verify-backup-integrity.sh backup-$TIMESTAMP"
echo ""
echo "To rollback to this backup, run:"
echo "  ./scripts/backup/rollback-to-phase.sh --backup backup-$TIMESTAMP"

if [ -d "$BACKUP_DIR" ]; then
    rm -rf "$BACKUP_DIR"
fi

exit 0