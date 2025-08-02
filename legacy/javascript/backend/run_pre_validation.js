require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const pool = require('./db.js');

async function runPreValidation() {
    console.log('🔍 Running Phase 2 Pre-Validation...\n');
    
    try {
        // Read the pre-validation SQL file
        const sqlFile = path.join(__dirname, 'phase2', 'pre_validation_queries.sql');
        const sqlContent = await fs.readFile(sqlFile, 'utf8');
        
        // Split the SQL into individual queries (better parsing)
        const queries = sqlContent
            .split(/\n\s*--\s*=/)
            .map(section => {
                // Extract the main query from each section
                const lines = section.split('\n');
                const queryLines = lines.filter(line => 
                    !line.trim().startsWith('--') && 
                    line.trim().length > 0 &&
                    !line.trim().startsWith('WITH') && // Skip CTE definitions for now
                    !line.trim().startsWith('UNION')
                );
                return queryLines.join('\n').trim();
            })
            .filter(q => q.length > 0);
        
        console.log(`Found ${queries.length} validation sections to run\n`);
        
        // Run key validation queries manually
        const keyQueries = [
            // Overall metrics status
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
            
            // Shape type breakdown
            `SELECT 
                shape_type,
                COUNT(*) as total_count,
                COUNT(CASE WHEN metrics IS NULL THEN 1 END) as null_metrics,
                COUNT(CASE WHEN metrics = '{}'::jsonb THEN 1 END) as empty_metrics,
                COUNT(CASE 
                    WHEN metrics IS NOT NULL 
                    AND metrics != '{}'::jsonb 
                    AND (metrics->>'center_x' IS NULL 
                        OR metrics->>'center_y' IS NULL 
                        OR metrics->>'total_points' IS NULL 
                        OR metrics->>'stroke_count' IS NULL 
                        OR metrics->>'avg_speed' IS NULL) 
                    THEN 1 
                END) as incomplete_metrics,
                COUNT(CASE 
                    WHEN metrics->>'center_x' IS NOT NULL 
                    AND metrics->>'center_y' IS NOT NULL 
                    AND metrics->>'total_points' IS NOT NULL 
                    AND metrics->>'stroke_count' IS NOT NULL 
                    AND metrics->>'avg_speed' IS NOT NULL 
                    THEN 1 
                END) as complete_metrics
            FROM shapes
            WHERE shape_type IN ('circle', 'square', 'triangle')
            GROUP BY shape_type
            ORDER BY shape_type`,
            
            // Total shapes needing processing
            `SELECT 
                COUNT(*) as shapes_needing_processing
            FROM shapes
            WHERE shape_type IN ('circle', 'square', 'triangle')
            AND (metrics IS NULL 
                OR metrics = '{}'::jsonb 
                OR metrics->>'center_x' IS NULL 
                OR metrics->>'center_y' IS NULL 
                OR metrics->>'total_points' IS NULL 
                OR metrics->>'stroke_count' IS NULL 
                OR metrics->>'avg_speed' IS NULL)`
        ];
        
        for (let i = 0; i < keyQueries.length; i++) {
            const query = keyQueries[i];
            
            try {
                console.log(`Running validation query ${i + 1}/${keyQueries.length}...`);
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
        
        console.log('✅ Pre-validation completed');
        
    } catch (error) {
        console.error('❌ Error reading pre-validation file:', error.message);
    } finally {
        await pool.end();
    }
}

// Run pre-validation
runPreValidation().catch(console.error); 