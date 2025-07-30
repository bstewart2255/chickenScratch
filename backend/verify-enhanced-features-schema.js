const { Pool } = require('pg');
require('dotenv').config();

async function verifyEnhancedFeaturesSchema() {
    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL || 
          `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    try {
        // Check if enhanced_features column exists in auth_attempts table
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'auth_attempts' AND column_name = 'enhanced_features'
        `);
        
        if (result.rows.length === 0) {
            console.log('❌ enhanced_features column does not exist in auth_attempts table');
            console.log('Creating enhanced_features column...');
            
            await pool.query(`
                ALTER TABLE auth_attempts 
                ADD COLUMN enhanced_features JSONB
            `);
            
            console.log('✅ Enhanced features column created');
            
            // Create index for performance
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_auth_attempts_enhanced_features 
                ON auth_attempts USING gin(enhanced_features)
            `);
            
            console.log('✅ Enhanced features index created');
        } else {
            console.log('✅ Enhanced features column already exists:', result.rows[0]);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error verifying enhanced features schema:', error);
        return false;
    } finally {
        await pool.end();
    }
}

// Run verification
verifyEnhancedFeaturesSchema();