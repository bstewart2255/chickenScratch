-- Migration 002: Add performance indexes
-- Author: Migration System
-- Date: 2025-08-01
-- Description: Creates indexes for improved query performance

BEGIN;

-- Create index on signatures table for user lookups with timestamp
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'signatures' 
        AND indexname = 'idx_signatures_user_created'
    ) THEN
        CREATE INDEX idx_signatures_user_created 
        ON signatures(user_id, created_at DESC);
        
        RAISE NOTICE 'Created index idx_signatures_user_created';
    ELSE
        RAISE NOTICE 'Index idx_signatures_user_created already exists';
    END IF;
END $$;

-- Create GIN index on enhanced_features for JSONB queries on signatures
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'signatures' 
        AND indexname = 'idx_signatures_enhanced_features'
    ) THEN
        CREATE INDEX idx_signatures_enhanced_features 
        ON signatures USING gin(enhanced_features) 
        WHERE enhanced_features IS NOT NULL;
        
        RAISE NOTICE 'Created GIN index idx_signatures_enhanced_features';
    ELSE
        RAISE NOTICE 'Index idx_signatures_enhanced_features already exists';
    END IF;
END $$;

-- Create index on shapes table for user lookups with timestamp
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'shapes' 
        AND indexname = 'idx_shapes_user_created'
    ) THEN
        CREATE INDEX idx_shapes_user_created 
        ON shapes(user_id, created_at DESC);
        
        RAISE NOTICE 'Created index idx_shapes_user_created';
    ELSE
        RAISE NOTICE 'Index idx_shapes_user_created already exists';
    END IF;
END $$;

-- Create index on shape_type for shapes table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'shapes' 
        AND indexname = 'idx_shapes_type'
    ) THEN
        CREATE INDEX idx_shapes_type 
        ON shapes(shape_type);
        
        RAISE NOTICE 'Created index idx_shapes_type';
    ELSE
        RAISE NOTICE 'Index idx_shapes_type already exists';
    END IF;
END $$;

-- Create GIN index on enhanced_features for JSONB queries on shapes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'shapes' 
        AND indexname = 'idx_shapes_enhanced_features'
    ) THEN
        CREATE INDEX idx_shapes_enhanced_features 
        ON shapes USING gin(enhanced_features) 
        WHERE enhanced_features IS NOT NULL;
        
        RAISE NOTICE 'Created GIN index idx_shapes_enhanced_features';
    ELSE
        RAISE NOTICE 'Index idx_shapes_enhanced_features already exists';
    END IF;
END $$;

-- Create index on auth_attempts for user authentication history
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'auth_attempts' 
        AND indexname = 'idx_auth_attempts_user_created'
    ) THEN
        CREATE INDEX idx_auth_attempts_user_created 
        ON auth_attempts(user_id, created_at DESC);
        
        RAISE NOTICE 'Created index idx_auth_attempts_user_created';
    ELSE
        RAISE NOTICE 'Index idx_auth_attempts_user_created already exists';
    END IF;
END $$;

-- Create index on auth_attempts for success/failure analysis
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'auth_attempts' 
        AND indexname = 'idx_auth_attempts_success'
    ) THEN
        CREATE INDEX idx_auth_attempts_success 
        ON auth_attempts(success, created_at DESC);
        
        RAISE NOTICE 'Created index idx_auth_attempts_success';
    ELSE
        RAISE NOTICE 'Index idx_auth_attempts_success already exists';
    END IF;
END $$;

-- Create indexes on drawings table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'drawings'
    ) THEN
        -- User and timestamp index
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'drawings' 
            AND indexname = 'idx_drawings_user_created'
        ) THEN
            CREATE INDEX idx_drawings_user_created 
            ON drawings(user_id, created_at DESC);
            
            RAISE NOTICE 'Created index idx_drawings_user_created';
        END IF;
        
        -- GIN index on enhanced_features
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'drawings' 
            AND indexname = 'idx_drawings_enhanced_features'
        ) THEN
            CREATE INDEX idx_drawings_enhanced_features 
            ON drawings USING gin(enhanced_features) 
            WHERE enhanced_features IS NOT NULL;
            
            RAISE NOTICE 'Created GIN index idx_drawings_enhanced_features';
        END IF;
    END IF;
END $$;

-- Analyze tables to update statistics after index creation
ANALYZE signatures;
ANALYZE shapes;
ANALYZE auth_attempts;

-- Analyze drawings if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'drawings'
    ) THEN
        ANALYZE drawings;
    END IF;
END $$;

-- Verification
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    -- Count indexes created
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename IN ('signatures', 'shapes', 'auth_attempts', 'drawings')
    AND indexname LIKE 'idx_%';
    
    RAISE NOTICE 'Total custom indexes created: %', index_count;
    
    IF index_count < 6 THEN
        RAISE WARNING 'Expected at least 6 indexes, found %', index_count;
    END IF;
END $$;

COMMIT;

-- Index usage hints
COMMENT ON INDEX idx_signatures_user_created IS 'Optimizes user signature history queries';
COMMENT ON INDEX idx_signatures_enhanced_features IS 'Optimizes JSONB queries on enhanced features';
COMMENT ON INDEX idx_shapes_user_created IS 'Optimizes user shape history queries';
COMMENT ON INDEX idx_shapes_type IS 'Optimizes shape type filtering';
COMMENT ON INDEX idx_auth_attempts_user_created IS 'Optimizes user authentication history';
COMMENT ON INDEX idx_auth_attempts_success IS 'Optimizes success/failure analysis';