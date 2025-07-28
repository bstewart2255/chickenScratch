-- Phase 1: Backup Procedure with Verification
-- Purpose: Create comprehensive backup of affected data before migration
-- Critical: Execute this BEFORE any data modifications

-- ============================================
-- STEP 1: CREATE BACKUP SCHEMA
-- ============================================
CREATE SCHEMA IF NOT EXISTS backup_phase1_data_format;

-- ============================================
-- STEP 2: BACKUP AFFECTED SHAPES TABLE DATA
-- ============================================

-- Create backup table with timestamp
CREATE TABLE backup_phase1_data_format.shapes_backup_20250128 AS
SELECT 
    s.*,
    NOW() as backup_timestamp,
    current_user as backup_by,
    'pre_data_format_fix' as backup_reason
FROM shapes s
WHERE s.data_format = 'base64';

-- Create index on backup table for faster recovery
CREATE INDEX idx_shapes_backup_id ON backup_phase1_data_format.shapes_backup_20250128(id);
CREATE INDEX idx_shapes_backup_data_format ON backup_phase1_data_format.shapes_backup_20250128(data_format);

-- ============================================
-- STEP 3: BACKUP RELATED DATA
-- ============================================

-- Backup authentication attempts for affected shapes
CREATE TABLE backup_phase1_data_format.auth_attempts_backup_20250128 AS
SELECT 
    aa.*,
    NOW() as backup_timestamp
FROM authentication_attempts aa
WHERE aa.shape_id IN (
    SELECT id FROM shapes WHERE data_format = 'base64'
);

-- Backup any metrics data for affected shapes
CREATE TABLE backup_phase1_data_format.shape_metrics_backup_20250128 AS
SELECT 
    id,
    metrics,
    created_at,
    updated_at,
    NOW() as backup_timestamp
FROM shapes
WHERE data_format = 'base64' AND metrics IS NOT NULL;

-- ============================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================

-- Verify backup completeness
WITH backup_verification AS (
    SELECT 
        'Original shapes count' as check_type,
        COUNT(*) as count
    FROM shapes 
    WHERE data_format = 'base64'
    
    UNION ALL
    
    SELECT 
        'Backed up shapes count' as check_type,
        COUNT(*) as count
    FROM backup_phase1_data_format.shapes_backup_20250128
    
    UNION ALL
    
    SELECT 
        'Auth attempts backed up' as check_type,
        COUNT(*) as count
    FROM backup_phase1_data_format.auth_attempts_backup_20250128
)
SELECT * FROM backup_verification;

-- Verify data integrity with checksums
WITH checksum_verification AS (
    SELECT 
        'Original data checksum' as checksum_type,
        MD5(string_agg(
            id::text || COALESCE(shape_data::text, 'null') || COALESCE(data_format, 'null'), 
            ',' ORDER BY id
        )) as checksum
    FROM shapes 
    WHERE data_format = 'base64'
    
    UNION ALL
    
    SELECT 
        'Backup data checksum' as checksum_type,
        MD5(string_agg(
            id::text || COALESCE(shape_data::text, 'null') || COALESCE(data_format, 'null'), 
            ',' ORDER BY id
        )) as checksum
    FROM backup_phase1_data_format.shapes_backup_20250128
)
SELECT * FROM checksum_verification;

-- Sample comparison to ensure data matches
SELECT 
    'Data comparison - first 5 records' as check_type,
    o.id,
    o.data_format as original_format,
    b.data_format as backup_format,
    o.shape_data = b.shape_data as data_matches,
    o.created_at = b.created_at as timestamps_match
FROM shapes o
JOIN backup_phase1_data_format.shapes_backup_20250128 b ON o.id = b.id
WHERE o.data_format = 'base64'
LIMIT 5;

-- ============================================
-- STEP 5: CREATE RECOVERY SCRIPT
-- ============================================

-- Generate recovery script (DO NOT EXECUTE unless needed)
SELECT '-- EMERGENCY RECOVERY SCRIPT - DO NOT EXECUTE UNLESS ROLLBACK NEEDED' as warning;

SELECT FORMAT(
    'UPDATE shapes SET data_format = %L, shape_data = %L, metrics = %L, updated_at = NOW() WHERE id = %s;',
    data_format,
    shape_data,
    metrics,
    id
) as recovery_sql
FROM backup_phase1_data_format.shapes_backup_20250128
ORDER BY id;

-- ============================================
-- STEP 6: BACKUP METADATA
-- ============================================

-- Store backup metadata
CREATE TABLE IF NOT EXISTS backup_phase1_data_format.backup_metadata (
    backup_id SERIAL PRIMARY KEY,
    backup_name VARCHAR(255),
    backup_timestamp TIMESTAMP DEFAULT NOW(),
    source_table VARCHAR(255),
    record_count INTEGER,
    checksum VARCHAR(32),
    backup_by VARCHAR(255) DEFAULT current_user,
    notes TEXT
);

INSERT INTO backup_phase1_data_format.backup_metadata (
    backup_name,
    source_table,
    record_count,
    checksum,
    notes
)
SELECT 
    'phase1_data_format_fix_20250128' as backup_name,
    'shapes' as source_table,
    COUNT(*) as record_count,
    MD5(string_agg(
        id::text || COALESCE(shape_data::text, 'null') || COALESCE(data_format, 'null'), 
        ',' ORDER BY id
    )) as checksum,
    'Backup before fixing data_format from base64 to stroke_data for 115 shape records' as notes
FROM backup_phase1_data_format.shapes_backup_20250128;

-- ============================================
-- FINAL VERIFICATION
-- ============================================

SELECT 
    'BACKUP COMPLETE' as status,
    json_build_object(
        'backup_schema', 'backup_phase1_data_format',
        'shapes_backed_up', (SELECT COUNT(*) FROM backup_phase1_data_format.shapes_backup_20250128),
        'auth_attempts_backed_up', (SELECT COUNT(*) FROM backup_phase1_data_format.auth_attempts_backup_20250128),
        'backup_timestamp', NOW(),
        'backup_user', current_user,
        'checksum_match', (
            SELECT 
                (SELECT MD5(string_agg(id::text || shape_data::text, ',' ORDER BY id)) 
                 FROM shapes WHERE data_format = 'base64') = 
                (SELECT MD5(string_agg(id::text || shape_data::text, ',' ORDER BY id)) 
                 FROM backup_phase1_data_format.shapes_backup_20250128)
        )
    ) as backup_summary;

-- ============================================
-- IMPORTANT NOTES
-- ============================================
-- 1. This backup is table-specific and includes only affected records
-- 2. Full database backup should also be taken before migration
-- 3. Backup tables are timestamped for easy identification
-- 4. Recovery script is generated but not executed
-- 5. All backups are verified with checksums
-- 6. Keep backup for at least 30 days after successful migration