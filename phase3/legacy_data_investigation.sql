-- Phase 3: Legacy Data Investigation Queries
-- Purpose: Deep dive into data patterns to understand the actual structure
-- Created: 2025-01-28

-- ============================================
-- SECTION 1: INVESTIGATE ACTUAL DATA STRUCTURE
-- ============================================

-- 1.1 Sample actual signature data structure
SELECT 
    'Sample Signature Data Structure' as analysis_type,
    id,
    data_format,
    jsonb_pretty(signature_data) as pretty_data
FROM signatures
WHERE data_format = 'stroke_data'
LIMIT 2;

-- 1.2 Investigate the JSON keys in signature_data
SELECT 
    'Signature Data Keys Analysis' as analysis_type,
    data_format,
    jsonb_object_keys(signature_data) as top_level_keys,
    COUNT(*) as count
FROM signatures
WHERE signature_data IS NOT NULL
GROUP BY data_format, jsonb_object_keys(signature_data)
ORDER BY data_format, count DESC;

-- 1.3 Check if signatures use 'raw' instead of 'strokes'
SELECT 
    'Signature Data Structure Pattern' as analysis_type,
    data_format,
    CASE 
        WHEN signature_data ? 'raw' THEN 'Uses "raw" key'
        WHEN signature_data ? 'strokes' THEN 'Uses "strokes" key'
        WHEN signature_data ? 'data' THEN 'Uses "data" key'
        ELSE 'Other structure'
    END as structure_pattern,
    COUNT(*) as count
FROM signatures
GROUP BY data_format, structure_pattern
ORDER BY data_format, count DESC;

-- 1.4 Analyze shape data structure
SELECT 
    'Shape Data Structure Pattern' as analysis_type,
    data_format,
    CASE 
        WHEN shape_data ? 'raw' THEN 'Uses "raw" key'
        WHEN shape_data ? 'strokes' THEN 'Uses "strokes" key'
        WHEN shape_data ? 'data' THEN 'Uses "data" key'
        ELSE 'Other structure'
    END as structure_pattern,
    COUNT(*) as count
FROM shapes
GROUP BY data_format, structure_pattern
ORDER BY data_format, count DESC;

-- ============================================
-- SECTION 2: AUTHENTICATION FAILURE ANALYSIS
-- ============================================

-- 2.1 Recent authentication attempts with detailed error info
SELECT 
    'Recent Auth Attempts Details' as analysis_type,
    aa.id,
    aa.signature_id,
    s.data_format,
    aa.success,
    aa.error_message,
    aa.created_at,
    LEFT(s.signature_data::text, 100) as signature_preview
FROM auth_attempts aa
JOIN signatures s ON aa.signature_id = s.id
WHERE aa.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY aa.created_at DESC
LIMIT 10;

-- 2.2 Authentication error patterns
SELECT 
    'Auth Error Patterns' as analysis_type,
    s.data_format,
    aa.error_message,
    COUNT(*) as error_count
FROM auth_attempts aa
JOIN signatures s ON aa.signature_id = s.id
WHERE aa.success = false
GROUP BY s.data_format, aa.error_message
ORDER BY error_count DESC;

-- ============================================
-- SECTION 3: DATA CONSISTENCY VERIFICATION
-- ============================================

-- 3.1 Check if all stroke_data signatures use 'raw' key
SELECT 
    'Stroke Data Consistency Check' as analysis_type,
    data_format,
    COUNT(*) as total_records,
    COUNT(CASE WHEN signature_data ? 'raw' THEN 1 END) as has_raw_key,
    COUNT(CASE WHEN signature_data ? 'strokes' THEN 1 END) as has_strokes_key,
    COUNT(CASE WHEN NOT (signature_data ? 'raw' OR signature_data ? 'strokes') THEN 1 END) as has_neither
FROM signatures
WHERE data_format = 'stroke_data'
GROUP BY data_format;

-- 3.2 Analyze the single base64 signature
SELECT 
    'Base64 Signature Analysis' as analysis_type,
    id,
    user_id,
    data_format,
    LENGTH(signature_data::text) as data_length,
    LEFT(signature_data::text, 200) as data_preview,
    created_at
