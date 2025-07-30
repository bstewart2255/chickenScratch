const http = require('http');

const username = 'migrationtest12';
const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/user/${username}/detailed-analysis`,
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            const baseline = response.baseline;
            
            console.log('\n--- Checking for zero/falsy values ---');
            console.log('circle_roundness:', baseline.circle_roundness, 'truthy?', !!baseline.circle_roundness);
            console.log('square_corner_accuracy:', baseline.square_corner_accuracy, 'truthy?', !!baseline.square_corner_accuracy);
            console.log('triangle_closure:', baseline.triangle_closure, 'truthy?', !!baseline.triangle_closure);
            console.log('face_score:', baseline.face_score, 'truthy?', !!baseline.face_score);
            console.log('star_score:', baseline.star_score, 'truthy?', !!baseline.star_score);
            console.log('house_score:', baseline.house_score, 'truthy?', !!baseline.house_score);
            console.log('connect_dots_score:', baseline.connect_dots_score, 'truthy?', !!baseline.connect_dots_score);
            
            // Check for specific enrollment data
            console.log('\n--- Checking enrollment data ---');
            console.log('Shapes enrolled:', response.enrollment?.shapes?.length || 0);
            console.log('Drawings enrolled:', response.enrollment?.drawings?.length || 0);
            
            if (response.enrollment?.shapes) {
                response.enrollment.shapes.forEach(shape => {
                    console.log(`Shape ${shape.shape_type}:`, {
                        has_metrics: !!shape.metrics,
                        has_enhanced_features: !!shape.enhanced_features,
                        stroke_count: shape.metrics?.strokeCount
                    });
                });
            }
            
            if (response.enrollment?.drawings) {
                response.enrollment.drawings.forEach(drawing => {
                    console.log(`Drawing ${drawing.drawing_type}:`, {
                        has_metrics: !!drawing.metrics,
                        has_enhanced_features: !!drawing.enhanced_features,
                        stroke_count: drawing.metrics?.strokeCount
                    });
                });
            }
            
        } catch (err) {
            console.error('Error parsing response:', err);
        }
    });
});

req.on('error', (error) => {
    console.error('Request error:', error);
});

req.end();