-- Migration to add enhanced_features JSONB columns for shapes and drawings
-- This enables storage of 44+ biometric features for each component type

-- Add enhanced_features column to shapes table
ALTER TABLE shapes 
ADD COLUMN IF NOT EXISTS enhanced_features JSONB;

-- Add enhanced_features column to drawings table
ALTER TABLE drawings 
ADD COLUMN IF NOT EXISTS enhanced_features JSONB;

-- Create GIN indexes for efficient JSONB queries
-- These indexes optimize queries on the enhanced_features JSONB data
CREATE INDEX IF NOT EXISTS idx_shapes_enhanced_features 
ON shapes USING gin(enhanced_features);

CREATE INDEX IF NOT EXISTS idx_drawings_enhanced_features 
ON drawings USING gin(enhanced_features);

-- Add comment to document the column purpose
COMMENT ON COLUMN shapes.enhanced_features IS 'Stores 44+ biometric features extracted from shape strokes including pressure, timing, geometric, and security metrics';
COMMENT ON COLUMN drawings.enhanced_features IS 'Stores 44+ biometric features extracted from drawing strokes including pressure, timing, geometric, and security metrics';

-- Update existing records to extract enhanced features (optional)
-- This can be run separately to gradually migrate existing data
/*
UPDATE shapes 
SET enhanced_features = '{}'::jsonb 
WHERE enhanced_features IS NULL;

UPDATE drawings 
SET enhanced_features = '{}'::jsonb 
WHERE enhanced_features IS NULL;
*/

-- Verification query to check migration success
DO $$ 
BEGIN
    -- Check if columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'shapes' 
              AND column_name = 'enhanced_features') THEN
        RAISE NOTICE 'shapes.enhanced_features column created successfully';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'drawings' 
              AND column_name = 'enhanced_features') THEN
        RAISE NOTICE 'drawings.enhanced_features column created successfully';
    END IF;
    
    -- Check if indexes exist
    IF EXISTS (SELECT 1 FROM pg_indexes 
              WHERE tablename = 'shapes' 
              AND indexname = 'idx_shapes_enhanced_features') THEN
        RAISE NOTICE 'idx_shapes_enhanced_features index created successfully';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes 
              WHERE tablename = 'drawings' 
              AND indexname = 'idx_drawings_enhanced_features') THEN
        RAISE NOTICE 'idx_drawings_enhanced_features index created successfully';
    END IF;
END $$;