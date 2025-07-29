-- Add is_enrollment column to signatures table
-- This column will be used to identify enrollment signatures for baseline calculation

-- Add the column with a default value of false
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS is_enrollment BOOLEAN DEFAULT false;

-- Create an index on the column for better query performance
CREATE INDEX IF NOT EXISTS idx_signatures_is_enrollment ON signatures(is_enrollment);

-- Create a composite index for efficient user enrollment queries
CREATE INDEX IF NOT EXISTS idx_signatures_user_enrollment ON signatures(user_id, is_enrollment);

-- Add a comment to document the column's purpose
COMMENT ON COLUMN signatures.is_enrollment IS 'Flag indicating if this signature was used for user enrollment/baseline calculation'; 