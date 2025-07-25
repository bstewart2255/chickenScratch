-- Create drawings table for storing user drawing data
CREATE TABLE IF NOT EXISTS drawings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    drawing_type VARCHAR(50) NOT NULL CHECK (drawing_type IN ('face', 'star', 'house', 'connect_dots')),
    drawing_data JSONB NOT NULL,
    metrics JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    -- Ensure one drawing per type per user
    UNIQUE(user_id, drawing_type)
);

-- Create index for faster lookups
CREATE INDEX idx_drawings_user_id ON drawings(user_id);
CREATE INDEX idx_drawings_type ON drawings(drawing_type);

-- Add drawing scores to auth_attempts if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'auth_attempts' 
                  AND column_name = 'drawing_scores') THEN
        ALTER TABLE auth_attempts ADD COLUMN drawing_scores JSONB;
    END IF;
END $$;