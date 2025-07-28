-- Phase 2: Emergency Rollback Procedures
-- Use these queries to rollback changes if issues are discovered post-processing
-- IMPORTANT: Always backup data before running these procedures

-- ============================================================
-- 1. BACKUP CURRENT METRICS (RUN FIRST!)
-- ============================================================

-- Create backup table with timestamp
CREATE TABLE IF NOT EXISTS shapes_metrics_backup_phase2 AS
SELECT 
    id,
    user_id,
    shape_type,
    metrics,
    updated_at,
    CURRENT_TIMESTAMP as backup_timestamp,
    'phase2_shape_metrics_standardization' as backup_reason
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle');

-- Verify backup was created
SELECT 
    COUNT(*) as backed_up_records,
    MIN(backup_timestamp) as backup_created_at
FROM shapes_metrics_backup_phase2
WHERE backup_reason = 'phase2_shape_metrics_standardization';

-- ============================================================
-- 2. IDENTIFY RECENTLY PROCESSED SHAPES
-- ============================================================

-- Find shapes processed by the batch script (using metadata)
SELECT 
    COUNT(*) as processed_count,
    MIN((metrics->>'_processed_at')::timestamp) as earliest_processed,
    MAX((metrics->>'_processed_at')::timestamp) as latest_processed
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics->>'_processed_at' IS NOT NULL;

-- ============================================================
-- 3. SELECTIVE ROLLBACK PROCEDURES
-- ============================================================

-- Option A: Rollback shapes processed after a specific timestamp
-- Replace 'YYYY-MM-DD HH:MI:SS' with actual timestamp
/*
UPDATE shapes s
SET 
    metrics = b.metrics,
    updated_at = CURRENT_TIMESTAMP
FROM shapes_metrics_backup_phase2 b
WHERE s.id = b.id
    AND s.shape_type IN ('circle', 'square', 'triangle')
    AND s.metrics->>'_processed_at' IS NOT NULL
    AND (s.metrics->>'_processed_at')::timestamp >= 'YYYY-MM-DD HH:MI:SS';
*/

-- Option B: Rollback specific shape types only
/*
UPDATE shapes s
SET 
    metrics = b.metrics,
    updated_at = CURRENT_TIMESTAMP
FROM shapes_metrics_backup_phase2 b
WHERE s.id = b.id
    AND s.shape_type = 'circle'  -- Change to specific shape type
    AND s.metrics->>'_processed_at' IS NOT NULL;
*/

-- Option C: Rollback shapes with suspicious metric values
/*
UPDATE shapes s
SET 
    metrics = b.metrics,
    updated_at = CURRENT_TIMESTAMP
FROM shapes_metrics_backup_phase2 b
WHERE s.id = b.id
    AND s.shape_type IN ('circle', 'square', 'triangle')
    AND (
        -- Add conditions for suspicious values
        (s.metrics->>'avg_speed')::numeric > 10  -- Example: unreasonably high speed
        OR (s.metrics->>'total_points')::int > 5000  -- Example: too many points
        OR (s.metrics->>'center_x')::numeric < 0  -- Example: negative center
    );
*/

-- ============================================================
-- 4. FULL ROLLBACK PROCEDURE
-- ============================================================

-- DANGER: This will rollback ALL shape metrics to pre-processing state
-- Only use if complete rollback is necessary
/*
BEGIN;

-- Show what will be rolled back
SELECT 
    COUNT(*) as shapes_to_rollback,
    COUNT(DISTINCT user_id) as affected_users
FROM shapes s
INNER JOIN shapes_metrics_backup_phase2 b ON s.id = b.id
WHERE s.shape_type IN ('circle', 'square', 'triangle')
    AND s.metrics->>'_processed_at' IS NOT NULL;

-- Perform the rollback
UPDATE shapes s
SET 
    metrics = b.metrics,
    updated_at = CURRENT_TIMESTAMP
FROM shapes_metrics_backup_phase2 b
WHERE s.id = b.id
    AND s.shape_type IN ('circle', 'square', 'triangle');

-- Verify rollback results
SELECT 
    COUNT(*) as total_shapes,
    COUNT(CASE WHEN metrics->>'_processed_at' IS NOT NULL THEN 1 END) as still_has_metadata,
    COUNT(CASE 
        WHEN metrics->>'center_x' IS NULL 
        OR metrics->>'center_y' IS NULL 
        OR metrics->>'total_points' IS NULL 
        OR metrics->>'stroke_count' IS NULL 
        OR metrics->>'avg_speed' IS NULL 
        THEN 1 
    END) as incomplete_after_rollback
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle');

-- COMMIT or ROLLBACK based on verification
-- COMMIT;
-- ROLLBACK;
*/

