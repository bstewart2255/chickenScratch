#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class AutoTestRunner {
    constructor() {
        this.testDirectory = './tests/backend/';
        this.testPatterns = [
            /^test-.*\.js$/,           // test-*.js
            /^.*-test\.js$/,           // *-test.js  
            /^validate-.*\.js$/,       // validate-*.js
            /^benchmark-.*\.js$/,      // benchmark-*.js
            /^health-check.*\.js$/,    // health-check*.js
            /^monitor-.*\.js$/         // monitor-*.js
        ];
        this.results = [];
    }

    async discoverTestFiles() {
        console.log('🔍 Discovering test files...\n');
        
        try {
            const files = await fs.readdir(this.testDirectory);
            const testFiles = files.filter(file => 
                this.testPatterns.some(pattern => pattern.test(file))
            );
            
            console.log(`Found ${testFiles.length} test files:`);
            testFiles.forEach(file => console.log(`  ✓ ${file}`));
            console.log('');
            
            return testFiles;
        } catch (error) {
            console.error('❌ Error discovering test files:', error.message);
            return [];
        }
    }

    async runTest(testFile) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            console.log(`🧪 Running ${testFile}...`);
            
            const child = spawn('node', [testFile], {
                cwd: this.testDirectory,
                stdio: 'pipe'
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            child.on('close', (code) => {
                const duration = Date.now() - startTime;
                const result = {
                    file: testFile,
                    success: code === 0,
                    code,
                    duration,
                    stdout,
                    stderr
                };
                
                if (result.success) {
                    console.log(`   ✅ ${testFile} passed (${duration}ms)`);
                } else {
                    console.log(`   ❌ ${testFile} failed (${duration}ms) - Exit code: ${code}`);
                    if (stderr) {
                        console.log(`   Error: ${stderr.slice(0, 200)}...`);
                    }
                }
                
                resolve(result);
            });
            
            child.on('error', (error) => {
                console.log(`   ❌ ${testFile} error: ${error.message}`);
                resolve({
                    file: testFile,
                    success: false,
                    error: error.message,
                    duration: Date.now() - startTime
                });
            });
        });
    }

    async runAllTests() {
        const testFiles = await this.discoverTestFiles();
        
        if (testFiles.length === 0) {
            console.log('⚠️  No test files found');
            return false;
        }
        
        console.log('🚀 Starting test execution...\n');
        
        // Run tests sequentially to avoid database conflicts
        for (const testFile of testFiles) {
            const result = await this.runTest(testFile);
            this.results.push(result);
            
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return this.generateReport();
    }

    async runTestsInParallel() {
        const testFiles = await this.discoverTestFiles();
        
        if (testFiles.length === 0) {
            console.log('⚠️  No test files found');
            return false;
        }
        
        console.log('🚀 Starting parallel test execution...\n');
        
        // Run tests in parallel (good for independent tests)
        const promises = testFiles.map(testFile => this.runTest(testFile));
        this.results = await Promise.all(promises);
        
        return this.generateReport();
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST EXECUTION SUMMARY');
        console.log('='.repeat(60));
        
        const passed = this.results.filter(r => r.success);
        const failed = this.results.filter(r => !r.success);
        const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
        
        console.log(`\n📈 Overall Results:`);
        console.log(`   Total tests: ${this.results.length}`);
        console.log(`   Passed: ${passed.length}`);
        console.log(`   Failed: ${failed.length}`);
        console.log(`   Success rate: ${Math.round((passed.length / this.results.length) * 100)}%`);
        console.log(`   Total duration: ${totalDuration}ms`);
        
        if (passed.length > 0) {
            console.log(`\n✅ Passed tests:`);
            passed.forEach(test => {
                console.log(`   ✓ ${test.file} (${test.duration}ms)`);
            });
        }
        
        if (failed.length > 0) {
            console.log(`\n❌ Failed tests:`);
            failed.forEach(test => {
                console.log(`   ✗ ${test.file} (${test.duration || 0}ms)`);
                if (test.error) {
                    console.log(`     Error: ${test.error}`);
                } else if (test.stderr) {
                    console.log(`     Stderr: ${test.stderr.slice(0, 100)}...`);
                }
            });
        }
        
        // Generate JUnit XML for CI/CD systems
        this.generateJUnitReport();
        
        console.log('\n' + '='.repeat(60));
        
        return failed.length === 0;
    }

    generateJUnitReport() {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite 
    name="Auto-Discovered Tests" 
    tests="${this.results.length}" 
    failures="${this.results.filter(r => !r.success).length}" 
    time="${this.results.reduce((sum, r) => sum + (r.duration || 0), 0) / 1000}">
${this.results.map(test => `
    <testcase name="${test.file}" time="${(test.duration || 0) / 1000}">
        ${!test.success ? `<failure message="${test.error || 'Test failed'}">${test.stderr || test.stdout || ''}</failure>` : ''}
    </testcase>`).join('')}
</testsuite>`;
        
        // Save JUnit report for CI/CD
        fs.writeFile('./test-results.xml', xml).catch(console.error);
        console.log(`\n📄 JUnit report saved to test-results.xml`);
    }

    // Configuration for different test categories
    async runTestsByCategory(category) {
        const categoryPatterns = {
            'validation': [/^validate-.*\.js$/, /^health-check.*\.js$/],
            'integration': [/^test-.*\.js$/],
            'performance': [/^benchmark-.*\.js$/],
            'monitoring': [/^monitor-.*\.js$/]
        };
        
        if (!categoryPatterns[category]) {
            console.log(`❌ Unknown category: ${category}`);
            console.log(`Available categories: ${Object.keys(categoryPatterns).join(', ')}`);
            return false;
        }
        
        // Temporarily override patterns
        const originalPatterns = this.testPatterns;
        this.testPatterns = categoryPatterns[category];
        
        console.log(`🏷️  Running ${category} tests only...\n`);
        const result = await this.runAllTests();
        
        // Restore original patterns
        this.testPatterns = originalPatterns;
        
        return result;
    }
}

// CLI Interface
if (require.main === module) {
    const runner = new AutoTestRunner();
    
    const args = process.argv.slice(2);
    const parallel = args.includes('--parallel');
    const category = args.find(arg => arg.startsWith('--category='))?.split('=')[1];
    
    let testPromise;
    
    if (category) {
        testPromise = runner.runTestsByCategory(category);
    } else if (parallel) {
        testPromise = runner.runTestsInParallel();
    } else {
        testPromise = runner.runAllTests();
    }
    
    testPromise
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test runner crashed:', error);
            process.exit(1);
        });
}

module.exports = AutoTestRunner;

/*
Usage Examples:

1. Run all discovered tests:
   node run-all-tests.js

2. Run tests in parallel:
   node run-all-tests.js --parallel

3. Run specific category:
   node run-all-tests.js --category=validation
   node run-all-tests.js --category=integration
   node run-all-tests.js --category=performance
   node run-all-tests.js --category=monitoring

4. In package.json:
   "scripts": {
     "test": "node run-all-tests.js",
     "test:parallel": "node run-all-tests.js --parallel",
     "test:validation": "node run-all-tests.js --category=validation"
   }
*/