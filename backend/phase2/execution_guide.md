# Phase 2: Shape Metrics Standardization - Execution Guide

## Overview
This guide provides step-by-step instructions for executing the Phase 2 shape metrics standardization to achieve 99%+ success rate matching signature processing.

## Prerequisites

1. **Database Access**: Ensure you have PostgreSQL connection credentials
2. **Node.js Environment**: Node.js 14+ installed
3. **Dependencies**: Run `npm install` in the backend directory
4. **Environment Variables**: Ensure `.env` file contains:
   ```
   DATABASE_URL=your_database_connection_string
   ```

## Pre-Execution Checklist

- [ ] Database backup completed
- [ ] All code files reviewed and in place
- [ ] Environment variables configured
- [ ] Team notified of maintenance window
- [ ] Monitoring tools ready

## Step-by-Step Execution

### Step 1: Pre-Validation (5 minutes)

1. Connect to your database:
   ```bash
   psql $DATABASE_URL
   ```

2. Run pre-validation queries to understand current state:
   ```bash
   psql $DATABASE_URL < backend/phase2/pre_validation_queries.sql > pre_validation_report.txt
   ```

3. Review the output and confirm:
   - Number of shapes needing processing
   - No critical data issues (NULL shape_data)
   - Estimated processing time

**Expected Output:**
```
PRE-FLIGHT CHECK | PASS: Ready for processing | 115 shapes_to_process
```

### Step 2: Create Backup (2 minutes)

Always create a backup before processing:

```sql
-- Run in psql
CREATE TABLE shapes_metrics_backup_phase2_$(date +%Y%m%d_%H%M%S) AS
SELECT id, user_id, shape_type, metrics, updated_at, CURRENT_TIMESTAMP as backup_timestamp
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle');
```

### Step 3: Test Run - Dry Run Mode (5 minutes)

First, test the script in dry-run mode:

```bash
cd backend/phase2
DRY_RUN=true BATCH_SIZE=5 node batch_processing_script.js
```

**Expected Output:**
```
✅ Starting Phase 2: Shape Metrics Standardization
✅ Found 115 shapes needing metrics calculation
⚠️ DRY RUN MODE - No changes will be saved to database
✅ Batch 1: Processing 5 shapes...
```

### Step 4: Production Run (10-15 minutes)

Execute the actual processing:

```bash
# Default settings (recommended)
node batch_processing_script.js

# Or with custom settings
BATCH_SIZE=20 BATCH_DELAY_MS=100 VERBOSE=true node batch_processing_script.js
```

**Monitor Progress:**
- Watch for error messages
- Check success rate in output
- Monitor database performance

**Expected Output Pattern:**
```
[2024-01-20T10:30:00.000Z] ✅ Starting Phase 2: Shape Metrics Standardization
[2024-01-20T10:30:01.000Z] ✅ Found 115 shapes needing metrics calculation
[2024-01-20T10:30:01.000Z] ✅ Batch 1: Processing 20 shapes...
[2024-01-20T10:30:03.000Z] ✅ Batch completed in 2000ms - Success: 20, Failed: 0
[2024-01-20T10:30:03.000Z] ✅ Progress: 20/115 (17.4%)
```

### Step 5: Real-Time Monitoring (During Processing)

In a separate terminal, monitor progress:

```bash
# Watch processing progress
watch -n 5 "psql $DATABASE_URL -c 'SELECT processed, remaining, progress_percent FROM (<first query from performance_monitoring.sql>)'"

# Check for errors
psql $DATABASE_URL -c "SELECT failure_reason, COUNT(*) FROM (<failed shapes query>) GROUP BY failure_reason"
```

### Step 6: Post-Validation (5 minutes)

After processing completes:

```bash
psql $DATABASE_URL < backend/phase2/post_validation_queries.sql > post_validation_report.txt
```

**Success Criteria:**
- Shape success rate ≥ 99%
- All required metrics fields populated
- No unexpected NULL values

**Expected Output:**
```
PHASE 2 COMPLETION SUMMARY | 115 | 114 | 1 | 99.13 | ✅ TARGET ACHIEVED (≥99%)
```