-- ============================================================
-- 5. REMOVE PROCESSING METADATA
-- ============================================================

-- Remove only the processing metadata while keeping calculated metrics
/*
UPDATE shapes
SET metrics = metrics - '_processed_at' - '_processing_time_ms' - '_calculation_metadata'
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics ? '_processed_at';
*/

-- ============================================================
-- 6. VERIFICATION QUERIES
-- ============================================================

-- Compare current state with backup
WITH comparison AS (
    SELECT 
        s.id,
        s.shape_type,
        CASE 
            WHEN s.metrics = b.metrics THEN 'unchanged'
            WHEN s.metrics->>'_processed_at' IS NOT NULL THEN 'processed_by_script'
            ELSE 'modified_other'
        END as status
    FROM shapes s
    LEFT JOIN shapes_metrics_backup_phase2 b ON s.id = b.id
    WHERE s.shape_type IN ('circle', 'square', 'triangle')
)
SELECT 
    status,
    COUNT(*) as count
FROM comparison
GROUP BY status;

-- ============================================================
-- 7. PARTIAL METRIC ROLLBACK
-- ============================================================

-- Rollback only specific metric fields (keep others)
/*
UPDATE shapes s
SET metrics = jsonb_build_object(
    'stroke_count', s.metrics->'stroke_count',
    'total_points', s.metrics->'total_points',
    'center_x', b.metrics->'center_x',  -- Rollback center_x
    'center_y', b.metrics->'center_y',  -- Rollback center_y
    'avg_speed', s.metrics->'avg_speed',
    'time_duration', s.metrics->'time_duration',
    'width', s.metrics->'width',
    'height', s.metrics->'height',
    'area', s.metrics->'area',
    'aspect_ratio', s.metrics->'aspect_ratio'
)
FROM shapes_metrics_backup_phase2 b
WHERE s.id = b.id
    AND s.shape_type IN ('circle', 'square', 'triangle')
    AND s.metrics->>'_processed_at' IS NOT NULL;
*/

-- ============================================================
-- 8. CLEANUP PROCEDURES
-- ============================================================

-- After successful verification, optionally drop backup table
-- WARNING: Only do this after confirming everything is working correctly
/*
DROP TABLE IF EXISTS shapes_metrics_backup_phase2;
*/

-- ============================================================
-- 9. EMERGENCY CONTACTS LOG
-- ============================================================

-- Log rollback action for audit trail
/*
INSERT INTO system_logs (action, details, performed_by, performed_at)
VALUES (
    'phase2_metrics_rollback',
    jsonb_build_object(
        'reason', 'Describe reason for rollback',
        'shapes_affected', (SELECT COUNT(*) FROM shapes WHERE metrics->>'_processed_at' IS NOT NULL),
        'rollback_type', 'full|partial|selective'
    ),
    current_user,
    CURRENT_TIMESTAMP
);
*/

-- ============================================================
-- 10. POST-ROLLBACK VALIDATION
-- ============================================================

-- Ensure data integrity after rollback
SELECT 
    'Post-Rollback Summary' as check_type,
    COUNT(*) as total_shapes,
    COUNT(CASE WHEN metrics IS NULL THEN 1 END) as null_metrics,
    COUNT(CASE 
        WHEN metrics->>'center_x' IS NOT NULL 
        AND metrics->>'center_y' IS NOT NULL 
        AND metrics->>'total_points' IS NOT NULL 
        AND metrics->>'stroke_count' IS NOT NULL 
        AND metrics->>'avg_speed' IS NOT NULL 
        THEN 1 
    END) as complete_metrics,
    COUNT(CASE WHEN metrics->>'_processed_at' IS NOT NULL THEN 1 END) as still_has_processing_metadata
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle');