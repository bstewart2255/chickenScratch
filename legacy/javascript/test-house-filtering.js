// Test script to verify that house and connect_dots are filtered out of authentication attempts
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testHouseFiltering() {
    try {
        console.log('Testing house/connect_dots filtering in authentication attempts...\n');
        
        // Test with a user that has enrolled all components including house and connect_dots
        const testUsername = 'testuser_house_filtering';
        
        // First, let's check if the user exists and has enrolled components
        console.log(`1. Checking user enrollment for: ${testUsername}`);
        const userResponse = await fetch(`${API_URL}/api/user/${testUsername}/detailed-analysis`);
        
        if (!userResponse.ok) {
            console.log('User not found, creating test user with all components...');
            // Create a test user with all components enrolled
            await createTestUserWithAllComponents(testUsername);
        }
        
        // Now test authentication with signature-only (which should trigger estimated scores)
        console.log('\n2. Testing signature-only authentication...');
        const authResponse = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: testUsername,
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
        console.log('Authentication response:', authResult);
        
        if (authResult.scores) {
            console.log('\n3. Component scores in authentication response:');
            Object.entries(authResult.scores).forEach(([component, score]) => {
                console.log(`  ${component}: ${score}%`);
            });
            
            // Check if house and connect_dots are present (they shouldn't be)
            const hasHouse = 'house' in authResult.scores;
            const hasConnectDots = 'connect_dots' in authResult.scores;
            
            console.log('\n4. Filtering verification:');
            console.log(`  House component present: ${hasHouse} ❌`);
            console.log(`  Connect dots component present: ${hasConnectDots} ❌`);
            
            if (!hasHouse && !hasConnectDots) {
                console.log('\n✅ SUCCESS: House and connect_dots are correctly filtered out!');
                console.log('   Only components from the sign-in flow are included.');
            } else {
                console.log('\n❌ FAILURE: House or connect_dots are still present in authentication scores!');
            }
            
            // Verify that only auth flow components are present
            const expectedComponents = ['signature', 'circle', 'square', 'triangle', 'face', 'star'];
            const unexpectedComponents = Object.keys(authResult.scores).filter(
                comp => !expectedComponents.includes(comp)
            );
            
            if (unexpectedComponents.length === 0) {
                console.log('\n✅ SUCCESS: Only expected authentication flow components are present!');
            } else {
                console.log('\n❌ FAILURE: Unexpected components found:', unexpectedComponents);
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

async function createTestUserWithAllComponents(username) {
    // This is a simplified version - in a real test you'd need to actually enroll all components
    console.log('Note: Creating a test user with all components would require a full enrollment flow.');
    console.log('For this test, we\'ll assume the user exists and has house/connect_dots enrolled.');
}

// Run the test
testHouseFiltering(); 