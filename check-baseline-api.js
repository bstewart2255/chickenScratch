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
            console.log('API Response baseline:', JSON.stringify(response.baseline, null, 2));
            
            // Check for shape and drawing features
            const baseline = response.baseline;
            console.log('\n--- Shape Features ---');
            if (baseline.shape_features) {
                console.log('Circle roundness:', baseline.shape_features.circle_roundness);
                console.log('Square corners:', baseline.shape_features.square_corners);
                console.log('Triangle closure:', baseline.shape_features.triangle_closure);
            } else {
                console.log('No shape_features in baseline');
            }
            
            console.log('\n--- Drawing Features ---');
            if (baseline.drawing_features) {
                console.log('Face features:', baseline.drawing_features.face_features);
                console.log('Star points:', baseline.drawing_features.star_points);
                console.log('House structure:', baseline.drawing_features.house_structure);
                console.log('Connect dots:', baseline.drawing_features.connect_dots);
            } else {
                console.log('No drawing_features in baseline');
            }
            
            // Check enrollment data
            console.log('\n--- Enrollment Data ---');
            console.log('Shapes count:', response.enrollment?.shapes?.length || 0);
            console.log('Drawings count:', response.enrollment?.drawings?.length || 0);
            
        } catch (err) {
            console.error('Error parsing response:', err);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Request error:', error);
});

req.end();