-- Migration: Simplify Architecture - Remove temp tables and add signature_id to auth_attempts
-- Date: 2024-01-24
-- Description: This migration removes the temporary enrollment tables and adds proper foreign key relationships

BEGIN;

-- Step 1: Add signature_id column to auth_attempts table
ALTER TABLE auth_attempts 
ADD COLUMN signature_id INTEGER REFERENCES signatures(id);

-- Step 2: Add index for better query performance
CREATE INDEX idx_auth_attempts_signature_id ON auth_attempts(signature_id);
CREATE INDEX idx_signatures_user_id_created_at ON signatures(user_id, created_at DESC);
CREATE INDEX idx_auth_attempts_user_id_created_at ON auth_attempts(user_id, created_at DESC);

-- Step 3: Drop functions that depend on temp tables
DROP FUNCTION IF EXISTS cleanup_expired_enrollments();
DROP FUNCTION IF EXISTS get_enrollment_progress(VARCHAR);
DROP FUNCTION IF EXISTS complete_enrollment(VARCHAR);

-- Step 4: Drop temp tables (CASCADE will handle dependent objects)
DROP TABLE IF EXISTS temp_enrollment_steps CASCADE;
DROP TABLE IF EXISTS temp_enrollments CASCADE;

-- Step 5: Add comment to document the change
COMMENT ON COLUMN auth_attempts.signature_id IS 'Direct reference to the signature used for this authentication attempt';

-- Step 6: Create a function to help migrate existing data (optional - for historical data)
-- This attempts to match existing auth_attempts with signatures based on the 5-second window
-- Run this only if you want to populate signature_id for historical data
/*
UPDATE auth_attempts a
SET signature_id = (
    SELECT s.id 
    FROM signatures s
    WHERE s.user_id = a.user_id 
    AND s.created_at >= a.created_at - INTERVAL '5 seconds'
    AND s.created_at <= a.created_at + INTERVAL '5 seconds'
    ORDER BY ABS(EXTRACT(EPOCH FROM (s.created_at - a.created_at)))
    LIMIT 1
)
WHERE a.signature_id IS NULL;
*/

COMMIT;

-- Rollback script (save this separately):
/*
BEGIN;
-- Re-create temp tables
CREATE TABLE IF NOT EXISTS temp_enrollments (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL,
    flow_type VARCHAR(20) NOT NULL CHECK (flow_type IN ('signup', 'signin')),
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired')),
    device_info TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE TABLE IF NOT EXISTS temp_enrollment_steps (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER NOT NULL REFERENCES temp_enrollments(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_type VARCHAR(20) NOT NULL CHECK (step_type IN ('signature', 'shape', 'drawing')),
    instruction TEXT,
    signature_data TEXT NOT NULL,
    raw_data JSONB,
    metrics JSONB DEFAULT '{}',
    completed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(enrollment_id, step_number)
);

-- Remove signature_id column
ALTER TABLE auth_attempts DROP COLUMN signature_id;

-- Drop indexes
DROP INDEX IF EXISTS idx_auth_attempts_signature_id;
DROP INDEX IF EXISTS idx_signatures_user_id_created_at;
DROP INDEX IF EXISTS idx_auth_attempts_user_id_created_at;

COMMIT;
*/