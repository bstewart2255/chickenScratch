const axios = require('axios');
require('dotenv').config();

async function testEnhancedFeaturesCollection() {
    const API_URL = process.env.API_URL || 'http://localhost:3000';
    
    console.log('🧪 Testing Enhanced Features Collection...');
    console.log('API URL:', API_URL);
    
    try {
        // Use the username provided as command line argument or default to 'testuser'
        const testUsername = process.argv[2] || 'testuser';
        console.log('Using test username:', testUsername);
        
        // Test authentication with all components
        const authRequest = {
            username: testUsername,
            signature: {
                data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                raw: [[{x: 100, y: 100, timestamp: Date.now()}, {x: 200, y: 200, timestamp: Date.now() + 100}]],
                metrics: {
                    stroke_count: 1,
                    total_points: 2,
                    total_duration_ms: 1000,
                    avg_velocity: 50
                }
            },
            shapes: {
                circle: {
                    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                    raw: [[{x: 150, y: 150, timestamp: Date.now()}, {x: 151, y: 151, timestamp: Date.now() + 50}]]
                },
                square: {
                    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                    raw: [[{x: 100, y: 100, timestamp: Date.now()}, {x: 200, y: 200, timestamp: Date.now() + 100}]]
                },
                triangle: {
                    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                    raw: [[{x: 120, y: 120, timestamp: Date.now()}, {x: 180, y: 180, timestamp: Date.now() + 80}]]
                }
            },
            drawings: {
                face: {
                    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                    raw: [[{x: 140, y: 140, timestamp: Date.now()}, {x: 160, y: 160, timestamp: Date.now() + 60}]]
                },
                star: {
                    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                    raw: [[{x: 130, y: 130, timestamp: Date.now()}, {x: 170, y: 170, timestamp: Date.now() + 70}]]
                }
            }
        };
        
        console.log('📤 Sending authentication request...');
        
        // Send authentication request
        const response = await axios.post(`${API_URL}/login`, authRequest);
        
        console.log('✅ Authentication response received');
        console.log('Success:', response.data.success);
        console.log('Score:', response.data.score);
        
        // Wait a moment for database to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test detailed analysis endpoint
        const username = testUsername;
        console.log('\n📊 Fetching detailed analysis for user:', username);
        
        const analysisResponse = await axios.get(`${API_URL}/api/user/${username}/detailed-analysis`);
        
        // Check if enhanced features are present
        const authAttempts = analysisResponse.data.authAttempts || [];
        
        if (authAttempts.length === 0) {
            console.log('❌ No auth attempts found');
            return;
        }
        
        const latestAttempt = authAttempts[0];
        console.log('\n🔍 Latest auth attempt analysis:');
        console.log('- Attempt ID:', latestAttempt.id);
        console.log('- Success:', latestAttempt.success);
        console.log('- Confidence:', latestAttempt.confidence);
        console.log('- Enhanced features enabled:', latestAttempt._enhanced_features_enabled);
        
        if (latestAttempt.enhanced_features) {
            console.log('\n✅ Enhanced features found in latest auth attempt');
            
            const ef = latestAttempt.enhanced_features;
            console.log('\n📋 Enhanced features structure:');
            console.log('- Has signature features:', !!ef.signature);
            console.log('- Shape components:', Object.keys(ef.shapes || {}));
            console.log('- Drawing components:', Object.keys(ef.drawings || {}));
            
            if (ef._processing_summary) {
                console.log('\n📊 Processing summary:');
                console.log('- Total components processed:', ef._processing_summary.total_features_collected);
                console.log('- Signature features:', ef._processing_summary.signature_features);
                console.log('- Shape components:', ef._processing_summary.shape_components);
                console.log('- Drawing components:', ef._processing_summary.drawing_components);
                console.log('- Estimated total features:', ef._processing_summary.estimated_total_features);
            }
            
            // Count actual features
            let totalFeatures = 0;
            
            if (ef.signature) {
                const sigFeatures = Object.keys(ef.signature).length;
                totalFeatures += sigFeatures;
                console.log('\n🖊️  Signature features:', sigFeatures);
                console.log('Sample features:', Object.keys(ef.signature).slice(0, 5).join(', '), '...');
            }
            
            if (ef.shapes && Object.keys(ef.shapes).length > 0) {
                console.log('\n🔷 Shape features:');
                Object.entries(ef.shapes).forEach(([shape, features]) => {
                    const count = Object.keys(features).length;
                    totalFeatures += count;
                    console.log(`- ${shape}: ${count} features`);
                });
            }
            
            if (ef.drawings && Object.keys(ef.drawings).length > 0) {
                console.log('\n🎨 Drawing features:');
                Object.entries(ef.drawings).forEach(([drawing, features]) => {
                    const count = Object.keys(features).length;
                    totalFeatures += count;
                    console.log(`- ${drawing}: ${count} features`);
                });
            }
            
            console.log('\n📊 Total enhanced features collected:', totalFeatures);
            
            if (totalFeatures >= 200) {
                console.log('🎉 SUCCESS: Enhanced features collection working properly!');
                console.log('✅ All authentication components are preserving their enhanced biometric features');
            } else {
                console.log('⚠️  WARNING: Expected 200+ features, got', totalFeatures);
                console.log('This might indicate some components are not properly collecting features');
            }
        } else {
            console.log('❌ Enhanced features not found in auth attempt');
            console.log('Available fields:', Object.keys(latestAttempt).filter(k => !k.startsWith('_')));
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response?.status === 404) {
            console.log('\n💡 Hint: Make sure the user "testuser" exists and has enrolled biometric data');
        }
    }
}

// Run test
console.log('Starting enhanced features collection test...');
console.log('Usage: node test-enhanced-features-collection.js [username]');
console.log('Example: node test-enhanced-features-collection.js john_doe\n');
testEnhancedFeaturesCollection();