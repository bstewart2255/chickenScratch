// Test script to verify registration fix
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test data
const testUser = {
    username: `testuser_${Date.now()}`,
    signatures: [
        {
            data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            raw: [
                [
                    { x: 100, y: 100, time: 0 },
                    { x: 150, y: 150, time: 100 },
                    { x: 200, y: 100, time: 200 }
                ]
            ],
            metrics: {
                stroke_count: 1,
                total_points: 3,
                total_duration_ms: 200,
                avg_points_per_stroke: 3,
                avg_velocity: 1.5,
                max_velocity: 2,
                min_velocity: 1,
                velocity_std: 0.5,
                width: 100,
                height: 50,
                area: 5000,
                aspect_ratio: 2,
                center_x: 150,
                center_y: 125,
                avg_stroke_length: 100,
                total_length: 100,
                length_variation: 0,
                avg_stroke_duration: 200,
                duration_variation: 0
            },
            timestamp: Date.now()
        }
    ],
    shapes: {
        circle: {
            data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            raw: [[{ x: 100, y: 100, time: 0 }]],
            metrics: {},
            timestamp: Date.now()
        },
        square: {
            data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            raw: [[{ x: 100, y: 100, time: 0 }]],
            metrics: {},
            timestamp: Date.now()
        },
        triangle: {
            data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            raw: [[{ x: 100, y: 100, time: 0 }]],
            metrics: {},
            timestamp: Date.now()
        }
    },
    drawings: {
        face: {
            data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            strokes: [[{ x: 100, y: 100, time: 0 }]],
            metrics: {},
            timestamp: Date.now()
        },
        star: {
            data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            strokes: [[{ x: 100, y: 100, time: 0 }]],
            metrics: {},
            timestamp: Date.now()
        }
    }
};

async function testRegistration() {
    console.log('Testing registration endpoint...');
    console.log('API URL:', API_URL);
    console.log('Test username:', testUser.username);
    
    try {
        console.log('\nSending registration request...');
        const response = await axios.post(`${API_URL}/register`, testUser, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n✅ Registration successful!');
        console.log('Response:', response.data);
        
        // Test login to verify user was created properly
        console.log('\nTesting login with the new user...');
        const loginResponse = await axios.post(`${API_URL}/login`, {
            username: testUser.username,
            signature: testUser.signatures[0],
            shapes: testUser.shapes,
            drawings: testUser.drawings
        });
        
        console.log('\n✅ Login successful!');
        console.log('Login response:', loginResponse.data);
        
    } catch (error) {
        console.error('\n❌ Registration failed!');
        if (error.response) {
            console.error('Error response:', error.response.data);
            console.error('Status code:', error.response.status);
        } else {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

// Run the test
testRegistration()
    .then(() => {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });