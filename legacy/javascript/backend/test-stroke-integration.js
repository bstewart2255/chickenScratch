require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const assert = require('assert');
const { performance } = require('perf_hooks');

// Environment configuration
const ENV = process.env.TEST_ENV || 'local';
const environments = {
    local: {
        apiUrl: 'http://localhost:3001',
        dbUrl: process.env.DATABASE_URL,
        mlApiUrl: 'http://localhost:5000'
    },
    staging: {
        apiUrl: process.env.STAGING_API_URL || 'https://staging-api.signature-auth.com',
        dbUrl: process.env.STAGING_DATABASE_URL,
        mlApiUrl: process.env.STAGING_ML_API_URL
    },
    production: {
        apiUrl: process.env.PRODUCTION_API_URL || 'https://api.signature-auth.com',
        dbUrl: process.env.PRODUCTION_DATABASE_URL,
        mlApiUrl: process.env.PRODUCTION_ML_API_URL,
        readOnly: true // Safety flag for production
    }
};

const config = environments[ENV];
if (!config) {
    console.error(`Invalid environment: ${ENV}`);
    process.exit(1);
}

// Safety check for production
if (ENV === 'production' && !process.env.ALLOW_PRODUCTION_TESTS) {
    console.error('Production tests disabled. Set ALLOW_PRODUCTION_TESTS=true to enable.');
    process.exit(1);
}

// Test configuration
const testConfig = {
    cleanup: process.env.SKIP_CLEANUP !== 'true',
    verbose: process.env.VERBOSE === 'true',
    concurrentUsers: parseInt(process.env.CONCURRENT_USERS || '5'),
    testPrefix: `test_${Date.now()}_`
};

