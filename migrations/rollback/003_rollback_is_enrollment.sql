-- Rollback for Migration 003: Remove is_enrollment column
-- Author: Migration System
-- Date: 2025-08-01
-- Description: Removes is_enrollment column and related indexes from signatures table

BEGIN;

-- Drop indexes first (must be done before dropping column)
DO $$
BEGIN
    -- Drop partial index
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'signatures' 
        AND indexname = 'idx_signatures_is_enrollment'
    ) THEN
        DROP INDEX idx_signatures_is_enrollment;
        RAISE NOTICE 'Dropped index idx_signatures_is_enrollment';
    ELSE
        RAISE NOTICE 'Index idx_signatures_is_enrollment does not exist';
    END IF;
    
    -- Drop composite index
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'signatures' 
        AND indexname = 'idx_signatures_user_enrollment'
    ) THEN
        DROP INDEX idx_signatures_user_enrollment;
        RAISE NOTICE 'Dropped index idx_signatures_user_enrollment';
    ELSE
        RAISE NOTICE 'Index idx_signatures_user_enrollment does not exist';
    END IF;
END $$;

-- Remove is_enrollment column from signatures table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'signatures' 
        AND column_name = 'is_enrollment'
    ) THEN
        ALTER TABLE signatures 
        DROP COLUMN is_enrollment;
        
        RAISE NOTICE 'Removed is_enrollment column from signatures table';
    ELSE
        RAISE NOTICE 'is_enrollment column does not exist in signatures table';
    END IF;
END $$;

-- Verification
DO $$
DECLARE
    col_exists BOOLEAN;
    idx_count INTEGER;
BEGIN
    -- Check column is removed
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'signatures' 
        AND column_name = 'is_enrollment'
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE EXCEPTION 'Failed to remove is_enrollment column from signatures table';
    END IF;
    
    -- Check indexes are removed
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE tablename = 'signatures'
    AND indexname IN ('idx_signatures_is_enrollment', 'idx_signatures_user_enrollment');
    
    IF idx_count > 0 THEN
        RAISE EXCEPTION 'Failed to remove all related indexes. % indexes remain', idx_count;
    END IF;
    
    RAISE NOTICE 'is_enrollment column and related indexes removed successfully';
END $$;

COMMIT;