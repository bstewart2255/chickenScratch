#!/usr/bin/env node

/**
 * Regression Test Suite
 * Ensures existing functionality remains intact after dashboard fixes
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:3000';

class RegressionTester {
    constructor() {
        this.passed = 0;
        this.failed = 0;
    }

    async test(name, testFn) {
        process.stdout.write(`Testing ${name}... `);
        try {
            await testFn();
            this.passed++;
            console.log('✅ PASSED');
        } catch (error) {
            this.failed++;
            console.log(`❌ FAILED: ${error.message}`);
        }
    }

    async runTests() {
        console.log('🔍 Running Regression Tests\n');
        
        // Test user registration
        await this.test('User registration endpoint', async () => {
            const testUser = `regression_test_${Date.now()}`;
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: testUser,
                    signatures: [
                        {
                            data: "data:image/png;base64,test",
                            raw: [[{x: 10, y: 10}]],
                            metrics: { stroke_count: 1 }
                        }
                    ]
                })
            });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Registration failed: ${error}`);
            }
        });

        // Test authentication flow
        await this.test('Authentication endpoint', async () => {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'test15',
                    signature: {
                        data: "data:image/png;base64,test",
                        raw: [[{x: 10, y: 10}]],
                        metrics: { stroke_count: 1 }
                    }
                })
            });
            
            const result = await response.json();
            if (!result.success && !result.error) {
                throw new Error('Invalid authentication response structure');
            }
        });

        // Test user list endpoint
        await this.test('User list retrieval', async () => {
            const response = await fetch(`${API_URL}/users`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const users = await response.json();
            if (!Array.isArray(users)) {
                throw new Error('Users endpoint should return array');
            }
        });

        // Test detailed analysis endpoint
        await this.test('Detailed analysis endpoint', async () => {
            const response = await fetch(`${API_URL}/api/user/test15/detailed-analysis`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            // Check required fields
            const required = ['user', 'enrollment', 'baseline', 'authAttempts'];
            for (const field of required) {
                if (!data[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
        });

        // Test signature data extraction
        await this.test('Signature data extraction', async () => {
            const response = await fetch(`${API_URL}/api/user/test15/detailed-analysis`);
            const data = await response.json();
            
            if (data.enrollment.signatures.length > 0) {
                const sig = data.enrollment.signatures[0];
                
                // Should not be the full object anymore
                if (sig.signature_data && typeof sig.signature_data === 'object' && sig.signature_data.raw && sig.signature_data.metrics) {
                    throw new Error('Signature data not properly extracted - contains full object');
                }
            }
        });

        // Test component scores
        await this.test('Component scores in auth attempts', async () => {
            const response = await fetch(`${API_URL}/api/user/test15/detailed-analysis`);
            const data = await response.json();
            
            if (data.authAttempts.length > 0) {
                // At least some attempts should have component scores now
                const hasScores = data.authAttempts.some(a => 
                    a.shape_scores || a.drawing_scores
                );
                
                if (!hasScores) {
                    throw new Error('No authentication attempts have component scores');
                }
            }
        });

        // Test model status endpoint
        await this.test('Model training status endpoint', async () => {
            const response = await fetch(`${API_URL}/api/model/training-status`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const status = await response.json();
            if (!status.status) {
                throw new Error('Model status missing status field');
            }
        });

        // Test device performance endpoint
        await this.test('Device performance analytics', async () => {
            const response = await fetch(`${API_URL}/api/analytics/device-performance`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            if (!data.devicePerformance) {
                throw new Error('Missing devicePerformance field');
            }
        });

        // Test auth attempt breakdown
        await this.test('Auth attempt breakdown endpoint', async () => {
            // First get an attempt ID
            const userResponse = await fetch(`${API_URL}/api/user/test15/detailed-analysis`);
            const userData = await userResponse.json();
            
            if (userData.authAttempts.length > 0) {
                const attemptId = userData.authAttempts[0].id;
                const response = await fetch(`${API_URL}/api/auth-attempt/${attemptId}/breakdown`);
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const breakdown = await response.json();
                if (!breakdown.attempt || !breakdown.signature) {
                    throw new Error('Invalid breakdown structure');
                }
            }
        });

        // Print summary
        console.log('\n' + '='.repeat(40));
        console.log(`Total: ${this.passed + this.failed} tests`);
        console.log(`Passed: ${this.passed} ✅`);
        console.log(`Failed: ${this.failed} ❌`);
        console.log('='.repeat(40));
        
        if (this.failed === 0) {
            console.log('\n✨ All regression tests passed! No functionality broken.');
        } else {
            console.log('\n⚠️  Some regression tests failed. Please investigate.');
        }
        
        process.exit(this.failed > 0 ? 1 : 0);
    }
}

// Run tests
if (require.main === module) {
    const tester = new RegressionTester();
    tester.runTests().catch(error => {
        console.error('Regression test error:', error);
        process.exit(1);
    });
}

module.exports = RegressionTester;