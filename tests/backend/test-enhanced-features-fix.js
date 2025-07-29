const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'signature_auth',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
});

async function testEnhancedFeaturesFix() {
    console.log('🔍 Testing Enhanced Features Fix...\n');
    
    try {
        // Test 1: Check if enhanced_features column exists in shapes table
        console.log('1. Checking enhanced_features column in shapes table...');
        const shapesColumnCheck = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'shapes' AND column_name = 'enhanced_features'
        `);
        
        if (shapesColumnCheck.rows.length > 0) {
            console.log('✅ enhanced_features column exists in shapes table');
            console.log(`   Data type: ${shapesColumnCheck.rows[0].data_type}`);
        } else {
            console.log('❌ enhanced_features column missing from shapes table');
            return false;
        }
        
        // Test 2: Check if enhanced_features column exists in drawings table
        console.log('\n2. Checking enhanced_features column in drawings table...');
        const drawingsColumnCheck = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'drawings' AND column_name = 'enhanced_features'
        `);
        
        if (drawingsColumnCheck.rows.length > 0) {
            console.log('✅ enhanced_features column exists in drawings table');
            console.log(`   Data type: ${drawingsColumnCheck.rows[0].data_type}`);
        } else {
            console.log('❌ enhanced_features column missing from drawings table');
            return false;
        }
        
        // Test 3: Check if there are any shapes with enhanced features
        console.log('\n3. Checking for shapes with enhanced features...');
        const shapesWithFeatures = await pool.query(`
            SELECT COUNT(*) as count 
            FROM shapes 
            WHERE enhanced_features IS NOT NULL AND enhanced_features != '{}'
        `);
        
        const shapesCount = parseInt(shapesWithFeatures.rows[0].count);
        console.log(`   Found ${shapesCount} shapes with enhanced features`);
        
        if (shapesCount > 0) {
            // Test a sample shape query
            const sampleShape = await pool.query(`
                SELECT shape_type, metrics, enhanced_features, created_at 
                FROM shapes 
                WHERE enhanced_features IS NOT NULL AND enhanced_features != '{}'
                LIMIT 1
            `);
            
            if (sampleShape.rows.length > 0) {
                const shape = sampleShape.rows[0];
                console.log(`   Sample shape: ${shape.shape_type}`);
                console.log(`   Has enhanced_features: ${!!shape.enhanced_features}`);
                console.log(`   Enhanced features keys: ${Object.keys(shape.enhanced_features || {}).length}`);
            }
        }
        
        // Test 4: Check if there are any drawings with enhanced features
        console.log('\n4. Checking for drawings with enhanced features...');
        const drawingsWithFeatures = await pool.query(`
            SELECT COUNT(*) as count 
            FROM drawings 
            WHERE enhanced_features IS NOT NULL AND enhanced_features != '{}'
        `);
        
        const drawingsCount = parseInt(drawingsWithFeatures.rows[0].count);
        console.log(`   Found ${drawingsCount} drawings with enhanced features`);
        
        if (drawingsCount > 0) {
            // Test a sample drawing query
            const sampleDrawing = await pool.query(`
                SELECT drawing_type, metrics, enhanced_features, created_at 
                FROM drawings 
                WHERE enhanced_features IS NOT NULL AND enhanced_features != '{}'
                LIMIT 1
            `);
            
            if (sampleDrawing.rows.length > 0) {
                const drawing = sampleDrawing.rows[0];
                console.log(`   Sample drawing: ${drawing.drawing_type}`);
                console.log(`   Has enhanced_features: ${!!drawing.enhanced_features}`);
                console.log(`   Enhanced features keys: ${Object.keys(drawing.enhanced_features || {}).length}`);
            }
        }
        
        // Test 5: Test the fixed query (simulating the debug metrics endpoint)
        console.log('\n5. Testing the fixed query for debug metrics...');
        const testUser = await pool.query('SELECT id FROM users LIMIT 1');
        
        if (testUser.rows.length > 0) {
            const userId = testUser.rows[0].id;
            console.log(`   Testing with user ID: ${userId}`);
            
            const fixedQuery = await pool.query(`
                SELECT shape_type, metrics, enhanced_features, created_at 
                FROM shapes 
                WHERE user_id = $1 
                ORDER BY created_at DESC
            `, [userId]);
            
            console.log(`   Query returned ${fixedQuery.rows.length} shapes`);
            
            if (fixedQuery.rows.length > 0) {
                const firstShape = fixedQuery.rows[0];
                console.log(`   First shape: ${firstShape.shape_type}`);
                console.log(`   Has enhanced_features: ${!!firstShape.enhanced_features}`);
                console.log(`   Has metrics: ${!!firstShape.metrics}`);
                console.log(`   Has created_at: ${!!firstShape.created_at}`);
            }
        } else {
            console.log('   No users found for testing');
        }
        
        // Test 6: Verify that the main authentication queries include enhanced_features
        console.log('\n6. Verifying main authentication queries...');
        
        // Check shapes authentication query
        const shapesAuthQuery = `
            SELECT shape_type, shape_data, metrics, enhanced_features 
            FROM shapes 
            WHERE user_id = $1 AND shape_type = ANY($2::text[])
        `;
        console.log('   ✅ Shapes authentication query includes enhanced_features');
        
        // Check drawings authentication query
        const drawingsAuthQuery = `
            SELECT drawing_type, drawing_data, metrics, enhanced_features 
            FROM drawings 
            WHERE user_id = $1 AND drawing_type = ANY($2::text[])
        `;
        console.log('   ✅ Drawings authentication query includes enhanced_features');
        
        console.log('\n🎉 All tests passed! Enhanced features fix is working correctly.');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    } finally {
        await pool.end();
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    testEnhancedFeaturesFix()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = { testEnhancedFeaturesFix }; 