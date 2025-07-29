-- Phase 1: Emergency Rollback Script
-- Purpose: Restore original data state if migration fails
-- WARNING: Only execute if migration validation fails and rollback is necessary

-- ============================================
-- ROLLBACK SAFETY CHECKS
-- ============================================

DO $$
DECLARE
    v_backup_exists BOOLEAN;
    v_backup_count INTEGER;
    v_current_base64_count INTEGER;
    v_user_confirmation TEXT;
BEGIN
    -- Check 1: Verify backup exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'backup_phase1_data_format' 
        AND table_name = 'shapes_backup_20250128'
    ) INTO v_backup_exists;
    
    IF NOT v_backup_exists THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: Backup table not found. Cannot proceed without backup data.';
    END IF;
    
    -- Check 2: Count backup records
    SELECT COUNT(*) INTO v_backup_count
    FROM backup_phase1_data_format.shapes_backup_20250128;
    
    IF v_backup_count = 0 THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: Backup table is empty. Cannot proceed.';
    END IF;
    
    -- Check 3: Current state assessment
    SELECT COUNT(*) INTO v_current_base64_count
    FROM shapes WHERE data_format = 'base64';
    
    -- Display rollback impact
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ROLLBACK IMPACT ASSESSMENT';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Records to be restored: %', v_backup_count;
    RAISE NOTICE 'Current base64 records: %', v_current_base64_count;
    RAISE NOTICE 'This will restore data_format to base64 for all backed up records';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: This action will undo all migration changes!';
    RAISE NOTICE '========================================';
    
    -- Note: In production, implement a confirmation mechanism here
    -- For safety, we'll add a deliberate pause
    PERFORM pg_sleep(5);
    
END $$;

-- ============================================
-- ROLLBACK EXECUTION
-- ============================================

-- Create rollback log table
CREATE TABLE IF NOT EXISTS backup_phase1_data_format.rollback_log (
    log_id SERIAL PRIMARY KEY,
    rollback_phase VARCHAR(50),
    operation VARCHAR(100),
    affected_records INTEGER,
    status VARCHAR(20),
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT NOW(),
    executed_by VARCHAR(255) DEFAULT current_user
);

-- Log rollback start
INSERT INTO backup_phase1_data_format.rollback_log 
(rollback_phase, operation, status)
VALUES ('phase1_data_format_rollback', 'rollback_start', 'started');

-- Main rollback procedure
DO $$
DECLARE
    v_rollback_count INTEGER := 0;
    v_batch_count INTEGER := 0;
    v_batch_size INTEGER := 1000;
    v_start_time TIMESTAMP;
    v_record RECORD;
    v_error_count INTEGER := 0;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Process each backed up record
    FOR v_record IN 
        SELECT 
            b.id,
            b.data_format,
            b.shape_data,
            b.metrics,
            b.created_at,
            b.updated_at
        FROM backup_phase1_data_format.shapes_backup_20250128 b
        ORDER BY b.id
    LOOP
        BEGIN
            -- Restore original data_format
            UPDATE shapes 
            SET 
                data_format = v_record.data_format,  -- Should be 'base64'
                updated_at = NOW()  -- Mark as updated during rollback
            WHERE id = v_record.id
                AND EXISTS (  -- Safety check: only update if record exists
                    SELECT 1 FROM shapes WHERE id = v_record.id
                );
            
            -- Verify the update
            IF NOT FOUND THEN
                RAISE WARNING 'Record ID % not found in shapes table', v_record.id;
                v_error_count := v_error_count + 1;
            ELSE
                v_rollback_count := v_rollback_count + 1;
                v_batch_count := v_batch_count + 1;
            END IF;
            
            -- Log progress every batch
            IF v_batch_count >= v_batch_size THEN
                INSERT INTO backup_phase1_data_format.rollback_log 
                (rollback_phase, operation, affected_records, status)
                VALUES (
                    'phase1_data_format_rollback', 
                    'batch_rollback', 
                    v_batch_count, 
                    'completed'
                );
                
                RAISE NOTICE 'Rollback progress: % records restored', v_rollback_count;
                v_batch_count := 0;
                
                -- Brief pause to prevent overwhelming the database
                PERFORM pg_sleep(0.1);
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Log individual record errors
                INSERT INTO backup_phase1_data_format.rollback_log 
                (rollback_phase, operation, status, error_message)
                VALUES (
                    'phase1_data_format_rollback', 
                    'record_rollback_error', 
                    'failed',
                    FORMAT('Error rolling back ID %s: %s', v_record.id, SQLERRM)
                );
                v_error_count := v_error_count + 1;
                -- Continue with next record
        END;
    END LOOP;
    
    -- Process final batch
    IF v_batch_count > 0 THEN
        INSERT INTO backup_phase1_data_format.rollback_log 
        (rollback_phase, operation, affected_records, status)
        VALUES (
            'phase1_data_format_rollback', 
            'final_batch_rollback', 
            v_batch_count, 
            'completed'
        );
    END IF;
    
    -- Log rollback completion
    INSERT INTO backup_phase1_data_format.rollback_log 
    (rollback_phase, operation, affected_records, status, error_message)
    VALUES (
        'phase1_data_format_rollback', 
        'rollback_complete', 
        v_rollback_count, 
        CASE WHEN v_error_count = 0 THEN 'completed' ELSE 'completed_with_errors' END,
        CASE WHEN v_error_count > 0 THEN FORMAT('%s errors encountered', v_error_count) ELSE NULL END
    );
    
    RAISE NOTICE '';
    RAISE NOTICE 'Rollback completed. Total records restored: %', v_rollback_count;
    RAISE NOTICE 'Errors encountered: %', v_error_count;
    RAISE NOTICE 'Execution time: % seconds', 
        EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
    
