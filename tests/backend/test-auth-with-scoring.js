// Test authentication with component scoring
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testAuth(username) {
    try {
        console.log(`\nTesting authentication for user: ${username}`);
        
        // Simple signature-only authentication
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                signature: {
                    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                    raw: [[{x: 100, y: 100}, {x: 200, y: 200}]],
                    metrics: {
                        stroke_count: 1,
                        total_points: 2,
                        total_duration_ms: 1000,
                        avg_velocity: 50
                    }
                }
            })
        });
        
        const result = await response.json();
        console.log('Response:', result);
        
        if (result.scores) {
            console.log('\nComponent Scores:');
            Object.entries(result.scores).forEach(([component, score]) => {
                console.log(`  ${component}: ${score}`);
            });
        }
        
        // Check if auth attempt was saved with component scores
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for DB write
        
        console.log('\nChecking dashboard data...');
        const dashboardResponse = await fetch(`${API_URL}/api/user/${username}/detailed-analysis`);
        const dashboardData = await dashboardResponse.json();
        
        if (dashboardData.authAttempts && dashboardData.authAttempts.length > 0) {
            const latestAttempt = dashboardData.authAttempts[0];
            console.log('\nLatest attempt in dashboard:');
            console.log(`  Confidence: ${latestAttempt.confidence}`);
            console.log(`  Shape scores:`, latestAttempt.shape_scores || 'None');
            console.log(`  Drawing scores:`, latestAttempt.drawing_scores || 'None');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Test with a specific user or use command line argument
const username = process.argv[2] || 'testuser';
testAuth(username);