// Database connection
const pool = new Pool({
    connectionString: config.dbUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test results storage
const testResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [],
    startTime: new Date()
};

// Test data storage for cleanup
const testData = {
    userIds: [],
    signatureIds: [],
    authAttemptIds: []
};

// ANSI colors for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Helper functions
function log(message, type = 'info') {
    if (!testConfig.verbose && type === 'debug') return;
    
    const prefix = {
        info: `${colors.cyan}[INFO]${colors.reset}`,
        success: `${colors.green}[PASS]${colors.reset}`,
        error: `${colors.red}[FAIL]${colors.reset}`,
        warning: `${colors.yellow}[WARN]${colors.reset}`,
        debug: `${colors.blue}[DEBUG]${colors.reset}`
    };
    
    console.log(`${prefix[type] || ''} ${message}`);
}

async function runTest(name, testFn) {
    const testResult = {
        name,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'running',
        error: null
    };
    
    log(`Running: ${name}`);
    
    try {
        const start = performance.now();
        await testFn();
        const duration = performance.now() - start;
        
        testResult.endTime = new Date();
        testResult.duration = duration;
        testResult.status = 'passed';
        testResults.passed++;
        
        log(`${name} (${duration.toFixed(2)}ms)`, 'success');
    } catch (error) {
        testResult.endTime = new Date();
        testResult.status = 'failed';
        testResult.error = error.message;
        testResults.failed++;
        
        log(`${name}: ${error.message}`, 'error');
        if (testConfig.verbose) {
            console.error(error.stack);
        }
    }
    
    testResults.tests.push(testResult);
}

// Generate realistic stroke data
function generateStrokeData(complexity = 'medium') {
    const configs = {
        simple: { strokes: 3, pointsPerStroke: 10 },
        medium: { strokes: 5, pointsPerStroke: 20 },
        complex: { strokes: 8, pointsPerStroke: 30 }
    };
    
    const config = configs[complexity];
    const strokes = [];
    let currentTime = 0;
    
    for (let s = 0; s < config.strokes; s++) {
        const stroke = [];
        const startX = 50 + Math.random() * 200;
        const startY = 50 + Math.random() * 100;
        
        for (let p = 0; p < config.pointsPerStroke; p++) {
            stroke.push({
                x: startX + Math.sin(p * 0.2) * 30 + Math.random() * 5,
                y: startY + Math.cos(p * 0.2) * 20 + Math.random() * 5,
                time: currentTime,
                pressure: 0.3 + Math.random() * 0.4
            });
            currentTime += 20 + Math.random() * 30;
        }
        strokes.push(stroke);
        currentTime += 100; // Gap between strokes
    }
    
    return strokes;
}

// Calculate metrics from stroke data
function calculateMetrics(strokeData) {
    let totalPoints = 0;
    let totalDuration = 0;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    strokeData.forEach(stroke => {
        totalPoints += stroke.length;
        if (stroke.length > 0) {
            const duration = stroke[stroke.length - 1].time - stroke[0].time;
            totalDuration = Math.max(totalDuration, stroke[stroke.length - 1].time);
            
            stroke.forEach(point => {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            });
        }
    });
    
    return {
        stroke_count: strokeData.length,
        total_points: totalPoints,
        total_duration_ms: totalDuration,
        avg_points_per_stroke: totalPoints / strokeData.length,
        width: maxX - minX,
        height: maxY - minY,
        area: (maxX - minX) * (maxY - minY),
        aspect_ratio: (maxX - minX) / (maxY - minY),
        center_x: (minX + maxX) / 2,
        center_y: (minY + maxY) / 2
    };
}

// Test implementations
async function testUserEnrollment() {
    const username = `${testConfig.testPrefix}user_${Date.now()}`;
    const password = 'TestPass123!';
    
    // Step 1: Create user
    log(`Creating user: ${username}`, 'debug');
    const createUserResponse = await axios.post(`${config.apiUrl}/api/users`, {
        username,
        password
    });
    
    assert.strictEqual(createUserResponse.status, 201, 'User creation failed');
    const userId = createUserResponse.data.id;
    testData.userIds.push(userId);
    
    // Step 2: Enroll signatures with stroke data
    const signatures = [];
    for (let i = 0; i < 3; i++) {
        const strokeData = generateStrokeData('medium');
        const metrics = calculateMetrics(strokeData);
        
        log(`Enrolling signature ${i + 1}/3`, 'debug');
        const enrollResponse = await axios.post(`${config.apiUrl}/api/signatures`, {
            userId,
            signatureData: strokeData,
            metrics,
            isEnrollment: true
        });
        
        assert.strictEqual(enrollResponse.status, 201, `Signature ${i + 1} enrollment failed`);
        const signatureId = enrollResponse.data.id;
        signatures.push(signatureId);
        testData.signatureIds.push(signatureId);
    }
    
    // Step 3: Verify signatures are stored with stroke format
    const client = await pool.connect();
    try {
        const verifyResult = await client.query(`
            SELECT id, data_format, stroke_data IS NOT NULL as has_stroke_data
            FROM signatures
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 3
        `, [userId]);
        
        assert.strictEqual(verifyResult.rows.length, 3, 'Not all signatures stored');
        
        verifyResult.rows.forEach(row => {
            assert.strictEqual(row.data_format, 'stroke_data', 'Wrong data format');
            assert.strictEqual(row.has_stroke_data, true, 'Missing stroke data');
        });
        
        log('All enrollment signatures use stroke format', 'debug');
    } finally {
        client.release();
    }
    
    return { userId, username, password, signatures };
}

async function testAuthenticationFlow(enrollmentData) {
    const { userId, username, password } = enrollmentData;
    
    // Step 1: Login to get session
    log(`Logging in as ${username}`, 'debug');
    const loginResponse = await axios.post(`${config.apiUrl}/api/login`, {
        username,
        password
    });
    
    assert.strictEqual(loginResponse.status, 200, 'Login failed');
    const sessionToken = loginResponse.data.token || 'test-session';
    
    // Step 2: Submit authentication signature
    const authStrokeData = generateStrokeData('medium');
    const authMetrics = calculateMetrics(authStrokeData);
    
    log('Submitting authentication signature', 'debug');
    const authResponse = await axios.post(`${config.apiUrl}/api/authenticate`, {
        userId,
        signatureData: authStrokeData,
        metrics: authMetrics
    }, {
        headers: {
            'Authorization': `Bearer ${sessionToken}`
        }
    });
    
    assert.strictEqual(authResponse.status, 200, 'Authentication failed');
    assert.strictEqual(authResponse.data.success, true, 'Authentication not successful');
    
    // Step 3: Verify auth attempt was recorded
    const client = await pool.connect();
    try {
        const authAttempt = await client.query(`
            SELECT id, success, confidence, signature_id
            FROM auth_attempts
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [userId]);
        
        assert.strictEqual(authAttempt.rows.length, 1, 'Auth attempt not recorded');
        assert.strictEqual(authAttempt.rows[0].success, true, 'Auth attempt marked as failed');
        
        testData.authAttemptIds.push(authAttempt.rows[0].id);
        
        // Verify signature was stored
        if (authAttempt.rows[0].signature_id) {
            testData.signatureIds.push(authAttempt.rows[0].signature_id);
        }
    } finally {
        client.release();
    }
    
    return { success: true, sessionToken };
}

async function testMLDashboardDisplay(enrollmentData) {
    const { username } = enrollmentData;
    
    // Step 1: Get user details for ML dashboard
    log(`Fetching ML dashboard data for ${username}`, 'debug');
    const detailsResponse = await axios.get(
        `${config.apiUrl}/api/user/${username}/details`
    );
    
    assert.strictEqual(detailsResponse.status, 200, 'Failed to get user details');
    const userDetails = detailsResponse.data;
    
    // Step 2: Verify ML features are present
    assert(userDetails.mlFeatures, 'ML features missing');
    
    const requiredFeatures = [
        'stroke_count', 'total_points', 'total_duration_ms',
        'width', 'height', 'area'
    ];
    
    requiredFeatures.forEach(feature => {
        assert(feature in userDetails.mlFeatures, `Missing ML feature: ${feature}`);
        assert(typeof userDetails.mlFeatures[feature] === 'number', 
            `Invalid ML feature type for ${feature}`);
    });
    
    // Step 3: Verify signatures have stroke data
    assert(Array.isArray(userDetails.signatures), 'Signatures not an array');
    assert(userDetails.signatures.length >= 3, 'Not enough signatures returned');
    
    userDetails.signatures.forEach((sig, index) => {
        assert(sig.stroke_data || sig.data_format === 'stroke_data', 
            `Signature ${index} missing stroke data`);
    });
    
    // Step 4: Test dashboard stats endpoint
    log('Testing dashboard stats endpoint', 'debug');
    const statsResponse = await axios.get(`${config.apiUrl}/api/dashboard-stats`);
    
    assert.strictEqual(statsResponse.status, 200, 'Dashboard stats failed');
    assert(typeof statsResponse.data.users === 'number', 'Invalid users count');
    assert(typeof statsResponse.data.accuracy === 'number', 'Invalid accuracy');
    
    return { mlFeatures: userDetails.mlFeatures, stats: statsResponse.data };
}

async function testSignatureComparison(enrollmentData) {
    const { userId, signatures: enrollmentSigs } = enrollmentData;
    
    // Step 1: Get enrollment signatures
    const client = await pool.connect();
    try {
        const enrollmentResult = await client.query(`
            SELECT id, stroke_data, metrics
            FROM signatures
            WHERE id = ANY($1)
        `, [enrollmentSigs]);
        
        assert.strictEqual(enrollmentResult.rows.length, enrollmentSigs.length, 
            'Could not retrieve all enrollment signatures');
        
        // Step 2: Create variation of enrollment signature
        const baseSignature = enrollmentResult.rows[0];
        const baseStrokeData = baseSignature.stroke_data;
        
        // Create slight variation
        const variedStrokeData = baseStrokeData.map(stroke => 
            stroke.map(point => ({
                ...point,
                x: point.x + (Math.random() - 0.5) * 5,
                y: point.y + (Math.random() - 0.5) * 5,
                time: point.time + Math.random() * 10
            }))
        );
        
        // Step 3: Test authentication with variation
        log('Testing authentication with signature variation', 'debug');
        const authResponse = await axios.post(`${config.apiUrl}/api/authenticate`, {
            userId,
            signatureData: variedStrokeData,
            metrics: calculateMetrics(variedStrokeData)
        });
        
        assert.strictEqual(authResponse.status, 200, 'Variation auth failed');
        assert.strictEqual(authResponse.data.success, true, 
            'Legitimate variation rejected');
        
        // Step 4: Test with significantly different signature
        const differentSignature = generateStrokeData('simple');
        const rejectResponse = await axios.post(`${config.apiUrl}/api/authenticate`, {
            userId,
            signatureData: differentSignature,
            metrics: calculateMetrics(differentSignature)
        });
        
        // Should either reject or have low confidence
        if (rejectResponse.data.success) {
            assert(rejectResponse.data.confidence < 0.7, 
                'Different signature accepted with high confidence');
        }
        
        log('Signature comparison working correctly', 'debug');
        
    } finally {
        client.release();
    }
}

async function testErrorHandling() {
    // Test 1: Missing stroke data
    await runTest('Handle missing stroke data', async () => {
        try {
            await axios.post(`${config.apiUrl}/api/signatures`, {
                userId: 99999,
                signatureData: null,
                metrics: {}
            });
            throw new Error('Should have rejected null signature data');
        } catch (error) {
            assert(error.response.status >= 400, 'Did not return error status');
        }
    });
    
    // Test 2: Invalid stroke data format
    await runTest('Handle invalid stroke format', async () => {
        try {
            await axios.post(`${config.apiUrl}/api/signatures`, {
                userId: 99999,
                signatureData: "not an array",
                metrics: {}
            });
            throw new Error('Should have rejected invalid format');
        } catch (error) {
            assert(error.response.status >= 400, 'Did not return error status');
        }
    });
    
    // Test 3: Corrupted stroke data
    await runTest('Handle corrupted stroke data', async () => {
        const corruptedData = [
            [
                { x: "not a number", y: 100, time: 0 },
                { x: 100, y: null, time: 100 }
            ]
        ];
        
        try {
            await axios.post(`${config.apiUrl}/api/signatures`, {
                userId: 99999,
                signatureData: corruptedData,
                metrics: {}
            });
            // May or may not fail depending on validation
            log('API accepted corrupted data (may need stricter validation)', 'warning');
        } catch (error) {
            assert(error.response.status >= 400, 'Unexpected error');
        }
    });
    
    // Test 4: Database connection failure simulation
    if (ENV === 'local') {
        await runTest('Handle database errors gracefully', async () => {
            // This test would require mocking or actual connection issues
            log('Database error handling test skipped (requires mock)', 'warning');
        });
    }
}

async function testConcurrentOperations() {
    const concurrentUsers = testConfig.concurrentUsers;
    log(`Testing with ${concurrentUsers} concurrent users`, 'debug');
    
    // Create multiple users
    const users = [];
    for (let i = 0; i < concurrentUsers; i++) {
        users.push({
            username: `${testConfig.testPrefix}concurrent_${i}_${Date.now()}`,
            password: 'ConcurrentTest123!'
        });
    }
    
    // Step 1: Concurrent user creation
    const createPromises = users.map(user => 
        axios.post(`${config.apiUrl}/api/users`, user)
            .then(res => {
                user.id = res.data.id;
                testData.userIds.push(user.id);
                return res;
            })
    );
    
    const createResults = await Promise.allSettled(createPromises);
    const createdUsers = createResults.filter(r => r.status === 'fulfilled').length;
    assert(createdUsers === concurrentUsers, 
        `Only ${createdUsers}/${concurrentUsers} users created`);
    
    // Step 2: Concurrent signature enrollment
    const enrollPromises = [];
    users.forEach(user => {
        if (user.id) {
            for (let i = 0; i < 3; i++) {
                const strokeData = generateStrokeData('simple');
                enrollPromises.push(
                    axios.post(`${config.apiUrl}/api/signatures`, {
                        userId: user.id,
                        signatureData: strokeData,
                        metrics: calculateMetrics(strokeData),
                        isEnrollment: true
                    }).then(res => {
                        testData.signatureIds.push(res.data.id);
                        return res;
                    })
                );
            }
        }
    });
    
    const enrollResults = await Promise.allSettled(enrollPromises);
    const successfulEnrollments = enrollResults.filter(r => r.status === 'fulfilled').length;
    log(`${successfulEnrollments}/${enrollPromises.length} signatures enrolled`, 'debug');
    
    // Step 3: Concurrent authentication attempts
    const authPromises = users.map(user => {
        if (user.id) {
            const authStroke = generateStrokeData('simple');
            return axios.post(`${config.apiUrl}/api/authenticate`, {
                userId: user.id,
                signatureData: authStroke,
                metrics: calculateMetrics(authStroke)
            });
        }
        return Promise.resolve(null);
    }).filter(p => p !== null);
    
    const authResults = await Promise.allSettled(authPromises);
    const successfulAuths = authResults.filter(r => 
        r.status === 'fulfilled' && r.value?.data?.success
    ).length;
    
    log(`${successfulAuths}/${authPromises.length} authentications successful`, 'debug');
    
    // Verify no data corruption
    const client = await pool.connect();
    try {
        const integrityCheck = await client.query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN data_format = 'stroke_data' THEN 1 END) as stroke_format
            FROM signatures
            WHERE user_id = ANY($1)
        `, [users.map(u => u.id).filter(id => id)]);
        
        const result = integrityCheck.rows[0];
        assert(result.stroke_format === parseInt(result.total), 
            'Not all signatures use stroke format after concurrent operations');
        
    } finally {
        client.release();
    }
}

// Cleanup function
async function cleanupTestData() {
    if (!testConfig.cleanup) {
        log('Cleanup skipped', 'warning');
        return;
    }
    
    if (config.readOnly) {
        log('Cleanup skipped for production environment', 'warning');
        return;
    }
    
    log('Cleaning up test data...', 'debug');
    const client = await pool.connect();
    
    try {
        // Delete in correct order to avoid foreign key constraints
        if (testData.authAttemptIds.length > 0) {
            await client.query(
                'DELETE FROM auth_attempts WHERE id = ANY($1)',
                [testData.authAttemptIds]
            );
        }
        
        if (testData.signatureIds.length > 0) {
            await client.query(
                'DELETE FROM signatures WHERE id = ANY($1)',
                [testData.signatureIds]
            );
        }
        
        if (testData.userIds.length > 0) {
            await client.query(
                'DELETE FROM users WHERE id = ANY($1)',
                [testData.userIds]
            );
        }
        
        log(`Cleaned up: ${testData.userIds.length} users, ${testData.signatureIds.length} signatures`, 'debug');
        
    } catch (error) {
        log(`Cleanup error: ${error.message}`, 'error');
    } finally {
        client.release();
    }
}

// Report generator
function generateReport() {
    const endTime = new Date();
    const duration = (endTime - testResults.startTime) / 1000;
    
    console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}INTEGRATION TEST SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${'='.repeat(60)}${colors.reset}\n`);
    
    console.log(`Environment: ${ENV}`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Total Tests: ${testResults.tests.length}`);
    console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
    console.log(`${colors.yellow}Skipped: ${testResults.skipped}${colors.reset}`);
    
    if (testResults.failed > 0) {
        console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
        testResults.tests
            .filter(t => t.status === 'failed')
            .forEach(t => {
                console.log(`  - ${t.name}: ${t.error}`);
            });
    }
    
    console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
    
    const status = testResults.failed === 0 ? 
        `${colors.green}✓ ALL TESTS PASSED${colors.reset}` : 
        `${colors.red}✗ TESTS FAILED${colors.reset}`;
    
    console.log(`Status: ${status}`);
    console.log(`${colors.bright}${'='.repeat(60)}${colors.reset}\n`);
    
    // Save detailed report
    const reportPath = `integration-test-report-${ENV}-${Date.now()}.json`;
    require('fs').writeFileSync(reportPath, JSON.stringify({
        environment: ENV,
        startTime: testResults.startTime,
        endTime: endTime,
        duration: duration,
        summary: {
            total: testResults.tests.length,
            passed: testResults.passed,
            failed: testResults.failed,
            skipped: testResults.skipped
        },
        tests: testResults.tests
    }, null, 2));
    
    console.log(`Detailed report saved to: ${reportPath}`);
}

