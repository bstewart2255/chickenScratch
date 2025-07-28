/**
 * Phase 2: Component Testing Script
 * Tests all components without modifying production data
 */

const path = require('path');
const { 
    calculateStandardizedMetrics, 
    extractStrokeData, 
    validateMetrics, 
    mergeMetrics 
} = require('./metrics_calculation_service');

// Test data representing various edge cases
const testCases = [
    {
        name: 'Normal circle shape',
        shapeData: {
            raw: [
                [
                    { x: 100, y: 50, time: 0 },
                    { x: 120, y: 60, time: 50 },
                    { x: 130, y: 80, time: 100 },
                    { x: 120, y: 100, time: 150 },
                    { x: 100, y: 110, time: 200 },
                    { x: 80, y: 100, time: 250 },
                    { x: 70, y: 80, time: 300 },
                    { x: 80, y: 60, time: 350 },
                    { x: 100, y: 50, time: 400 }
                ]
            ]
        },
        expectedFields: ['stroke_count', 'total_points', 'center_x', 'center_y', 'avg_speed']
    },
    {
        name: 'Shape with multiple strokes',
        shapeData: {
            raw: [
                [
                    { x: 50, y: 50, time: 0 },
                    { x: 150, y: 50, time: 100 }
                ],
                [
                    { x: 150, y: 50, time: 200 },
                    { x: 150, y: 150, time: 300 }
                ],
                [
                    { x: 150, y: 150, time: 400 },
                    { x: 50, y: 150, time: 500 }
                ],
                [
                    { x: 50, y: 150, time: 600 },
                    { x: 50, y: 50, time: 700 }
                ]
            ]
        },
        expectedFields: ['stroke_count', 'total_points', 'center_x', 'center_y', 'avg_speed']
    },
    {
        name: 'Empty stroke array',
        shapeData: {
            raw: []
        },
        expectedFields: ['stroke_count', 'total_points', 'center_x', 'center_y', 'avg_speed'],
        expectZeroValues: true
    },
    {
        name: 'Null shape data',
        shapeData: null,
        expectNull: true
    },
    {
        name: 'Shape with missing coordinates',
        shapeData: {
            raw: [
                [
                    { x: 100, y: 100, time: 0 },
                    { y: 150, time: 50 }, // Missing x
                    { x: 150, time: 100 }, // Missing y
                    { x: 200, y: 200, time: 150 }
                ]
            ]
        },
        expectedFields: ['stroke_count', 'total_points', 'center_x', 'center_y', 'avg_speed']
    },
    {
        name: 'Shape without time data',
        shapeData: {
            raw: [
                [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 100 },
                    { x: 0, y: 100 },
                    { x: 0, y: 0 }
                ]
            ]
        },
        expectedFields: ['stroke_count', 'total_points', 'center_x', 'center_y'],
        expectZeroSpeed: true
    },
    {
        name: 'Legacy format (strokes field)',
        shapeData: {
            strokes: [
                [
                    { x: 50, y: 50, time: 0 },
                    { x: 100, y: 100, time: 100 }
                ]
            ]
        },
        expectedFields: ['stroke_count', 'total_points', 'center_x', 'center_y', 'avg_speed']
    },
    {
        name: 'Array format (direct array)',
        shapeData: [
            [
                { x: 25, y: 25, time: 0 },
                { x: 75, y: 75, time: 50 }
            ]
        ],
        expectedFields: ['stroke_count', 'total_points', 'center_x', 'center_y', 'avg_speed']
    }
];

// Color codes for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, type = 'info') {
    const prefix = {
        info: `${colors.cyan}[INFO]${colors.reset}`,
        success: `${colors.green}[PASS]${colors.reset}`,
        error: `${colors.red}[FAIL]${colors.reset}`,
        warning: `${colors.yellow}[WARN]${colors.reset}`
    };
    console.log(`${prefix[type] || ''} ${message}`);
}

