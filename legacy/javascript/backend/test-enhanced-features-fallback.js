const { Pool } = require('pg');
require('dotenv').config();

async function testEnhancedFeaturesFallback() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 
          `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🧪 Testing Enhanced Features Fallback Mechanism\n');

        // Step 1: Check current schema
        console.log('1️⃣ Checking current database schema...');
        
        const columnCheck = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'auth_attempts' AND column_name = 'enhanced_features'
        `);
        
        const hasEnhancedFeaturesColumn = columnCheck.rows.length > 0;
        console.log(`   ${hasEnhancedFeaturesColumn ? '✅' : '❌'} enhanced_features column exists:`, hasEnhancedFeaturesColumn);
        
        if (hasEnhancedFeaturesColumn) {
            console.log('   Column details:', columnCheck.rows[0]);
        }

        // Step 2: Test INSERT operations
        console.log('\n2️⃣ Testing INSERT operations...');
        
        // Create a test user if it doesn't exist
        await pool.query(`
            INSERT INTO users (username) VALUES ('fallback_test_user')
            ON CONFLICT (username) DO NOTHING
        `);
        
        const userResult = await pool.query('SELECT id FROM users WHERE username = $1', ['fallback_test_user']);
        const userId = userResult.rows[0].id;
        
        // Create a test signature if it doesn't exist
        await pool.query(`
            INSERT INTO signatures (user_id, signature_data) 
            VALUES ($1, '{"test": "data"}'::jsonb)
            ON CONFLICT DO NOTHING
        `, [userId]);
        
        const signatureResult = await pool.query('SELECT id FROM signatures WHERE user_id = $1 LIMIT 1', [userId]);
        const signatureId = signatureResult.rows[0]?.id;
        
        // Test INSERT with enhanced features
        try {
            const enhancedFeaturesData = {
                signature: { test_feature: 1.0 },
                shapes: { circle: { test_feature: 0.8 } },
                drawings: { face: { test_feature: 0.9 } },
                _processing_summary: { total_features_collected: 3 }
            };
            
            await pool.query(`
                INSERT INTO auth_attempts (user_id, success, confidence, device_info, signature_id, drawing_scores, enhanced_features) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [userId, true, 85.5, 'test-device', signatureId, '{"test": "scores"}', JSON.stringify(enhancedFeaturesData)]);
            
            console.log('   ✅ INSERT with enhanced_features succeeded');
        } catch (error) {
            if (error.code === '42703') {
                console.log('   ⚠️ INSERT with enhanced_features failed (column missing) - this is expected without migration');
            } else {
                console.log('   ❌ INSERT with enhanced_features failed:', error.message);
            }
        }
        
        // Test INSERT without enhanced features (fallback)
        try {
            await pool.query(`
                INSERT INTO auth_attempts (user_id, success, confidence, device_info, signature_id, drawing_scores) 
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, true, 82.0, 'test-device-fallback', signatureId, '{"test": "scores-fallback"}']);
            
            console.log('   ✅ INSERT without enhanced_features succeeded (fallback)');
        } catch (error) {
            console.log('   ❌ INSERT without enhanced_features failed:', error.message);
        }

        // Step 3: Test SELECT operations
        console.log('\n3️⃣ Testing SELECT operations...');
        
        try {
            const resultWithEnhanced = await pool.query(`
                SELECT id, enhanced_features, drawing_scores
                FROM auth_attempts 
                WHERE user_id = $1 AND enhanced_features IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
            `, [userId]);
            
            if (resultWithEnhanced.rows.length > 0) {
                console.log('   ✅ SELECT with enhanced_features succeeded');
                console.log('   Sample data:', {
                    id: resultWithEnhanced.rows[0].id,
                    has_enhanced_features: !!resultWithEnhanced.rows[0].enhanced_features,
                    enhanced_features_keys: resultWithEnhanced.rows[0].enhanced_features ? Object.keys(resultWithEnhanced.rows[0].enhanced_features) : null
                });
            } else {
                console.log('   ⚠️ No records with enhanced_features found');
            }
        } catch (error) {
            if (error.code === '42703') {
                console.log('   ⚠️ SELECT with enhanced_features failed (column missing) - this is expected without migration');
            } else {
                console.log('   ❌ SELECT with enhanced_features failed:', error.message);
            }
        }
        
        // Test SELECT without enhanced features (fallback)
        try {
            const resultWithoutEnhanced = await pool.query(`
                SELECT id, drawing_scores
                FROM auth_attempts 
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 1
            `, [userId]);
            
            if (resultWithoutEnhanced.rows.length > 0) {
                console.log('   ✅ SELECT without enhanced_features succeeded (fallback)');
                console.log('   Sample data:', {
                    id: resultWithoutEnhanced.rows[0].id,
                    has_drawing_scores: !!resultWithoutEnhanced.rows[0].drawing_scores
                });
            } else {
                console.log('   ❌ No auth attempts found');
            }
        } catch (error) {
            console.log('   ❌ SELECT without enhanced_features failed:', error.message);
        }

        // Step 4: Test the actual server endpoints
        console.log('\n4️⃣ Testing server endpoints...');
        
        // Simulate the server's fallback logic
        console.log('   Testing INSERT fallback logic...');
        
        const testEnhancedFeatures = {
            signature: { test: 'data' },
            _processing_summary: { total_features_collected: 1 }
        };
        
        // Simulate the server's try-catch logic
        let insertSuccess = false;
        try {
            await pool.query(`
                INSERT INTO auth_attempts (user_id, success, confidence, device_info, signature_id, drawing_scores, enhanced_features) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [userId, true, 88.0, 'server-test', signatureId, '{"server": "test"}', JSON.stringify(testEnhancedFeatures)]);
            insertSuccess = true;
            console.log('   ✅ Server INSERT with enhanced_features succeeded');
        } catch (columnError) {
            if (columnError.code === '42703') {
                console.log('   ⚠️ Server INSERT with enhanced_features failed (column missing), trying fallback...');
                try {
                    await pool.query(`
                        INSERT INTO auth_attempts (user_id, success, confidence, device_info, signature_id, drawing_scores) 
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [userId, true, 88.0, 'server-test-fallback', signatureId, '{"server": "test-fallback"}']);
                    console.log('   ✅ Server INSERT fallback succeeded');
                    insertSuccess = true;
                } catch (fallbackError) {
                    console.log('   ❌ Server INSERT fallback failed:', fallbackError.message);
                }
            } else {
                console.log('   ❌ Server INSERT failed (not a column error):', columnError.message);
            }
        }
        
        if (insertSuccess) {
            console.log('   ✅ Server fallback mechanism works correctly');
        } else {
            console.log('   ❌ Server fallback mechanism failed');
        }

        // Step 5: Summary
        console.log('\n📊 Test Summary:');
        console.log(`   - Enhanced features column exists: ${hasEnhancedFeaturesColumn ? 'Yes' : 'No'}`);
        console.log(`   - Fallback mechanism tested: ${insertSuccess ? 'Passed' : 'Failed'}`);
        
        if (hasEnhancedFeaturesColumn) {
            console.log('\n✅ System is ready for enhanced features');
            console.log('   The enhanced_features column exists and can be used for storing comprehensive biometric data.');
        } else {
            console.log('\n⚠️ System is running in fallback mode');
            console.log('   The enhanced_features column does not exist, but the system will continue to work');
            console.log('   with basic authentication functionality. To enable enhanced features, run:');
            console.log('   node backend/run_enhanced_features_migration.js');
        }
        
        console.log('\n🎉 Enhanced features fallback test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the test
testEnhancedFeaturesFallback(); 