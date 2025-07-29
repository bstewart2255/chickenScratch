-- Phase 1: Data Format Migration Script
-- Purpose: Safely update data_format from 'base64' to 'stroke_data' for affected shapes
-- Safety: Uses transactions, batch processing, and comprehensive validation
-- 
-- FIXED: Batch processing resume functionality now properly tracks last processed shape ID
--        instead of incorrectly querying migration_log.id (which doesn't exist)
-- FIXED: Resume functionality now correctly tracks the maximum ID of records actually updated
--        rather than the maximum ID from the selected batch, preventing skipped records

-- ============================================
-- CONFIGURATION
-- ============================================
\set ON_ERROR_STOP on
\set BATCH_SIZE 1000

-- Note: This migration supports resume functionality. If interrupted, 
-- it will automatically resume from the last processed shape ID.

-- ============================================
-- PRE-MIGRATION SAFETY CHECKS
-- ============================================

DO $$
DECLARE
    v_affected_count INTEGER;
    v_backup_exists BOOLEAN;
    v_checksum_original VARCHAR(32);
    v_checksum_backup VARCHAR(32);
BEGIN
    -- Check 1: Verify backup exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'backup_phase1_data_format' 
        AND table_name = 'shapes_backup_20250128'
    ) INTO v_backup_exists;
    
    IF NOT v_backup_exists THEN
        RAISE EXCEPTION 'SAFETY VIOLATION: Backup table not found. Run backup procedure first.';
    END IF;
    
    -- Check 2: Verify affected record count matches expectations
    SELECT COUNT(*) INTO v_affected_count
    FROM shapes 
    WHERE data_format = 'base64' AND shape_data::jsonb ? 'raw';
    
    IF v_affected_count <> 115 THEN
        RAISE WARNING 'Expected 115 records, found %. Proceeding with caution.', v_affected_count;
    END IF;
    
    -- Check 3: Verify backup integrity
    -- Note: Checksums exclude data_format field since that's what we're changing
    SELECT MD5(string_agg(id::text || COALESCE(shape_data::text, 'null'), ',' ORDER BY id))
    INTO v_checksum_original
    FROM shapes 
    WHERE data_format = 'base64';
    
    SELECT MD5(string_agg(id::text || COALESCE(shape_data::text, 'null'), ',' ORDER BY id))
    INTO v_checksum_backup
    FROM backup_phase1_data_format.shapes_backup_20250128;
    
    IF v_checksum_original <> v_checksum_backup THEN
        RAISE EXCEPTION 'SAFETY VIOLATION: Backup checksum mismatch. Data may have changed since backup.';
    END IF;
    
    RAISE NOTICE 'Pre-migration checks passed. Proceeding with migration of % records.', v_affected_count;
END $$;

-- ============================================
-- MIGRATION EXECUTION
-- ============================================

-- Create migration log table
CREATE TABLE IF NOT EXISTS backup_phase1_data_format.migration_log (
    log_id SERIAL PRIMARY KEY,
    migration_phase VARCHAR(50),
    operation VARCHAR(100),
    affected_records INTEGER,
    last_processed_id INTEGER,  -- Track the last processed shape ID for resume functionality
    status VARCHAR(20),
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT NOW(),
    executed_by VARCHAR(255) DEFAULT current_user
);

-- Main migration procedure
DO $$
DECLARE
    v_batch_count INTEGER := 0;
    v_total_updated INTEGER := 0;
    v_batch_size INTEGER := 1000;
    v_start_time TIMESTAMP;
    v_batch_start_time TIMESTAMP;
    v_batch_ids INTEGER[];
    v_affected_count INTEGER;
    v_batch_updated INTEGER;
    v_last_processed_id INTEGER := 0;  -- Track the last processed shape ID
