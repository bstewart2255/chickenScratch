# Phase 1: Data Format Fix - Execution Checklist

## Overview
This checklist ensures safe and successful migration of 115 shape records from incorrect 'base64' format to correct 'stroke_data' format.

**Expected Duration**: 2-4 hours including validation  
**Risk Level**: Low-Medium  
**Rollback Available**: Yes

---

## Pre-Execution Requirements

### Team & Resources
- [ ] DBA assigned and available
- [ ] Backend developer on standby
- [ ] QA engineer ready for post-migration testing
- [ ] Stakeholders notified of maintenance window

### Environment Preparation
- [ ] Staging environment available with production-like data
- [ ] Database backup tools verified and working
- [ ] Monitoring dashboards accessible
- [ ] Communication channels (Slack/Teams) ready

### Access Verification
- [ ] Database write access confirmed
- [ ] Backup location accessible with sufficient space
- [ ] Application can be put in maintenance mode

---

## Stage 1: Pre-Migration Validation (15 minutes)

### Execute Validation Script
```bash
psql -h [hostname] -d [database] -U [username] -f 01_pre_migration_validation.sql > pre_migration_results.log
```

### Validation Checkpoints
- [ ] Confirm exactly 115 records with data_format = 'base64'
- [ ] Verify all 115 records have shape_data->>'raw' key
- [ ] No records with data_format = 'base64' lack the 'raw' key
- [ ] Review sample records - data looks correct
- [ ] No NULL shape_data in affected records
- [ ] Authentication attempts linkage documented
- [ ] Checksum recorded: ________________________

### Go/No-Go Decision Point 1
- [ ] All validation checks passed
- [ ] Team agrees to proceed
- [ ] Document any deviations: ________________________

---

## Stage 2: Backup Creation (20 minutes)

### Execute Backup Procedure
```bash
psql -h [hostname] -d [database] -U [username] -f 02_backup_procedure.sql > backup_results.log
```

### Backup Verification
- [ ] Backup schema created successfully
- [ ] 115 records backed up to shapes_backup_20250128
- [ ] Authentication attempts backed up
- [ ] Metrics data backed up (if applicable)
- [ ] Backup checksum matches original data checksum
- [ ] Recovery script generated and saved
- [ ] Backup metadata recorded

### Full Database Backup
- [ ] Initiate full database backup (parallel to table backup)
- [ ] Backup location: ________________________
- [ ] Backup size verified: ________ GB
- [ ] Backup completion confirmed

### Go/No-Go Decision Point 2
- [ ] All backups completed successfully
- [ ] Checksums verified
- [ ] Recovery plan documented
- [ ] Team agrees to proceed

---

## Stage 3: Migration Execution (30-45 minutes)

### Pre-Migration Steps
- [ ] Application put in maintenance mode
- [ ] Active connections monitored
- [ ] Database performance baseline recorded

### Execute Migration
```bash
# Monitor in separate terminal
watch -n 5 "psql -h [hostname] -d [database] -U [username] -c 'SELECT COUNT(*) FROM shapes WHERE data_format = \"base64\"'"

# Execute migration
psql -h [hostname] -d [database] -U [username] -f 03_migration_script.sql > migration_results.log
```

### Migration Monitoring
- [ ] Batch updates progressing (check every 5 minutes)
- [ ] No error messages in logs
- [ ] Database CPU < 80%
- [ ] Database I/O normal
- [ ] Lock contention minimal
- [ ] Migration completed message received

### Initial Verification
- [ ] Query shows 0 records with data_format = 'base64'
- [ ] Migration log shows 115 records updated
- [ ] No failed operations in migration log

---

## Stage 4: Post-Migration Validation (20 minutes)

### Execute Validation Queries
```bash
psql -h [hostname] -d [database] -U [username] -f 04_post_migration_validation.sql > post_migration_results.log
```

### Critical Validations
- [ ] PRIMARY CHECK: 0 base64 formats remaining - **MUST PASS**
- [ ] All 115 records now have data_format = 'stroke_data'
- [ ] Data integrity check - all shape_data unchanged
- [ ] Checksum validation passed
- [ ] All shapes still have 'raw' key in shape_data
- [ ] Authentication linkages intact
- [ ] Timestamps updated appropriately

### Performance Validation
- [ ] Query performance normal
- [ ] No table bloat detected
- [ ] Indexes still valid and used
- [ ] Database performance metrics normal

### Go/No-Go Decision Point 3
- [ ] All critical validations passed
- [ ] No data corruption detected
- [ ] Performance acceptable
- [ ] Team agrees migration successful

---

## Stage 5: Application Testing (30 minutes)

### Functional Testing
- [ ] Application removed from maintenance mode
- [ ] Test shape creation workflow
- [ ] Test shape authentication
- [ ] Verify shape data display correct
- [ ] Test signature comparison with shapes
- [ ] Check ML model processing shapes correctly

### Integration Testing
- [ ] API endpoints responding normally
- [ ] No errors in application logs
- [ ] Database connection pool stable
- [ ] Background jobs processing normally

### User Acceptance
- [ ] QA team validates critical workflows
- [ ] No user-reported issues
- [ ] Performance meets SLA requirements

---

## Stage 6: Final Verification & Closeout (15 minutes)

### Final Checks
- [ ] Re-run validation queries - all passing
- [ ] Application fully functional
- [ ] No errors in logs (last 30 minutes)
- [ ] Team consensus: migration successful

### Documentation
- [ ] Migration results documented
- [ ] Lessons learned captured
- [ ] Runbook updated if needed
- [ ] Stakeholders notified of completion

### Backup Retention
- [ ] Backup retention period set (30 days)
- [ ] Calendar reminder for backup cleanup
- [ ] Backup location documented

---

## Emergency Rollback Procedure

**Only execute if critical issues discovered**

### Rollback Decision Criteria
- [ ] Data corruption detected
- [ ] Application failures affecting users
- [ ] Performance degradation > 50%
- [ ] Team consensus to rollback

### Execute Rollback
```bash
psql -h [hostname] -d [database] -U [username] -f 05_rollback_script.sql > rollback_results.log
```

### Post-Rollback
- [ ] Verify 115 records restored to base64
- [ ] Application functionality restored
- [ ] Incident report created
- [ ] Root cause analysis scheduled

---

## Success Criteria Summary

✅ **Migration is successful when:**
1. 0 shapes with data_format = 'base64'
2. All 115 affected records now show data_format = 'stroke_data'
3. No data loss or corruption
4. Application fully functional
5. Performance unchanged or improved
6. All validations passed

---

## Contact Information

**Primary DBA**: ________________________  
**Backup DBA**: ________________________  
**Dev Lead**: ________________________  
**QA Lead**: ________________________  
**Escalation**: ________________________

---

## Notes Section

**Pre-Migration Notes**:
_________________________________
_________________________________

**Issues Encountered**:
_________________________________
_________________________________

**Post-Migration Notes**:
_________________________________
_________________________________

**Sign-off**:
- DBA: _________________ Date: _______
- Dev: _________________ Date: _______
- QA: __________________ Date: _______