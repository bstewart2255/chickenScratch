-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Signatures table
CREATE TABLE IF NOT EXISTS signatures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    signature_data JSONB NOT NULL,
    features JSONB,
    metrics JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shapes table
CREATE TABLE IF NOT EXISTS shapes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    shape_type VARCHAR(50),
    shape_data JSONB NOT NULL,
    metrics JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Authentication attempts table
CREATE TABLE IF NOT EXISTS auth_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    success BOOLEAN NOT NULL,
    confidence DECIMAL(5,2),
    device_info VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add metrics columns to existing tables (run these if tables already exist)
-- ALTER TABLE signatures ADD COLUMN IF NOT EXISTS metrics JSONB;
-- ALTER TABLE shapes ADD COLUMN IF NOT EXISTS metrics JSONB;