### Step 7: Performance Review

Check processing performance:

```bash
psql $DATABASE_URL -c "SELECT * FROM (<dashboard query from performance_monitoring.sql>)"
```

## Troubleshooting Guide

### Issue: Low Success Rate (<99%)

1. Check for specific error patterns:
   ```sql
   SELECT failure_reason, COUNT(*), array_agg(id LIMIT 5) 
   FROM (<failed analysis query>)
   GROUP BY failure_reason;
   ```

2. Common issues and fixes:
   - **"Unable to extract stroke data"**: Check shape_data format
   - **"Invalid coordinates"**: Look for non-numeric values
   - **"Validation failed"**: Review metric ranges

### Issue: Slow Processing

1. Check batch performance:
   ```sql
   SELECT batch_number, shapes_in_batch, shapes_per_second
   FROM (<batch analysis query>)
   ORDER BY shapes_per_second LIMIT 10;
   ```

2. Adjust settings:
   ```bash
   # Smaller batches for better responsiveness
   BATCH_SIZE=10 BATCH_DELAY_MS=50 node batch_processing_script.js
   ```

### Issue: Database Performance Impact

1. Check active connections:
   ```sql
   SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;
   ```

2. If needed, pause processing:
   - Press `Ctrl+C` to gracefully stop
   - Script will show progress before exiting

## Rollback Procedures

If issues are discovered after processing:

### Quick Rollback (All Shapes)

```sql
BEGIN;

-- Verify what will be rolled back
SELECT COUNT(*) FROM shapes s
INNER JOIN shapes_metrics_backup_phase2 b ON s.id = b.id
WHERE s.metrics->>'_processed_at' IS NOT NULL;

-- Perform rollback
UPDATE shapes s
SET metrics = b.metrics, updated_at = CURRENT_TIMESTAMP
FROM shapes_metrics_backup_phase2 b
WHERE s.id = b.id AND s.shape_type IN ('circle', 'square', 'triangle');

-- Verify and commit
COMMIT;
```

### Selective Rollback

For specific shapes or conditions, see `rollback_procedures.sql`.

## Post-Execution Tasks

1. **Verify Authentication Still Works**:
   ```bash
   # Test a few authentication attempts
   curl -X POST $API_URL/api/authenticate -d '{"username":"testuser"}'
   ```

2. **Update Documentation**:
   - Record processing time
   - Note any issues encountered
   - Update runbook with learnings

3. **Clean Up**:
   ```bash
   # After confirming success (wait 24-48 hours)
   psql $DATABASE_URL -c "DROP TABLE IF EXISTS shapes_metrics_backup_phase2"
   ```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| BATCH_SIZE | 20 | Number of shapes per batch |
| BATCH_DELAY_MS | 100 | Milliseconds between batches |
| MAX_RETRIES | 3 | Retry attempts for failed shapes |
| DRY_RUN | false | Test mode without database changes |
| VERBOSE | true | Detailed logging output |
| TARGET_SHAPES_ONLY | true | Process only circle, square, triangle |

## Success Metrics

Target outcomes:
- ✅ 99%+ shapes with complete metrics
- ✅ All 5 required fields populated (center_x, center_y, total_points, stroke_count, avg_speed)
- ✅ Processing time <15 minutes for ~115 shapes
- ✅ No authentication disruption
- ✅ Metrics precision matches signatures

## Contact for Issues

If you encounter critical issues:
1. Stop the script immediately (Ctrl+C)
2. Run diagnostics from performance_monitoring.sql
3. Check error logs
4. If needed, execute rollback procedures
5. Document the issue for team review

## Final Verification

After successful completion:
```bash
# Generate final report
echo "=== Phase 2 Completion Report ===" > phase2_report.txt
echo "Date: $(date)" >> phase2_report.txt
psql $DATABASE_URL -c "SELECT * FROM (<final summary query>)" >> phase2_report.txt
```

---

**Remember**: Always prioritize data integrity over processing speed. It's better to process slowly and correctly than to rush and corrupt data.