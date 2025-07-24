const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixVelocityBaselines() {
    try {
        console.log('Fixing velocity baselines in database...');
        
        // Get all signatures with metrics
        const result = await pool.query(`
            SELECT id, user_id, metrics
            FROM signatures
            WHERE metrics IS NOT NULL
            AND metrics::text != '{}'
        `);
        
        console.log(`Found ${result.rows.length} signatures to check`);
        
        let fixedCount = 0;
        
        for (const row of result.rows) {
            const metrics = row.metrics;
            
            // Check if velocities are likely in the wrong unit (>10 suggests pixels/second)
            if (metrics.avg_velocity > 10) {
                console.log(`Fixing signature ${row.id} - avg_velocity: ${metrics.avg_velocity}`);
                
                // Divide all velocity metrics by 1000 to convert from pixels/s to pixels/ms
                const fixedMetrics = {
                    ...metrics,
                    avg_velocity: metrics.avg_velocity / 1000,
                    max_velocity: metrics.max_velocity / 1000,
                    min_velocity: metrics.min_velocity / 1000,
                    velocity_std: metrics.velocity_std / 1000
                };
                
                // Update the database
                await pool.query(
                    'UPDATE signatures SET metrics = $1 WHERE id = $2',
                    [fixedMetrics, row.id]
                );
                
                fixedCount++;
            }
        }
        
        console.log(`\nFixed ${fixedCount} signatures with incorrect velocity units`);
        
        // Show sample of fixed data
        if (fixedCount > 0) {
            const sampleResult = await pool.query(`
                SELECT user_id, metrics
                FROM signatures
                WHERE metrics IS NOT NULL
                LIMIT 3
            `);
            
            console.log('\nSample of fixed velocities:');
            sampleResult.rows.forEach(row => {
                console.log(`User ${row.user_id}:`);
                console.log(`  avg_velocity: ${row.metrics.avg_velocity?.toFixed(3)}`);
                console.log(`  max_velocity: ${row.metrics.max_velocity?.toFixed(3)}`);
            });
        }
        
    } catch (error) {
        console.error('Error fixing velocities:', error);
    } finally {
        await pool.end();
    }
}

// Export the function instead of running it automatically
module.exports = fixVelocityBaselines;

// Only run if this file is executed directly (not imported)
if (require.main === module) {
    fixVelocityBaselines();
}