function runTests() {
    log('Starting Phase 2 Component Tests', 'info');
    log('=' .repeat(60), 'info');
    
    let passedTests = 0;
    let failedTests = 0;
    const errors = [];

    testCases.forEach((testCase, index) => {
        log(`\nTest ${index + 1}: ${testCase.name}`, 'info');
        
        try {
            // Test stroke extraction
            const strokeData = extractStrokeData(testCase.shapeData);
            
            if (testCase.expectNull) {
                if (strokeData === null) {
                    log('✓ Correctly returned null for invalid data', 'success');
                    passedTests++;
                } else {
                    throw new Error('Expected null but got stroke data');
                }
                return;
            }

            if (!strokeData && !testCase.expectNull) {
                throw new Error('Failed to extract stroke data');
            }

            // Test metrics calculation
            const metrics = calculateStandardizedMetrics(strokeData);
            
            if (!metrics) {
                throw new Error('Metrics calculation returned null');
            }

            log(`  Calculated metrics:`, 'info');
            log(`    - stroke_count: ${metrics.stroke_count}`, 'info');
            log(`    - total_points: ${metrics.total_points}`, 'info');
            log(`    - center_x: ${metrics.center_x}`, 'info');
            log(`    - center_y: ${metrics.center_y}`, 'info');
            log(`    - avg_speed: ${metrics.avg_speed}`, 'info');

            // Verify expected fields
            const missingFields = testCase.expectedFields.filter(field => 
                metrics[field] === undefined || metrics[field] === null
            );
            
            if (missingFields.length > 0) {
                throw new Error(`Missing fields: ${missingFields.join(', ')}`);
            }

            // Check for zero values when expected
            if (testCase.expectZeroValues) {
                if (metrics.stroke_count !== 0 || metrics.total_points !== 0) {
                    throw new Error('Expected zero values for empty data');
                }
            }

            if (testCase.expectZeroSpeed && metrics.avg_speed !== 0) {
                throw new Error('Expected zero speed for data without timestamps');
            }

            // Test validation
            const validation = validateMetrics(metrics);
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.reason}`);
            }

            // Test merging
            const existingMetrics = { old_field: 'value', center_x: null };
            const merged = mergeMetrics(existingMetrics, metrics);
            
            if (!merged.old_field || merged.center_x === null) {
                throw new Error('Merge function failed to preserve/update correctly');
            }

            log('✓ All tests passed for this case', 'success');
            passedTests++;

        } catch (error) {
            log(`✗ Test failed: ${error.message}`, 'error');
            failedTests++;
            errors.push({
                testCase: testCase.name,
                error: error.message
            });
        }
    });

    // Summary
    log('\n' + '='.repeat(60), 'info');
    log('TEST SUMMARY', 'info');
    log('=' .repeat(60), 'info');
    log(`Total tests: ${testCases.length}`, 'info');
    log(`Passed: ${passedTests} ✅`, 'success');
    log(`Failed: ${failedTests} ❌`, failedTests > 0 ? 'error' : 'info');
    
    if (errors.length > 0) {
        log('\nFailed tests:', 'error');
        errors.forEach(err => {
            log(`  - ${err.testCase}: ${err.error}`, 'error');
        });
    }

    // Test batch processing configuration
    log('\n' + '='.repeat(60), 'info');
    log('BATCH PROCESSING CONFIGURATION TEST', 'info');
    log('=' .repeat(60), 'info');
    
    const configTests = [
        { env: 'BATCH_SIZE', expected: 20, actual: process.env.BATCH_SIZE || 20 },
        { env: 'BATCH_DELAY_MS', expected: 100, actual: process.env.BATCH_DELAY_MS || 100 },
        { env: 'DRY_RUN', expected: false, actual: process.env.DRY_RUN === 'true' }
    ];

    configTests.forEach(test => {
        const status = test.actual == test.expected ? 'success' : 'warning';
        log(`${test.env}: ${test.actual} (default: ${test.expected})`, status);
    });

    // Final result
    const allPassed = failedTests === 0;
    log('\n' + '='.repeat(60), 'info');
    if (allPassed) {
        log('✅ ALL COMPONENT TESTS PASSED - Ready for execution!', 'success');
    } else {
        log('❌ SOME TESTS FAILED - Review errors before proceeding', 'error');
    }
    log('=' .repeat(60), 'info');

    process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests();