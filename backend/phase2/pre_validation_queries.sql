-- Phase 2: Pre-Processing Validation Queries
-- Execute these queries before running the batch processing script
-- to understand the current state and identify potential issues

-- ============================================================
-- 1. OVERALL METRICS STATUS
-- ============================================================

-- Count shapes by metrics completeness
WITH metrics_status AS (
    SELECT 
        id,
        shape_type,
        CASE 
            WHEN metrics IS NULL THEN 'null_metrics'
            WHEN metrics = '{}'::jsonb THEN 'empty_metrics'
            WHEN metrics->>'center_x' IS NULL 
                OR metrics->>'center_y' IS NULL 
                OR metrics->>'total_points' IS NULL 
                OR metrics->>'stroke_count' IS NULL 
                OR metrics->>'avg_speed' IS NULL THEN 'incomplete_metrics'
            ELSE 'complete_metrics'
        END as status
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
)
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM metrics_status
GROUP BY status
ORDER BY count DESC;

-- ============================================================
-- 2. SHAPE TYPE BREAKDOWN
-- ============================================================

-- Metrics status by shape type
SELECT 
    shape_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN metrics IS NULL THEN 1 END) as null_metrics,
    COUNT(CASE WHEN metrics = '{}'::jsonb THEN 1 END) as empty_metrics,
    COUNT(CASE 
        WHEN metrics IS NOT NULL 
        AND metrics != '{}'::jsonb 
        AND (metrics->>'center_x' IS NULL 
            OR metrics->>'center_y' IS NULL 
            OR metrics->>'total_points' IS NULL 
            OR metrics->>'stroke_count' IS NULL 
            OR metrics->>'avg_speed' IS NULL) 
        THEN 1 
    END) as incomplete_metrics,
    COUNT(CASE 
        WHEN metrics->>'center_x' IS NOT NULL 
        AND metrics->>'center_y' IS NOT NULL 
        AND metrics->>'total_points' IS NOT NULL 
        AND metrics->>'stroke_count' IS NOT NULL 
        AND metrics->>'avg_speed' IS NOT NULL 
        THEN 1 
    END) as complete_metrics
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
GROUP BY shape_type
ORDER BY shape_type;

-- ============================================================
-- 3. DATA QUALITY CHECKS
-- ============================================================

-- Check for NULL or invalid shape_data
SELECT 
    'Null shape_data' as issue,
    COUNT(*) as count
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND shape_data IS NULL

UNION ALL

SELECT 
    'Empty shape_data' as issue,
    COUNT(*) as count
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND shape_data = '{}'::jsonb

UNION ALL

SELECT 
    'No raw stroke data' as issue,
    COUNT(*) as count
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND shape_data IS NOT NULL
    AND shape_data->>'raw' IS NULL
    AND shape_data->>'strokes' IS NULL
    AND shape_data->>'data' IS NULL
    AND NOT (shape_data @> '[]'::jsonb);

-- ============================================================
-- 4. STROKE DATA ANALYSIS
-- ============================================================

-- Analyze stroke data structure variations
WITH stroke_analysis AS (
    SELECT 
        id,
        shape_type,
        CASE
            WHEN shape_data->>'raw' IS NOT NULL THEN 'has_raw'
            WHEN shape_data->>'strokes' IS NOT NULL THEN 'has_strokes'
            WHEN shape_data->>'data' IS NOT NULL THEN 'has_data'
            WHEN jsonb_typeof(shape_data) = 'array' THEN 'is_array'
            ELSE 'unknown_format'
        END as data_format,
        CASE
            WHEN shape_data->>'raw' IS NOT NULL THEN jsonb_array_length(shape_data->'raw')
            WHEN shape_data->>'strokes' IS NOT NULL THEN jsonb_array_length(shape_data->'strokes')
            WHEN shape_data->>'data' IS NOT NULL THEN jsonb_array_length(shape_data->'data')
            WHEN jsonb_typeof(shape_data) = 'array' THEN jsonb_array_length(shape_data)
            ELSE 0
        END as stroke_count
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
        AND shape_data IS NOT NULL
)
SELECT 
    data_format,
    COUNT(*) as count,
    AVG(stroke_count) as avg_strokes,
    MIN(stroke_count) as min_strokes,
    MAX(stroke_count) as max_strokes
FROM stroke_analysis
GROUP BY data_format
ORDER BY count DESC;

-- ============================================================
-- 5. EDGE CASES DETECTION
-- ============================================================

-- Find shapes with potential edge cases
SELECT 
    'Empty stroke arrays' as edge_case,
    COUNT(*) as count,
    array_agg(id ORDER BY id LIMIT 5) as sample_ids
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND (
        (shape_data->'raw' IS NOT NULL AND jsonb_array_length(shape_data->'raw') = 0)
        OR (shape_data->'strokes' IS NOT NULL AND jsonb_array_length(shape_data->'strokes') = 0)
        OR (jsonb_typeof(shape_data) = 'array' AND jsonb_array_length(shape_data) = 0)
    )

UNION ALL

SELECT 
    'Single point strokes' as edge_case,
    COUNT(*) as count,
    array_agg(id ORDER BY id LIMIT 5) as sample_ids
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND shape_data->'raw' IS NOT NULL
    AND EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(shape_data->'raw') as stroke
        WHERE jsonb_array_length(stroke) < 2
    );

-- ============================================================
-- 6. EXISTING METRICS ANALYSIS
-- ============================================================

