// Script to update existing signatures with ML features
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper function to calculate ML features (same as in server.js)
function calculateMLFeatures(metrics) {
    // If already has all features, return as is
    if (metrics && Object.keys(metrics).filter(k => k !== 'context').length >= 15) {
        return metrics;
    }
    
    // Extract basic metrics if nested
    const basicMetrics = metrics?.basic || metrics || {};
    const boundingBox = basicMetrics.bounding_box || {};
    
    return {
        stroke_count: basicMetrics.stroke_count || 0,
        total_points: basicMetrics.total_points || 0,
        total_duration_ms: basicMetrics.duration_ms || basicMetrics.total_duration_ms || 0,
        avg_points_per_stroke: basicMetrics.stroke_count > 0 ? 
            (basicMetrics.total_points / basicMetrics.stroke_count) : 0,
        avg_velocity: parseFloat(basicMetrics.avg_speed) || 0,
        max_velocity: 0,
        min_velocity: 0,
        velocity_std: 0,
        width: boundingBox.width || 0,
        height: boundingBox.height || 0,
        area: (boundingBox.width || 0) * (boundingBox.height || 0),
        aspect_ratio: boundingBox.height > 0 ? (boundingBox.width / boundingBox.height) : 0,
        center_x: boundingBox.center_x || 0,
        center_y: boundingBox.center_y || 0,
        avg_stroke_length: basicMetrics.stroke_count > 0 && basicMetrics.total_distance ? 
            (basicMetrics.total_distance / basicMetrics.stroke_count) : 0,
        total_length: basicMetrics.total_distance || 0,
        length_variation: 0,
        avg_stroke_duration: basicMetrics.stroke_count > 0 && basicMetrics.duration_ms > 0 ? 
            (basicMetrics.duration_ms / basicMetrics.stroke_count) : 0,
        duration_variation: 0
    };
}

async function updateMLFeatures() {
    try {
        console.log('Fetching signatures with metrics...');
        
        // Get all signatures
        const result = await pool.query(`
            SELECT id, metrics, user_id 
            FROM signatures 
            WHERE metrics IS NOT NULL
            ORDER BY created_at DESC
        `);
        
        console.log(`Found ${result.rows.length} signatures with metrics`);
        
        let updated = 0;
        let alreadyComplete = 0;
        
        for (const row of result.rows) {
            const currentMetrics = row.metrics;
            
            // Check if already has ML features
            const hasMLFeatures = currentMetrics && 
                             typeof currentMetrics === 'object' &&
                             Object.keys(currentMetrics).filter(k => k !== 'context' && k !== 'basic').length >= 15;
            
            if (hasMLFeatures) {
                alreadyComplete++;
                continue;
            }
            
            // Calculate ML features
            const mlFeatures = calculateMLFeatures(currentMetrics);
            
            // Update the signature
            await pool.query(
                'UPDATE signatures SET metrics = $1 WHERE id = $2',
                [JSON.stringify(mlFeatures), row.id]
            );
            
            updated++;
            console.log(`Updated signature ${row.id} for user ${row.user_id} with ${Object.keys(mlFeatures).length} ML features`);
        }
        
        console.log(`\n✅ Update complete!`);
        console.log(`  - ${updated} signatures updated with ML features`);
        console.log(`  - ${alreadyComplete} signatures already had ML features`);
        console.log(`  - Total: ${result.rows.length} signatures processed`);
        
    } catch (error) {
        console.error('Error updating ML features:', error);
    } finally {
        await pool.end();
    }
}

// Run the update
updateMLFeatures();