BEGIN
    v_start_time := clock_timestamp();
    
    -- Get the last processed ID from previous runs (if any)
    SELECT COALESCE(MAX(last_processed_id), 0) INTO v_last_processed_id
    FROM backup_phase1_data_format.migration_log 
    WHERE operation = 'batch_update' AND status = 'completed';
    
    -- Log migration start
    INSERT INTO backup_phase1_data_format.migration_log 
    (migration_phase, operation, status, last_processed_id)
    VALUES ('phase1_data_format', 'migration_start', 'started', v_last_processed_id);
    
    -- Get all affected IDs in batches
    LOOP
        -- Collect batch of IDs
        SELECT ARRAY_AGG(id) INTO v_batch_ids
        FROM (
            SELECT id 
            FROM shapes 
            WHERE data_format = 'base64' 
                AND shape_data::jsonb ? 'raw'
                AND id > v_last_processed_id  -- Resume from last processed ID
            ORDER BY id
            LIMIT v_batch_size
        ) batch_ids;
        
        -- Exit if no more records to process
        IF v_batch_ids IS NULL OR array_length(v_batch_ids, 1) = 0 THEN
            EXIT;
        END IF;
        
        v_batch_start_time := clock_timestamp();
        v_batch_count := v_batch_count + 1;
        
        -- Process batch in transaction
        BEGIN
            -- Create temporary table to store IDs of records that were actually updated
            CREATE TEMP TABLE IF NOT EXISTS temp_updated_ids (id INTEGER);
            DELETE FROM temp_updated_ids;
            
            -- Update all records in the batch with safety checks
            WITH batch_update AS (
                UPDATE shapes 
                SET 
                    data_format = 'stroke_data',
                    updated_at = NOW()
                WHERE id = ANY(v_batch_ids)
                    AND data_format = 'base64'  -- Double-check condition
                    AND shape_data::jsonb ? 'raw'  -- Ensure it has stroke data
                    AND shape_data IS NOT NULL  -- Null safety
                RETURNING id
            )
            INSERT INTO temp_updated_ids (id)
            SELECT id FROM batch_update;
            
            -- Get count of actually updated records
            SELECT COUNT(*) INTO v_batch_updated FROM temp_updated_ids;
            
            -- Update counters based on actual results
            v_total_updated := v_total_updated + v_batch_updated;
            
            -- FIXED: Update the last processed ID to the maximum ID of records actually updated
            -- This ensures resume functionality works correctly even if some records in a batch fail
            SELECT COALESCE(MAX(id), v_last_processed_id) INTO v_last_processed_id 
            FROM temp_updated_ids;
            
            -- Log batch completion
            INSERT INTO backup_phase1_data_format.migration_log 
            (migration_phase, operation, affected_records, status, last_processed_id)
            VALUES (
                'phase1_data_format', 
                'batch_update', 
                v_batch_updated, 
                'completed',
                v_last_processed_id
            );
            
            RAISE NOTICE 'Batch % completed: % records updated (Total: %)', 
                v_batch_count, v_batch_updated, v_total_updated;
            
            -- Brief pause to prevent overwhelming the database
            PERFORM pg_sleep(0.1);
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error and re-raise
                INSERT INTO backup_phase1_data_format.migration_log 
                (migration_phase, operation, status, error_message, last_processed_id)
                VALUES (
                    'phase1_data_format', 
                    'batch_update_error', 
                    'failed',
                    SQLERRM,
                    v_last_processed_id
                );
                RAISE;
        END;
    END LOOP;
    
    -- No final batch processing needed - all batches are processed in the main loop
    
    -- Log migration completion
    INSERT INTO backup_phase1_data_format.migration_log 
    (migration_phase, operation, affected_records, status, last_processed_id)
    VALUES (
        'phase1_data_format', 
        'migration_complete', 
        v_total_updated, 
        'completed',
        v_last_processed_id
    );
    
    RAISE NOTICE 'Migration completed successfully. Total records updated: %', v_total_updated;
    RAISE NOTICE 'Execution time: % seconds', 
        EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
    
END $$;

-- ============================================
-- POST-MIGRATION VALIDATION
-- ============================================

-- Validation 1: Ensure no records remain with base64 format
WITH validation_1 AS (
    SELECT COUNT(*) as remaining_base64_count
    FROM shapes 
    WHERE data_format = 'base64'
)
SELECT 
    'Remaining base64 records' as validation_check,
    remaining_base64_count,
    CASE 
        WHEN remaining_base64_count = 0 THEN 'PASSED'
        ELSE 'FAILED'
    END as status
FROM validation_1;

-- Validation 2: Verify all updated records have correct format
WITH validation_2 AS (
    SELECT 
        COUNT(*) as stroke_data_count,
        COUNT(*) FILTER (WHERE shape_data::jsonb ? 'raw') as has_raw_key_count
    FROM shapes 
    WHERE data_format = 'stroke_data'
        AND id IN (SELECT id FROM backup_phase1_data_format.shapes_backup_20250128)
)
SELECT 
    'Updated records validation' as validation_check,
    stroke_data_count,
    has_raw_key_count,
    CASE 
        WHEN stroke_data_count = has_raw_key_count AND stroke_data_count = 115 THEN 'PASSED'
        ELSE 'FAILED'
    END as status
FROM validation_2;

-- Validation 3: Data integrity check
WITH integrity_check AS (
    SELECT 
        s.id,
        s.shape_data = b.shape_data as data_unchanged,
        s.data_format = 'stroke_data' as format_updated
    FROM shapes s
    JOIN backup_phase1_data_format.shapes_backup_20250128 b ON s.id = b.id
)
SELECT 
    'Data integrity check' as validation_check,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE data_unchanged) as data_preserved_count,
    COUNT(*) FILTER (WHERE format_updated) as format_updated_count,
    CASE 
        WHEN COUNT(*) = COUNT(*) FILTER (WHERE data_unchanged AND format_updated) THEN 'PASSED'
        ELSE 'FAILED'
    END as status
FROM integrity_check;

-- ============================================
-- MIGRATION SUMMARY
-- ============================================

SELECT 
    'MIGRATION SUMMARY' as report_type,
    json_build_object(
        'migration_phase', 'phase1_data_format',
        'start_time', MIN(executed_at),
        'end_time', MAX(executed_at),
        'duration_seconds', EXTRACT(EPOCH FROM (MAX(executed_at) - MIN(executed_at))),
        'total_records_updated', SUM(affected_records) FILTER (WHERE operation = 'batch_update' AND status = 'completed'),
        'batch_count', COUNT(*) FILTER (WHERE operation = 'batch_update' AND status = 'completed'),
        'errors_encountered', COUNT(*) FILTER (WHERE status = 'failed'),
        'final_status', CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'failed') = 0 THEN 'SUCCESS'
            ELSE 'FAILED'
        END,
        'remaining_base64_records', (SELECT COUNT(*) FROM shapes WHERE data_format = 'base64'),
        'validation_passed', (SELECT COUNT(*) FROM shapes WHERE data_format = 'base64') = 0
    ) as summary
FROM backup_phase1_data_format.migration_log
WHERE migration_phase = 'phase1_data_format';

-- ============================================
-- IMPORTANT POST-MIGRATION STEPS
-- ============================================
-- 1. Review all validation results above
-- 2. Run application tests to ensure functionality
-- 3. Monitor error logs for any issues
-- 4. Keep backup for at least 30 days
-- 5. Document completion in project tracking system