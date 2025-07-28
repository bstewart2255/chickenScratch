-- Phase 1: Post-Migration Validation Queries
-- Purpose: Comprehensive validation to ensure migration success
-- Execute: Run all queries after migration to verify success

-- ============================================
-- SECTION 1: CORE VALIDATION
-- ============================================

-- 1.1 Primary Success Criteria - No base64 formats remaining
SELECT 
    'PRIMARY CHECK: Base64 formats remaining' as validation_name,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASSED - No base64 formats found'
        ELSE '✗ FAILED - Base64 formats still exist'
    END as status,
    'Critical' as severity
FROM shapes 
WHERE data_format = 'base64';

-- 1.2 Verify all migrated records have correct format
WITH migration_check AS (
    SELECT 
        COUNT(*) as migrated_count
    FROM shapes s
    JOIN backup_phase1_data_format.shapes_backup_20250128 b ON s.id = b.id
    WHERE s.data_format = 'stroke_data'
)
SELECT 
    'Migrated records format check' as validation_name,
    migrated_count,
    CASE 
        WHEN migrated_count = 115 THEN '✓ PASSED - All 115 records migrated'
        ELSE '✗ FAILED - Expected 115, found ' || migrated_count
    END as status,
    'Critical' as severity
FROM migration_check;

-- ============================================
-- SECTION 2: DATA INTEGRITY VALIDATION
-- ============================================

-- 2.1 Verify shape_data content unchanged
WITH data_integrity AS (
    SELECT 
        s.id,
        s.shape_data = b.shape_data as data_matches,
        LENGTH(s.shape_data::text) = LENGTH(b.shape_data::text) as length_matches
    FROM shapes s
    JOIN backup_phase1_data_format.shapes_backup_20250128 b ON s.id = b.id
)
SELECT 
    'Data integrity check' as validation_name,
    COUNT(*) as total_checked,
    COUNT(*) FILTER (WHERE data_matches) as data_preserved,
    COUNT(*) FILTER (WHERE NOT data_matches) as data_changed,
    CASE 
        WHEN COUNT(*) = COUNT(*) FILTER (WHERE data_matches) THEN '✓ PASSED - All data preserved'
        ELSE '✗ FAILED - Data corruption detected'
    END as status,
    'Critical' as severity
FROM data_integrity;

-- 2.2 Checksum comparison
WITH checksum_validation AS (
    SELECT 
        MD5(string_agg(id::text || COALESCE(shape_data::text, 'null') || data_format, ',' ORDER BY id)) as current_checksum,
        (SELECT MD5(string_agg(id::text || COALESCE(shape_data::text, 'null') || 'stroke_data', ',' ORDER BY id)) 
         FROM backup_phase1_data_format.shapes_backup_20250128) as expected_checksum
    FROM shapes
    WHERE id IN (SELECT id FROM backup_phase1_data_format.shapes_backup_20250128)
)
SELECT 
    'Checksum validation' as validation_name,
    CASE 
        WHEN current_checksum = expected_checksum THEN '✓ PASSED - Checksums match'
        ELSE '✗ FAILED - Checksum mismatch'
    END as status,
    'High' as severity,
    current_checksum,
    expected_checksum
FROM checksum_validation;

-- ============================================
-- SECTION 3: FUNCTIONAL VALIDATION
-- ============================================

-- 3.1 Verify all shapes still have valid stroke data
SELECT 
    'Stroke data validation' as validation_name,
    COUNT(*) as total_stroke_data_shapes,
    COUNT(*) FILTER (WHERE shape_data::jsonb ? 'raw') as has_raw_key,
    COUNT(*) FILTER (WHERE jsonb_array_length((shape_data::jsonb->'raw')::jsonb) > 0) as has_strokes,
    CASE 
        WHEN COUNT(*) = COUNT(*) FILTER (WHERE shape_data::jsonb ? 'raw') THEN '✓ PASSED - All shapes have raw data'
        ELSE '✗ FAILED - Missing raw data'
    END as status,
    'High' as severity
FROM shapes
WHERE data_format = 'stroke_data'
    AND id IN (SELECT id FROM backup_phase1_data_format.shapes_backup_20250128);

