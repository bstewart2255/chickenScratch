# Rollback Procedures

## Overview
This document outlines the procedures for backing up the system and rolling back to previous states during the TypeScript migration.

## Quick Reference

### Create a Backup
```bash
./scripts/backup/create-migration-backup.sh
```

### List Available Rollback Points
```bash
./scripts/backup/rollback-to-phase.sh --list
```

### Rollback to Specific Backup
```bash
./scripts/backup/rollback-to-phase.sh --backup backup-20240315_120000
```

### Rollback to Migration Phase
```bash
./scripts/backup/rollback-to-phase.sh --phase 10
```

### Verify Backup Integrity
```bash
./scripts/backup/verify-backup-integrity.sh backup-20240315_120000
./scripts/backup/verify-backup-integrity.sh --deep backup-20240315_120000
./scripts/backup/verify-backup-integrity.sh --all
```

## Backup System

### What Gets Backed Up
1. **Database**: Full database dump and schema-only backup
2. **Code**: Complete source code archive via git
3. **Configuration**: All .env files and config overrides
4. **Migration Status**: Migration tracking files and logs

### Backup Storage
- Local storage in `backups/` directory
- Compressed tar.gz archives
- 30-day retention policy (automatic cleanup)
- Each backup includes manifest with metadata

### Backup Schedule
- Manual backups before major changes
- Automatic backup before each rollback
- Recommended: Daily backups during active migration

## Rollback Procedures

### Pre-Rollback Checklist
1. ✓ Notify team of planned rollback
2. ✓ Stop all running services
3. ✓ Create current state backup
4. ✓ Verify target rollback point exists
5. ✓ Review rollback impact

### Rollback Process
1. System automatically creates backup of current state
2. Services are stopped
3. Database is restored (if backup includes DB)
4. Code is reset to target commit
5. Configuration files are restored
6. Migration status is updated
7. Dependencies are reinstalled
8. System verification runs

### Post-Rollback Verification
```bash
# Run system verification
./scripts/verify-system.sh

# Run tests
npm test

# Check migration status
node scripts/show-migration-status.js

# Start services and verify functionality
npm start
```

## Emergency Procedures

### Critical Failure Rollback
If the system is completely broken:

1. **Immediate Rollback to Last Known Good**
   ```bash
   ./scripts/backup/rollback-to-phase.sh --phase 0 --force
   ```

2. **Manual Database Restore**
   ```bash
   psql $DATABASE_URL < backups/backup-YYYYMMDD_HHMMSS/database/full_dump.sql
   ```

3. **Git Hard Reset**
   ```bash
   git reset --hard migration-v2-start
   npm install
   ```

### Rollback Decision Tree
```
System Issue Detected
├─ Is it a TypeScript error?
│  ├─ Yes → Rollback to previous phase
│  └─ No → Continue to next check
├─ Is it a runtime error?
│  ├─ Yes → Check if configuration related
│  │  ├─ Yes → Restore config files only
│  │  └─ No → Full rollback to last working phase
│  └─ No → Continue to next check
└─ Is it a database issue?
   ├─ Yes → Restore database backup only
   └─ No → Investigate further before rollback
```

## Phase-Specific Rollback Notes

### Phase 1-4: Setup Phases
- Minimal impact rollback
- No database changes
- Simple git reset sufficient

### Phase 5-8: Core Migration
- May require dependency reinstall
- Check for configuration changes
- Verify TypeScript setup

### Phase 9-10: Service Migration
- Database schema may have changed
- API contracts should be verified
- Frontend state management check

### Phase 11-14: Testing & Deployment
- CI/CD configuration may need reset
- Test coverage thresholds may change
- Monitoring scripts may need adjustment

## Rollback Time Estimates
- Git reset only: < 1 minute
- Full rollback with DB: 3-5 minutes
- Complete system restore: 5-10 minutes
- Emergency recovery: 10-15 minutes

## Common Issues and Solutions

### Issue: Backup Creation Fails
**Solution**: Check disk space, permissions, and database connectivity

### Issue: Rollback Hangs
**Solution**: Kill process, manually restore from backup archive

### Issue: Database Restore Fails
**Solution**: Use schema-only restore, then migrate data manually

### Issue: Dependencies Won't Install
**Solution**: Clear npm cache, delete node_modules, retry

## Contact Information
- Migration Lead: [Contact Info]
- Database Admin: [Contact Info]
- DevOps Team: [Contact Info]
- Emergency Hotline: [Phone Number]

## Backup File Structure
```
backup-YYYYMMDD_HHMMSS/
├── database/
│   ├── full_dump.sql
│   └── schema_only.sql
├── code/
│   ├── source.tar.gz
│   └── git-commit.txt
├── config/
│   ├── .env.backup
│   └── *.json
├── migration/
│   ├── .migration-status.json
│   └── .migration-validation.json
└── manifest.json
```

## Retention Policy
- Keep all backups for 30 days
- Archive phase completion backups permanently
- Store pre-migration backup indefinitely
- Emergency backups kept for 90 days

## Testing Rollback Procedures
Run these tests periodically:
1. Create test backup
2. Make harmless change
3. Rollback to test backup
4. Verify system restored correctly
5. Document any issues

## Audit Trail
All rollback operations are logged with:
- Timestamp
- Operator
- Source state
- Target state
- Duration
- Success/failure status

---
Last Updated: 2025-08-01
Version: 1.0