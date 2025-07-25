const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth',
    ssl: { rejectUnauthorized: false }
});

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'ml-model', 'data');
const BATCH_SIZE = 100;

// Validate metrics quality
function validateMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') {
        return { valid: false, reason: 'Missing or invalid metrics object' };
    }

    // Check for required fields
    const requiredFields = [
        'stroke_count', 'total_points', 'total_duration_ms', 
        'avg_velocity', 'width', 'height', 'area'
    ];

    for (const field of requiredFields) {
        if (metrics[field] === undefined || metrics[field] === null) {
            return { valid: false, reason: `Missing required field: ${field}` };
        }
    }

    // Validate ranges
    if (metrics.stroke_count <= 0 || metrics.stroke_count > 50) {
        return { valid: false, reason: `Invalid stroke_count: ${metrics.stroke_count}` };
    }

    if (metrics.total_points <= 0) {
        return { valid: false, reason: `Invalid total_points: ${metrics.total_points}` };
    }

    if (metrics.total_duration_ms <= 0 || metrics.total_duration_ms > 60000) {
        return { valid: false, reason: `Invalid total_duration_ms: ${metrics.total_duration_ms}` };
    }

    if (metrics.avg_velocity < 0 || metrics.avg_velocity > 10) {
        return { valid: false, reason: `Invalid avg_velocity: ${metrics.avg_velocity}` };
    }

    if (metrics.width <= 0 || metrics.height <= 0) {
        return { valid: false, reason: `Invalid dimensions: ${metrics.width}x${metrics.height}` };
    }

    return { valid: true };
}

// Convert flat metrics to nested ML feature structure
function convertToMLFeatures(metrics) {
    return {
        basic_stats: {
            stroke_count: metrics.stroke_count || 0,
            total_points: metrics.total_points || 0,
            total_duration_ms: metrics.total_duration_ms || 0,
            average_points_per_stroke: metrics.avg_points_per_stroke || 0
        },
        velocity_features: {
            average_velocity: metrics.avg_velocity || 0,
            max_velocity: metrics.max_velocity || 0,
            min_velocity: metrics.min_velocity || 0,
            velocity_std: metrics.velocity_std || 0
        },
        shape_features: {
            width: metrics.width || 0,
            height: metrics.height || 0,
            area: metrics.area || 0,
            aspect_ratio: metrics.aspect_ratio || 0,
            center_x: metrics.center_x || 0,
            center_y: metrics.center_y || 0
        },
        stroke_features: {
            average_stroke_length: metrics.avg_stroke_length || 0,
            total_length: metrics.total_length || 0,
            length_variation: metrics.length_variation || 0,
            average_stroke_duration: metrics.avg_stroke_duration || 0,
            duration_variation: metrics.duration_variation || 0
        }
    };
}