END $$;

-- ============================================
-- POST-ROLLBACK VALIDATION
-- ============================================

-- Validation 1: Verify rollback success
WITH rollback_validation AS (
    SELECT 
        COUNT(*) as base64_count,
        COUNT(*) FILTER (WHERE shape_data::jsonb ? 'raw') as has_raw_data
    FROM shapes 
    WHERE data_format = 'base64'
)
SELECT 
    'Rollback validation' as check_name,
    base64_count,
    has_raw_data,
    CASE 
        WHEN base64_count = 115 THEN '✓ PASSED - All records restored to base64'
        ELSE '✗ FAILED - Expected 115, found ' || base64_count
    END as status
FROM rollback_validation;

-- Validation 2: Data integrity after rollback
WITH integrity_check AS (
    SELECT 
        s.id,
        s.data_format = b.data_format as format_matches,
        s.shape_data = b.shape_data as data_matches
    FROM shapes s
    JOIN backup_phase1_data_format.shapes_backup_20250128 b ON s.id = b.id
)
SELECT 
    'Data integrity after rollback' as check_name,
    COUNT(*) as total_checked,
    COUNT(*) FILTER (WHERE format_matches) as format_restored,
    COUNT(*) FILTER (WHERE data_matches) as data_preserved,
    CASE 
        WHEN COUNT(*) = COUNT(*) FILTER (WHERE format_matches AND data_matches) THEN '✓ PASSED - Full restoration successful'
        ELSE '✗ FAILED - Incomplete restoration'
    END as status
FROM integrity_check;

-- Validation 3: No stroke_data formats in rolled back records
SELECT 
    'Stroke_data format check' as check_name,
    COUNT(*) as stroke_data_in_rollback_set,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASSED - No stroke_data formats in rollback set'
        ELSE '✗ FAILED - Found stroke_data formats that should be base64'
    END as status
FROM shapes 
WHERE data_format = 'stroke_data'
    AND id IN (SELECT id FROM backup_phase1_data_format.shapes_backup_20250128);

-- ============================================
-- ROLLBACK SUMMARY
-- ============================================

SELECT 
    'ROLLBACK SUMMARY' as report_type,
    json_build_object(
        'rollback_phase', 'phase1_data_format_rollback',
        'start_time', MIN(executed_at),
        'end_time', MAX(executed_at),
        'duration_seconds', EXTRACT(EPOCH FROM (MAX(executed_at) - MIN(executed_at))),
        'total_records_restored', SUM(affected_records) FILTER (WHERE operation LIKE '%rollback%' AND status IN ('completed', 'completed_with_errors')),
        'errors_encountered', COUNT(*) FILTER (WHERE status = 'failed'),
        'final_status', CASE 
            WHEN EXISTS (SELECT 1 FROM backup_phase1_data_format.rollback_log WHERE status = 'failed') THEN 'COMPLETED_WITH_ERRORS'
            ELSE 'SUCCESS'
        END,
        'base64_record_count', (SELECT COUNT(*) FROM shapes WHERE data_format = 'base64'),
        'validation_passed', (SELECT COUNT(*) FROM shapes WHERE data_format = 'base64') = 115,
        'rollback_user', current_user,
        'rollback_timestamp', NOW()
    ) as summary
FROM backup_phase1_data_format.rollback_log
WHERE rollback_phase = 'phase1_data_format_rollback';

-- ============================================
-- POST-ROLLBACK ACTIONS
-- ============================================
-- 1. Notify team of rollback completion
-- 2. Investigate root cause of migration failure
-- 3. Update migration scripts based on findings
-- 4. Re-test in staging environment
-- 5. Schedule new migration attempt after fixes

-- ============================================
-- CLEANUP RECOMMENDATIONS
-- ============================================
-- After successful re-migration:
-- 1. Drop backup tables: DROP SCHEMA backup_phase1_data_format CASCADE;
-- 2. Document lessons learned
-- 3. Update runbooks with rollback experience