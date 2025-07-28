-- Phase 1: Pre-Migration Validation Script
-- Purpose: Validate and identify all records that need data_format correction
-- Expected: 115 shape records with incorrect 'base64' format

-- ============================================
-- VALIDATION QUERIES
-- ============================================

-- 1. Get total count of shapes with incorrect data_format
SELECT 
    '1. Total shapes with incorrect base64 format' as check_name,
    COUNT(*) as count
FROM shapes 
WHERE data_format = 'base64';

-- 2. Verify these records actually contain stroke data (have 'raw' key)
SELECT 
    '2. Shapes with base64 format that have raw stroke data' as check_name,
    COUNT(*) as count
FROM shapes 
WHERE data_format = 'base64' 
    AND shape_data::jsonb ? 'raw';

-- 3. Safety check: Ensure no shapes with base64 format lack the 'raw' key
SELECT 
    '3. Shapes with base64 format WITHOUT raw key (should be 0)' as check_name,
    COUNT(*) as count
FROM shapes 
WHERE data_format = 'base64' 
    AND NOT (shape_data::jsonb ? 'raw');

-- 4. Get sample of affected records for manual verification
SELECT 
    '4. Sample of affected records' as check_name,
    id,
    created_at,
    data_format,
    jsonb_pretty(shape_data::jsonb) as shape_data_preview
FROM shapes 
WHERE data_format = 'base64' 
    AND shape_data::jsonb ? 'raw'
LIMIT 5;

-- 5. Verify data integrity - check for any null shape_data
SELECT 
    '5. Shapes with NULL shape_data (should be 0)' as check_name,
    COUNT(*) as count
FROM shapes 
WHERE data_format = 'base64' 
    AND shape_data IS NULL;

-- 6. Distribution of data formats across all shapes
SELECT 
    '6. Distribution of data formats' as check_name,
    data_format,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM shapes) * 100, 2) as percentage
FROM shapes
GROUP BY data_format
ORDER BY count DESC;

-- 7. Verify no foreign key dependencies would be affected
SELECT 
    '7. Authentication attempts linked to affected shapes' as check_name,
    COUNT(DISTINCT aa.id) as auth_attempts_count,
    COUNT(DISTINCT s.id) as affected_shapes_count
FROM shapes s
JOIN authentication_attempts aa ON aa.shape_id = s.id
WHERE s.data_format = 'base64';

-- 8. Check for any shapes with metrics that would be affected
SELECT 
    '8. Affected shapes that already have metrics' as check_name,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE metrics IS NOT NULL) as with_metrics,
    COUNT(*) FILTER (WHERE metrics IS NULL) as without_metrics
FROM shapes 
WHERE data_format = 'base64';

-- 9. Generate checksums for validation
WITH affected_shapes AS (
    SELECT id, shape_data
    FROM shapes 
    WHERE data_format = 'base64' 
        AND shape_data::jsonb ? 'raw'
)
SELECT 
    '9. Checksum for affected records' as check_name,
    MD5(string_agg(id::text || shape_data::text, ',' ORDER BY id)) as checksum,
    COUNT(*) as record_count
FROM affected_shapes;

-- 10. Final safety check - ensure we're only updating the expected records
SELECT 
    '10. Final validation summary' as check_name,
    json_build_object(
        'total_shapes', (SELECT COUNT(*) FROM shapes),
        'shapes_to_update', (SELECT COUNT(*) FROM shapes WHERE data_format = 'base64' AND shape_data::jsonb ? 'raw'),
        'shapes_already_correct', (SELECT COUNT(*) FROM shapes WHERE data_format = 'stroke_data'),
        'database_name', current_database(),
        'execution_time', NOW()
    ) as summary;

-- ============================================
-- EXPECTED RESULTS
-- ============================================
-- Check 1: Should return 115
-- Check 2: Should return 115 (all base64 shapes have raw data)
-- Check 3: Should return 0 (no base64 shapes without raw data)
-- Check 4: Sample records for manual review
-- Check 5: Should return 0 (no NULL shape_data)
-- Check 6: Shows distribution of all data formats
-- Check 7: Shows impact on authentication attempts
-- Check 8: Shows metrics distribution for affected shapes
-- Check 9: Generates checksum for rollback validation
-- Check 10: Final summary for go/no-go decision