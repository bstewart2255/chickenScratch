-- Migration script to store stroke data instead of base64 images
-- This will significantly reduce storage size and improve performance

-- 1. Add new columns for stroke data
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS stroke_data JSONB;
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS stroke_data JSONB;

-- 2. Create index on stroke data for better query performance
CREATE INDEX IF NOT EXISTS idx_signatures_stroke_data ON signatures USING GIN (stroke_data);
CREATE INDEX IF NOT EXISTS idx_shapes_stroke_data ON shapes USING GIN (stroke_data);

-- 3. Add a column to track data format
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS data_format VARCHAR(20) DEFAULT 'base64';
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS data_format VARCHAR(20) DEFAULT 'base64';

-- 4. Create a function to extract stroke data from existing base64 data
-- (This would need to be run after converting existing data)

-- 5. Optional: Add a column to store compressed image data for display
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS display_image TEXT;
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS display_image TEXT;

-- 6. Create a function to generate display images from stroke data
CREATE OR REPLACE FUNCTION generate_display_image(stroke_data JSONB)
RETURNS TEXT AS $$
BEGIN
    -- This would call a Node.js function to generate base64 image
    -- For now, return NULL - will be handled by application layer
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Add comments for documentation
COMMENT ON COLUMN signatures.stroke_data IS 'Raw stroke data in JSON format for efficient storage and ML processing';
COMMENT ON COLUMN signatures.data_format IS 'Format of stored data: base64, stroke_data, or compressed';
COMMENT ON COLUMN signatures.display_image IS 'Optional base64 image for display purposes (generated from stroke_data)';
COMMENT ON COLUMN shapes.stroke_data IS 'Raw stroke data with coordinates and timestamps';
COMMENT ON COLUMN shapes.data_format IS 'Format of stored data: base64, stroke, or hybrid'; 