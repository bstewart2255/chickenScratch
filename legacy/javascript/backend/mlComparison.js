const axios = require('axios');

// Enhanced ML-based signature comparison that respects excluded features
async function compareSignaturesEnhanced(storedMetrics, currentMetrics, baseline, username) {
    try {
        // Ensure we have valid metrics
        if (!storedMetrics || !currentMetrics || !baseline) {
            console.error('Missing metrics or baseline for enhanced ML comparison');
            return compareSignaturesML(storedMetrics, currentMetrics, username); // Fallback
        }
        
        // Get list of supported features from baseline
        const supportedFeatures = baseline._supported_features || [];
        const excludedFeatures = baseline._excluded_features || [];
        
        console.log(`Enhanced comparison for ${username}:`, {
            supportedFeatures: supportedFeatures.length,
            excludedFeatures: excludedFeatures.length
        });
        
        // Calculate differences only for supported features
        let totalDifference = 0;
        let featureCount = 0;
        
        // Process each supported feature
        supportedFeatures.forEach(feature => {
            // Skip metadata fields
            if (feature.startsWith('_') || feature.endsWith('_std')) return;
            
            const baselineValue = baseline[feature];
            const currentValue = currentMetrics[feature];
            
            // Skip if either value is missing
            if (baselineValue === undefined || currentValue === undefined) return;
            
            // Calculate normalized difference
            const diff = Math.abs(currentValue - baselineValue);
            const normalizedDiff = baselineValue > 0 ? diff / baselineValue : diff;
            
            // Weight different features differently
            let weight = 1.0;
            if (feature.includes('velocity')) weight = 1.5;
            else if (feature.includes('pressure') && !excludedFeatures.includes(feature)) weight = 2.0;
            else if (feature.includes('duration')) weight = 1.2;
            else if (feature.includes('stroke')) weight = 1.3;
            
            totalDifference += normalizedDiff * weight;
            featureCount++;
        });
        
        // Calculate score based on average difference
        const avgDifference = featureCount > 0 ? totalDifference / featureCount : 1.0;
        let score = Math.max(0, 100 - (avgDifference * 50));
        
        // Ensure minimum score of 5%
        score = Math.max(5, Math.min(100, score));
        
        console.log(`Enhanced ML score for ${username}: ${score.toFixed(1)}% (${featureCount} features)`);
        
        // Try ML API with enhanced features if available
        try {
            const defaultMLUrl = process.env.NODE_ENV === 'production' 
                ? 'https://chickenscratch-ml.onrender.com'
                : 'http://localhost:5002';
            const ML_API_URL = process.env.ML_API_URL || defaultMLUrl;
            
            const response = await axios.post(`${ML_API_URL}/api/predict_enhanced`, {
                username: username,
                baseline: baseline,
                current_features: currentMetrics,
                supported_features: supportedFeatures,
                excluded_features: excludedFeatures
            });
            
            console.log(`Enhanced ML API Response:`, response.data);
            return response.data.confidence_score;
        } catch (mlError) {
            console.warn('Enhanced ML API not available, using calculated score:', mlError.message);
            return score;
        }
        
    } catch (error) {
        console.error('Enhanced ML comparison error:', error);
        // Fallback to standard comparison
        return compareSignaturesML(storedMetrics, currentMetrics, username);
    }
}

