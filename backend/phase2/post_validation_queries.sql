-- Phase 2: Post-Processing Validation Queries
-- Execute these queries after running the batch processing script
-- to verify success and compare with signature processing rates

-- ============================================================
-- 1. OVERALL SUCCESS RATE
-- ============================================================

-- Calculate shape metrics processing success rate
WITH shape_metrics_status AS (
    SELECT 
        id,
        shape_type,
        metrics,
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
    'SHAPES' as data_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN status = 'complete_metrics' THEN 1 END) as successful,
    COUNT(CASE WHEN status != 'complete_metrics' THEN 1 END) as failed,
    ROUND(
        COUNT(CASE WHEN status = 'complete_metrics' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as success_rate_percent
FROM shape_metrics_status

UNION ALL

-- Compare with signature success rate
SELECT 
    'SIGNATURES' as data_type,
    COUNT(*) as total_records,
    COUNT(CASE 
        WHEN metrics->>'stroke_count' IS NOT NULL 
        AND metrics->>'total_points' IS NOT NULL 
        AND metrics->>'avg_velocity' IS NOT NULL 
        THEN 1 
    END) as successful,
    COUNT(CASE 
        WHEN metrics IS NULL 
        OR metrics->>'stroke_count' IS NULL 
        OR metrics->>'total_points' IS NULL 
        OR metrics->>'avg_velocity' IS NULL 
        THEN 1 
    END) as failed,
    ROUND(
        COUNT(CASE 
            WHEN metrics->>'stroke_count' IS NOT NULL 
            AND metrics->>'total_points' IS NOT NULL 
            AND metrics->>'avg_velocity' IS NOT NULL 
            THEN 1 
        END) * 100.0 / NULLIF(COUNT(*), 0), 
        2
    ) as success_rate_percent
FROM signatures
WHERE metrics IS NOT NULL;

-- ============================================================
-- 2. DETAILED SHAPE TYPE ANALYSIS
-- ============================================================

-- Success rate by shape type
SELECT 
    shape_type,
    COUNT(*) as total_count,
    COUNT(CASE 
        WHEN metrics->>'center_x' IS NOT NULL 
        AND metrics->>'center_y' IS NOT NULL 
        AND metrics->>'total_points' IS NOT NULL 
        AND metrics->>'stroke_count' IS NOT NULL 
        AND metrics->>'avg_speed' IS NOT NULL 
        THEN 1 
    END) as complete_metrics,
    ROUND(
        COUNT(CASE 
            WHEN metrics->>'center_x' IS NOT NULL 
            AND metrics->>'center_y' IS NOT NULL 
            AND metrics->>'total_points' IS NOT NULL 
            AND metrics->>'stroke_count' IS NOT NULL 
            AND metrics->>'avg_speed' IS NOT NULL 
            THEN 1 
        END) * 100.0 / COUNT(*), 
        2
    ) as success_rate_percent
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
GROUP BY shape_type
ORDER BY shape_type;

-- ============================================================
-- 3. METRICS FIELD COMPLETENESS
-- ============================================================

-- Check completeness of each metric field
SELECT 
    'center_x' as metric_field,
    COUNT(CASE WHEN metrics->>'center_x' IS NOT NULL THEN 1 END) as populated,
    COUNT(CASE WHEN metrics->>'center_x' IS NULL THEN 1 END) as missing,
    ROUND(
        COUNT(CASE WHEN metrics->>'center_x' IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as completeness_percent
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')

UNION ALL

SELECT 
    'center_y' as metric_field,
    COUNT(CASE WHEN metrics->>'center_y' IS NOT NULL THEN 1 END) as populated,
    COUNT(CASE WHEN metrics->>'center_y' IS NULL THEN 1 END) as missing,
    ROUND(
        COUNT(CASE WHEN metrics->>'center_y' IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as completeness_percent
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')

UNION ALL

SELECT 
    'total_points' as metric_field,
    COUNT(CASE WHEN metrics->>'total_points' IS NOT NULL THEN 1 END) as populated,
    COUNT(CASE WHEN metrics->>'total_points' IS NULL THEN 1 END) as missing,
    ROUND(
        COUNT(CASE WHEN metrics->>'total_points' IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as completeness_percent
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')

UNION ALL

SELECT 
    'stroke_count' as metric_field,
    COUNT(CASE WHEN metrics->>'stroke_count' IS NOT NULL THEN 1 END) as populated,
    COUNT(CASE WHEN metrics->>'stroke_count' IS NULL THEN 1 END) as missing,
    ROUND(
        COUNT(CASE WHEN metrics->>'stroke_count' IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as completeness_percent
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')

UNION ALL

SELECT 
    'avg_speed' as metric_field,
    COUNT(CASE WHEN metrics->>'avg_speed' IS NOT NULL THEN 1 END) as populated,
    COUNT(CASE WHEN metrics->>'avg_speed' IS NULL THEN 1 END) as missing,
    ROUND(
        COUNT(CASE WHEN metrics->>'avg_speed' IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as completeness_percent
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')

ORDER BY completeness_percent DESC;

-- ============================================================
-- 4. METRICS VALUE DISTRIBUTION
-- ============================================================

-- Analyze metric value ranges to ensure they're reasonable
SELECT 
    'stroke_count' as metric,
    MIN((metrics->>'stroke_count')::int) as min_value,
    MAX((metrics->>'stroke_count')::int) as max_value,
    ROUND(AVG((metrics->>'stroke_count')::numeric), 2) as avg_value,
    ROUND(STDDEV((metrics->>'stroke_count')::numeric), 2) as std_dev
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics->>'stroke_count' IS NOT NULL

UNION ALL

SELECT 
    'total_points' as metric,
    MIN((metrics->>'total_points')::int) as min_value,
    MAX((metrics->>'total_points')::int) as max_value,
    ROUND(AVG((metrics->>'total_points')::numeric), 2) as avg_value,
    ROUND(STDDEV((metrics->>'total_points')::numeric), 2) as std_dev
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics->>'total_points' IS NOT NULL

UNION ALL

SELECT 
    'avg_speed' as metric,
    ROUND(MIN((metrics->>'avg_speed')::numeric), 3) as min_value,
    ROUND(MAX((metrics->>'avg_speed')::numeric), 3) as max_value,
    ROUND(AVG((metrics->>'avg_speed')::numeric), 3) as avg_value,
    ROUND(STDDEV((metrics->>'avg_speed')::numeric), 3) as std_dev
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics->>'avg_speed' IS NOT NULL
    AND (metrics->>'avg_speed')::numeric > 0;

-- ============================================================
-- 5. PROCESSING METADATA ANALYSIS
-- ============================================================

-- Check processing metadata (if added by script)
SELECT 
    COUNT(CASE WHEN metrics->>'_processed_at' IS NOT NULL THEN 1 END) as processed_with_metadata,
    COUNT(CASE WHEN metrics->>'_processing_time_ms' IS NOT NULL THEN 1 END) as has_processing_time,
    ROUND(
        AVG(CASE 
            WHEN metrics->>'_processing_time_ms' IS NOT NULL 
            THEN (metrics->>'_processing_time_ms')::numeric 
        END), 
        2
    ) as avg_processing_time_ms
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics IS NOT NULL;

-- ============================================================
-- 6. FAILED RECORDS ANALYSIS
-- ============================================================

-- Analyze remaining incomplete records
WITH failed_shapes AS (
    SELECT 
        id,
        shape_type,
        user_id,
        CASE 
            WHEN shape_data IS NULL THEN 'null_shape_data'
            WHEN shape_data = '{}'::jsonb THEN 'empty_shape_data'
            WHEN shape_data->>'raw' IS NULL 
                AND shape_data->>'strokes' IS NULL 
                AND shape_data->>'data' IS NULL 
                AND jsonb_typeof(shape_data) != 'array' THEN 'no_stroke_data'
            WHEN metrics IS NULL THEN 'null_metrics_after_processing'
            WHEN metrics = '{}'::jsonb THEN 'empty_metrics_after_processing'
            ELSE 'incomplete_metrics_after_processing'
        END as failure_reason
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
    failure_reason,
    COUNT(*) as count,
    array_agg(DISTINCT shape_type) as affected_shape_types,
    array_agg(id ORDER BY id LIMIT 5) as sample_ids
FROM failed_shapes
GROUP BY failure_reason
ORDER BY count DESC;

-- ============================================================
-- 7. USER IMPACT ANALYSIS
-- ============================================================

-- Check how many users are affected by incomplete metrics
SELECT 
    user_metrics_status,
    COUNT(DISTINCT user_id) as user_count,
    ROUND(
        COUNT(DISTINCT user_id) * 100.0 / (
            SELECT COUNT(DISTINCT user_id) 
            FROM shapes 
            WHERE shape_type IN ('circle', 'square', 'triangle')
        ), 
        2
    ) as user_percentage
FROM (
    SELECT 
        user_id,
        CASE 
            WHEN COUNT(CASE 
                WHEN metrics->>'center_x' IS NULL 
                OR metrics->>'center_y' IS NULL 
                OR metrics->>'total_points' IS NULL 
                OR metrics->>'stroke_count' IS NULL 
                OR metrics->>'avg_speed' IS NULL 
                THEN 1 
            END) = 0 THEN 'all_shapes_complete'
            WHEN COUNT(CASE 
                WHEN metrics->>'center_x' IS NOT NULL 
                AND metrics->>'center_y' IS NOT NULL 
                AND metrics->>'total_points' IS NOT NULL 
                AND metrics->>'stroke_count' IS NOT NULL 
                AND metrics->>'avg_speed' IS NOT NULL 
                THEN 1 
            END) = 0 THEN 'no_shapes_complete'
            ELSE 'partially_complete'
        END as user_metrics_status
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
    GROUP BY user_id
) user_status
GROUP BY user_metrics_status
ORDER BY user_count DESC;

-- ============================================================
-- 8. COMPARISON WITH BASELINE
-- ============================================================

-- Compare shape metrics with signature metrics for same users
WITH user_comparison AS (
    SELECT 
        u.id as user_id,
        COALESCE(sig_stats.sig_success_rate, 0) as signature_success_rate,
        COALESCE(shape_stats.shape_success_rate, 0) as shape_success_rate
    FROM users u
    LEFT JOIN (
        SELECT 
            user_id,
            ROUND(
                COUNT(CASE 
                    WHEN metrics->>'stroke_count' IS NOT NULL 
                    AND metrics->>'total_points' IS NOT NULL 
                    THEN 1 
                END) * 100.0 / NULLIF(COUNT(*), 0), 
                2
            ) as sig_success_rate
        FROM signatures
        GROUP BY user_id
    ) sig_stats ON u.id = sig_stats.user_id
    LEFT JOIN (
        SELECT 
            user_id,
            ROUND(
                COUNT(CASE 
                    WHEN metrics->>'center_x' IS NOT NULL 
                    AND metrics->>'center_y' IS NOT NULL 
                    AND metrics->>'total_points' IS NOT NULL 
                    AND metrics->>'stroke_count' IS NOT NULL 
                    AND metrics->>'avg_speed' IS NOT NULL 
                    THEN 1 
                END) * 100.0 / NULLIF(COUNT(*), 0), 
                2
            ) as shape_success_rate
        FROM shapes
        WHERE shape_type IN ('circle', 'square', 'triangle')
        GROUP BY user_id
    ) shape_stats ON u.id = shape_stats.user_id
    WHERE sig_stats.user_id IS NOT NULL OR shape_stats.user_id IS NOT NULL
)
SELECT 
    CASE 
        WHEN signature_success_rate = 100 AND shape_success_rate = 100 THEN 'Both 100%'
        WHEN signature_success_rate = 100 AND shape_success_rate < 100 THEN 'Sig 100%, Shape < 100%'
        WHEN signature_success_rate < 100 AND shape_success_rate = 100 THEN 'Sig < 100%, Shape 100%'
        ELSE 'Both < 100%'
    END as category,
    COUNT(*) as user_count,
    ROUND(AVG(signature_success_rate), 2) as avg_sig_rate,
    ROUND(AVG(shape_success_rate), 2) as avg_shape_rate
FROM user_comparison
GROUP BY category
ORDER BY user_count DESC;

-- ============================================================
-- 9. SAMPLE SUCCESSFUL RECORDS
-- ============================================================

-- Show sample of successfully processed shapes
SELECT 
    id,
    shape_type,
    metrics->>'stroke_count' as stroke_count,
    metrics->>'total_points' as total_points,
    ROUND((metrics->>'center_x')::numeric, 2) as center_x,
    ROUND((metrics->>'center_y')::numeric, 2) as center_y,
    ROUND((metrics->>'avg_speed')::numeric, 3) as avg_speed,
    metrics->>'_processed_at' as processed_at
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics->>'center_x' IS NOT NULL 
    AND metrics->>'center_y' IS NOT NULL 
    AND metrics->>'total_points' IS NOT NULL 
    AND metrics->>'stroke_count' IS NOT NULL 
    AND metrics->>'avg_speed' IS NOT NULL
ORDER BY 
    CASE WHEN metrics->>'_processed_at' IS NOT NULL THEN 0 ELSE 1 END,
    (metrics->>'_processed_at')::timestamp DESC NULLS LAST
LIMIT 10;

-- ============================================================
-- 10. FINAL SUCCESS SUMMARY
-- ============================================================

-- Executive summary
WITH summary_stats AS (
    SELECT 
        COUNT(*) as total_shapes,
        COUNT(CASE 
            WHEN metrics->>'center_x' IS NOT NULL 
            AND metrics->>'center_y' IS NOT NULL 
            AND metrics->>'total_points' IS NOT NULL 
            AND metrics->>'stroke_count' IS NOT NULL 
            AND metrics->>'avg_speed' IS NOT NULL 
            THEN 1 
        END) as complete_shapes,
        COUNT(CASE 
            WHEN metrics IS NULL 
            OR metrics = '{}'::jsonb
            OR metrics->>'center_x' IS NULL
            OR metrics->>'center_y' IS NULL
            OR metrics->>'total_points' IS NULL
            OR metrics->>'stroke_count' IS NULL
            OR metrics->>'avg_speed' IS NULL
            THEN 1 
        END) as incomplete_shapes
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
)
SELECT 
    'PHASE 2 COMPLETION SUMMARY' as report,
    total_shapes,
    complete_shapes,
    incomplete_shapes,
    ROUND(complete_shapes * 100.0 / total_shapes, 2) as success_rate_percent,
    CASE 
        WHEN complete_shapes * 100.0 / total_shapes >= 99 THEN '✅ TARGET ACHIEVED (≥99%)'
        WHEN complete_shapes * 100.0 / total_shapes >= 95 THEN '⚠️ CLOSE TO TARGET (95-98%)'
        ELSE '❌ BELOW TARGET (<95%)'
    END as status
FROM summary_stats;