// Main export function
async function exportMLTrainingData() {
    console.log('=== Improved ML Training Data Export ===');
    console.log(`Output directory: ${OUTPUT_DIR}`);
    
    const client = await pool.connect();
    
    try {
        // Create output directory
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        // Query with improved classification logic
        const query = `
            WITH signature_classification AS (
                SELECT 
                    s.id,
                    s.user_id,
                    u.username,
                    s.metrics,
                    s.created_at,
                    -- Improved classification logic
                    CASE 
                        -- First 3 signatures are always genuine (enrollment)
                        WHEN ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.created_at) <= 3 THEN 'genuine'
                        -- Failed auth attempts with good metrics are forgeries
                        WHEN a.success = false AND a.id IS NOT NULL AND s.metrics IS NOT NULL THEN 'forgery'
                        -- Successful auth attempts are genuine
                        WHEN a.success = true THEN 'genuine'
                        -- Default to genuine if no auth attempt found
                        ELSE 'genuine'
                    END as classification,
                    a.success,
                    a.confidence,
                    ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.created_at) as signature_number
                FROM signatures s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN auth_attempts a ON a.signature_id = s.id
                WHERE s.metrics IS NOT NULL
                    AND jsonb_typeof(s.metrics) = 'object'
                    AND s.metrics::text != '{}'
            )
            SELECT * FROM signature_classification 
            ORDER BY created_at DESC
        `;

        console.log('\nQuerying database for signatures with metrics...');
        const result = await client.query(query);
        console.log(`Found ${result.rows.length} signatures with metrics`);

        // Process signatures
        const genuineSamples = [];
        const forgerySamples = [];
        const skippedSamples = [];
        
        // Statistics
        const stats = {
            totalProcessed: 0,
            genuineCount: 0,
            forgeryCount: 0,
            skippedCount: 0,
            userStats: {}
        };

        console.log('\nProcessing signatures...');
        
        for (const row of result.rows) {
            stats.totalProcessed++;
            
            // Update user statistics
            if (!stats.userStats[row.username]) {
                stats.userStats[row.username] = {
                    genuine: 0,
                    forgery: 0,
                    skipped: 0,
                    enrollmentSignatures: 0
                };
            }

            // Validate metrics
            const validation = validateMetrics(row.metrics);
            if (!validation.valid) {
                console.log(`  ⚠️  Skipping ${row.username} signature ${row.id}: ${validation.reason}`);
                skippedSamples.push({
                    id: row.id,
                    username: row.username,
                    reason: validation.reason
                });
                stats.skippedCount++;
                stats.userStats[row.username].skipped++;
                continue;
            }

            // Create training sample
            const sample = {
                user_id: row.username,
                timestamp: new Date(row.created_at).getTime(),
                type: row.classification,
                features: convertToMLFeatures(row.metrics),
                metadata: {
                    signature_id: row.id,
                    signature_number: row.signature_number,
                    confidence: row.confidence,
                    auth_success: row.success
                }
            };

            // Add to appropriate collection
            if (row.classification === 'genuine') {
                genuineSamples.push(sample);
                stats.genuineCount++;
                stats.userStats[row.username].genuine++;
                
                if (row.signature_number <= 3) {
                    stats.userStats[row.username].enrollmentSignatures++;
                }
            } else {
                forgerySamples.push(sample);
                stats.forgeryCount++;
                stats.userStats[row.username].forgery++;
            }

            // Progress logging
            if (stats.totalProcessed % 50 === 0) {
                console.log(`  Processed ${stats.totalProcessed} signatures...`);
            }
        }

        // Write output files
        console.log('\nWriting output files...');
        
        // Write genuine samples
        const genuineFile = path.join(OUTPUT_DIR, 'genuine_signatures_improved.json');
        await fs.writeFile(genuineFile, JSON.stringify(genuineSamples, null, 2));
        console.log(`  ✅ Wrote ${genuineSamples.length} genuine samples to ${genuineFile}`);

        // Write forgery samples
        const forgeryFile = path.join(OUTPUT_DIR, 'forgery_signatures_improved.json');
        await fs.writeFile(forgeryFile, JSON.stringify(forgerySamples, null, 2));
        console.log(`  ✅ Wrote ${forgerySamples.length} forgery samples to ${forgeryFile}`);

        // Write skipped samples report
        const skippedFile = path.join(OUTPUT_DIR, 'skipped_samples_report.json');
        await fs.writeFile(skippedFile, JSON.stringify({
            timestamp: new Date().toISOString(),
            totalSkipped: skippedSamples.length,
            samples: skippedSamples
        }, null, 2));
        console.log(`  ✅ Wrote skip report to ${skippedFile}`);

        // Print summary statistics
        console.log('\n=== Export Summary ===');
        console.log(`Total signatures processed: ${stats.totalProcessed}`);
        console.log(`Genuine samples: ${stats.genuineCount} (${((stats.genuineCount / stats.totalProcessed) * 100).toFixed(1)}%)`);
        console.log(`Forgery samples: ${stats.forgeryCount} (${((stats.forgeryCount / stats.totalProcessed) * 100).toFixed(1)}%)`);
        console.log(`Skipped samples: ${stats.skippedCount} (${((stats.skippedCount / stats.totalProcessed) * 100).toFixed(1)}%)`);

        // User breakdown
        console.log('\nPer-user breakdown:');
        const userList = Object.keys(stats.userStats).sort();
        for (const username of userList) {
            const userStat = stats.userStats[username];
            console.log(`  ${username}:`);
            console.log(`    - Enrollment signatures: ${userStat.enrollmentSignatures}`);
            console.log(`    - Total genuine: ${userStat.genuine}`);
            console.log(`    - Total forgery: ${userStat.forgery}`);
            if (userStat.skipped > 0) {
                console.log(`    - Skipped: ${userStat.skipped}`);
            }
        }

        // Data quality check
        console.log('\n=== Data Quality Check ===');
        
        // Check if we have enough samples
        if (genuineSamples.length < 10) {
            console.log('⚠️  WARNING: Very few genuine samples. Consider enrolling more users.');
        }
        
        if (forgerySamples.length < 10) {
            console.log('⚠️  WARNING: Very few forgery samples. The model may not learn to detect forgeries well.');
        }

        // Check class balance
        const totalSamples = genuineSamples.length + forgerySamples.length;
        const genuineRatio = genuineSamples.length / totalSamples;
        const forgeryRatio = forgerySamples.length / totalSamples;

        console.log(`\nClass balance:`);
        console.log(`  Genuine: ${(genuineRatio * 100).toFixed(1)}%`);
        console.log(`  Forgery: ${(forgeryRatio * 100).toFixed(1)}%`);

        if (genuineRatio > 0.8 || forgeryRatio > 0.8) {
            console.log('⚠️  WARNING: Class imbalance detected. Consider collecting more samples of the minority class.');
        }

        console.log('\n✅ Export complete!');
        console.log('\nNext steps:');
        console.log('1. Review the exported files in ml-model/data/');
        console.log('2. Run clean_training_data.js if you want to merge with existing data');
        console.log('3. Retrain the model with: cd ml-model && ./retrain_model.sh');

    } catch (error) {
        console.error('\n❌ Export failed:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    exportMLTrainingData();
}

module.exports = { exportMLTrainingData, validateMetrics, convertToMLFeatures };