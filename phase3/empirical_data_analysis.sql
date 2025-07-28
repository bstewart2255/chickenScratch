-- Phase 3: Comprehensive Empirical Data Analysis
-- Purpose: Analyze actual data across all tables to inform cleanup and monitoring strategies
-- Created: 2025-01-28

-- ============================================
-- SECTION 1: SIGNATURES TABLE ANALYSIS
-- ============================================

-- 1.1 Data format distribution in signatures table
SELECT 
    'Signatures Data Format Distribution' as analysis_type,
    data_format, 
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM signatures 
GROUP BY data_format
ORDER BY count DESC;

-- 1.2 Detailed content analysis of signature_data
SELECT 
    'Signatures Content Type Analysis' as analysis_type,
    data_format,
    CASE 
        WHEN signature_data IS NULL THEN 'NULL data'
        WHEN signature_data::text LIKE 'data:image/png;base64,%' THEN 'Base64 PNG'
        WHEN signature_data::text LIKE 'data:image/jpeg;base64,%' THEN 'Base64 JPEG'
        WHEN signature_data::text LIKE 'data:image%;base64,%' THEN 'Base64 Other'
        WHEN signature_data::text LIKE '%"strokes":%' THEN 'Stroke data JSON'
        WHEN signature_data::text LIKE '%stroke%' THEN 'Other stroke format'
        ELSE 'Unknown format'
    END as content_type,
    COUNT(*) as count,
    MIN(LENGTH(signature_data::text)) as min_data_length,
    MAX(LENGTH(signature_data::text)) as max_data_length,
    AVG(LENGTH(signature_data::text))::INTEGER as avg_data_length
FROM signatures
GROUP BY data_format, content_type
ORDER BY data_format, count DESC;

-- 1.3 Identify potential legacy or problematic data
SELECT 
    'Potential Legacy Data in Signatures' as analysis_type,
    id,
    user_id,
    data_format,
    CASE 
        WHEN signature_data IS NULL THEN 'NULL data'
        WHEN data_format = 'base64' AND signature_data::text NOT LIKE 'data:image%' THEN 'Invalid base64 format'
        WHEN data_format = 'stroke_data' AND signature_data::text NOT LIKE '%strokes%' THEN 'Invalid stroke format'
        WHEN data_format IS NULL THEN 'NULL format'
        ELSE 'Format OK'
    END as issue_type,
    created_at,
    LEFT(signature_data::text, 100) as data_preview
FROM signatures
WHERE 
    signature_data IS NULL OR
    data_format IS NULL OR
    (data_format = 'base64' AND signature_data::text NOT LIKE 'data:image%') OR
    (data_format = 'stroke_data' AND signature_data::text NOT LIKE '%strokes%')
LIMIT 20;

-- ============================================
-- SECTION 2: SHAPES TABLE ANALYSIS
-- ============================================

-- 2.1 Data format distribution in shapes table
SELECT 
    'Shapes Data Format Distribution' as analysis_type,
    data_format, 
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM shapes 
GROUP BY data_format
ORDER BY count DESC;

-- 2.2 Shape data content analysis
SELECT 
    'Shapes Content Type Analysis' as analysis_type,
    data_format,
    shape_type,
    CASE 
        WHEN shape_data IS NULL THEN 'NULL data'
        WHEN shape_data::text LIKE '%"strokes":%' THEN 'Stroke data JSON'
        WHEN shape_data::text LIKE '%stroke%' THEN 'Other stroke format'
        ELSE 'Unknown format'
    END as content_type,
    COUNT(*) as count,
    AVG(metrics_score)::NUMERIC(5,2) as avg_metrics_score
FROM shapes
GROUP BY data_format, shape_type, content_type
ORDER BY shape_type, count DESC;

-- 2.3 Metrics calculation success rate by format
SELECT 
    'Metrics Calculation Success Rate' as analysis_type,
    data_format,
    COUNT(*) as total_shapes,
    COUNT(CASE WHEN metrics_score IS NOT NULL THEN 1 END) as shapes_with_metrics,
    COUNT(CASE WHEN metrics_score IS NULL THEN 1 END) as shapes_without_metrics,
    ROUND(
        COALESCE(COUNT(CASE WHEN metrics_score IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 0), 
        2
    ) as metrics_success_rate
FROM shapes
GROUP BY data_format
ORDER BY total_shapes DESC;

-- ============================================
-- SECTION 3: SYSTEM-WIDE DATA INTEGRITY
-- ============================================

-- 3.1 Cross-table data format consistency
SELECT 
    'Cross-Table Format Summary' as analysis_type,
    'signatures' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN data_format = 'base64' THEN 1 END) as base64_count,
    COUNT(CASE WHEN data_format = 'stroke_data' THEN 1 END) as stroke_count,
    COUNT(CASE WHEN data_format IS NULL THEN 1 END) as null_format_count
FROM signatures
UNION ALL
SELECT 
    'Cross-Table Format Summary' as analysis_type,
    'shapes' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN data_format = 'base64' THEN 1 END) as base64_count,
    COUNT(CASE WHEN data_format = 'stroke_data' THEN 1 END) as stroke_count,
    COUNT(CASE WHEN data_format IS NULL THEN 1 END) as null_format_count
FROM shapes;