FROM signatures
WHERE data_format = 'base64';

-- 3.3 Check if base64 signature is actually stroke data
SELECT 
    'Base64 Content Analysis' as analysis_type,
    id,
    CASE 
        WHEN signature_data::text LIKE '{"data": "data:image%' THEN 'Wrapped base64 image'
        WHEN signature_data::text LIKE 'data:image%' THEN 'Direct base64 image'
        WHEN signature_data::text LIKE '%"raw"%' THEN 'JSON with raw key'
        WHEN signature_data::text LIKE '%"strokes"%' THEN 'JSON with strokes key'
        ELSE 'Other format'
    END as content_type,
    LEFT(signature_data::text, 100) as preview
FROM signatures
WHERE data_format = 'base64';

-- ============================================
-- SECTION 4: CORRECTIVE ACTION RECOMMENDATIONS
-- ============================================

-- 4.1 Count records that would need correction
WITH correction_analysis AS (
    SELECT 
        'signatures' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN data_format = 'stroke_data' AND signature_data ? 'raw' THEN 1 END) as needs_raw_to_strokes,
        COUNT(CASE WHEN data_format = 'base64' AND signature_data::text LIKE '%"raw"%' THEN 1 END) as misclassified_base64
    FROM signatures
    UNION ALL
    SELECT 
        'shapes' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN data_format = 'stroke_data' AND shape_data ? 'raw' THEN 1 END) as needs_raw_to_strokes,
        COUNT(CASE WHEN data_format = 'base64' AND shape_data::text LIKE '%"raw"%' THEN 1 END) as misclassified_base64
    FROM shapes
)
SELECT 
    'Correction Requirements Summary' as analysis_type,
    *
FROM correction_analysis;

-- 4.2 Verify if system expects 'strokes' key
SELECT 
    'ML Processing Data Access Pattern' as analysis_type,
    mp.id,
    mp.signature_id,
    s.data_format,
    mp.success,
    mp.error_message,
    CASE 
        WHEN s.signature_data ? 'raw' THEN 'Has raw key'
        WHEN s.signature_data ? 'strokes' THEN 'Has strokes key'
        ELSE 'Other'
    END as data_key_type
FROM ml_processings mp
JOIN signatures s ON mp.signature_id = s.id
WHERE mp.created_at >= CURRENT_DATE - INTERVAL '7 days'
LIMIT 10;

-- ============================================
-- SECTION 5: SYSTEM EXPECTATIONS ANALYSIS
-- ============================================

-- 5.1 Check what the application code expects
-- This query helps understand if the mismatch is causing auth failures
SELECT 
    'Data Access Pattern Analysis' as analysis_type,
    'Signatures with raw key' as data_type,
    COUNT(*) as count,
    COUNT(CASE WHEN id IN (SELECT signature_id FROM auth_attempts WHERE success = true) THEN 1 END) as successful_auths,
    COUNT(CASE WHEN id IN (SELECT signature_id FROM auth_attempts WHERE success = false) THEN 1 END) as failed_auths
FROM signatures
WHERE signature_data ? 'raw'
UNION ALL
SELECT 
    'Data Access Pattern Analysis' as analysis_type,
    'Signatures with strokes key' as data_type,
    COUNT(*) as count,
    COUNT(CASE WHEN id IN (SELECT signature_id FROM auth_attempts WHERE success = true) THEN 1 END) as successful_auths,
    COUNT(CASE WHEN id IN (SELECT signature_id FROM auth_attempts WHERE success = false) THEN 1 END) as failed_auths
FROM signatures
WHERE signature_data ? 'strokes';

-- 5.2 Sample a working signature (if any exist)
SELECT 
    'Working Signature Example' as analysis_type,
    s.id,
    s.data_format,
    aa.success,
    jsonb_pretty(s.signature_data) as pretty_data
FROM signatures s
JOIN auth_attempts aa ON s.id = aa.signature_id
WHERE aa.success = true
LIMIT 1;