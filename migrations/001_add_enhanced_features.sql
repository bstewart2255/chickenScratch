-- Migration 001: Add enhanced_features column to biometric tables
-- Author: Migration System
-- Date: 2025-08-01
-- Description: Adds JSONB column for storing enhanced biometric features

BEGIN;

-- Add enhanced_features column to signatures table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'signatures' 
        AND column_name = 'enhanced_features'
    ) THEN
        ALTER TABLE signatures 
        ADD COLUMN enhanced_features JSONB;
        
        RAISE NOTICE 'Added enhanced_features column to signatures table';
    ELSE
        RAISE NOTICE 'enhanced_features column already exists in signatures table';
    END IF;
END $$;

-- Add enhanced_features column to shapes table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shapes' 
        AND column_name = 'enhanced_features'
    ) THEN
        ALTER TABLE shapes 
        ADD COLUMN enhanced_features JSONB;
        
        RAISE NOTICE 'Added enhanced_features column to shapes table';
    ELSE
        RAISE NOTICE 'enhanced_features column already exists in shapes table';
    END IF;
END $$;

-- Add enhanced_features column to drawings table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drawings' 
        AND column_name = 'enhanced_features'
    ) THEN
        ALTER TABLE drawings 
        ADD COLUMN enhanced_features JSONB;
        
        RAISE NOTICE 'Added enhanced_features column to drawings table';
    ELSE
        RAISE NOTICE 'enhanced_features column already exists in drawings table';
    END IF;
END $$;

-- Verification queries
DO $$
DECLARE
    sig_count INTEGER;
    shape_count INTEGER;
    draw_count INTEGER;
BEGIN
    -- Check signatures table
    SELECT COUNT(*) INTO sig_count
    FROM information_schema.columns 
    WHERE table_name = 'signatures' 
    AND column_name = 'enhanced_features';
    
    IF sig_count = 0 THEN
        RAISE EXCEPTION 'Failed to add enhanced_features to signatures table';
    END IF;
    
    -- Check shapes table
    SELECT COUNT(*) INTO shape_count
    FROM information_schema.columns 
    WHERE table_name = 'shapes' 
    AND column_name = 'enhanced_features';
    
    IF shape_count = 0 THEN
        RAISE EXCEPTION 'Failed to add enhanced_features to shapes table';
    END IF;
    
    -- Check drawings table (only if table exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'drawings'
    ) THEN
        SELECT COUNT(*) INTO draw_count
        FROM information_schema.columns 
        WHERE table_name = 'drawings' 
        AND column_name = 'enhanced_features';
        
        IF draw_count = 0 THEN
            RAISE EXCEPTION 'Failed to add enhanced_features to drawings table';
        END IF;
    END IF;
    
    RAISE NOTICE 'All enhanced_features columns verified successfully';
END $$;

COMMIT;

-- Migration metadata
COMMENT ON COLUMN signatures.enhanced_features IS 'Enhanced biometric features in JSONB format for improved authentication';
COMMENT ON COLUMN shapes.enhanced_features IS 'Enhanced shape features in JSONB format for improved authentication';
COMMENT ON COLUMN drawings.enhanced_features IS 'Enhanced drawing features in JSONB format for improved authentication';