-- 3.2 Authentication attempts still linked correctly
WITH auth_validation AS (
    SELECT 
        COUNT(DISTINCT aa.id) as auth_attempts,
        COUNT(DISTINCT s.id) as linked_shapes,
        COUNT(*) FILTER (WHERE s.data_format = 'stroke_data') as correct_format_count
    FROM authentication_attempts aa
    JOIN shapes s ON aa.shape_id = s.id
    WHERE s.id IN (SELECT id FROM backup_phase1_data_format.shapes_backup_20250128)
)
SELECT 
    'Authentication linkage check' as validation_name,
    auth_attempts,
    linked_shapes,
    CASE 
        WHEN correct_format_count = linked_shapes THEN '✓ PASSED - All linked shapes have correct format'
        ELSE '✗ FAILED - Format mismatch in linked shapes'
    END as status,
    'Medium' as severity
FROM auth_validation;

-- ============================================
-- SECTION 4: PERFORMANCE VALIDATION
-- ============================================

-- 4.1 Check for any table bloat or fragmentation
SELECT 
    'Table statistics' as validation_name,
    pg_size_pretty(pg_relation_size('shapes')) as table_size,
    (SELECT COUNT(*) FROM shapes) as total_rows,
    (SELECT COUNT(*) FROM shapes WHERE data_format = 'stroke_data') as stroke_data_rows,
    'Info' as severity;

-- 4.2 Verify indexes are still valid
SELECT 
    'Index health check' as validation_name,
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
    'Info' as severity
FROM pg_indexes
WHERE tablename = 'shapes'
ORDER BY indexname;

-- ============================================
-- SECTION 5: AUDIT TRAIL VALIDATION
-- ============================================

-- 5.1 Verify updated_at timestamps were set
WITH timestamp_check AS (
    SELECT 
        COUNT(*) as total_migrated,
        COUNT(*) FILTER (WHERE s.updated_at > b.backup_timestamp) as recently_updated
    FROM shapes s
    JOIN backup_phase1_data_format.shapes_backup_20250128 b ON s.id = b.id
)
SELECT 
    'Timestamp update check' as validation_name,
    total_migrated,
    recently_updated,
    CASE 
        WHEN total_migrated = recently_updated THEN '✓ PASSED - All timestamps updated'
        ELSE '✗ WARNING - Some timestamps not updated'
    END as status,
    'Low' as severity
FROM timestamp_check;

-- 5.2 Migration log review
SELECT 
    'Migration log summary' as validation_name,
    COUNT(*) as total_log_entries,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_operations,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_operations,
    MAX(affected_records) as largest_batch,
    CASE 
        WHEN COUNT(*) FILTER (WHERE status = 'failed') = 0 THEN '✓ PASSED - No failures logged'
        ELSE '✗ FAILED - Errors found in log'
    END as status,
    'High' as severity
FROM backup_phase1_data_format.migration_log
WHERE migration_phase = 'phase1_data_format';

-- ============================================
-- SECTION 6: COMPREHENSIVE SUMMARY
-- ============================================

WITH summary_data AS (
    SELECT 
        (SELECT COUNT(*) FROM shapes WHERE data_format = 'base64') as remaining_base64,
        (SELECT COUNT(*) FROM shapes WHERE data_format = 'stroke_data' 
         AND id IN (SELECT id FROM backup_phase1_data_format.shapes_backup_20250128)) as migrated_count,
        (SELECT COUNT(*) FROM backup_phase1_data_format.shapes_backup_20250128) as expected_count,
        (SELECT MAX(executed_at) - MIN(executed_at) 
         FROM backup_phase1_data_format.migration_log 
         WHERE migration_phase = 'phase1_data_format') as migration_duration
)
SELECT 
    'FINAL VALIDATION SUMMARY' as report_type,
    json_build_object(
        'migration_status', CASE 
            WHEN remaining_base64 = 0 AND migrated_count = expected_count THEN 'SUCCESS'
            ELSE 'FAILED'
        END,
        'remaining_base64_records', remaining_base64,
        'successfully_migrated', migrated_count,
        'expected_migrations', expected_count,
        'migration_duration', migration_duration,
        'validation_timestamp', NOW(),
        'all_checks_passed', remaining_base64 = 0 AND migrated_count = expected_count,
        'next_steps', CASE 
            WHEN remaining_base64 = 0 AND migrated_count = expected_count 
            THEN 'Migration successful. Proceed with application testing.'
            ELSE 'Migration issues detected. Review logs and consider rollback.'
        END
    ) as summary
FROM summary_data;

-- ============================================
-- RECOMMENDED ACTIONS
-- ============================================
-- If all validations pass:
-- 1. Run application integration tests
-- 2. Monitor application logs for 24 hours
-- 3. Backup the successfully migrated state
-- 4. Proceed to Phase 2 after stability confirmed

-- If any validation fails:
-- 1. Review detailed error logs
-- 2. Consider executing rollback procedure
-- 3. Investigate root cause before retry
-- 4. Contact DBA team if needed