require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

// Test configuration
const tests = [
    {
        name: 'Database Migration Verification',
        command: 'node',
        args: ['run-migration.js'],
        critical: true,
        timeout: 60000
    },
    {
        name: 'Stroke Data Flow Validation',
        command: 'node',
        args: ['validate-stroke-data-flow.js'],
        critical: true,
        timeout: 120000
    },
    {
        name: 'Regression Tests',
        command: 'node',
        args: ['../test-regression.js'],
        critical: false,
        timeout: 90000
    },
    {
        name: 'ML Dashboard Tests',
        command: 'node',
        args: ['../test-ml-dashboard.js'],
        critical: false,
        timeout: 60000
    },
    {
        name: 'API Endpoint Tests - Stroke Storage',
        command: 'node',
        args: ['test-stroke-storage.js'],
        critical: true,
        timeout: 60000
    },
    {
        name: 'API Endpoint Tests - Realistic Stroke Storage',
        command: 'node',
        args: ['test-stroke-storage-realistic.js'],
        critical: false,
        timeout: 60000
    },
    {
        name: 'Component Scoring Tests',
        command: 'node',
        args: ['test-component-scoring.js'],
        critical: false,
        timeout: 60000
    },
    {
        name: 'Authentication with Scoring Tests',
        command: 'node',
        args: ['test-auth-with-scoring.js'],
        critical: false,
        timeout: 60000
    },
    {
        name: 'Signature Extraction Tests',
        command: 'node',
        args: ['test-signature-extraction.js'],
        critical: false,
        timeout: 60000
    }
];

// Test results storage
const testResults = [];
const startTime = new Date();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'test-logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Generate log filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
const logFilePath = path.join(logsDir, `stroke-tests-${timestamp}.log`);

// Logger function
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    // Write to log file
    fs.appendFileSync(logFilePath, logEntry);
    
    // Console output with colors
    switch (type) {
        case 'error':
            console.log(`${colors.red}${message}${colors.reset}`);
            break;
        case 'success':
            console.log(`${colors.green}${message}${colors.reset}`);
            break;
        case 'warning':
            console.log(`${colors.yellow}${message}${colors.reset}`);
            break;
        case 'info':
            console.log(`${colors.cyan}${message}${colors.reset}`);
            break;
        case 'header':
            console.log(`${colors.bright}${colors.blue}${message}${colors.reset}`);
            break;
        default:
            console.log(message);
    }
}

// Function to run a single test
function runTest(test) {
    return new Promise((resolve) => {
        const testStart = new Date();
        log(`\n${'='.repeat(60)}`, 'header');
        log(`Running: ${test.name}`, 'header');
        log(`${'='.repeat(60)}`, 'header');
        
        const result = {
            name: test.name,
            startTime: testStart,
            endTime: null,
            duration: null,
            passed: false,
            output: '',
            error: '',
            exitCode: null,
            timedOut: false
        };
        
        try {
            const child = spawn(test.command, test.args, {
                cwd: __dirname,
                env: process.env
            });
            
            let outputBuffer = '';
            let errorBuffer = '';
            let timeout;
            
            // Set timeout if specified
            if (test.timeout) {
                timeout = setTimeout(() => {
                    result.timedOut = true;
                    child.kill('SIGKILL');
                    log(`Test timed out after ${test.timeout}ms`, 'error');
                }, test.timeout);
            }
            
            // Capture stdout
            child.stdout.on('data', (data) => {
                const output = data.toString();
                outputBuffer += output;
                process.stdout.write(output);
                fs.appendFileSync(logFilePath, output);
            });
            
            // Capture stderr
            child.stderr.on('data', (data) => {
                const error = data.toString();
                errorBuffer += error;
                process.stderr.write(error);
                fs.appendFileSync(logFilePath, error);
            });
            
            // Handle process exit
            child.on('exit', (code) => {
                clearTimeout(timeout);
                result.endTime = new Date();
                result.duration = (result.endTime - result.startTime) / 1000;
                result.exitCode = code;
                result.output = outputBuffer;
                result.error = errorBuffer;
                result.passed = code === 0 && !result.timedOut;
                
                if (result.passed) {
                    log(`✓ ${test.name} passed (${result.duration.toFixed(2)}s)`, 'success');
                } else {
                    log(`✗ ${test.name} failed (exit code: ${code}, duration: ${result.duration.toFixed(2)}s)`, 'error');
                }
                
                testResults.push(result);
                resolve(result);
            });
            
            // Handle process error
            child.on('error', (err) => {
                clearTimeout(timeout);
                result.endTime = new Date();
                result.duration = (result.endTime - result.startTime) / 1000;
                result.error = err.message;
                result.passed = false;
                
                log(`✗ ${test.name} failed to start: ${err.message}`, 'error');
                testResults.push(result);
                resolve(result);
            });
            
        } catch (error) {
            result.endTime = new Date();
            result.duration = (result.endTime - result.startTime) / 1000;
            result.error = error.message;
            result.passed = false;
            
            log(`✗ ${test.name} encountered an error: ${error.message}`, 'error');
            testResults.push(result);
            resolve(result);
        }
    });
}

