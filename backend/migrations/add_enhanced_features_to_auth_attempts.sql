-- Migration: Add enhanced_features column to auth_attempts table
-- Date: 2025-07-30
-- Description: This migration adds the enhanced_features JSONB column to the auth_attempts table
--              to store comprehensive biometric features from all authentication components

BEGIN;

-- Step 1: Add enhanced_features column to auth_attempts table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'auth_attempts' 
                  AND column_name = 'enhanced_features') THEN
        ALTER TABLE auth_attempts ADD COLUMN enhanced_features JSONB;
        RAISE NOTICE 'enhanced_features column added to auth_attempts table';
    ELSE
        RAISE NOTICE 'enhanced_features column already exists in auth_attempts table';
    END IF;
END $$;

-- Step 2: Create GIN index for optimized query performance on JSONB data
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                  WHERE tablename = 'auth_attempts' 
                  AND indexname = 'idx_auth_attempts_enhanced_features') THEN
        CREATE INDEX idx_auth_attempts_enhanced_features 
        ON auth_attempts USING gin(enhanced_features);
        RAISE NOTICE 'idx_auth_attempts_enhanced_features index created';
    ELSE
        RAISE NOTICE 'idx_auth_attempts_enhanced_features index already exists';
    END IF;
END $$;

-- Step 3: Add comment to document the column purpose
COMMENT ON COLUMN auth_attempts.enhanced_features IS 'Stores comprehensive biometric features from all authentication components (signature, shapes, drawings) including 44+ features per component';

-- Step 4: Initialize existing records with empty JSONB object (optional)
-- This ensures consistent data structure for existing records
UPDATE auth_attempts 
SET enhanced_features = '{}'::jsonb
WHERE enhanced_features IS NULL;

-- Step 5: Verify the migration
DO $$
DECLARE
    column_exists BOOLEAN;
    index_exists BOOLEAN;
BEGIN
    -- Check if column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auth_attempts' 
        AND column_name = 'enhanced_features'
    ) INTO column_exists;
    
    -- Check if index exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'auth_attempts' 
        AND indexname = 'idx_auth_attempts_enhanced_features'
    ) INTO index_exists;
    
    IF column_exists AND index_exists THEN
        RAISE NOTICE '✅ Migration completed successfully: enhanced_features column and index created';
    ELSE
        RAISE EXCEPTION '❌ Migration failed: column_exists=%, index_exists=%', column_exists, index_exists;
    END IF;
END $$;

COMMIT;

-- Rollback script (save this separately):
/*
BEGIN;

-- Remove index
DROP INDEX IF EXISTS idx_auth_attempts_enhanced_features;

-- Remove column
ALTER TABLE auth_attempts DROP COLUMN IF EXISTS enhanced_features;

COMMIT;
*/ 