-- Phase 2: Performance Monitoring Queries
-- Use these queries to monitor processing performance and database impact

-- ============================================================
-- 1. REAL-TIME PROCESSING PROGRESS
-- ============================================================

-- Monitor processing progress in real-time
WITH processing_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE metrics->>'_processed_at' IS NOT NULL) as processed,
        COUNT(*) FILTER (WHERE 
            metrics IS NULL 
            OR metrics = '{}'::jsonb
            OR metrics->>'center_x' IS NULL
            OR metrics->>'center_y' IS NULL
            OR metrics->>'total_points' IS NULL
            OR metrics->>'stroke_count' IS NULL
            OR metrics->>'avg_speed' IS NULL
        ) as remaining,
        COUNT(*) as total
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
)
SELECT 
    processed,
    remaining,
    total,
    ROUND(processed * 100.0 / NULLIF(total, 0), 2) as progress_percent,
    CASE 
        WHEN processed > 0 THEN 
            ROUND(remaining::numeric / NULLIF(
                processed::numeric / EXTRACT(EPOCH FROM (
                    MAX((metrics->>'_processed_at')::timestamp) - 
                    MIN((metrics->>'_processed_at')::timestamp)
                )), 0
            ) / 60, 2)
        ELSE NULL 
    END as estimated_minutes_remaining
FROM processing_stats, shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics->>'_processed_at' IS NOT NULL
GROUP BY processed, remaining, total;

-- ============================================================
-- 2. PROCESSING PERFORMANCE METRICS
-- ============================================================

-- Analyze processing performance over time
WITH processing_windows AS (
    SELECT 
        DATE_TRUNC('minute', (metrics->>'_processed_at')::timestamp) as minute_window,
        COUNT(*) as shapes_processed,
        AVG((metrics->>'_processing_time_ms')::numeric) as avg_processing_time_ms,
        MIN((metrics->>'_processing_time_ms')::numeric) as min_processing_time_ms,
        MAX((metrics->>'_processing_time_ms')::numeric) as max_processing_time_ms
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
        AND metrics->>'_processed_at' IS NOT NULL
        AND metrics->>'_processing_time_ms' IS NOT NULL
    GROUP BY minute_window
)
SELECT 
    minute_window,
    shapes_processed,
    ROUND(avg_processing_time_ms, 2) as avg_ms,
    ROUND(min_processing_time_ms, 2) as min_ms,
    ROUND(max_processing_time_ms, 2) as max_ms,
    shapes_processed as shapes_per_minute
FROM processing_windows
ORDER BY minute_window DESC
LIMIT 20;

-- ============================================================
-- 3. DATABASE PERFORMANCE IMPACT
-- ============================================================

-- Check current database activity (requires appropriate permissions)
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    CASE 
        WHEN state = 'active' THEN 
            ROUND(EXTRACT(EPOCH FROM (NOW() - query_start))::numeric, 2)
        ELSE NULL 
    END as query_duration_seconds,
    wait_event_type,
    wait_event,
    LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
    AND state != 'idle'
ORDER BY query_start;

-- Check table statistics for shapes table
SELECT 
    schemaname,
    tablename,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_row_percent,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename = 'shapes';

-- ============================================================
-- 4. BATCH PROCESSING STATISTICS
-- ============================================================

-- Analyze batch processing patterns
WITH batch_analysis AS (
    SELECT 
        DATE_TRUNC('second', (metrics->>'_processed_at')::timestamp) as batch_second,
        COUNT(*) as shapes_in_batch,
        MIN((metrics->>'_processed_at')::timestamp) as batch_start,
        MAX((metrics->>'_processed_at')::timestamp) as batch_end,
        EXTRACT(EPOCH FROM (
            MAX((metrics->>'_processed_at')::timestamp) - 
            MIN((metrics->>'_processed_at')::timestamp)
        )) as batch_duration_seconds
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
        AND metrics->>'_processed_at' IS NOT NULL
    GROUP BY batch_second
    HAVING COUNT(*) > 1
)
SELECT 
    ROW_NUMBER() OVER (ORDER BY batch_start) as batch_number,
    shapes_in_batch,
    ROUND(batch_duration_seconds::numeric, 3) as duration_seconds,
    ROUND(shapes_in_batch / NULLIF(batch_duration_seconds, 0), 2) as shapes_per_second,
    batch_start
