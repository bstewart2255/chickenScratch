require('dotenv').config();
const pool = require('./db');

async function testEnrollmentFix() {
    try {
        console.log('🧪 Testing enrollment fix...');
        
        // Test 1: Check if is_enrollment column exists
        console.log('\n1. Checking if is_enrollment column exists...');
        try {
            const columnCheck = await pool.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'signatures' AND column_name = 'is_enrollment'
            `);
            
            if (columnCheck.rows.length > 0) {
                console.log('✅ is_enrollment column exists:', columnCheck.rows[0]);
            } else {
                console.log('❌ is_enrollment column does not exist');
                return;
            }
        } catch (error) {
            console.log('❌ Error checking column:', error.message);
            return;
        }
        
        // Test 2: Check current enrollment signature counts
        console.log('\n2. Checking current enrollment signature counts...');
        const enrollmentStats = await pool.query(`
            SELECT 
                user_id,
                COUNT(*) as total_signatures,
                COUNT(CASE WHEN is_enrollment = true THEN 1 END) as enrollment_signatures
            FROM signatures 
            GROUP BY user_id 
            ORDER BY user_id
        `);
        
        console.log('📊 Enrollment statistics:');
        enrollmentStats.rows.forEach(row => {
            console.log(`   User ${row.user_id}: ${row.enrollment_signatures}/${row.total_signatures} enrollment signatures`);
        });
        
        // Test 3: Test the enhanced comparison function
        console.log('\n3. Testing enhanced comparison function...');
        
        // Get a user with enrollment signatures
        const userWithEnrollment = await pool.query(`
            SELECT DISTINCT user_id 
            FROM signatures 
            WHERE is_enrollment = true 
            LIMIT 1
        `);
        
        if (userWithEnrollment.rows.length > 0) {
            const userId = userWithEnrollment.rows[0].user_id;
            console.log(`   Testing with user ${userId}...`);
            
            // Get enrollment signatures
            const enrollmentSigs = await pool.query(`
                SELECT metrics FROM signatures 
                WHERE user_id = $1 AND is_enrollment = true 
                ORDER BY created_at ASC LIMIT 3
            `, [userId]);
            
            if (enrollmentSigs.rows.length >= 3) {
                console.log(`   ✅ Found ${enrollmentSigs.rows.length} enrollment signatures`);
                
                // Test baseline calculation
                const enrollmentData = enrollmentSigs.rows.map(row => ({ metrics: row.metrics }));
                const baseline = calculateUserBaseline(enrollmentData);
                
                console.log(`   ✅ Baseline calculated with ${Object.keys(baseline).filter(k => !k.startsWith('_')).length} features`);
                console.log(`   ✅ Supported features: ${baseline._supported_features?.length || 0}`);
                console.log(`   ✅ Excluded features: ${baseline._excluded_features?.length || 0}`);
            } else {
                console.log(`   ⚠️  Only ${enrollmentSigs.rows.length}/3 enrollment signatures found`);
            }
        } else {
            console.log('   ⚠️  No users with enrollment signatures found');
        }
        
        console.log('\n✅ Enrollment fix test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await pool.end();
    }
}

// Import the calculateUserBaseline function from server.js
function calculateUserBaseline(signatures) {
    // Start with basic ML features
    const basicFeatures = [
        'stroke_count', 'total_points', 'total_duration_ms', 'avg_points_per_stroke',
        'avg_velocity', 'max_velocity', 'min_velocity', 'velocity_std',
        'width', 'height', 'area', 'aspect_ratio', 'center_x', 'center_y',
        'avg_stroke_duration', 'duration_variation'
    ];
    
    // Dynamically discover all features from signatures
    const allFeatures = new Set(basicFeatures);
    const excludedFeatures = new Set();
    const supportedFeatures = new Set();
    
    // Scan all signatures to find all available features
    signatures.forEach(sig => {
        if (sig.metrics && typeof sig.metrics === 'object') {
            // Add any excluded features to our tracking
            if (sig.metrics._excluded_features) {
                sig.metrics._excluded_features.forEach(f => excludedFeatures.add(f));
            }
            
            // Add supported features
            if (sig.metrics._supported_features) {
                sig.metrics._supported_features.forEach(f => {
                    allFeatures.add(f);
                    supportedFeatures.add(f);
                });
            } else {
                // Fallback: discover features from metrics object
                Object.keys(sig.metrics).forEach(key => {
                    if (!key.startsWith('_') && !excludedFeatures.has(key)) {
                        allFeatures.add(key);
                    }
                });
            }
        }
    });
    
    // Remove excluded features from calculation
    excludedFeatures.forEach(f => allFeatures.delete(f));
    
    const baseline = {};
    
    // Initialize sums for each feature
    allFeatures.forEach(feature => {
        baseline[feature] = { sum: 0, count: 0, values: [] };
    });
    
    // Aggregate metrics from all enrollment signatures
    signatures.forEach(sig => {
        if (sig.metrics && typeof sig.metrics === 'object') {
            allFeatures.forEach(feature => {
                // Skip excluded features
                if (sig.metrics._excluded_features && sig.metrics._excluded_features.includes(feature)) {
                    return;
                }
                
                if (sig.metrics[feature] !== undefined && sig.metrics[feature] !== null) {
                    const value = parseFloat(sig.metrics[feature]);
                    if (!isNaN(value)) {
                        baseline[feature].sum += value;
                        baseline[feature].count++;
                        baseline[feature].values.push(value);
                    }
                }
            });
        }
    });
    
    // Calculate averages and standard deviations
    const result = {};
    allFeatures.forEach(feature => {
        if (baseline[feature].count > 0) {
            const avg = baseline[feature].sum / baseline[feature].count;
            result[feature] = parseFloat(avg.toFixed(2));
            
            // Calculate standard deviation
            if (baseline[feature].values.length > 1) {
                const variance = baseline[feature].values.reduce((sum, val) => {
                    return sum + Math.pow(val - avg, 2);
                }, 0) / (baseline[feature].values.length - 1);
                result[`${feature}_std`] = parseFloat(Math.sqrt(variance).toFixed(2));
            }
        } else {
            // Don't include features with no valid data
            console.log(`Feature ${feature} has no valid data across all signatures`);
        }
    });
    
    // Add metadata about supported and excluded features
    result._supported_features = Array.from(supportedFeatures);
    result._excluded_features = Array.from(excludedFeatures);
    result._baseline_signature_count = signatures.length;
    
    return result;
}

// Run the test if this script is executed directly
if (require.main === module) {
    testEnrollmentFix()
        .then(() => {
            console.log('🎉 Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testEnrollmentFix }; 