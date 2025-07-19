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
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shapes table
CREATE TABLE IF NOT EXISTS shapes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    shape_type VARCHAR(50),
    shape_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);