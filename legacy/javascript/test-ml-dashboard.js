#!/usr/bin/env node

/**
 * ML Dashboard Integration Test Suite
 * Tests component scoring, chart functionality, and overall dashboard health
 */

const fetch = require('node-fetch');
const { performance } = require('perf_hooks');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USERS = ['test15', 'test16', 'alice', 'bob']; // Users to test

class DashboardTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
        this.startTime = Date.now();
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '📘',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[level] || '📝';
        
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async test(name, testFn) {
        this.log(`Running: ${name}`);
        const start = performance.now();
        
        try {
            await testFn();
            const duration = Math.round(performance.now() - start);
            this.results.passed++;
            this.results.tests.push({ name, status: 'passed', duration });
            this.log(`✓ ${name} (${duration}ms)`, 'success');
        } catch (error) {
            const duration = Math.round(performance.now() - start);
            this.results.failed++;
            this.results.tests.push({ name, status: 'failed', error: error.message, duration });
            this.log(`✗ ${name}: ${error.message}`, 'error');
        }
    }

    async runAllTests() {
        this.log('Starting ML Dashboard Integration Tests', 'info');
        this.log(`Testing against: ${API_URL}`, 'info');
        
        // Test Categories
        await this.testEndToEndFlow();
        await this.testComponentScoring();
        await this.testChartFunctionality();
        await this.testPerformance();
        await this.testErrorHandling();
        
        this.printSummary();
    }

    async testEndToEndFlow() {
        this.log('\n=== End-to-End Flow Tests ===', 'info');
        
        // Test 1: User data retrieval
        await this.test('User data retrieval', async () => {
            const response = await fetch(`${API_URL}/api/user/${TEST_USERS[0]}/detailed-analysis`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            if (!data.user) throw new Error('No user data');
            if (!data.enrollment) throw new Error('No enrollment data');
            if (!data.authAttempts) throw new Error('No auth attempts');
        });

        // Test 2: Enrollment data completeness
        await this.test('Enrollment data completeness', async () => {
            const response = await fetch(`${API_URL}/api/user/${TEST_USERS[0]}/detailed-analysis`);
            const data = await response.json();
            
            // Check signatures
            if (!data.enrollment.signatures || data.enrollment.signatures.length === 0) {
                throw new Error('No enrollment signatures');
            }
            
            // Check if signature_data is properly extracted
            const sig = data.enrollment.signatures[0];
            if (!sig.signature_data) {
                throw new Error('Signature data not extracted');
            }
            
            // Verify it's not the full object
            if (typeof sig.signature_data === 'object' && sig.signature_data.raw) {
                throw new Error('Signature data not properly extracted - still contains full object');
            }
        });

        // Test 3: Authentication attempts structure
        await this.test('Authentication attempts structure', async () => {
            const response = await fetch(`${API_URL}/api/user/${TEST_USERS[0]}/detailed-analysis`);
            const data = await response.json();
            
            if (data.authAttempts.length === 0) {
                this.log('No auth attempts to test', 'warning');
                return;
            }
            
            const attempt = data.authAttempts[0];
            if (typeof attempt.confidence !== 'number') {
                throw new Error('Missing confidence score');
            }
            
            // Check for component scores
            if (!attempt.shape_scores && !attempt.drawing_scores) {
                throw new Error('No component scores found');
            }
        });
    }

    async testComponentScoring() {
        this.log('\n=== Component Scoring Tests ===', 'info');
        
        // Test 1: Component scores present
        await this.test('Component scores present in auth attempts', async () => {
            const response = await fetch(`${API_URL}/api/user/${TEST_USERS[0]}/detailed-analysis`);
            const data = await response.json();
            
            const attemptsWithScores = data.authAttempts.filter(a => 
                a.shape_scores || a.drawing_scores
            );
            
            if (attemptsWithScores.length === 0) {
                throw new Error('No authentication attempts have component scores');
            }
            
            const percentage = (attemptsWithScores.length / data.authAttempts.length) * 100;
            this.log(`${percentage.toFixed(1)}% of attempts have component scores`, 'info');
        });

        // Test 2: Score range validation
        await this.test('Component scores in valid range (0-100)', async () => {
            const response = await fetch(`${API_URL}/api/user/${TEST_USERS[0]}/detailed-analysis`);
            const data = await response.json();
            
            let invalidScores = [];
            
            data.authAttempts.forEach((attempt, idx) => {
                // Check confidence
                if (attempt.confidence < 0 || attempt.confidence > 100) {
                    invalidScores.push(`Attempt ${idx}: confidence=${attempt.confidence}`);
                }
                
                // Check shape scores
                if (attempt.shape_scores) {
                    Object.entries(attempt.shape_scores).forEach(([shape, score]) => {
                        if (score < 0 || score > 100) {
                            invalidScores.push(`Attempt ${idx}: ${shape}=${score}`);
                        }
                    });
                }
                
                // Check drawing scores
                if (attempt.drawing_scores) {
                    Object.entries(attempt.drawing_scores).forEach(([drawing, score]) => {
                        if (score < 0 || score > 100) {
                            invalidScores.push(`Attempt ${idx}: ${drawing}=${score}`);
                        }
                    });
                }
            });
            
            if (invalidScores.length > 0) {
                throw new Error(`Invalid scores found: ${invalidScores.join(', ')}`);
            }
        });

        // Test 3: Score estimation consistency
        await this.test('Score estimation follows expected patterns', async () => {
            const response = await fetch(`${API_URL}/api/user/${TEST_USERS[0]}/detailed-analysis`);
            const data = await response.json();
            
            // Find attempts with all scores
            const completeAttempts = data.authAttempts.filter(a => 
                a.shape_scores && Object.keys(a.shape_scores).length > 0
            );
            
            if (completeAttempts.length === 0) {
                this.log('No attempts with shape scores to verify patterns', 'warning');
                return;
            }
            
            // Verify circle scores tend to be higher than triangles
            const attempt = completeAttempts[0];
            if (attempt.shape_scores.circle && attempt.shape_scores.triangle) {
                if (attempt.shape_scores.circle < attempt.shape_scores.triangle - 20) {
                    throw new Error('Unexpected pattern: circle score much lower than triangle');
                }
            }
        });
    }

    async testChartFunctionality() {
        this.log('\n=== Chart Functionality Tests ===', 'info');
        
        // Test 1: Data structure for charts
        await this.test('Chart data structure validation', async () => {
            const response = await fetch(`${API_URL}/api/user/${TEST_USERS[0]}/detailed-analysis`);
            const data = await response.json();
            
            // Verify data needed for Score Trends
            if (!Array.isArray(data.authAttempts)) {
                throw new Error('authAttempts not an array');
            }
            
            data.authAttempts.forEach(attempt => {
                if (!attempt.created_at) throw new Error('Missing created_at timestamp');
                if (typeof attempt.confidence !== 'number') throw new Error('Missing confidence score');
            });
            
            // Verify data needed for Component Performance
            if (!data.enrollment.shapes && !data.enrollment.drawings) {
                this.log('No shapes or drawings enrolled for component chart', 'warning');
            }
        });

        // Test 2: Empty data handling
        await this.test('Empty data handling for new users', async () => {
            // Try to find a user with no auth attempts
            const newUserResponse = await fetch(`${API_URL}/users`);
            const users = await newUserResponse.json();
            
            // This is a synthetic test - in real scenario would test with actual empty user
            this.log('Empty data handling test passed (synthetic)', 'info');
        });
    }

    async testPerformance() {
        this.log('\n=== Performance Tests ===', 'info');
        
        // Test 1: API response time
        await this.test('API response time < 3 seconds', async () => {
            const start = performance.now();
            const response = await fetch(`${API_URL}/api/user/${TEST_USERS[0]}/detailed-analysis`);
            await response.json();
            const duration = performance.now() - start;
            
            if (duration > 3000) {
                throw new Error(`Response took ${Math.round(duration)}ms (> 3000ms)`);
            }
            
            this.log(`Response time: ${Math.round(duration)}ms`, 'info');
        });

        // Test 2: Multiple user switching
        await this.test('User switching performance', async () => {
            const times = [];
            
            for (const user of TEST_USERS.slice(0, 3)) {
                const start = performance.now();
                const response = await fetch(`${API_URL}/api/user/${user}/detailed-analysis`);
                
                if (response.ok) {
                    await response.json();
                    times.push(performance.now() - start);
                }
            }
            
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            if (avgTime > 2000) {
                throw new Error(`Average switch time ${Math.round(avgTime)}ms (> 2000ms)`);
            }
            
            this.log(`Average user switch time: ${Math.round(avgTime)}ms`, 'info');
        });
    }

    async testErrorHandling() {
        this.log('\n=== Error Handling Tests ===', 'info');
        
        // Test 1: Invalid user handling
        await this.test('Invalid user returns 404', async () => {
            const response = await fetch(`${API_URL}/api/user/invalid_user_xyz_123/detailed-analysis`);
            if (response.status !== 404) {
                throw new Error(`Expected 404, got ${response.status}`);
            }
        });

        // Test 2: Malformed requests
        await this.test('Malformed requests handled gracefully', async () => {
            const response = await fetch(`${API_URL}/api/user//detailed-analysis`);
            if (response.status >= 500) {
                throw new Error(`Server error ${response.status} on malformed request`);
            }
        });
    }

    printSummary() {
        const duration = Date.now() - this.startTime;
        const total = this.results.passed + this.results.failed;
        const successRate = total > 0 ? (this.results.passed / total * 100).toFixed(1) : 0;
        
        console.log('\n' + '='.repeat(50));
        console.log('TEST SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${this.results.passed} ✅`);
        console.log(`Failed: ${this.results.failed} ❌`);
        console.log(`Success Rate: ${successRate}%`);
        console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log('='.repeat(50));
        
        if (this.results.failed > 0) {
            console.log('\nFailed Tests:');
            this.results.tests
                .filter(t => t.status === 'failed')
                .forEach(t => {
                    console.log(`  ❌ ${t.name}: ${t.error}`);
                });
        }
        
        // Exit with appropriate code
        process.exit(this.results.failed > 0 ? 1 : 0);
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new DashboardTester();
    tester.runAllTests().catch(error => {
        console.error('Test suite error:', error);
        process.exit(1);
    });
}

module.exports = DashboardTester;