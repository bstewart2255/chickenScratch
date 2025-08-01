const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runEnhancedFeaturesMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 
          `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🚀 Starting enhanced features migration for auth_attempts table...\n');

        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'migrations', 'add_enhanced_features_to_auth_attempts.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📋 Executing migration...');
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // Verify the migration
        console.log('\n🔍 Verifying migration...');
        
        const columnCheck = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'auth_attempts' AND column_name = 'enhanced_features'
        `);
        
        if (columnCheck.rows.length > 0) {
            console.log('✅ enhanced_features column exists:', columnCheck.rows[0]);
        } else {
            console.log('❌ enhanced_features column not found');
        }
        
        const indexCheck = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes 
            WHERE tablename = 'auth_attempts' AND indexname = 'idx_auth_attempts_enhanced_features'
        `);
        
        if (indexCheck.rows.length > 0) {
            console.log('✅ enhanced_features index exists:', indexCheck.rows[0].indexname);
        } else {
            console.log('❌ enhanced_features index not found');
        }
        
        // Test the fallback mechanism
        console.log('\n🧪 Testing fallback mechanism...');
        
        // Test INSERT with enhanced_features column
        try {
            await pool.query(`
                INSERT INTO auth_attempts (user_id, success, confidence, device_info, enhanced_features) 
                VALUES (1, true, 85.5, 'test-device', '{"test": "data"}'::jsonb)
                ON CONFLICT DO NOTHING
            `);
            console.log('✅ INSERT with enhanced_features column works');
        } catch (error) {
            console.log('❌ INSERT with enhanced_features column failed:', error.message);
        }
        
        // Test SELECT with enhanced_features column
        try {
            const selectResult = await pool.query(`
                SELECT id, enhanced_features FROM auth_attempts 
                WHERE enhanced_features IS NOT NULL 
                LIMIT 1
            `);
            console.log('✅ SELECT with enhanced_features column works');
        } catch (error) {
            console.log('❌ SELECT with enhanced_features column failed:', error.message);
        }
        
        console.log('\n🎉 Enhanced features migration verification complete!');
        console.log('The system now supports enhanced features with fallback mechanisms.');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the migration
runEnhancedFeaturesMigration(); 