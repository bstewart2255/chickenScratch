// Test script for enhanced user details endpoint
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testUserDetails(username) {
    try {
        console.log(`\n🔍 Testing enhanced user details for: ${username}`);
        console.log('=' .repeat(60));
        
        const response = await fetch(`${API_URL}/api/user/${username}/details`);
        
        if (!response.ok) {
            console.error(`❌ Error: ${response.status} ${response.statusText}`);
            const error = await response.json();
            console.error('Error details:', error);
            return;
        }
        
        const data = await response.json();
        
        console.log('\n📊 Basic User Info:');
        console.log(`  Username: ${data.username}`);
        console.log(`  Enrolled: ${new Date(data.enrolledDate).toLocaleDateString()}`);
        console.log(`  Total Signatures: ${data.totalSignatures}`);
        console.log(`  Total Auth Attempts: ${data.totalAuths}`);
        console.log(`  Success Rate: ${data.successRate}%`);
        console.log(`  Avg Confidence: ${data.avgConfidence}%`);
        
        console.log('\n🎯 User Baseline (ML Features):');
        if (data.userBaseline) {
            const baseline = data.userBaseline;
            console.log(`  Stroke Count: ${baseline.stroke_count || 'N/A'}`);
            console.log(`  Total Points: ${baseline.total_points || 'N/A'}`);
            console.log(`  Duration (ms): ${baseline.total_duration_ms || 'N/A'}`);
            console.log(`  Avg Velocity: ${baseline.avg_velocity || 'N/A'}`);
            console.log(`  Width: ${baseline.width || 'N/A'}`);
            console.log(`  Height: ${baseline.height || 'N/A'}`);
            console.log(`  Area: ${baseline.area || 'N/A'}`);
            console.log(`  Aspect Ratio: ${baseline.aspect_ratio || 'N/A'}`);
            console.log('\n  ... and', Object.keys(baseline).length - 8, 'more features');
        }
        
        console.log('\n📈 Recent Attempts with ML Features:');
        if (data.recentAttemptsWithFeatures && data.recentAttemptsWithFeatures.length > 0) {
            data.recentAttemptsWithFeatures.slice(0, 3).forEach((attempt, index) => {
                console.log(`\n  Attempt ${index + 1}:`);
                console.log(`    Time: ${attempt.time}`);
                console.log(`    Status: ${attempt.status} (${attempt.confidence}% confidence)`);
                
                if (attempt.attempt_scores) {
                    console.log('    Sample ML Features vs Baseline:');
                    const features = ['stroke_count', 'avg_velocity', 'area'];
                    features.forEach(feature => {
                        const attemptValue = attempt.attempt_scores[feature] || 0;
                        const baselineValue = attempt.user_baseline[feature] || 0;
                        const diff = ((attemptValue - baselineValue) / baselineValue * 100).toFixed(1);
                        console.log(`      ${feature}: ${attemptValue} (baseline: ${baselineValue}, diff: ${diff}%)`);
                    });
                }
            });
        } else {
            console.log('  No recent authentication attempts with ML features found');
        }
        
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

// Run test with command line argument or default username
const username = process.argv[2] || 'testuser';
testUserDetails(username);