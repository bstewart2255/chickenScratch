-- Rollback for Migration 001: Remove enhanced_features columns
-- Author: Migration System
-- Date: 2025-08-01
-- Description: Removes enhanced_features columns from biometric tables

BEGIN;

-- Remove enhanced_features column from signatures table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'signatures' 
        AND column_name = 'enhanced_features'
    ) THEN
        ALTER TABLE signatures 
        DROP COLUMN enhanced_features;
        
        RAISE NOTICE 'Removed enhanced_features column from signatures table';
    ELSE
        RAISE NOTICE 'enhanced_features column does not exist in signatures table';
    END IF;
END $$;

-- Remove enhanced_features column from shapes table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shapes' 
        AND column_name = 'enhanced_features'
    ) THEN
        ALTER TABLE shapes 
        DROP COLUMN enhanced_features;
        
        RAISE NOTICE 'Removed enhanced_features column from shapes table';
    ELSE
        RAISE NOTICE 'enhanced_features column does not exist in shapes table';
    END IF;
END $$;

-- Remove enhanced_features column from drawings table if table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'drawings'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'drawings' 
            AND column_name = 'enhanced_features'
        ) THEN
            ALTER TABLE drawings 
            DROP COLUMN enhanced_features;
            
            RAISE NOTICE 'Removed enhanced_features column from drawings table';
        ELSE
            RAISE NOTICE 'enhanced_features column does not exist in drawings table';
        END IF;
    END IF;
END $$;

-- Verification
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
    
    IF sig_count > 0 THEN
        RAISE EXCEPTION 'Failed to remove enhanced_features from signatures table';
    END IF;
    
    -- Check shapes table
    SELECT COUNT(*) INTO shape_count
    FROM information_schema.columns 
    WHERE table_name = 'shapes' 
    AND column_name = 'enhanced_features';
    
    IF shape_count > 0 THEN
        RAISE EXCEPTION 'Failed to remove enhanced_features from shapes table';
    END IF;
    
    -- Check drawings table if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'drawings'
    ) THEN
        SELECT COUNT(*) INTO draw_count
        FROM information_schema.columns 
        WHERE table_name = 'drawings' 
        AND column_name = 'enhanced_features';
        
        IF draw_count > 0 THEN
            RAISE EXCEPTION 'Failed to remove enhanced_features from drawings table';
        END IF;
    END IF;
    
    RAISE NOTICE 'All enhanced_features columns removed successfully';
END $$;

COMMIT;