FROM batch_analysis
ORDER BY batch_start DESC
LIMIT 20;

-- ============================================================
-- 5. ERROR RATE MONITORING
-- ============================================================

-- Track error patterns by shape type and time
WITH hourly_stats AS (
    SELECT 
        DATE_TRUNC('hour', COALESCE(
            (metrics->>'_processed_at')::timestamp, 
            updated_at
        )) as hour_window,
        shape_type,
        COUNT(*) FILTER (WHERE 
            metrics->>'center_x' IS NOT NULL 
            AND metrics->>'center_y' IS NOT NULL 
            AND metrics->>'total_points' IS NOT NULL 
            AND metrics->>'stroke_count' IS NOT NULL 
            AND metrics->>'avg_speed' IS NOT NULL
        ) as successful,
        COUNT(*) FILTER (WHERE 
            metrics IS NULL 
            OR metrics = '{}'::jsonb
            OR metrics->>'center_x' IS NULL
            OR metrics->>'center_y' IS NULL
            OR metrics->>'total_points' IS NULL
            OR metrics->>'stroke_count' IS NULL
            OR metrics->>'avg_speed' IS NULL
        ) as failed
    FROM shapes
    WHERE shape_type IN ('circle', 'square', 'triangle')
    GROUP BY hour_window, shape_type
)
SELECT 
    hour_window,
    shape_type,
    successful,
    failed,
    ROUND(successful * 100.0 / NULLIF(successful + failed, 0), 2) as success_rate
FROM hourly_stats
WHERE hour_window >= NOW() - INTERVAL '24 hours'
ORDER BY hour_window DESC, shape_type;

-- ============================================================
-- 6. RESOURCE UTILIZATION
-- ============================================================

-- Monitor connection usage
SELECT 
    COUNT(*) as total_connections,
    COUNT(*) FILTER (WHERE state = 'active') as active_connections,
    COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
    ROUND(COUNT(*) * 100.0 / (
        SELECT setting::int FROM pg_settings WHERE name = 'max_connections'
    ), 2) as connection_usage_percent
FROM pg_stat_activity;

-- Check for long-running transactions
SELECT 
    pid,
    usename,
    ROUND(EXTRACT(EPOCH FROM (NOW() - xact_start))::numeric / 60, 2) as transaction_duration_minutes,
    state,
    LEFT(query, 100) as current_query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
    AND state != 'idle'
ORDER BY xact_start
LIMIT 10;

-- ============================================================
-- 7. PROCESSING SPEED ANALYSIS
-- ============================================================

-- Compare processing speed across different factors
SELECT 
    'By Shape Type' as grouping,
    shape_type as category,
    COUNT(*) as processed_count,
    ROUND(AVG((metrics->>'_processing_time_ms')::numeric), 2) as avg_time_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY (metrics->>'_processing_time_ms')::numeric
    ), 2) as median_time_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (
        ORDER BY (metrics->>'_processing_time_ms')::numeric
    ), 2) as p95_time_ms
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics->>'_processing_time_ms' IS NOT NULL
GROUP BY shape_type

UNION ALL

SELECT 
    'By Stroke Count' as grouping,
    CASE 
        WHEN (metrics->>'stroke_count')::int = 1 THEN '1 stroke'
        WHEN (metrics->>'stroke_count')::int BETWEEN 2 AND 5 THEN '2-5 strokes'
        WHEN (metrics->>'stroke_count')::int BETWEEN 6 AND 10 THEN '6-10 strokes'
        ELSE '10+ strokes'
    END as category,
    COUNT(*) as processed_count,
    ROUND(AVG((metrics->>'_processing_time_ms')::numeric), 2) as avg_time_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY (metrics->>'_processing_time_ms')::numeric
    ), 2) as median_time_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (
        ORDER BY (metrics->>'_processing_time_ms')::numeric
    ), 2) as p95_time_ms
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics->>'_processing_time_ms' IS NOT NULL
    AND metrics->>'stroke_count' IS NOT NULL
GROUP BY category

ORDER BY grouping, category;

-- ============================================================
-- 8. BOTTLENECK IDENTIFICATION
-- ============================================================

-- Identify slowest processing cases
SELECT 
    id,
    shape_type,
    (metrics->>'stroke_count')::int as stroke_count,
    (metrics->>'total_points')::int as total_points,
    (metrics->>'_processing_time_ms')::numeric as processing_time_ms,
    pg_size_pretty(pg_column_size(shape_data)) as shape_data_size
FROM shapes
WHERE shape_type IN ('circle', 'square', 'triangle')
    AND metrics->>'_processing_time_ms' IS NOT NULL
ORDER BY (metrics->>'_processing_time_ms')::numeric DESC
LIMIT 10;

-- ============================================================
-- 9. SYSTEM HEALTH CHECK
-- ============================================================

-- Overall system health during processing
WITH health_metrics AS (
    SELECT 
        (SELECT COUNT(*) FROM shapes WHERE metrics->>'_processed_at' >= NOW() - INTERVAL '5 minutes') as recent_processed,
        (SELECT ROUND(AVG((metrics->>'_processing_time_ms')::numeric), 2) 
         FROM shapes 
         WHERE metrics->>'_processed_at' >= NOW() - INTERVAL '5 minutes') as recent_avg_time_ms,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_queries,
        (SELECT ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2)
         FROM pg_stat_user_tables WHERE tablename = 'shapes') as dead_row_percent
)
SELECT 
    'Processing Rate' as metric,
    COALESCE(recent_processed::text || ' shapes in last 5 min', 'No recent processing') as value,
    CASE 
        WHEN recent_processed >= 50 THEN '✅ Healthy'
        WHEN recent_processed >= 20 THEN '⚠️ Slow'
        WHEN recent_processed > 0 THEN '❌ Very Slow'
        ELSE '⏸️ Not Processing'
    END as status
FROM health_metrics

UNION ALL

SELECT 
    'Avg Processing Time' as metric,
    COALESCE(recent_avg_time_ms::text || ' ms', 'N/A') as value,
    CASE 
        WHEN recent_avg_time_ms IS NULL THEN '⏸️ No Data'
        WHEN recent_avg_time_ms <= 50 THEN '✅ Excellent'
        WHEN recent_avg_time_ms <= 100 THEN '✅ Good'
        WHEN recent_avg_time_ms <= 200 THEN '⚠️ Acceptable'
        ELSE '❌ Slow'
    END as status
FROM health_metrics

UNION ALL

SELECT 
    'Database Load' as metric,
    active_queries::text || ' active queries' as value,
    CASE 
        WHEN active_queries <= 5 THEN '✅ Low'
        WHEN active_queries <= 10 THEN '⚠️ Moderate'
        ELSE '❌ High'
    END as status
FROM health_metrics

UNION ALL

SELECT 
    'Table Bloat' as metric,
    COALESCE(dead_row_percent::text || '% dead rows', 'Unknown') as value,
    CASE 
        WHEN dead_row_percent IS NULL THEN '❓ Unknown'
        WHEN dead_row_percent <= 10 THEN '✅ Healthy'
        WHEN dead_row_percent <= 20 THEN '⚠️ Moderate'
        ELSE '❌ High - Consider VACUUM'
    END as status
FROM health_metrics;

-- ============================================================
-- 10. PROCESSING SUMMARY DASHBOARD
-- ============================================================

-- Executive dashboard for monitoring
SELECT 
    'PERFORMANCE MONITORING DASHBOARD' as title,
    NOW() as report_time,
    (SELECT COUNT(*) FROM shapes WHERE shape_type IN ('circle', 'square', 'triangle')) as total_shapes,
    (SELECT COUNT(*) FROM shapes WHERE metrics->>'_processed_at' IS NOT NULL) as processed_shapes,
    (SELECT ROUND(AVG((metrics->>'_processing_time_ms')::numeric), 2) 
     FROM shapes WHERE metrics->>'_processing_time_ms' IS NOT NULL) as avg_processing_ms,
    (SELECT COUNT(DISTINCT DATE_TRUNC('minute', (metrics->>'_processed_at')::timestamp))
     FROM shapes WHERE metrics->>'_processed_at' IS NOT NULL) as processing_duration_minutes,
    (SELECT ROUND(
        COUNT(*) FILTER (WHERE metrics->>'_processed_at' IS NOT NULL) * 60.0 / 
        NULLIF(COUNT(DISTINCT DATE_TRUNC('minute', (metrics->>'_processed_at')::timestamp)), 0), 
        1
     ) FROM shapes WHERE shape_type IN ('circle', 'square', 'triangle')) as avg_shapes_per_minute;