// Function to generate summary report
function generateSummaryReport() {
    const endTime = new Date();
    const totalDuration = (endTime - startTime) / 1000;
    
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    const critical = testResults.filter(r => !r.passed && tests.find(t => t.name === r.name)?.critical).length;
    
    log(`\n${'='.repeat(80)}`, 'header');
    log('TEST SUMMARY REPORT', 'header');
    log(`${'='.repeat(80)}`, 'header');
    
    log(`\nTotal Tests Run: ${testResults.length}`);
    log(`Duration: ${totalDuration.toFixed(2)} seconds`);
    log(`Start Time: ${startTime.toISOString()}`);
    log(`End Time: ${endTime.toISOString()}`);
    
    log(`\n${colors.green}Passed: ${passed}${colors.reset}`);
    log(`${colors.red}Failed: ${failed}${colors.reset}`);
    if (critical > 0) {
        log(`${colors.bright}${colors.red}Critical Failures: ${critical}${colors.reset}`);
    }
    
    // Detailed results
    log('\nDetailed Results:', 'header');
    log('-'.repeat(80));
    
    testResults.forEach((result, index) => {
        const test = tests.find(t => t.name === result.name);
        const status = result.passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
        const critical = test?.critical ? ` ${colors.yellow}[CRITICAL]${colors.reset}` : '';
        
        log(`${index + 1}. ${result.name}${critical}`);
        log(`   Status: ${status}`);
        log(`   Duration: ${result.duration.toFixed(2)}s`);
        
        if (!result.passed) {
            log(`   Exit Code: ${result.exitCode || 'N/A'}`);
            if (result.timedOut) {
                log(`   ${colors.yellow}Timed out${colors.reset}`);
            }
            if (result.error) {
                log(`   Error: ${result.error.split('\n')[0]}`);
            }
        }
        log('');
    });
    
    // Failed test details
    if (failed > 0) {
        log('\nFailed Test Details:', 'header');
        log('-'.repeat(80));
        
        testResults.filter(r => !r.passed).forEach((result) => {
            log(`\n${colors.red}${result.name}:${colors.reset}`);
            if (result.error) {
                log('Error output:');
                log(result.error.substring(0, 500));
                if (result.error.length > 500) {
                    log('... (truncated, see log file for full output)');
                }
            }
        });
    }
    
    // Summary
    log(`\n${'='.repeat(80)}`, 'header');
    const overallStatus = failed === 0 ? 
        `${colors.green}✓ ALL TESTS PASSED${colors.reset}` : 
        critical > 0 ?
        `${colors.bright}${colors.red}✗ CRITICAL TESTS FAILED${colors.reset}` :
        `${colors.red}✗ SOME TESTS FAILED${colors.reset}`;
    
    log(`Overall Status: ${overallStatus}`);
    log(`Log file saved to: ${logFilePath}`);
    log(`${'='.repeat(80)}\n`, 'header');
    
    // Save JSON report
    const jsonReportPath = path.join(logsDir, `stroke-tests-${timestamp}.json`);
    const jsonReport = {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: totalDuration,
        summary: {
            total: testResults.length,
            passed,
            failed,
            criticalFailures: critical
        },
        results: testResults.map(r => ({
            ...r,
            startTime: r.startTime.toISOString(),
            endTime: r.endTime ? r.endTime.toISOString() : null
        }))
    };
    
    fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
    log(`JSON report saved to: ${jsonReportPath}`);
    
    return failed === 0 ? 0 : 1;
}

// Main execution
async function runAllTests() {
    console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║           Stroke Data Validation Test Suite                ║
║                                                           ║
║  Running all stroke data validation tests in sequence...  ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
    
    log(`Starting test suite at ${startTime.toISOString()}`);
    log(`Log file: ${logFilePath}`);
    
    // Run tests sequentially
    for (const test of tests) {
        const result = await runTest(test);
        
        // Check if we should continue after critical failure
        if (!result.passed && test.critical) {
            log('\n⚠️  Critical test failed! Continuing with remaining tests...', 'warning');
        }
    }
    
    // Generate and display summary
    const exitCode = generateSummaryReport();
    
    // Exit with appropriate code
    process.exit(exitCode);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    log(`\nUncaught exception: ${error.message}`, 'error');
    log(error.stack, 'error');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`\nUnhandled rejection at: ${promise}`, 'error');
    log(`Reason: ${reason}`, 'error');
    process.exit(1);
});

// Run the test suite
runAllTests();