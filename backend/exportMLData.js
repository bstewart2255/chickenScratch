const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
        
        // Create output directory
        const outputDir = path.join(__dirname, '..', 'ml-model', 'data', 'from_db');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Group by user for training
        const userSignatures = {};
        
        result.rows.forEach(row => {
            const username = row.username;
            if (!userSignatures[username]) {
                userSignatures[username] = {
                    genuine: [],
                    attempts: []
                };
            }
            
            // Extract the 19 ML features
            const metrics = row.metrics;
            const features = {
                stroke_count: metrics.stroke_count || 0,
                total_points: metrics.total_points || 0,
                total_duration_ms: metrics.total_duration_ms || 0,
                avg_points_per_stroke: metrics.avg_points_per_stroke || 0,
                avg_velocity: metrics.avg_velocity || 0,
                max_velocity: metrics.max_velocity || 0,
                min_velocity: metrics.min_velocity || 0,
                velocity_std: metrics.velocity_std || 0,
                width: metrics.width || 0,
                height: metrics.height || 0,
                area: metrics.area || 0,
                aspect_ratio: metrics.aspect_ratio || 0,
                center_x: metrics.center_x || 0,
                center_y: metrics.center_y || 0,
                avg_stroke_length: metrics.avg_stroke_length || 0,
                total_length: metrics.total_length || 0,
                length_variation: metrics.length_variation || 0,
                avg_stroke_duration: metrics.avg_stroke_duration || 0,
                duration_variation: metrics.duration_variation || 0
            };
            
            const signatureData = {
                id: row.id,
                timestamp: row.created_at,
                features: features,
                auth_success: row.auth_success,
                confidence: row.confidence
            };
            
            // During registration, signatures are genuine
            // During failed auth attempts, they might be forgeries
            if (row.auth_success === null || row.auth_success === true) {
                userSignatures[username].genuine.push(signatureData);
            } else {
                userSignatures[username].attempts.push(signatureData);
            }
        });
        
        // Export data for each user
        let totalExported = 0;
        Object.entries(userSignatures).forEach(([username, data]) => {
            if (data.genuine.length > 0) {
                const outputFile = path.join(outputDir, `${username}_signatures.json`);
                fs.writeFileSync(outputFile, JSON.stringify({
                    username: username,
                    genuine_signatures: data.genuine,
                    attempted_signatures: data.attempts,
                    feature_names: Object.keys(data.genuine[0].features)
                }, null, 2));
                
                console.log(`Exported ${data.genuine.length} genuine + ${data.attempts.length} attempted signatures for ${username}`);
                totalExported += data.genuine.length + data.attempts.length;
            }
        });
        
        console.log(`\nTotal signatures exported: ${totalExported}`);
        console.log(`Output directory: ${outputDir}`);
        
    } catch (error) {
        console.error('Error exporting ML data:', error);
    } finally {
        await pool.end();
    }
}

// Run the export
exportMLTrainingData();