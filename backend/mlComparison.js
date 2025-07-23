const axios = require('axios');

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
        score -= featureDifferences.velocity_relative_diff * 20;
        score -= featureDifferences.area_relative_diff * 15;
        score -= featureDifferences.duration_relative_diff * 10;
        score -= featureDifferences.aspect_ratio_diff * 10;
        
        // Ensure score is between 0 and 100
        score = Math.max(0, Math.min(100, score));
        
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
            const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5002';
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
    compareMultipleSignaturesML
};