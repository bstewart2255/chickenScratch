require('dotenv').config();
const { Pool } = require('pg');
// const fs = require('fs');
// const path = require('path');

// Database connection (same as server.js)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
    ssl: {
        rejectUnauthorized: false
    }
});

// Debug connection
console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

// SQL migration commands
const migrationSQL = `
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

-- 4. Optional: Add a column to store compressed image data for display
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS display_image TEXT;
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS display_image TEXT;

-- 5. Create a function to generate display images from stroke data
CREATE OR REPLACE FUNCTION generate_display_image(stroke_data JSONB)
RETURNS TEXT AS $$
BEGIN
    -- This would call a Node.js function to generate base64 image
    -- For now, return NULL - will be handled by application layer
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Add comments for documentation
COMMENT ON COLUMN signatures.stroke_data IS 'Raw stroke data in JSON format for efficient storage and ML processing';
COMMENT ON COLUMN signatures.data_format IS 'Format of stored data: base64, stroke_data, or compressed';
COMMENT ON COLUMN signatures.display_image IS 'Optional base64 image for display purposes (generated from stroke_data)';
`;

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting database migration for stroke data storage...\n');
        
        // Test database connection
        console.log('📡 Testing database connection...');
        const testResult = await client.query('SELECT version();');
        console.log('✅ Database connected:', testResult.rows[0].version.split(' ')[0]);
        
        // Check current table structure
        console.log('\n📋 Checking current table structure...');
        const tableInfo = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'signatures' 
            ORDER BY ordinal_position;
        `);
        
        console.log('Current signatures table columns:');
        tableInfo.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Run migration SQL
        console.log('\n🔧 Running migration SQL...');
        await client.query(migrationSQL);
        console.log('✅ Migration SQL executed successfully');
        
        // Verify new columns were added
        console.log('\n🔍 Verifying new columns...');
        const newTableInfo = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'signatures' 
            AND column_name IN ('stroke_data', 'data_format', 'display_image')
            ORDER BY column_name;
        `);
        
        console.log('New columns added:');
        newTableInfo.rows.forEach(row => {
            console.log(`  ✅ ${row.column_name}: ${row.data_type}`);
        });
        
        // Check indexes
        console.log('\n🔍 Checking indexes...');
        const indexInfo = await client.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'signatures' 
            AND indexname LIKE '%stroke_data%';
        `);
        
        console.log('Stroke data indexes:');
        indexInfo.rows.forEach(row => {
            console.log(`  ✅ ${row.indexname}`);
        });
        
        // Count existing records
        console.log('\n📊 Checking existing data...');
        const countResult = await client.query('SELECT COUNT(*) as total FROM signatures;');
        const totalSignatures = countResult.rows[0].total;
        console.log(`Total signatures in database: ${totalSignatures.toLocaleString()}`);
        
        // Check data format distribution
        const formatResult = await client.query(`
            SELECT data_format, COUNT(*) as count 
            FROM signatures 
            GROUP BY data_format;
        `);
        
        console.log('Current data format distribution:');
        formatResult.rows.forEach(row => {
            console.log(`  - ${row.data_format || 'NULL'}: ${row.count.toLocaleString()}`);
        });
        
        console.log('\n🎉 Database migration completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Run the data migration script: node update_to_stroke_storage.js');
        console.log('2. Update your server.js to use stroke storage functions');
        console.log('3. Test the new functionality');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('\n✅ Migration completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runMigration }; 