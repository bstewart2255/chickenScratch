// Script to update the database with metrics columns
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function updateDatabase() {
    try {
        console.log('Checking and updating database schema...');
        
        // Check if metrics column exists in signatures table
        const sigResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'signatures' 
            AND column_name = 'metrics'
        `);
        
        if (sigResult.rows.length === 0) {
            console.log('Adding metrics column to signatures table...');
            await pool.query('ALTER TABLE signatures ADD COLUMN metrics JSONB');
            console.log('✅ Added metrics column to signatures table');
        } else {
            console.log('✅ Metrics column already exists in signatures table');
        }
        
        // Check if metrics column exists in shapes table
        const shapeResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'shapes' 
            AND column_name = 'metrics'
        `);
        
        if (shapeResult.rows.length === 0) {
            console.log('Adding metrics column to shapes table...');
            await pool.query('ALTER TABLE shapes ADD COLUMN metrics JSONB');
            console.log('✅ Added metrics column to shapes table');
        } else {
            console.log('✅ Metrics column already exists in shapes table');
        }
        
        // Check current table structure
        console.log('\nCurrent signatures table structure:');
        const sigColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'signatures'
            ORDER BY ordinal_position
        `);
        console.table(sigColumns.rows);
        
        console.log('\nCurrent shapes table structure:');
        const shapeColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'shapes'
            ORDER BY ordinal_position
        `);
        console.table(shapeColumns.rows);
        
        // Check if auth_attempts table exists
        const authTableResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'auth_attempts'
        `);
        
        if (authTableResult.rows.length === 0) {
            console.log('Creating auth_attempts table...');
            await pool.query(`
                CREATE TABLE auth_attempts (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    success BOOLEAN NOT NULL,
                    confidence DECIMAL(5,2),
                    device_info VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            console.log('✅ Created auth_attempts table');
        } else {
            console.log('✅ Auth_attempts table already exists');
        }
        
        console.log('\n✅ Database update complete!');
        
    } catch (error) {
        console.error('Error updating database:', error);
    } finally {
        await pool.end();
    }
}

updateDatabase();