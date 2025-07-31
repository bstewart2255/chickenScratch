-- Migration to remove base64 image columns from the database
-- This migration is safe to run multiple times as it checks for column existence before dropping

-- Start transaction
BEGIN;

-- Function to check if column exists
CREATE OR REPLACE FUNCTION column_exists(p_table_name text, p_column_name text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = p_table_name
        AND column_name = p_column_name
    );
END;
$$ LANGUAGE plpgsql;

-- Drop dependent views first
DROP VIEW IF EXISTS system_health_summary CASCADE;
DROP VIEW IF EXISTS storage_efficiency_monitor CASCADE;
DROP VIEW IF EXISTS system_status_overview CASCADE;
DROP VIEW IF EXISTS data_consistency_monitor CASCADE;

-- Remove signature_data column from signatures table
DO $$
BEGIN
    IF column_exists('signatures', 'signature_data') THEN
        ALTER TABLE signatures DROP COLUMN signature_data;
        RAISE NOTICE 'Dropped column signature_data from signatures table';
    ELSE
        RAISE NOTICE 'Column signature_data does not exist in signatures table';
    END IF;
END $$;

-- Remove shape_data column from shapes table
DO $$
BEGIN
    IF column_exists('shapes', 'shape_data') THEN
        ALTER TABLE shapes DROP COLUMN shape_data;
        RAISE NOTICE 'Dropped column shape_data from shapes table';
    ELSE
        RAISE NOTICE 'Column shape_data does not exist in shapes table';
    END IF;
END $$;

-- Remove drawing_data column from drawings table
DO $$
BEGIN
    IF column_exists('drawings', 'drawing_data') THEN
        ALTER TABLE drawings DROP COLUMN drawing_data;
        RAISE NOTICE 'Dropped column drawing_data from drawings table';
    ELSE
        RAISE NOTICE 'Column drawing_data does not exist in drawings table';
    END IF;
END $$;

-- Optional: Remove any other base64 image columns that might exist
-- Uncomment if you have these columns in your database

-- Remove signature_image from auth_attempts table if it exists
-- DO $$
-- BEGIN
--     IF column_exists('auth_attempts', 'signature_image') THEN
--         ALTER TABLE auth_attempts DROP COLUMN signature_image;
--         RAISE NOTICE 'Dropped column signature_image from auth_attempts table';
--     ELSE
--         RAISE NOTICE 'Column signature_image does not exist in auth_attempts table';
--     END IF;
-- END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS column_exists(text, text);

-- Commit transaction
COMMIT;

-- Verify the changes
\echo 'Verification: Current columns in affected tables'
\echo '================================================'
\echo ''
\echo 'Signatures table columns:'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'signatures'
ORDER BY ordinal_position;

\echo ''
\echo 'Shapes table columns:'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'shapes'
ORDER BY ordinal_position;

\echo ''
\echo 'Drawings table columns:'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'drawings'
ORDER BY ordinal_position;

\echo ''
\echo 'Migration completed successfully!'
\echo 'All base64 image columns have been removed from the database.'