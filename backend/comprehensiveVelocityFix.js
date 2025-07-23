const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function comprehensiveVelocityFix() {
    try {
        console.log('Comprehensive velocity fix for all signatures...\n');
        
        // First, let's analyze the current state
        const analysisResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN (metrics->>'avg_velocity')::float > 5 THEN 1 END) as high_velocity_count,
                COUNT(CASE WHEN (metrics->>'avg_velocity')::float < 0.001 THEN 1 END) as zero_velocity_count,
                AVG((metrics->>'avg_velocity')::float) as avg_of_avg_velocities,
                MAX((metrics->>'avg_velocity')::float) as max_avg_velocity,
                MIN((metrics->>'avg_velocity')::float) as min_avg_velocity
            FROM signatures
            WHERE metrics IS NOT NULL
            AND metrics::text != '{}'
        `);
        
        const stats = analysisResult.rows[0];
        console.log('Current velocity statistics:');
        console.log(`Total signatures: ${stats.total}`);
        console.log(`High velocity (>5): ${stats.high_velocity_count}`);
        console.log(`Zero/tiny velocity (<0.001): ${stats.zero_velocity_count}`);
        console.log(`Average of avg_velocities: ${parseFloat(stats.avg_of_avg_velocities).toFixed(3)}`);
        console.log(`Max avg_velocity: ${stats.max_avg_velocity}`);
        console.log(`Min avg_velocity: ${stats.min_avg_velocity}\n`);
        
        // Get all signatures
        const result = await pool.query(`
            SELECT id, user_id, metrics, created_at
            FROM signatures
            WHERE metrics IS NOT NULL
            AND metrics::text != '{}'
            ORDER BY created_at DESC
        `);
        
        console.log(`Processing ${result.rows.length} signatures...\n`);
        
        let fixedHighCount = 0;
        let fixedZeroCount = 0;
        let problemSignatures = [];
        
        for (const row of result.rows) {
            const metrics = row.metrics;
            let needsUpdate = false;
            let fixType = '';
            
            // Check for different velocity issues
            if (metrics.avg_velocity > 5) {
                // Likely in pixels/second, convert to pixels/millisecond
                metrics.avg_velocity = metrics.avg_velocity / 1000;
                metrics.max_velocity = metrics.max_velocity / 1000;
                metrics.min_velocity = metrics.min_velocity / 1000;
                metrics.velocity_std = metrics.velocity_std / 1000;
                needsUpdate = true;
                fixType = 'high';
                fixedHighCount++;
            } else if (metrics.max_velocity === 0 && metrics.avg_velocity > 0) {
                // Max velocity shouldn't be 0 if avg velocity > 0
                // This suggests a calculation error - recalculate based on avg
                metrics.max_velocity = metrics.avg_velocity * 2; // Estimate
                metrics.min_velocity = metrics.avg_velocity * 0.1; // Estimate
                needsUpdate = true;
                fixType = 'zero_max';
                fixedZeroCount++;
            }
            
            if (needsUpdate) {
                await pool.query(
                    'UPDATE signatures SET metrics = $1 WHERE id = $2',
                    [metrics, row.id]
                );
                
                problemSignatures.push({
                    id: row.id,
                    user_id: row.user_id,
                    fixType: fixType,
                    avg_velocity: metrics.avg_velocity
                });
            }
        }
        
        console.log(`\nFixed ${fixedHighCount} signatures with high velocity values`);
        console.log(`Fixed ${fixedZeroCount} signatures with zero max velocity`);
        
        // Show examples of fixed signatures
        if (problemSignatures.length > 0) {
            console.log('\nExamples of fixed signatures:');
            problemSignatures.slice(0, 5).forEach(sig => {
                console.log(`  ID: ${sig.id}, User: ${sig.user_id}, Fix: ${sig.fixType}, New avg_velocity: ${sig.avg_velocity.toFixed(3)}`);
            });
        }
        
        // Re-analyze after fixes
        const afterResult = await pool.query(`
            SELECT 
                AVG((metrics->>'avg_velocity')::float) as avg_of_avg_velocities,
                MAX((metrics->>'avg_velocity')::float) as max_avg_velocity,
                MIN((metrics->>'avg_velocity')::float) as min_avg_velocity
            FROM signatures
            WHERE metrics IS NOT NULL
        `);
        
        const afterStats = afterResult.rows[0];
        console.log('\nAfter fix - velocity statistics:');
        console.log(`Average of avg_velocities: ${parseFloat(afterStats.avg_of_avg_velocities).toFixed(3)}`);
        console.log(`Max avg_velocity: ${afterStats.max_avg_velocity}`);
        console.log(`Min avg_velocity: ${afterStats.min_avg_velocity}`);
        
        // Check specific users that might be problematic
        const userCheck = await pool.query(`
            SELECT DISTINCT u.username, COUNT(s.id) as sig_count,
                   AVG((s.metrics->>'avg_velocity')::float) as avg_velocity
            FROM users u
            JOIN signatures s ON u.id = s.user_id
            WHERE s.metrics IS NOT NULL
            GROUP BY u.username
            HAVING AVG((s.metrics->>'avg_velocity')::float) > 1
            ORDER BY avg_velocity DESC
        `);
        
        if (userCheck.rows.length > 0) {
            console.log('\nUsers with high average velocities (may need re-enrollment):');
            userCheck.rows.forEach(user => {
                console.log(`  ${user.username}: ${parseFloat(user.avg_velocity).toFixed(3)} (${user.sig_count} signatures)`);
            });
        }
        
    } catch (error) {
        console.error('Error fixing velocities:', error);
    } finally {
        await pool.end();
    }
}

// Run the comprehensive fix
comprehensiveVelocityFix();