-- Analyze existing partial metrics
WITH partial_metrics AS (
    SELECT 
        id,
        shape_type,
        metrics,
        ARRAY[
            CASE WHEN metrics->>'stroke_count' IS NOT NULL THEN 'stroke_count' END,
            CASE WHEN metrics->>'total_points' IS NOT NULL THEN 'total_points' END,
            CASE WHEN metrics->>'center_x' IS NOT NULL THEN 'center_x' END,
            CASE WHEN metrics->>'center_y' IS NOT NULL THEN 'center_y' END,
            CASE WHEN metrics->>'avg_speed' IS NOT NULL THEN 'avg_speed' END,
            CASE WHEN metrics->>'time_duration' IS NOT NULL THEN 'time_duration' END
        ] as present_fields
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
        AND metrics IS NOT NULL 
        AND metrics != '{}'::jsonb
)
SELECT 
    array_to_string(
        array_remove(array_remove(present_fields, NULL), ''), 
        ', '
    ) as fields_present,
    COUNT(*) as count
FROM partial_metrics
GROUP BY present_fields
ORDER BY count DESC
LIMIT 20;

-- ============================================================
-- 7. USER DISTRIBUTION
-- ============================================================

-- Check shape distribution across users
SELECT 
    user_count_range,
    COUNT(*) as user_count,
    SUM(shape_count) as total_shapes
FROM (
    SELECT 
        user_id,
        COUNT(*) as shape_count,
        CASE 
            WHEN COUNT(*) = 1 THEN '1 shape'
            WHEN COUNT(*) BETWEEN 2 AND 3 THEN '2-3 shapes'
            WHEN COUNT(*) BETWEEN 4 AND 10 THEN '4-10 shapes'
            ELSE '10+ shapes'
        END as user_count_range
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
    GROUP BY user_id
) user_shapes
GROUP BY user_count_range
ORDER BY 
    CASE user_count_range
        WHEN '1 shape' THEN 1
        WHEN '2-3 shapes' THEN 2
        WHEN '4-10 shapes' THEN 3
        ELSE 4
    END;

-- ============================================================
-- 8. SAMPLE PROBLEMATIC RECORDS
-- ============================================================

-- Get sample of shapes that need processing
SELECT 
    id,
    user_id,
    shape_type,
    CASE 
        WHEN metrics IS NULL THEN 'NULL'
        WHEN metrics = '{}'::jsonb THEN 'EMPTY'
        ELSE 'INCOMPLETE'
    END as metrics_status,
    jsonb_pretty(shape_data) as shape_data_preview,
    created_at
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND (
        metrics IS NULL 
        OR metrics = '{}'::jsonb
        OR metrics->>'center_x' IS NULL
        OR metrics->>'center_y' IS NULL
        OR metrics->>'total_points' IS NULL
        OR metrics->>'stroke_count' IS NULL
        OR metrics->>'avg_speed' IS NULL
    )
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- 9. PROCESSING ESTIMATION
-- ============================================================

-- Estimate processing requirements
WITH processing_estimate AS (
    SELECT 
        COUNT(*) as shapes_to_process,
        20 as batch_size, -- Default batch size
        100 as batch_delay_ms, -- Default delay
        50 as avg_processing_time_ms -- Estimated per shape
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
        AND (
            metrics IS NULL 
            OR metrics = '{}'::jsonb
            OR metrics->>'center_x' IS NULL
            OR metrics->>'center_y' IS NULL
            OR metrics->>'total_points' IS NULL
            OR metrics->>'stroke_count' IS NULL
            OR metrics->>'avg_speed' IS NULL
        )
)
SELECT 
    shapes_to_process,
    CEIL(shapes_to_process::numeric / batch_size) as total_batches,
    ROUND(
        (shapes_to_process * avg_processing_time_ms + 
         CEIL(shapes_to_process::numeric / batch_size) * batch_delay_ms) / 1000.0, 
        2
    ) as estimated_seconds,
    ROUND(
        (shapes_to_process * avg_processing_time_ms + 
         CEIL(shapes_to_process::numeric / batch_size) * batch_delay_ms) / 60000.0, 
        2
    ) as estimated_minutes
FROM processing_estimate;

-- ============================================================
-- 10. FINAL PRE-FLIGHT CHECK
-- ============================================================

-- Summary for go/no-go decision
SELECT 
    'PRE-FLIGHT CHECK' as check_type,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM shapes 
            WHERE shape_type IN ('circle', 'square', 'triangle') 
                AND shape_data IS NULL
        ) > 0 THEN 'FAIL: Found shapes with NULL shape_data'
        WHEN (
            SELECT COUNT(*) 
            FROM shapes 
            WHERE shape_type IN ('circle', 'square', 'triangle')
                AND (
                    metrics IS NULL 
                    OR metrics = '{}'::jsonb
                    OR metrics->>'center_x' IS NULL
                    OR metrics->>'center_y' IS NULL
                    OR metrics->>'total_points' IS NULL
                    OR metrics->>'stroke_count' IS NULL
                    OR metrics->>'avg_speed' IS NULL
                )
        ) = 0 THEN 'PASS: No shapes need processing'
        ELSE 'PASS: Ready for processing'
    END as status,
    (
        SELECT COUNT(*) 
        FROM shapes 
        WHERE shape_type IN ('circle', 'square', 'triangle')
            AND (
                metrics IS NULL 
                OR metrics = '{}'::jsonb
                OR metrics->>'center_x' IS NULL
                OR metrics->>'center_y' IS NULL
                OR metrics->>'total_points' IS NULL
                OR metrics->>'stroke_count' IS NULL
                OR metrics->>'avg_speed' IS NULL
            )
    ) as shapes_to_process;