-- 3.2 Authentication attempts analysis
SELECT 
    'Authentication Success by Data Format' as analysis_type,
    s.data_format,
    COUNT(aa.id) as total_attempts,
    COUNT(CASE WHEN aa.success = true THEN 1 END) as successful_attempts,
    COUNT(CASE WHEN aa.success = false THEN 1 END) as failed_attempts,
    ROUND(
        COALESCE(COUNT(CASE WHEN aa.success = true THEN 1 END) * 100.0 / NULLIF(COUNT(aa.id), 0), 0), 
        2
    ) as success_rate
FROM auth_attempts aa
JOIN signatures s ON aa.signature_id = s.id
WHERE aa.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.data_format
ORDER BY total_attempts DESC;

-- 3.3 ML processing performance by format
SELECT 
    'ML Processing Performance' as analysis_type,
    s.data_format,
    COUNT(mp.id) as total_processings,
    AVG(mp.processing_time_ms)::INTEGER as avg_processing_time_ms,
    MIN(mp.processing_time_ms) as min_processing_time_ms,
    MAX(mp.processing_time_ms) as max_processing_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mp.processing_time_ms)::INTEGER as median_processing_time_ms
FROM ml_processings mp
JOIN signatures s ON mp.signature_id = s.id
WHERE mp.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.data_format
ORDER BY total_processings DESC;

-- ============================================
-- SECTION 4: DATA ANOMALY DETECTION
-- ============================================

-- 4.1 Identify orphaned records
SELECT 
    'Orphaned Records Analysis' as analysis_type,
    'signatures without users' as orphan_type,
    COUNT(*) as count
FROM signatures s
LEFT JOIN users u ON s.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 
    'Orphaned Records Analysis' as analysis_type,
    'shapes without users' as orphan_type,
    COUNT(*) as count
FROM shapes sh
LEFT JOIN users u ON sh.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 
    'Orphaned Records Analysis' as analysis_type,
    'auth_attempts without signatures' as orphan_type,
    COUNT(*) as count
FROM auth_attempts aa
LEFT JOIN signatures s ON aa.signature_id = s.id
WHERE s.id IS NULL;

-- 4.2 Data size analysis for storage optimization
SELECT 
    'Storage Analysis' as analysis_type,
    'signatures' as table_name,
    COUNT(*) as record_count,
    SUM(LENGTH(signature_data::text)) / 1024 / 1024 as total_data_mb,
    AVG(LENGTH(signature_data::text)) / 1024 as avg_data_kb,
    MAX(LENGTH(signature_data::text)) / 1024 as max_data_kb
FROM signatures
UNION ALL
SELECT 
    'Storage Analysis' as analysis_type,
    'shapes' as table_name,
    COUNT(*) as record_count,
    SUM(LENGTH(shape_data::text)) / 1024 / 1024 as total_data_mb,
    AVG(LENGTH(shape_data::text)) / 1024 as avg_data_kb,
    MAX(LENGTH(shape_data::text)) / 1024 as max_data_kb
FROM shapes;

-- ============================================
-- SECTION 5: TEMPORAL ANALYSIS
-- ============================================

-- 5.1 Data format adoption over time
SELECT 
    'Format Adoption Timeline' as analysis_type,
    DATE_TRUNC('month', created_at) as month,
    data_format,
    COUNT(*) as count
FROM signatures
WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at), data_format
ORDER BY month DESC, count DESC;

-- 5.2 Recent data quality trends
SELECT 
    'Recent Data Quality Trends' as analysis_type,
    DATE(created_at) as date,
    COUNT(*) as total_records,
    COUNT(CASE WHEN data_format IS NULL THEN 1 END) as null_format_count,
    COUNT(CASE WHEN signature_data IS NULL THEN 1 END) as null_data_count,
    ROUND(
        COALESCE(COUNT(CASE WHEN data_format IS NOT NULL AND signature_data IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 0), 
        2
    ) as data_quality_score
FROM signatures
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- SECTION 6: RECOMMENDATIONS SUMMARY
-- ============================================

-- 6.1 Generate summary statistics for decision making
WITH summary_stats AS (
    SELECT 
        (SELECT COUNT(*) FROM signatures WHERE data_format IS NULL) as signatures_null_format,
        (SELECT COUNT(*) FROM signatures WHERE signature_data IS NULL) as signatures_null_data,
        (SELECT COUNT(*) FROM shapes WHERE data_format IS NULL) as shapes_null_format,
        (SELECT COUNT(*) FROM shapes WHERE shape_data IS NULL) as shapes_null_data,
        (SELECT COUNT(*) FROM signatures WHERE data_format = 'base64' AND signature_data::text NOT LIKE 'data:image%') as invalid_base64,
        (SELECT COUNT(*) FROM signatures WHERE data_format = 'stroke_data' AND signature_data::text NOT LIKE '%strokes%') as invalid_stroke
)
SELECT 
    'Data Quality Summary' as report_type,
    signatures_null_format,
    signatures_null_data,
    shapes_null_format,
    shapes_null_data,
    invalid_base64,
    invalid_stroke,
    (signatures_null_format + signatures_null_data + shapes_null_format + shapes_null_data + invalid_base64 + invalid_stroke) as total_issues
FROM summary_stats;