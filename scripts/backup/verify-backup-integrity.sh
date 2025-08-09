#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_ROOT="$PROJECT_ROOT/backups"

BACKUP_NAME=""
VERIFY_ALL=false
DEEP_CHECK=false

usage() {
    echo "Usage: $0 [OPTIONS] <backup-name>"
    echo ""
    echo "Options:"
    echo "  --all               Verify all backups"
    echo "  --deep              Perform deep integrity check (extract and verify contents)"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backup-20240315_120000"
    echo "  $0 --deep backup-20240315_120000"
    echo "  $0 --all"
    echo "  $0 --all --deep"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            VERIFY_ALL=true
            shift
            ;;
        --deep)
            DEEP_CHECK=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            BACKUP_NAME="$1"
            shift
            ;;
    esac
done

if [ "$VERIFY_ALL" != true ] && [ -z "$BACKUP_NAME" ]; then
    echo "Error: Backup name required (or use --all)"
    usage
fi

verify_backup() {
    local backup_file="$1"
    local backup_path="$BACKUP_ROOT/$backup_file"
    
    echo "=== Verifying Backup: $backup_file ==="
    
    local status="PASS"
    local errors=()
    
    echo -n "1. Checking file existence... "
    if [ ! -f "$backup_path" ]; then
        echo "FAIL"
        errors+=("Backup file not found: $backup_path")
        status="FAIL"
        echo ""
        echo "❌ Backup verification FAILED"
        echo "Errors:"
        printf '%s\n' "${errors[@]}"
        return 1
    fi
    echo "PASS"
    
    echo -n "2. Checking file integrity... "
    if ! tar -tzf "$backup_path" >/dev/null 2>&1; then
        echo "FAIL"
        errors+=("Backup archive is corrupted")
        status="FAIL"
    else
        echo "PASS"
    fi
    
    if [ "$DEEP_CHECK" = true ]; then
        echo "3. Performing deep integrity check..."
        
        TEMP_DIR=$(mktemp -d)
        cd "$TEMP_DIR"
        
        echo -n "   - Extracting archive... "
        if ! tar -xzf "$backup_path" 2>/dev/null; then
            echo "FAIL"
            errors+=("Failed to extract backup archive")
            status="FAIL"
        else
            echo "PASS"
            
            BACKUP_DIR=$(ls -d backup-* 2>/dev/null | head -1)
            if [ -z "$BACKUP_DIR" ]; then
                errors+=("Backup directory structure invalid")
                status="FAIL"
            else
                echo -n "   - Checking manifest.json... "
                if [ ! -f "$BACKUP_DIR/manifest.json" ]; then
                    echo "FAIL"
                    errors+=("manifest.json not found")
                    status="FAIL"
                else
                    if ! node -e "JSON.parse(require('fs').readFileSync('$BACKUP_DIR/manifest.json'))" 2>/dev/null; then
                        echo "FAIL"
                        errors+=("manifest.json is invalid JSON")
                        status="FAIL"
                    else
                        echo "PASS"
                    fi
                fi
                
                echo -n "   - Checking database backup... "
                if [ -d "$BACKUP_DIR/database" ]; then
                    if [ ! -f "$BACKUP_DIR/database/full_dump.sql" ] && [ ! -f "$BACKUP_DIR/database/schema_only.sql" ]; then
                        echo "WARN"
                        errors+=("No database backup files found (may be intentional)")
                    else
                        if [ -f "$BACKUP_DIR/database/full_dump.sql" ]; then
                            if ! head -n 10 "$BACKUP_DIR/database/full_dump.sql" | grep -q "PostgreSQL\|pg_dump"; then
                                echo "WARN"
                                errors+=("Database dump may be invalid")
                            else
                                echo "PASS"
                            fi
                        else
                            echo "PASS"
                        fi
                    fi
                else
                    echo "FAIL"
                    errors+=("Database backup directory missing")
                    status="FAIL"
                fi
                
                echo -n "   - Checking code backup... "
                if [ ! -f "$BACKUP_DIR/code/source.tar.gz" ]; then
                    echo "FAIL"
                    errors+=("Code archive not found")
                    status="FAIL"
                else
                    if ! tar -tzf "$BACKUP_DIR/code/source.tar.gz" >/dev/null 2>&1; then
                        echo "FAIL"
                        errors+=("Code archive is corrupted")
                        status="FAIL"
                    else
                        echo "PASS"
                    fi
                fi
                
                echo -n "   - Checking configuration backup... "
                if [ -d "$BACKUP_DIR/config" ]; then
                    if [ -z "$(ls -A $BACKUP_DIR/config 2>/dev/null)" ]; then
                        echo "WARN"
                        errors+=("No configuration files found (may be intentional)")
                    else
                        echo "PASS"
                    fi
                else
                    echo "FAIL"
                    errors+=("Configuration backup directory missing")
                    status="FAIL"
                fi
                
                echo -n "   - Checking migration status backup... "
                if [ -d "$BACKUP_DIR/migration" ]; then
                    if [ ! -f "$BACKUP_DIR/migration/.migration-status.json" ]; then
                        echo "WARN"
                        errors+=("Migration status file not found")
                    else
                        if ! node -e "JSON.parse(require('fs').readFileSync('$BACKUP_DIR/migration/.migration-status.json'))" 2>/dev/null; then
                            echo "FAIL"
                            errors+=("Migration status file is invalid JSON")
                            status="FAIL"
                        else
                            echo "PASS"
                        fi
                    fi
                else
                    echo "FAIL"
                    errors+=("Migration backup directory missing")
                    status="FAIL"
                fi
                
                echo -n "   - Verifying backup completeness... "
                local expected_dirs=("database" "code" "config" "migration")
                local missing_dirs=()
                for dir in "${expected_dirs[@]}"; do
                    if [ ! -d "$BACKUP_DIR/$dir" ]; then
                        missing_dirs+=("$dir")
                    fi
                done
                
                if [ ${#missing_dirs[@]} -eq 0 ]; then
                    echo "PASS"
                else
                    echo "FAIL"
                    errors+=("Missing directories: ${missing_dirs[*]}")
                    status="FAIL"
                fi
            fi
        fi
        
        rm -rf "$TEMP_DIR"
    fi
    
    echo -n "4. Checking backup size... "
    BACKUP_SIZE=$(du -h "$backup_path" | cut -f1)
    SIZE_BYTES=$(stat -f%z "$backup_path" 2>/dev/null || stat -c%s "$backup_path" 2>/dev/null || echo 0)
    
    if [ "$SIZE_BYTES" -lt 1024 ]; then
        echo "FAIL"
        errors+=("Backup suspiciously small: $BACKUP_SIZE")
        status="FAIL"
    else
        echo "PASS ($BACKUP_SIZE)"
    fi
    
    echo -n "5. Checking backup age... "
    if [[ "$backup_file" =~ backup-([0-9]{8}_[0-9]{6}) ]]; then
        BACKUP_DATE="${BASH_REMATCH[1]}"
        BACKUP_TIMESTAMP=$(echo "$BACKUP_DATE" | sed 's/_/ /')
        BACKUP_EPOCH=$(date -j -f "%Y%m%d %H%M%S" "$BACKUP_TIMESTAMP" +%s 2>/dev/null || date -d "${BACKUP_TIMESTAMP:0:8} ${BACKUP_TIMESTAMP:9}" +%s 2>/dev/null || echo 0)
        CURRENT_EPOCH=$(date +%s)
        AGE_DAYS=$(( (CURRENT_EPOCH - BACKUP_EPOCH) / 86400 ))
        
        if [ "$AGE_DAYS" -gt 30 ]; then
            echo "WARN (${AGE_DAYS} days old)"
            errors+=("Backup is older than 30 days")
        else
            echo "PASS (${AGE_DAYS} days old)"
        fi
    else
        echo "SKIP (cannot parse date)"
    fi
    
    echo ""
    if [ "$status" = "PASS" ]; then
        echo "✅ Backup verification PASSED"
        if [ ${#errors[@]} -gt 0 ]; then
            echo "Warnings:"
            printf '%s\n' "${errors[@]}"
        fi
        return 0
    else
        echo "❌ Backup verification FAILED"
        echo "Errors:"
        printf '%s\n' "${errors[@]}"
        return 1
    fi
}

generate_integrity_report() {
    local report_file="$BACKUP_ROOT/integrity-report-$(date +%Y%m%d_%H%M%S).txt"
    
    echo "=== Backup Integrity Report ===" > "$report_file"
    echo "Generated: $(date)" >> "$report_file"
    echo "" >> "$report_file"
    
    local total_backups=0
    local passed_backups=0
    local failed_backups=0
    
    for backup in "$BACKUP_ROOT"/backup-*.tar.gz; do
        if [ -f "$backup" ]; then
            backup_name=$(basename "$backup" .tar.gz)
            total_backups=$((total_backups + 1))
            
            echo "Backup: $backup_name" >> "$report_file"
            if verify_backup "$backup_name.tar.gz" >> "$report_file" 2>&1; then
                passed_backups=$((passed_backups + 1))
                echo "Status: PASSED" >> "$report_file"
            else
                failed_backups=$((failed_backups + 1))
                echo "Status: FAILED" >> "$report_file"
            fi
            echo "" >> "$report_file"
        fi
    done
    
    echo "=== Summary ===" >> "$report_file"
    echo "Total backups: $total_backups" >> "$report_file"
    echo "Passed: $passed_backups" >> "$report_file"
    echo "Failed: $failed_backups" >> "$report_file"
    echo "" >> "$report_file"
    
    echo ""
    echo "Integrity report saved to: $report_file"
    echo ""
    cat "$report_file" | tail -5
}

if [ "$VERIFY_ALL" = true ]; then
    echo "=== Verifying All Backups ==="
    echo ""
    
    if [ "$DEEP_CHECK" = true ]; then
        echo "Note: Deep check enabled - this may take several minutes..."
        echo ""
    fi
    
    generate_integrity_report
else
    if verify_backup "$BACKUP_NAME.tar.gz"; then
        exit 0
    else
        exit 1
    fi
fi