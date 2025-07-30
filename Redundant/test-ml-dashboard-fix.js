// Test script to verify ML Dashboard fixes
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = process.env.API_URL || 'https://your-render-app.onrender.com'; // Update with your Render URL
const TEST_USER = 'testuser';

async function testMLDashboardFix() {
    console.log('🧪 Testing ML Dashboard Fixes...\n');
    
    try {
        // Test 1: Signature-only authentication (should now generate component scores)
        console.log('1️⃣ Testing signature-only authentication...');
        const authResponse = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: TEST_USER,
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
        
        const authResult = await authResponse.json();
        console.log('Auth Response:', authResult);
        
        if (authResult.error) {
            console.log('❌ Authentication failed:', authResult.error);
        } else {
            console.log('✅ Authentication successful');
            if (authResult.scores) {
                console.log('📊 Component Scores:');
                Object.entries(authResult.scores).forEach(([component, score]) => {
                    console.log(`   ${component}: ${score}%`);
                });
            }
        }
        
        // Test 2: Check detailed analysis API
        console.log('\n2️⃣ Testing detailed analysis API...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for DB write
        
        const analysisResponse = await fetch(`${API_URL}/api/user/${TEST_USER}/detailed-analysis`);
        const analysisData = await analysisResponse.json();
        
        if (analysisData.error) {
            console.log('❌ Analysis API failed:', analysisData.error);
        } else {
            console.log('✅ Analysis API successful');
            
            // Check for component scores in auth attempts
            if (analysisData.authAttempts && analysisData.authAttempts.length > 0) {
                const latestAttempt = analysisData.authAttempts[0];
                console.log(`📈 Latest attempt (ID: ${latestAttempt.id}):`);
                console.log(`   Confidence: ${latestAttempt.confidence}%`);
                console.log(`   Shape scores:`, latestAttempt.shape_scores || 'None');
                console.log(`   Drawing scores:`, latestAttempt.drawing_scores || 'None');
                
                const hasComponentScores = latestAttempt.shape_scores || latestAttempt.drawing_scores;
                if (hasComponentScores) {
                    console.log('✅ Component scores are present!');
                } else {
                    console.log('❌ Component scores are still missing');
                }
            } else {
                console.log('⚠️ No authentication attempts found');
            }
            
            // Check enrollment data
            if (analysisData.enrollment) {
                console.log('\n📚 Enrollment Data:');
                console.log(`   Signatures: ${analysisData.enrollment.signatures?.length || 0}`);
                console.log(`   Shapes: ${analysisData.enrollment.shapes?.length || 0}`);
                console.log(`   Drawings: ${analysisData.enrollment.drawings?.length || 0}`);
            }
        }
        
        // Test 3: Test ML Dashboard frontend
        console.log('\n3️⃣ Testing ML Dashboard frontend...');
        console.log(`🌐 Open your ML Dashboard at: ${API_URL.replace('/api', '')}/ml-dashboard-v3.html?username=${TEST_USER}`);
        console.log('   Check that:');
        console.log('   - Component scores appear in the Data tab');
        console.log('   - Images display in the Images tab');
        console.log('   - No "No component scores available" messages');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Test with different users
async function testMultipleUsers() {
    const testUsers = ['testuser', 'testuser2', 'testuser3'];
    
    for (const user of testUsers) {
        console.log(`\n🧪 Testing user: ${user}`);
        try {
            const response = await fetch(`${API_URL}/api/user/${user}/detailed-analysis`);
            const data = await response.json();
            
            if (data.authAttempts && data.authAttempts.length > 0) {
                const hasScores = data.authAttempts.some(a => a.shape_scores || a.drawing_scores);
                console.log(`   ${hasScores ? '✅' : '❌'} Component scores: ${hasScores ? 'Present' : 'Missing'}`);
            } else {
                console.log('   ⚠️ No auth attempts');
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
}

// Run tests
async function runTests() {
    await testMLDashboardFix();
    console.log('\n' + '='.repeat(50));
    await testMultipleUsers();
    
    console.log('\n🎯 Test Summary:');
    console.log('If you see component scores in the API responses, the fix is working!');
    console.log('Check your ML Dashboard to verify the UI displays correctly.');
}

runTests(); 