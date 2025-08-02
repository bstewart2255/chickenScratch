// Migration script to fix existing drawing data with zero metrics
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper function to extract stroke data from SignaturePad v4 format
function extractStrokeDataFromSignaturePad(signatureData) {
    if (!signatureData) return null;
    
    try {
        let parsed = signatureData;
        if (typeof signatureData === 'string') {
            parsed = JSON.parse(signatureData);
        }
        
        // Handle SignaturePad v4 format: {raw: [{points: [...], ...}]}
        if (parsed.raw && Array.isArray(parsed.raw)) {
            return parsed.raw.map(stroke => {
                // Convert stroke object to points array
                if (stroke.points && Array.isArray(stroke.points)) {
                    return stroke.points;
                }
                // If stroke is already a points array, return as is
                if (Array.isArray(stroke)) {
                    return stroke;
                }
                return [];
            });
        }
        
        // Handle legacy format: {strokes: [[...], [...]]}
        if (parsed.strokes && Array.isArray(parsed.strokes)) {
            return parsed.strokes;
        }
        
        // Handle direct array format: [[...], [...]]
        if (Array.isArray(parsed)) {
            return parsed;
        }
        
        console.warn('No stroke data found in signature data');
        return null;
    } catch (error) {
        console.error('Error extracting stroke data from SignaturePad format:', error);
        return null;
    }
}

// Function to recalculate drawing metrics
function recalculateDrawingMetrics(drawingData) {
    try {
        const strokes = extractStrokeDataFromSignaturePad(drawingData);
        
        if (!strokes || strokes.length === 0) {
            return {
                strokeCount: 0,
                pointCount: 0,
                duration: 0,
                boundingBox: null
            };
        }
        
        // Calculate metrics
        const strokeCount = strokes.length;
        const pointCount = strokes.reduce((sum, stroke) => sum + (Array.isArray(stroke) ? stroke.length : 0), 0);
        
        // Extract duration from original data if available
        let duration = 0;
        if (drawingData.metrics && drawingData.metrics.total_duration_ms) {
            duration = drawingData.metrics.total_duration_ms;
        } else if (drawingData.metrics && drawingData.metrics.duration) {
            duration = drawingData.metrics.duration;
        }
        
        // Calculate bounding box
        let boundingBox = null;
        if (pointCount > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            strokes.forEach(stroke => {
                if (Array.isArray(stroke)) {
                    stroke.forEach(point => {
                        if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                            minX = Math.min(minX, point.x);
                            minY = Math.min(minY, point.y);
                            maxX = Math.max(maxX, point.x);
                            maxY = Math.max(maxY, point.y);
                        }
                    });
                }
            });
            
            if (minX !== Infinity && maxX !== -Infinity) {
                boundingBox = {
                    width: maxX - minX,
                    height: maxY - minY,
                    center_x: (minX + maxX) / 2,
                    center_y: (minY + maxY) / 2
                };
            }
        }
        
        return {
            strokeCount,
            pointCount,
            duration,
            boundingBox
        };
    } catch (error) {
        console.error('Error recalculating drawing metrics:', error);
        return {
            strokeCount: 0,
            pointCount: 0,
            duration: 0,
            boundingBox: null
        };
    }
}

async function migrateDrawingData() {
    const client = await pool.connect();
    
    try {
        console.log('Starting migration of drawing data...');
        
        // Get all drawings with zero metrics
        const result = await client.query(`
            SELECT id, user_id, drawing_type, drawing_data, metrics
            FROM drawings 
            WHERE (metrics->>'strokeCount')::int = 0 
            OR (metrics->>'pointCount')::int = 0
            OR metrics IS NULL
        `);
        
        console.log(`Found ${result.rows.length} drawings to migrate`);
        
        let migrated = 0;
        let errors = 0;
        
        for (const row of result.rows) {
            try {
                console.log(`Processing drawing ${row.id} (${row.drawing_type}) for user ${row.user_id}`);
                
                // Parse drawing data
                let drawingData;
                try {
                    drawingData = typeof row.drawing_data === 'string' ? 
                        JSON.parse(row.drawing_data) : row.drawing_data;
                } catch (e) {
                    console.warn(`Failed to parse drawing data for drawing ${row.id}:`, e.message);
                    errors++;
                    continue;
                }
                
                // Recalculate metrics
                const newMetrics = recalculateDrawingMetrics(drawingData);
                
                console.log(`Drawing ${row.id}: strokeCount=${newMetrics.strokeCount}, pointCount=${newMetrics.pointCount}`);
                
                // Update the record with new metrics
                await client.query(`
                    UPDATE drawings 
                    SET metrics = $1
                    WHERE id = $2
                `, [JSON.stringify(newMetrics), row.id]);
                
                migrated++;
                console.log(`✅ Migrated drawing ${row.id}`);
                
            } catch (error) {
                console.error(`Error migrating drawing ${row.id}:`, error);
                errors++;
            }
        }
        
        console.log(`\nMigration complete:`);
        console.log(`- Migrated: ${migrated} drawings`);
        console.log(`- Errors: ${errors} drawings`);
        console.log(`- Total processed: ${result.rows.length} drawings`);
        
    } finally {
        client.release();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateDrawingData()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = {
    migrateDrawingData,
    recalculateDrawingMetrics,
    extractStrokeDataFromSignaturePad
}; 