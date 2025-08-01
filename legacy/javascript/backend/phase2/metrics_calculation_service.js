/**
 * Phase 2: Standardized Metrics Calculation Service
 * 
 * This service provides a standardized metrics calculation function
 * extracted from successful signature processing logic to ensure
 * consistent metrics calculation for shapes with 99%+ success rate.
 */

/**
 * Calculate standardized metrics from stroke data
 * Based on the successful signature metrics calculation algorithm
 * 
 * @param {Array} strokeData - Array of strokes, where each stroke is an array of points
 * @returns {Object} Calculated metrics object
 */
function calculateStandardizedMetrics(strokeData) {
    // Handle NULL or invalid input
    if (!strokeData || !Array.isArray(strokeData)) {
        console.error('Invalid stroke data: not an array or null');
        return null;
    }

    // Handle empty stroke data
    if (strokeData.length === 0) {
        console.warn('Empty stroke data provided');
        return {
            stroke_count: 0,
            total_points: 0,
            total_duration_ms: 0,
            avg_points_per_stroke: 0,
            avg_speed: 0,
            center_x: 0,
            center_y: 0,
            width: 0,
            height: 0,
            area: 0,
            aspect_ratio: 0
        };
    }

    // Initialize tracking variables
    let totalPoints = 0;
    let totalDistance = 0;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let firstTime = null;
    let lastTime = null;
    let validStrokes = 0;

    // Process each stroke
    for (const stroke of strokeData) {
        // Validate stroke is an array
        if (!Array.isArray(stroke)) {
            console.warn('Skipping invalid stroke: not an array');
            continue;
        }

        // Skip empty strokes
        if (stroke.length === 0) {
            console.warn('Skipping empty stroke');
            continue;
        }

        validStrokes++;
        let strokeDistance = 0;
        let prevPoint = null;

        // Process each point in the stroke
        for (let i = 0; i < stroke.length; i++) {
            const point = stroke[i];

            // Validate point structure
            if (!point || typeof point !== 'object') {
                console.warn(`Skipping invalid point at stroke ${validStrokes}, index ${i}`);
                continue;
            }

            // Extract coordinates with validation
            const x = parseFloat(point.x);
            const y = parseFloat(point.y);
            const time = point.time !== undefined ? parseFloat(point.time) : null;

            // Skip if coordinates are invalid
            if (isNaN(x) || isNaN(y)) {
                console.warn(`Invalid coordinates at stroke ${validStrokes}, index ${i}: x=${point.x}, y=${point.y}`);
                continue;
            }

            totalPoints++;

            // Update bounding box
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            // Track time range
            if (time !== null && !isNaN(time)) {
                if (firstTime === null || time < firstTime) {
                    firstTime = time;
                }
                if (lastTime === null || time > lastTime) {
                    lastTime = time;
                }
            }

            // Calculate distance from previous point
            if (prevPoint && prevPoint.x !== undefined && prevPoint.y !== undefined) {
                const dx = x - prevPoint.x;
                const dy = y - prevPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (!isNaN(distance) && isFinite(distance)) {
                    strokeDistance += distance;
                    totalDistance += distance;
                }
            }

            prevPoint = { x, y, time };
        }
    }

    // Calculate derived metrics
    const width = isFinite(maxX) && isFinite(minX) ? maxX - minX : 0;
    const height = isFinite(maxY) && isFinite(minY) ? maxY - minY : 0;
    const area = width * height;
    const aspect_ratio = height > 0 ? width / height : 0;
    const center_x = isFinite(maxX) && isFinite(minX) ? (minX + maxX) / 2 : 0;
    const center_y = isFinite(maxY) && isFinite(minY) ? (minY + maxY) / 2 : 0;

    // Calculate time duration
    let time_duration = 0;
    if (firstTime !== null && lastTime !== null && lastTime > firstTime) {
        time_duration = lastTime - firstTime;
    }

    // Calculate average speed
    let avg_speed = 0;
    if (time_duration > 0 && totalDistance > 0) {
        avg_speed = totalDistance / time_duration;
    }

    // Calculate averages
    const avg_points_per_stroke = validStrokes > 0 ? totalPoints / validStrokes : 0;

    // Return the standardized metrics object
    return {
        // Basic metrics
        stroke_count: validStrokes,
        total_points: totalPoints,
        time_duration: Math.round(time_duration), // Match signature format
        
        // Spatial metrics
        center_x: Math.round(center_x * 100) / 100, // 2 decimal places
        center_y: Math.round(center_y * 100) / 100, // 2 decimal places
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
        area: Math.round(area * 100) / 100,
        aspect_ratio: Math.round(aspect_ratio * 1000) / 1000, // 3 decimal places
        
        // Calculated metrics
        avg_points_per_stroke: Math.round(avg_points_per_stroke * 100) / 100,
        avg_speed: Math.round(avg_speed * 1000) / 1000, // 3 decimal places
        total_distance: Math.round(totalDistance * 100) / 100,
        
        // Metadata for debugging
        _calculation_metadata: {
            valid_strokes: validStrokes,
            skipped_strokes: strokeData.length - validStrokes,
            has_time_data: firstTime !== null && lastTime !== null,
            bounding_box: {
                min_x: isFinite(minX) ? minX : null,
                min_y: isFinite(minY) ? minY : null,
                max_x: isFinite(maxX) ? maxX : null,
                max_y: isFinite(maxY) ? maxY : null
            }
        }
    };
}

/**
 * Extract stroke data from shape_data JSONB field
 * Handles various data formats and edge cases
 * 
 * @param {Object} shapeData - The shape_data JSONB object from database
 * @returns {Array|null} Extracted stroke array or null if invalid
 */
function extractStrokeData(shapeData) {
    if (!shapeData) {
        console.error('Shape data is null or undefined');
        return null;
    }

    // Try to extract from 'raw' field first (most common format)
    if (shapeData.raw && Array.isArray(shapeData.raw)) {
        return shapeData.raw;
    }

    // Try 'strokes' field
    if (shapeData.strokes && Array.isArray(shapeData.strokes)) {
        return shapeData.strokes;
    }

    // Try 'data' field
    if (shapeData.data && Array.isArray(shapeData.data)) {
        return shapeData.data;
    }

    // If shape_data itself is an array (legacy format)
    if (Array.isArray(shapeData)) {
        return shapeData;
    }

    console.error('Unable to extract stroke data from shape_data:', Object.keys(shapeData));
    return null;
}

/**
 * Validate calculated metrics are within reasonable ranges
 * Based on observed ranges from successful signature processing
 * 
 * @param {Object} metrics - Calculated metrics object
 * @returns {Object} Validation result with valid flag and reason if invalid
 */
function validateMetrics(metrics) {
    if (!metrics) {
        return { valid: false, reason: 'Metrics object is null' };
    }

    // Check required fields exist
    const requiredFields = ['stroke_count', 'total_points', 'center_x', 'center_y', 'avg_speed'];
    for (const field of requiredFields) {
        if (metrics[field] === undefined || metrics[field] === null) {
            return { valid: false, reason: `Missing required field: ${field}` };
        }
    }

    // Validate ranges based on signature data analysis
    if (metrics.stroke_count < 0 || metrics.stroke_count > 100) {
        return { valid: false, reason: `Invalid stroke_count: ${metrics.stroke_count}` };
    }

    if (metrics.total_points < 0 || metrics.total_points > 10000) {
        return { valid: false, reason: `Invalid total_points: ${metrics.total_points}` };
    }

    if (metrics.center_x < -1000 || metrics.center_x > 10000) {
        return { valid: false, reason: `Invalid center_x: ${metrics.center_x}` };
    }

    if (metrics.center_y < -1000 || metrics.center_y > 10000) {
        return { valid: false, reason: `Invalid center_y: ${metrics.center_y}` };
    }

    if (metrics.avg_speed < 0 || metrics.avg_speed > 100) {
        return { valid: false, reason: `Invalid avg_speed: ${metrics.avg_speed}` };
    }

    if (metrics.width < 0 || metrics.width > 10000) {
        return { valid: false, reason: `Invalid width: ${metrics.width}` };
    }

    if (metrics.height < 0 || metrics.height > 10000) {
        return { valid: false, reason: `Invalid height: ${metrics.height}` };
    }

    return { valid: true };
}

/**
 * Merge new metrics with existing metrics, preserving valid existing values
 * 
 * @param {Object} existingMetrics - Current metrics from database
 * @param {Object} newMetrics - Newly calculated metrics
 * @returns {Object} Merged metrics object
 */
function mergeMetrics(existingMetrics, newMetrics) {
    if (!existingMetrics || typeof existingMetrics !== 'object') {
        return newMetrics;
    }

    // Start with existing metrics
    const merged = { ...existingMetrics };

    // Only override if new value is valid and old value is missing/invalid
    for (const [key, value] of Object.entries(newMetrics)) {
        if (key === '_calculation_metadata') {
            // Always update metadata
            merged[key] = value;
        } else if (
            merged[key] === undefined || 
            merged[key] === null || 
            (typeof merged[key] === 'number' && (isNaN(merged[key]) || !isFinite(merged[key])))
        ) {
            // Only update if existing value is missing or invalid
            merged[key] = value;
        }
    }

    return merged;
}

module.exports = {
    calculateStandardizedMetrics,
    extractStrokeData,
    validateMetrics,
    mergeMetrics
};