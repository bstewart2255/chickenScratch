const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: { rejectUnauthorized: false }
});

async function exportMLTrainingData() {
    try {
        console.log('Exporting ML training data from database...');
        
        // Get all signatures with ML features
        const result = await pool.query(`
            SELECT 
                s.id,
                s.user_id,
                u.username,
                s.signature_data,
                s.metrics,
                s.created_at,
                a.success as auth_success,
                a.confidence
            FROM signatures s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN auth_attempts a ON a.user_id = s.user_id 
                AND a.created_at >= s.created_at - INTERVAL '1 minute'
                AND a.created_at <= s.created_at + INTERVAL '1 minute'
            WHERE s.metrics IS NOT NULL
            AND s.metrics::text != '{}'
            ORDER BY s.created_at DESC
        `);
        
        console.log(`Found ${result.rows.length} signatures with metrics`);
        
        // Create output directory matching train_model.py expectations
        const outputDir = path.join(__dirname, '..', 'ml-model', 'data');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Export in the format expected by train_model.py
        let exportCount = 0;
        
        result.rows.forEach((row) => {
            const metrics = row.metrics;
            const username = row.username;
            
            // Create features structure expected by train_model.py
            const features = {
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
            
            // Determine if this is genuine or a potential forgery
            // During registration (no auth attempt) = genuine
            // During successful auth = genuine  
            // During failed auth = potential forgery
            let type = 'genuine';
            if (row.auth_success === false) {
                type = 'forgery';
            }
            
            const signatureData = {
                user_id: username,
                timestamp: new Date(row.created_at).getTime(),
                type: type,
                features: features,
                auth_success: row.auth_success,
                confidence: row.confidence
            };
            
            // Save each signature as a separate file (train_model.py expects this)
            const filename = `signature_data_${username}_${exportCount}.json`;
            const filepath = path.join(outputDir, filename);
            
            fs.writeFileSync(filepath, JSON.stringify(signatureData, null, 2));
            exportCount++;
        });
        
        console.log(`\nExported ${exportCount} signatures to ${outputDir}`);
        console.log('\nBreakdown by type:');
        
        // Count genuine vs forgery
        const files = fs.readdirSync(outputDir).filter(f => f.startsWith('signature_data_'));
        let genuineCount = 0;
        let forgeryCount = 0;
        
        files.forEach(file => {
            const data = JSON.parse(fs.readFileSync(path.join(outputDir, file)));
            if (data.type === 'genuine') {
                genuineCount++;
            } else {
                forgeryCount++;
            }
        });
        
        console.log(`  Genuine signatures: ${genuineCount}`);
        console.log(`  Potential forgeries: ${forgeryCount}`);
        
        if (exportCount < 10) {
            console.log('\n⚠️  Warning: You need at least 10 samples to train the ML model.');
            console.log('Current samples:', exportCount);
            console.log('Please collect more signatures before training!');
        } else {
            console.log('\n✅ Ready to train! Run: cd ml-model && python train_model.py');
        }
        
    } catch (error) {
        console.error('Error exporting ML data:', error);
    } finally {
        await pool.end();
    }
}

// Run the export
exportMLTrainingData();