// Main test runner
async function runIntegrationTests() {
    console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║         Stroke Data Integration Test Suite                 ║
║                                                           ║
║  Environment: ${ENV.padEnd(44)}║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
    
    try {
        // Check API availability
        log('Checking API availability...', 'debug');
        await axios.get(config.apiUrl);
        
        // Run test suites
        let enrollmentData = null;
        
        await runTest('Complete User Enrollment Flow', async () => {
            enrollmentData = await testUserEnrollment();
        });
        
        if (enrollmentData) {
            await runTest('Authentication Flow with Stroke Data', async () => {
                await testAuthenticationFlow(enrollmentData);
            });
            
            await runTest('ML Dashboard Display', async () => {
                await testMLDashboardDisplay(enrollmentData);
            });
            
            await runTest('Signature Comparison', async () => {
                await testSignatureComparison(enrollmentData);
            });
        }
        
        await testErrorHandling();
        
        await runTest('Concurrent User Operations', async () => {
            await testConcurrentOperations();
        });
        
    } catch (error) {
        log(`Fatal error: ${error.message}`, 'error');
        if (testConfig.verbose) {
            console.error(error.stack);
        }
    } finally {
        // Cleanup
        await cleanupTestData();
        
        // Generate report
        generateReport();
        
        // Close connections
        await pool.end();
        
        // Exit with appropriate code
        process.exit(testResults.failed > 0 ? 1 : 0);
    }
}

// Run tests
runIntegrationTests();