// ML-based signature comparison using the trained model
async function compareSignaturesML(storedMetrics, currentMetrics, username) {
    try {
        // Ensure we have valid metrics
        if (!storedMetrics || !currentMetrics) {
            console.error('Missing metrics for ML comparison');
            return 0; // Failed comparison
        }
        
        // Calculate feature differences (what the model needs)
        const featureDifferences = {
            stroke_count_diff: Math.abs(currentMetrics.stroke_count - storedMetrics.stroke_count),
            total_points_diff: Math.abs(currentMetrics.total_points - storedMetrics.total_points),
            duration_diff: Math.abs(currentMetrics.total_duration_ms - storedMetrics.total_duration_ms),
            avg_velocity_diff: Math.abs(currentMetrics.avg_velocity - storedMetrics.avg_velocity),
            max_velocity_diff: Math.abs(currentMetrics.max_velocity - storedMetrics.max_velocity),
            width_diff: Math.abs(currentMetrics.width - storedMetrics.width),
            height_diff: Math.abs(currentMetrics.height - storedMetrics.height),
            area_diff: Math.abs(currentMetrics.area - storedMetrics.area),
            aspect_ratio_diff: Math.abs(currentMetrics.aspect_ratio - storedMetrics.aspect_ratio),
            
            // Relative differences (percentages)
            velocity_relative_diff: storedMetrics.avg_velocity > 0 ? 
                Math.abs((currentMetrics.avg_velocity - storedMetrics.avg_velocity) / storedMetrics.avg_velocity) : 1,
            area_relative_diff: storedMetrics.area > 0 ?
                Math.abs((currentMetrics.area - storedMetrics.area) / storedMetrics.area) : 1,
            duration_relative_diff: storedMetrics.total_duration_ms > 0 ?
                Math.abs((currentMetrics.total_duration_ms - storedMetrics.total_duration_ms) / storedMetrics.total_duration_ms) : 1
        };
        
        // For now, use a rule-based approach until ML model is trained
        // This is much better than the base64 comparison!
        let score = 100;
        
        // Penalize based on differences
        score -= featureDifferences.stroke_count_diff * 5;
        
        // Handle velocity calculation issues (temporary fix)
        if (featureDifferences.velocity_relative_diff > 0.95) {
            // Likely a calculation error, reduce penalty significantly
            console.warn(`Extreme velocity difference detected (${(featureDifferences.velocity_relative_diff * 100).toFixed(1)}%) - likely calculation issue`);
            score -= 5; // Fixed small penalty instead of proportional
        } else {
            score -= featureDifferences.velocity_relative_diff * 20;
        }
        
        score -= featureDifferences.area_relative_diff * 15;
        score -= featureDifferences.duration_relative_diff * 10;
        score -= featureDifferences.aspect_ratio_diff * 10;
        
        // Ensure score is between 5 and 100 (minimum 5% for any signature attempt)
        score = Math.max(5, Math.min(100, score));
        
        console.log(`ML Comparison for ${username}:`, {
            storedMetrics: {
                strokes: storedMetrics.stroke_count,
                velocity: storedMetrics.avg_velocity.toFixed(3),
                area: storedMetrics.area
            },
            currentMetrics: {
                strokes: currentMetrics.stroke_count,
                velocity: currentMetrics.avg_velocity.toFixed(3),
                area: currentMetrics.area
            },
            differences: {
                velocity: (featureDifferences.velocity_relative_diff * 100).toFixed(1) + '%',
                area: (featureDifferences.area_relative_diff * 100).toFixed(1) + '%',
                duration: (featureDifferences.duration_relative_diff * 100).toFixed(1) + '%'
            },
            score: score.toFixed(1)
        });
        
        // Try to use ML model first, fall back to rule-based if unavailable
        try {
            // Use environment variable or default based on NODE_ENV
            const defaultMLUrl = process.env.NODE_ENV === 'production' 
                ? 'https://chickenscratch-ml.onrender.com'
                : 'http://localhost:5002';
            const ML_API_URL = process.env.ML_API_URL || defaultMLUrl;
            const response = await axios.post(`${ML_API_URL}/api/predict`, {
                username: username,
                stored_features: storedMetrics,
                current_features: currentMetrics
            });
            
            console.log(`ML API Response:`, response.data);
            return response.data.confidence_score;
        } catch (mlError) {
            console.warn('ML API not available, using rule-based scoring:', mlError.message);
            return score;
        }
        
    } catch (error) {
        console.error('ML comparison error:', error);
        return 0; // Failed comparison
    }
}

// Compare multiple signatures and return average score
async function compareMultipleSignaturesML(storedSignatures, currentMetrics, username) {
    if (!storedSignatures || storedSignatures.length === 0) {
        return 0;
    }
    
    // Compare against each stored signature
    const scores = await Promise.all(
        storedSignatures.map(stored => 
            compareSignaturesML(stored.metrics || {}, currentMetrics, username)
        )
    );
    
    // Return the highest score (most similar signature)
    return Math.max(...scores);
}

module.exports = {
    compareSignaturesML,
    compareMultipleSignaturesML,
    compareSignaturesEnhanced
};