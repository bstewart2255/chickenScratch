-- Migration 003: Add is_enrollment column to signatures table
-- Author: Migration System
-- Date: 2025-08-01
-- Description: Adds boolean flag to distinguish enrollment signatures from verification signatures

BEGIN;

-- Add is_enrollment column to signatures table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'signatures' 
        AND column_name = 'is_enrollment'
    ) THEN
        ALTER TABLE signatures 
        ADD COLUMN is_enrollment BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Added is_enrollment column to signatures table';
        
        -- Set existing signatures as enrollment if they are the first 3 for each user
        -- This is a reasonable assumption for existing data
        WITH ranked_signatures AS (
            SELECT id, user_id,
                   ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) as rn
            FROM signatures
        )
        UPDATE signatures s
        SET is_enrollment = TRUE
        FROM ranked_signatures rs
        WHERE s.id = rs.id AND rs.rn <= 3;
        
        RAISE NOTICE 'Updated existing signatures to mark first 3 per user as enrollment';
    ELSE
        RAISE NOTICE 'is_enrollment column already exists in signatures table';
    END IF;
END $$;

-- Create index on is_enrollment for faster enrollment queries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'signatures' 
        AND indexname = 'idx_signatures_is_enrollment'
    ) THEN
        CREATE INDEX idx_signatures_is_enrollment 
        ON signatures(is_enrollment) 
        WHERE is_enrollment = TRUE;
        
        RAISE NOTICE 'Created partial index idx_signatures_is_enrollment';
    ELSE
        RAISE NOTICE 'Index idx_signatures_is_enrollment already exists';
    END IF;
END $$;

-- Create composite index for user enrollment signatures
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'signatures' 
        AND indexname = 'idx_signatures_user_enrollment'
    ) THEN
        CREATE INDEX idx_signatures_user_enrollment 
        ON signatures(user_id, is_enrollment, created_at DESC);
        
        RAISE NOTICE 'Created composite index idx_signatures_user_enrollment';
    ELSE
        RAISE NOTICE 'Index idx_signatures_user_enrollment already exists';
    END IF;
END $$;

-- Verification
DO $$
DECLARE
    col_exists BOOLEAN;
    enrollment_count INTEGER;
    total_count INTEGER;
BEGIN
    -- Check column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'signatures' 
        AND column_name = 'is_enrollment'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Failed to add is_enrollment column to signatures table';
    END IF;
    
    -- Count enrollment vs total signatures
    SELECT COUNT(*) INTO enrollment_count
    FROM signatures 
    WHERE is_enrollment = TRUE;
    
    SELECT COUNT(*) INTO total_count
    FROM signatures;
    
    RAISE NOTICE 'Enrollment signatures: %, Total signatures: %', enrollment_count, total_count;
    
    -- Verify each user has at least one enrollment signature if they have any signatures
    IF EXISTS (
        SELECT user_id 
        FROM signatures 
        GROUP BY user_id 
        HAVING COUNT(*) > 0 AND SUM(CASE WHEN is_enrollment THEN 1 ELSE 0 END) = 0
    ) THEN
        RAISE WARNING 'Some users have signatures but no enrollment signatures';
    END IF;
END $$;

COMMIT;

-- Add helpful constraint comment
COMMENT ON COLUMN signatures.is_enrollment IS 'TRUE for enrollment signatures used as reference, FALSE for verification attempts';