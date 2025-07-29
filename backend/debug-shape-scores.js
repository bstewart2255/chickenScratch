// Debug script: debug-shape-scores.js
// Run this to investigate why auth attempt shape scores are low

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
    ssl: {
        rejectUnauthorized: false
    }
});

async function debugShapeScores() {
    try {
        console.log('🔍 Debugging Shape Score Issues...\n');
        
        // 1. Check baseline data
        console.log('1. BASELINE SHAPE DATA:');
        const baselineQuery = `
            SELECT shape_type, shape_data, metrics
            FROM shapes 
            WHERE user_id = (SELECT id FROM users WHERE username = 'migrationtest3')
            AND shape_type IN ('circle', 'square', 'triangle')
            ORDER BY shape_type;
        `;
        
        const baselineResult = await pool.query(baselineQuery);
        console.log(`Found ${baselineResult.rows.length} baseline shapes\n`);
        
        baselineResult.rows.forEach(row => {
            console.log(`📐 ${row.shape_type.toUpperCase()}:`);
            const metrics = row.metrics || {};
            console.log(`   Aspect Ratio: ${metrics.aspect_ratio || 'N/A'}`);
            console.log(`   Width x Height: ${metrics.width || 'N/A'} x ${metrics.height || 'N/A'}`);
            console.log(`   Velocity Std: ${metrics.velocity_std || 'N/A'}`);
            
            // Calculate what the baseline SHOULD be
            if (row.shape_type === 'circle' && metrics.aspect_ratio) {
                const expectedScore = Math.round(Math.max(0, 100 - Math.abs(metrics.aspect_ratio - 1) * 100));
                console.log(`   ✅ Expected Circle Roundness: ${expectedScore}%`);
            }
            if (row.shape_type === 'square' && metrics.aspect_ratio) {
                const expectedScore = Math.round(Math.max(0, 100 - Math.abs(metrics.aspect_ratio - 1) * 50));
                console.log(`   ✅ Expected Square Corner Accuracy: ${expectedScore}%`);
            }
            if (row.shape_type === 'triangle' && metrics.velocity_std !== undefined) {
                const expectedScore = Math.round(Math.max(0, 100 - metrics.velocity_std * 200));
                console.log(`   ✅ Expected Triangle Closure: ${expectedScore}%`);
            }
            console.log('');
        });
        
        // 2. Check recent auth attempts
        console.log('2. RECENT AUTH ATTEMPT DATA:');
        const authQuery = `
            SELECT 
                a.id,
                a.created_at,
                a.success,
                a.confidence,
                a.drawing_scores,
                a.signature_id,
                s.metrics as signature_metrics
            FROM auth_attempts a
            LEFT JOIN signatures s ON a.signature_id = s.id
            WHERE a.user_id = (SELECT id FROM users WHERE username = 'migrationtest3')
            ORDER BY a.created_at DESC
            LIMIT 5;
        `;
        
        const authResult = await pool.query(authQuery);
        console.log(`Found ${authResult.rows.length} recent auth attempts\n`);
        
        authResult.rows.forEach((row, index) => {
            console.log(`🔐 AUTH ATTEMPT #${index + 1}:`);
            console.log(`   ID: ${row.id}`);
            console.log(`   Date: ${new Date(row.created_at).toLocaleString()}`);
            console.log(`   Success: ${row.success ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`   Confidence: ${row.confidence}%`);
            console.log(`   Signature ID: ${row.signature_id || 'N/A'}`);
            
            if (row.drawing_scores) {
                console.log(`   Component Scores:`, JSON.stringify(row.drawing_scores, null, 2));
                
                // Check if these include shape scores
                const scores = row.drawing_scores;
                if (scores.circle !== undefined || scores.square !== undefined || scores.triangle !== undefined) {
                    console.log(`   Shape Scores Found:`);
                    if (scores.circle !== undefined) {
                        console.log(`     Circle: ${scores.circle}%`);
                    }
                    if (scores.square !== undefined) {
                        console.log(`     Square: ${scores.square}%`);
                    }
                    if (scores.triangle !== undefined) {
                        console.log(`     Triangle: ${scores.triangle}%`);
                    }
                }
            } else {
                console.log(`   Component Scores: None recorded`);
            }
            
            if (row.signature_metrics) {
                console.log(`   Signature Metrics: Aspect Ratio = ${row.signature_metrics.aspect_ratio || 'N/A'}`);
            }
            console.log('');
        });
        
        // 3. Check signature storage pattern
        console.log('3. SIGNATURE STORAGE ANALYSIS:');
        const sigQuery = `
            SELECT 
                id,
                created_at,
                data_format,
                CASE 
                    WHEN metrics IS NOT NULL THEN 'Has metrics'
                    ELSE 'No metrics'
                END as metrics_status,
                CASE
                    WHEN stroke_data IS NOT NULL THEN 'Has stroke data'
                    ELSE 'No stroke data'
                END as stroke_status
            FROM signatures
            WHERE user_id = (SELECT id FROM users WHERE username = 'migrationtest3')
            ORDER BY created_at DESC
            LIMIT 10;
        `;
        
        const sigResult = await pool.query(sigQuery);
        console.log(`Total signatures for user: ${sigResult.rows.length}\n`);
        
        sigResult.rows.forEach((row, index) => {
            console.log(`📝 Signature ${index + 1} (ID: ${row.id}):`);
            console.log(`   Created: ${new Date(row.created_at).toLocaleString()}`);
            console.log(`   Format: ${row.data_format || 'legacy'}`);
            console.log(`   ${row.metrics_status}`);
            console.log(`   ${row.stroke_status}`);
            console.log('');
        });
        
        // 4. Check if shapes are being compared during auth
        console.log('4. SHAPE COMPARISON DURING AUTH:');
        console.log('Checking if the authentication endpoint is properly comparing shapes...\n');
        
        // 5. Recommendations
        console.log('5. ANALYSIS & RECOMMENDATIONS:\n');
        
        if (baselineResult.rows.length === 0) {
            console.log('❌ No baseline shapes found - user needs to re-enroll with shapes');
        } else {
            console.log('✅ Baseline shapes exist');
            
            // Check if metrics are present
            const hasMetrics = baselineResult.rows.some(row => row.metrics && Object.keys(row.metrics).length > 0);
            if (!hasMetrics) {
                console.log('⚠️  WARNING: Shape metrics are missing or empty');
            }
        }
        
        if (authResult.rows.length > 0) {
            const hasShapeScores = authResult.rows.some(row => 
                row.drawing_scores && 
                (row.drawing_scores.circle !== undefined || 
                 row.drawing_scores.square !== undefined || 
                 row.drawing_scores.triangle !== undefined)
            );
            
            if (!hasShapeScores) {
                console.log('❌ No shape scores found in recent auth attempts');
                console.log('   - This suggests shapes are not being compared during authentication');
            } else {
                console.log('✅ Shape scores are being recorded');
                
                // Check if scores are too low
                const lowScores = authResult.rows.filter(row => {
                    if (!row.drawing_scores) return false;
                    const scores = row.drawing_scores;
                    return (scores.circle < 50 || scores.square < 50 || scores.triangle < 50);
                });
                
                if (lowScores.length > 0) {
                    console.log(`⚠️  ${lowScores.length} auth attempts have low shape scores (<50%)`);
                }
            }
        }
        
        console.log('\n🔧 RECOMMENDED ACTIONS:');
        console.log('1. Verify that shapes are being sent during authentication');
        console.log('2. Check if the comparison logic is using the correct metrics');
        console.log('3. Ensure shape metrics are being calculated during enrollment');
        console.log('4. Test with a fresh authentication including all components');
        console.log('5. Monitor the /login endpoint logs for shape comparison details');
        
    } catch (error) {
        console.error('Error debugging shape scores:', error);
    } finally {
        await pool.end();
    }
}

// Run the debug
console.log('Starting shape score debugging...\n');
debugShapeScores();