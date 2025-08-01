/**
 * Phase 2: Batch Processing Script for Shape Metrics Calculation
 * 
 * This script implements TRUE batch processing with proper LIMIT-based queries,
 * transaction safety, and comprehensive error handling to achieve 99%+ success rate.
 */

require('dotenv').config();
const { Pool } = require('pg');
const { 
    calculateStandardizedMetrics, 
    extractStrokeData, 
    validateMetrics, 
    mergeMetrics 
} = require('./metrics_calculation_service');

// Configuration
const CONFIG = {
    BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '20'),
    BATCH_DELAY_MS: parseInt(process.env.BATCH_DELAY_MS || '100'),
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
    DRY_RUN: process.env.DRY_RUN === 'true',
    VERBOSE: process.env.VERBOSE !== 'false',
    TARGET_SHAPES_ONLY: process.env.TARGET_SHAPES_ONLY !== 'false' // Default: true
};

// Database connection
const pool = new Pool({
            connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
    ssl: { rejectUnauthorized: false }
});

// Processing statistics
const stats = {
    startTime: new Date(),
    totalRecords: 0,
    processedCount: 0,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    batchCount: 0,
    errors: [],
    processingTimes: []
};

/**
 * Log message with timestamp and level
 */
function log(message, level = 'INFO') {
    if (!CONFIG.VERBOSE && level === 'DEBUG') return;
    
    const timestamp = new Date().toISOString();
    const prefix = {
        'INFO': '✅',
        'WARN': '⚠️',
        'ERROR': '❌',
        'DEBUG': '🔍'
    }[level] || '📝';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Get the total count of shapes needing metrics calculation
 */
async function getTotalCount(client) {
    const query = `
        SELECT COUNT(*) as count
        FROM shapes
        WHERE (
            metrics IS NULL 
            OR metrics = '{}'::jsonb
            OR (
                metrics->>'center_x' IS NULL
                OR metrics->>'center_y' IS NULL
                OR metrics->>'total_points' IS NULL
                OR metrics->>'stroke_count' IS NULL
                OR metrics->>'avg_speed' IS NULL
            )
        )
        ${CONFIG.TARGET_SHAPES_ONLY ? "AND shape_type IN ('circle', 'square', 'triangle')" : ''}
    `;
    
    const result = await client.query(query);
    return parseInt(result.rows[0].count);
}

/**
 * Fetch a batch of shapes needing metrics calculation
 */
async function fetchBatch(client, offset) {
    const query = `
        SELECT 
            id,
            user_id,
            shape_type,
            shape_data,
            metrics,
            created_at
        FROM shapes
        WHERE (
            metrics IS NULL 
            OR metrics = '{}'::jsonb
            OR (
                metrics->>'center_x' IS NULL
                OR metrics->>'center_y' IS NULL
                OR metrics->>'total_points' IS NULL
                OR metrics->>'stroke_count' IS NULL
                OR metrics->>'avg_speed' IS NULL
            )
        )
        ${CONFIG.TARGET_SHAPES_ONLY ? "AND shape_type IN ('circle', 'square', 'triangle')" : ''}
        ORDER BY created_at ASC
        LIMIT $1
        OFFSET $2
    `;
    
    const result = await client.query(query, [CONFIG.BATCH_SIZE, offset]);
    return result.rows;
}

/**
 * Process a single shape record
 */
async function processShape(shape) {
    const startTime = Date.now();
    
    try {
        // Extract stroke data
        const strokeData = extractStrokeData(shape.shape_data);
        if (!strokeData) {
            return {
                success: false,
                error: 'Unable to extract stroke data',
                shapeId: shape.id
            };
        }

        // Calculate metrics
        const newMetrics = calculateStandardizedMetrics(strokeData);
        if (!newMetrics) {
            return {
                success: false,
                error: 'Metrics calculation returned null',
                shapeId: shape.id
            };
        }

        // Validate metrics
        const validation = validateMetrics(newMetrics);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.reason}`,
                shapeId: shape.id
            };
        }

        // Merge with existing metrics
        const mergedMetrics = mergeMetrics(shape.metrics, newMetrics);

        // Add shape-specific metadata
        mergedMetrics._processed_at = new Date().toISOString();
        mergedMetrics._processing_time_ms = Date.now() - startTime;

        return {
            success: true,
            shapeId: shape.id,
            metrics: mergedMetrics,
            processingTime: Date.now() - startTime
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            shapeId: shape.id,
            stack: error.stack
        };
    }
}

/**
 * Update shape metrics in database
 */
async function updateShapeMetrics(client, shapeId, metrics) {
    const query = `
        UPDATE shapes 
        SET 
            metrics = $1
        WHERE id = $2
        RETURNING id
    `;
    
    await client.query(query, [JSON.stringify(metrics), shapeId]);
}

/**
 * Process a batch of shapes
 */
async function processBatch(shapes) {
    const batchStartTime = Date.now();
    const batchResults = {
        success: 0,
        failure: 0,
        skipped: 0,
        errors: []
    };

    log(`Processing batch of ${shapes.length} shapes`, 'DEBUG');

    // Use a separate client for each batch transaction
    const client = await pool.connect();
    
    try {
        // Process each shape in the batch
        for (const shape of shapes) {
            try {
                // Start transaction for this shape
                await client.query('BEGIN');

                const result = await processShape(shape);
                
                if (result.success) {
                    if (!CONFIG.DRY_RUN) {
                        await updateShapeMetrics(client, result.shapeId, result.metrics);
                    }
                    
                    await client.query('COMMIT');
                    batchResults.success++;
                    stats.successCount++;
                    stats.processingTimes.push(result.processingTime);
                    
                    log(`✓ Shape ${shape.id} (${shape.shape_type}): Metrics calculated successfully`, 'DEBUG');
                } else {
                    await client.query('ROLLBACK');
                    batchResults.failure++;
                    stats.failureCount++;
                    batchResults.errors.push({
                        shapeId: result.shapeId,
                        error: result.error
                    });
                    
                    log(`✗ Shape ${shape.id}: ${result.error}`, 'WARN');
                }
            } catch (error) {
                // Rollback on any error
                await client.query('ROLLBACK');
                batchResults.failure++;
                stats.failureCount++;
                batchResults.errors.push({
                    shapeId: shape.id,
                    error: error.message
                });
                
                log(`✗ Shape ${shape.id}: Database error - ${error.message}`, 'ERROR');
            }
            
            stats.processedCount++;
        }
    } finally {
        client.release();
    }

    const batchTime = Date.now() - batchStartTime;
    log(`Batch completed in ${batchTime}ms - Success: ${batchResults.success}, Failed: ${batchResults.failure}`, 'INFO');
    
    return batchResults;
}

/**
 * Main processing function
 */
async function processAllShapes() {
    log('Starting Phase 2: Shape Metrics Standardization', 'INFO');
    log(`Configuration: ${JSON.stringify(CONFIG)}`, 'DEBUG');
    
    const mainClient = await pool.connect();
    
    try {
        // Get total count
        stats.totalRecords = await getTotalCount(mainClient);
        log(`Found ${stats.totalRecords} shapes needing metrics calculation`, 'INFO');
        
        if (stats.totalRecords === 0) {
            log('No shapes need processing. All shapes have complete metrics!', 'INFO');
            return;
        }

        if (CONFIG.DRY_RUN) {
            log('DRY RUN MODE - No changes will be saved to database', 'WARN');
        }

        let offset = 0;
        let hasMore = true;

        // Process in batches
        while (hasMore && stats.processedCount < stats.totalRecords) {
            stats.batchCount++;
            
            // Fetch next batch
            const shapes = await fetchBatch(mainClient, offset);
            
            if (shapes.length === 0) {
                hasMore = false;
                break;
            }

            log(`\nBatch ${stats.batchCount}: Processing ${shapes.length} shapes...`, 'INFO');
            
            // Process the batch
            await processBatch(shapes);
            
            // Update progress
            const progress = ((stats.processedCount / stats.totalRecords) * 100).toFixed(1);
            log(`Progress: ${stats.processedCount}/${stats.totalRecords} (${progress}%)`, 'INFO');

            // Add delay between batches
            if (hasMore && shapes.length === CONFIG.BATCH_SIZE) {
                log(`Waiting ${CONFIG.BATCH_DELAY_MS}ms before next batch...`, 'DEBUG');
                await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY_MS));
            }

            // Update offset for next batch
            offset += shapes.length;

            // Check if we should continue
            if (shapes.length < CONFIG.BATCH_SIZE) {
                hasMore = false;
            }
        }

    } catch (error) {
        log(`Fatal error: ${error.message}`, 'ERROR');
        console.error(error.stack);
        stats.errors.push({
            type: 'FATAL',
            message: error.message,
            stack: error.stack
        });
    } finally {
        mainClient.release();
    }

    // Print final statistics
    printFinalStats();
}

/**
 * Print final processing statistics
 */
function printFinalStats() {
    const duration = Date.now() - stats.startTime.getTime();
    const successRate = stats.processedCount > 0 
        ? ((stats.successCount / stats.processedCount) * 100).toFixed(2)
        : 0;
    
    const avgProcessingTime = stats.processingTimes.length > 0
        ? (stats.processingTimes.reduce((a, b) => a + b, 0) / stats.processingTimes.length).toFixed(2)
        : 0;

    console.log('\n' + '='.repeat(60));
    console.log('PROCESSING COMPLETE - FINAL STATISTICS');
    console.log('='.repeat(60));
    console.log(`Total shapes found: ${stats.totalRecords}`);
    console.log(`Total processed: ${stats.processedCount}`);
    console.log(`Successful: ${stats.successCount} ✅`);
    console.log(`Failed: ${stats.failureCount} ❌`);
    console.log(`Skipped: ${stats.skippedCount} ⏭️`);
    console.log(`Success rate: ${successRate}%`);
    console.log(`Total batches: ${stats.batchCount}`);
    console.log(`Average processing time: ${avgProcessingTime}ms per shape`);
    console.log(`Total duration: ${(duration / 1000).toFixed(1)} seconds`);
    
    if (CONFIG.DRY_RUN) {
        console.log('\n⚠️  DRY RUN - No changes were saved to database');
    }

    if (stats.errors.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('ERRORS ENCOUNTERED:');
        console.log('='.repeat(60));
        
        // Group errors by type
        const errorGroups = {};
        stats.errors.forEach(error => {
            const key = error.error || error.message || 'Unknown';
            if (!errorGroups[key]) {
                errorGroups[key] = 0;
            }
            errorGroups[key]++;
        });

        Object.entries(errorGroups)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([error, count]) => {
                console.log(`- ${error}: ${count} occurrences`);
            });
    }

    console.log('='.repeat(60));
}

/**
 * Run the script
 */
async function main() {
    try {
        await processAllShapes();
        process.exit(0);
    } catch (error) {
        log(`Script failed: ${error.message}`, 'ERROR');
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Handle interruption
process.on('SIGINT', async () => {
    log('\nProcessing interrupted by user', 'WARN');
    printFinalStats();
    await pool.end();
    process.exit(1);
});

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { processAllShapes };