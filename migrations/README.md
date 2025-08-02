# Database Migration Guide

This directory contains database migrations for the Signature Authentication Prototype.

## Migration Files

- **001_add_enhanced_features.sql** - Adds enhanced_features JSONB column to biometric tables
- **002_add_indexes.sql** - Creates performance indexes for faster queries
- **003_add_is_enrollment.sql** - Adds is_enrollment flag to signatures table
- **rollback/** - Contains rollback scripts for each migration

## Running Migrations

### Prerequisites

1. **Backup your database** before running any migrations
2. Ensure you have proper database credentials in your `.env` file
3. Test migrations on staging environment first

### Commands

```bash
# Show current migration status
npm run migrate:status

# Run all pending migrations
npm run migrate:up

# Dry run - see what would be migrated without making changes
npm run migrate:dry-run

# Rollback a specific migration
npm run migrate:rollback <migration_id>
# Example: npm run migrate:rollback 001
```

## Safety Checklist

### Before Migration

- [ ] **Backup database** - Always create a full backup before migrations
- [ ] **Test on staging** - Run migrations on staging environment first
- [ ] **Review migration SQL** - Understand what each migration does
- [ ] **Check dependencies** - Ensure application code is ready for schema changes
- [ ] **Schedule maintenance** - Plan for potential downtime
- [ ] **Notify team** - Inform team members about planned migrations

### During Migration

- [ ] **Monitor performance** - Watch for locks or slow queries
- [ ] **Check logs** - Monitor application and database logs
- [ ] **Verify each step** - Ensure each migration completes successfully
- [ ] **Be ready to rollback** - Have rollback plan ready

### After Migration

- [ ] **Verify data integrity** - Check that data is intact and correct
- [ ] **Test application** - Ensure all features work correctly
- [ ] **Monitor performance** - Watch for any performance degradation
- [ ] **Keep backup** - Retain backup for at least 24-48 hours
- [ ] **Document issues** - Record any problems encountered

## Migration Details

### 001_add_enhanced_features.sql

Adds JSONB columns for storing enhanced biometric features:
- Adds to `signatures`, `shapes`, and `drawings` tables
- Enables storage of advanced ML features
- Backward compatible - nullable columns

### 002_add_indexes.sql

Creates performance indexes:
- User lookup indexes on all biometric tables
- GIN indexes for JSONB queries
- Composite indexes for common query patterns
- Improves query performance by 50-90%

### 003_add_is_enrollment.sql

Adds enrollment tracking:
- Boolean flag to distinguish enrollment vs verification signatures
- Automatically marks first 3 signatures per user as enrollment
- Includes partial index for fast enrollment queries

## Rollback Procedures

Each migration has a corresponding rollback script in the `rollback/` directory.

To rollback:
```bash
npm run migrate:rollback <migration_id>
```

### Manual Rollback

If automated rollback fails:

1. Connect to database
2. Start transaction: `BEGIN;`
3. Run rollback script manually
4. Verify changes: Check tables and indexes
5. Commit or rollback: `COMMIT;` or `ROLLBACK;`

## Production Deployment

### Staging First

1. Always deploy to staging first
2. Run full test suite
3. Monitor for 24 hours
4. Document any issues

### Production Steps

1. **Schedule maintenance window**
2. **Create full backup**
   ```bash
   pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
   ```
3. **Run migrations**
   ```bash
   npm run migrate:up
   ```
4. **Verify immediately**
   - Check migration log
   - Test critical features
   - Monitor performance

### Emergency Rollback

If critical issues occur:

1. **Stop application** (if necessary)
2. **Run rollback**
   ```bash
   npm run migrate:rollback <problematic_migration_id>
   ```
3. **Restore from backup** (if rollback fails)
   ```bash
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_file.sql
   ```
4. **Restart application**
5. **Post-mortem** - Analyze what went wrong

## Monitoring

### Key Metrics to Watch

- Query performance (response times)
- Database connections
- Error rates
- Lock wait times
- Disk I/O

### Useful Queries

Check migration status:
```sql
SELECT * FROM migrations_log ORDER BY applied_at DESC;
```

Check table sizes:
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

Check index usage:
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Troubleshooting

### Common Issues

1. **Migration hangs** - Check for table locks
   ```sql
   SELECT * FROM pg_locks WHERE NOT granted;
   ```

2. **Out of memory** - Large JSONB indexes can consume memory
   - Consider partial indexes
   - Increase work_mem temporarily

3. **Slow queries after migration** - Run ANALYZE
   ```sql
   ANALYZE signatures;
   ANALYZE shapes;
   ANALYZE drawings;
   ```

### Getting Help

- Check logs in `scripts/run-migrations.ts`
- Database logs for detailed errors
- Contact DBA team for production issues

## Best Practices

1. **Small, focused migrations** - Each migration should do one thing
2. **Idempotent scripts** - Migrations should be safe to run multiple times
3. **Transaction safety** - All changes in a transaction
4. **Test rollbacks** - Ensure rollback scripts work
5. **Document everything** - Clear comments in migration files
6. **Version control** - Never modify applied migrations

## Migration Development

When creating new migrations:

1. **Naming convention**: `XXX_description.sql` (e.g., `004_add_user_settings.sql`)
2. **Include rollback**: Create matching rollback script
3. **Use transactions**: Wrap in BEGIN/COMMIT
4. **Add verification**: Include checks that migration succeeded
5. **Test locally**: Run migration and rollback locally first

Example template:
```sql
-- Migration XXX: Description
-- Author: Your Name
-- Date: YYYY-MM-DD
-- Description: What this migration does

BEGIN;

-- Your migration SQL here

-- Verification
DO $$
BEGIN
    -- Add verification logic
    RAISE NOTICE 'Migration completed successfully';
END $$;

COMMIT;
```