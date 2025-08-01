require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const pool = require('./db.js');

async function runPostValidation() {
    console.log('🔍 Running Phase 2 Post-Validation...\n');
    
    try {
        // Read the post-validation SQL file
        const sqlFile = path.join(__dirname, 'phase2', 'post_validation_queries.sql');
        // const sqlContent = await fs.readFile(sqlFile, 'utf8'); // Unused variable removed
        
        // Run key post-validation queries manually
        const keyQueries = [
            // Overall success rate
            `WITH metrics_status AS (
                SELECT 
                    id,
                    shape_type,
                    CASE 
                        WHEN metrics IS NULL THEN 'null_metrics'
                        WHEN metrics = '{}'::jsonb THEN 'empty_metrics'
                        WHEN metrics->>'center_x' IS NULL 
                            OR metrics->>'center_y' IS NULL 
                            OR metrics->>'total_points' IS NULL 
                            OR metrics->>'stroke_count' IS NULL 
                            OR metrics->>'avg_speed' IS NULL THEN 'incomplete_metrics'
                        ELSE 'complete_metrics'
                    END as status
                FROM shapes
                WHERE shape_type IN ('circle', 'square', 'triangle')
            )
            SELECT 
                status,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
            FROM metrics_status
            GROUP BY status
            ORDER BY count DESC`,
            
            // Success rate by shape type
            `SELECT 
                shape_type,
                COUNT(*) as total_count,
                COUNT(CASE 
                    WHEN metrics->>'center_x' IS NOT NULL 
                    AND metrics->>'center_y' IS NOT NULL 
                    AND metrics->>'total_points' IS NOT NULL 
                    AND metrics->>'stroke_count' IS NOT NULL 
                    AND metrics->>'avg_speed' IS NOT NULL 
                    THEN 1 
                END) as complete_metrics,
                ROUND(
                    COUNT(CASE 
                        WHEN metrics->>'center_x' IS NOT NULL 
                        AND metrics->>'center_y' IS NOT NULL 
                        AND metrics->>'total_points' IS NOT NULL 
                        AND metrics->>'stroke_count' IS NOT NULL 
                        AND metrics->>'avg_speed' IS NOT NULL 
                        THEN 1 
                    END) * 100.0 / COUNT(*), 2
                ) as success_rate
            FROM shapes
            WHERE shape_type IN ('circle', 'square', 'triangle')
            GROUP BY shape_type
            ORDER BY shape_type`,
            
            // Final summary
            `SELECT 
                'PHASE 2 COMPLETION SUMMARY' as metric,
                COUNT(*) as total_shapes,
                COUNT(CASE 
                    WHEN metrics->>'center_x' IS NOT NULL 
                    AND metrics->>'center_y' IS NOT NULL 
                    AND metrics->>'total_points' IS NOT NULL 
                    AND metrics->>'stroke_count' IS NOT NULL 
                    AND metrics->>'avg_speed' IS NOT NULL 
                    THEN 1 
                END) as successful_shapes,
                COUNT(CASE 
                    WHEN metrics->>'center_x' IS NULL 
                    OR metrics->>'center_y' IS NULL 
                    OR metrics->>'total_points' IS NULL 
                    OR metrics->>'stroke_count' IS NULL 
                    OR metrics->>'avg_speed' IS NULL 
                    THEN 1 
                END) as failed_shapes,
                ROUND(
                    COUNT(CASE 
                        WHEN metrics->>'center_x' IS NOT NULL 
                        AND metrics->>'center_y' IS NOT NULL 
                        AND metrics->>'total_points' IS NOT NULL 
                        AND metrics->>'stroke_count' IS NOT NULL 
                        AND metrics->>'avg_speed' IS NOT NULL 
                        THEN 1 
                    END) * 100.0 / COUNT(*), 2
                ) as success_rate,
                CASE 
                    WHEN COUNT(CASE 
                        WHEN metrics->>'center_x' IS NOT NULL 
                        AND metrics->>'center_y' IS NOT NULL 
                        AND metrics->>'total_points' IS NOT NULL 
                        AND metrics->>'stroke_count' IS NOT NULL 
                        AND metrics->>'avg_speed' IS NOT NULL 
                        THEN 1 
                    END) * 100.0 / COUNT(*) >= 99 
                    THEN '✅ TARGET ACHIEVED (≥99%)'
                    ELSE '❌ TARGET NOT MET (<99%)'
                END as status
            FROM shapes
            WHERE shape_type IN ('circle', 'square', 'triangle')`
        ];
        
        for (let i = 0; i < keyQueries.length; i++) {
            const query = keyQueries[i];
            
            try {
                console.log(`Running post-validation query ${i + 1}/${keyQueries.length}...`);
                const result = await pool.query(query);
                
                if (result.rows && result.rows.length > 0) {
                    console.log('Results:');
                    console.table(result.rows);
                } else {
                    console.log('Query executed successfully (no results)');
                }
                console.log('');
                
            } catch (error) {
                console.error(`❌ Error in query ${i + 1}:`, error.message);
                console.log('');
            }
        }
        
        console.log('✅ Post-validation completed');
        
    } catch (error) {
        console.error('❌ Error reading post-validation file:', error.message);
    } finally {
        await pool.end();
    }
}

// Run post-validation
runPostValidation().catch(console.error);