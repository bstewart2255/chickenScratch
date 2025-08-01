-- Rollback for Migration 002: Remove performance indexes
-- Author: Migration System
-- Date: 2025-08-01
-- Description: Removes performance indexes from database tables

BEGIN;

-- Drop index on signatures table for user lookups
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'signatures' 
        AND indexname = 'idx_signatures_user_created'
    ) THEN
        DROP INDEX idx_signatures_user_created;
        RAISE NOTICE 'Dropped index idx_signatures_user_created';
    ELSE
        RAISE NOTICE 'Index idx_signatures_user_created does not exist';
    END IF;
END $$;

-- Drop GIN index on enhanced_features for signatures
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'signatures' 
        AND indexname = 'idx_signatures_enhanced_features'
    ) THEN
        DROP INDEX idx_signatures_enhanced_features;
        RAISE NOTICE 'Dropped index idx_signatures_enhanced_features';
    ELSE
        RAISE NOTICE 'Index idx_signatures_enhanced_features does not exist';
    END IF;
END $$;

-- Drop index on shapes table for user lookups
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'shapes' 
        AND indexname = 'idx_shapes_user_created'
    ) THEN
        DROP INDEX idx_shapes_user_created;
        RAISE NOTICE 'Dropped index idx_shapes_user_created';
    ELSE
        RAISE NOTICE 'Index idx_shapes_user_created does not exist';
    END IF;
END $$;

-- Drop index on shape_type
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'shapes' 
        AND indexname = 'idx_shapes_type'
    ) THEN
        DROP INDEX idx_shapes_type;
        RAISE NOTICE 'Dropped index idx_shapes_type';
    ELSE
        RAISE NOTICE 'Index idx_shapes_type does not exist';
    END IF;
END $$;

-- Drop GIN index on enhanced_features for shapes
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'shapes' 
        AND indexname = 'idx_shapes_enhanced_features'
    ) THEN
        DROP INDEX idx_shapes_enhanced_features;
        RAISE NOTICE 'Dropped index idx_shapes_enhanced_features';
    ELSE
        RAISE NOTICE 'Index idx_shapes_enhanced_features does not exist';
    END IF;
END $$;

-- Drop index on auth_attempts for user history
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'auth_attempts' 
        AND indexname = 'idx_auth_attempts_user_created'
    ) THEN
        DROP INDEX idx_auth_attempts_user_created;
        RAISE NOTICE 'Dropped index idx_auth_attempts_user_created';
    ELSE
        RAISE NOTICE 'Index idx_auth_attempts_user_created does not exist';
    END IF;
END $$;

-- Drop index on auth_attempts for success analysis
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'auth_attempts' 
        AND indexname = 'idx_auth_attempts_success'
    ) THEN
        DROP INDEX idx_auth_attempts_success;
        RAISE NOTICE 'Dropped index idx_auth_attempts_success';
    ELSE
        RAISE NOTICE 'Index idx_auth_attempts_success does not exist';
    END IF;
END $$;

-- Drop indexes on drawings table if they exist
DO $$
BEGIN
    -- User and timestamp index
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'drawings' 
        AND indexname = 'idx_drawings_user_created'
    ) THEN
        DROP INDEX idx_drawings_user_created;
        RAISE NOTICE 'Dropped index idx_drawings_user_created';
    END IF;
    
    -- GIN index on enhanced_features
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'drawings' 
        AND indexname = 'idx_drawings_enhanced_features'
    ) THEN
        DROP INDEX idx_drawings_enhanced_features;
        RAISE NOTICE 'Dropped index idx_drawings_enhanced_features';
    END IF;
END $$;

-- Verification
DO $$
DECLARE
    remaining_indexes INTEGER;
BEGIN
    -- Count remaining custom indexes
    SELECT COUNT(*) INTO remaining_indexes
    FROM pg_indexes
    WHERE tablename IN ('signatures', 'shapes', 'auth_attempts', 'drawings')
    AND indexname IN (
        'idx_signatures_user_created',
        'idx_signatures_enhanced_features',
        'idx_shapes_user_created',
        'idx_shapes_type',
        'idx_shapes_enhanced_features',
        'idx_auth_attempts_user_created',
        'idx_auth_attempts_success',
        'idx_drawings_user_created',
        'idx_drawings_enhanced_features'
    );
    
    IF remaining_indexes > 0 THEN
        RAISE EXCEPTION 'Failed to remove all indexes. % indexes remain', remaining_indexes;
    ELSE
        RAISE NOTICE 'All custom indexes removed successfully';
    END IF;
END $$;

COMMIT;