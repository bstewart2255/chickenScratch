const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration - use the same as in server.js
const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runEnhancedFeaturesMigration() {
    console.log('🚀 Running Enhanced Features Migration...\n');
    
    try {
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'migrations', 'add_enhanced_features_columns.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📋 Executing migration SQL...');
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('✅ Migration executed successfully!');
        
        // Verify the migration
        console.log('\n🔍 Verifying migration...');
        
        // Check if enhanced_features columns exist
        const shapesColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'shapes' AND column_name = 'enhanced_features'
        `);
        
        const drawingsColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'drawings' AND column_name = 'enhanced_features'
        `);
        
        // Check if indexes exist
        const shapesIndex = await pool.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'shapes' AND indexname = 'idx_shapes_enhanced_features'
        `);
        
        const drawingsIndex = await pool.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'drawings' AND indexname = 'idx_drawings_enhanced_features'
        `);
        
        // Report results
        console.log('\n📊 Migration Verification Results:');
        
        if (shapesColumns.rows.length > 0) {
            console.log('✅ Shapes table has enhanced_features column:', shapesColumns.rows[0].data_type);
        } else {
            console.log('❌ Shapes table missing enhanced_features column');
        }
        
        if (drawingsColumns.rows.length > 0) {
            console.log('✅ Drawings table has enhanced_features column:', drawingsColumns.rows[0].data_type);
        } else {
            console.log('❌ Drawings table missing enhanced_features column');
        }
        
        if (shapesIndex.rows.length > 0) {
            console.log('✅ Shapes enhanced_features index created');
        } else {
            console.log('❌ Shapes enhanced_features index missing');
        }
        
        if (drawingsIndex.rows.length > 0) {
            console.log('✅ Drawings enhanced_features index created');
        } else {
            console.log('❌ Drawings enhanced_features index missing');
        }
        
        // Check existing data
        const shapesCount = await pool.query('SELECT COUNT(*) as count FROM shapes');
        const drawingsCount = await pool.query('SELECT COUNT(*) as count FROM drawings');
        
        console.log(`\n📈 Existing data: ${shapesCount.rows[0].count} shapes, ${drawingsCount.rows[0].count} drawings`);
        
        // Check how many records have enhanced_features
        const shapesWithFeatures = await pool.query('SELECT COUNT(*) as count FROM shapes WHERE enhanced_features IS NOT NULL');
        const drawingsWithFeatures = await pool.query('SELECT COUNT(*) as count FROM drawings WHERE enhanced_features IS NOT NULL');
        
        console.log(`📊 Records with enhanced_features: ${shapesWithFeatures.rows[0].count} shapes, ${drawingsWithFeatures.rows[0].count} drawings`);
        
        console.log('\n🎉 Enhanced Features Migration completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Restart the server to ensure all changes are loaded');
        console.log('2. Run the biometric fixes test to verify everything works');
        console.log('3. Monitor authentication logs for enhanced features usage');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the migration
if (require.main === module) {
    runEnhancedFeaturesMigration().catch(console.error);
}

module.exports = { runEnhancedFeaturesMigration }; 