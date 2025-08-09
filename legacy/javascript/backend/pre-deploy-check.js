require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const { generateImageFromStrokes, extractStrokeMetrics } = require('./stroke-to-image');
const { performance } = require('perf_hooks');
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

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: {
        rejectUnauthorized: false
    }
});

// Check results storage
const checks = {
    passed: [],
    failed: [],
    warnings: []
};

// Helper functions
function logCheck(name, passed, message = '', isWarning = false) {
    const icon = passed ? '✓' : (isWarning ? '⚠' : '✗');
    const color = passed ? colors.green : (isWarning ? colors.yellow : colors.red);
    console.log(`${color}${icon}${colors.reset} ${name}${message ? ': ' + message : ''}`);
    
    if (passed) {
        checks.passed.push({ name, message });
    } else if (isWarning) {
        checks.warnings.push({ name, message });
    } else {
        checks.failed.push({ name, message });
    }
}

function logSection(title) {
    console.log(`\n${colors.bright}${colors.blue}=== ${title} ===${colors.reset}\n`);
}

function formatDuration(ms) {
    return `${ms.toFixed(2)}ms`;
}

// Check functions
async function checkDatabaseMigrations() {
    logSection('DATABASE MIGRATION VERIFICATION');
    const client = await pool.connect();
    
    try {
        // Check if migrations table exists
        const migrationTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'migrations'
            );
        `);
        
        if (!migrationTableCheck.rows[0].exists) {
            // No migrations table, check if stroke_data column exists directly
            const strokeDataCheck = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'signatures' 
                AND column_name = 'stroke_data';
            `);
            
            if (strokeDataCheck.rows.length > 0) {
                logCheck('Database migrations', true, 'Stroke data column exists (migrations table not required)');
            } else {
                logCheck('Database migrations', false, 'No migrations table and stroke_data column missing');
                return false;
            }
        } else {
            // Check completed migrations
            const migrations = await client.query(`
                SELECT name, applied_at 
                FROM migrations 
                ORDER BY applied_at DESC;
            `);
            
            if (migrations.rows.length > 0) {
                logCheck('Database migrations', true, `${migrations.rows.length} migrations completed`);
                migrations.rows.forEach(m => {
                    console.log(`  - ${colors.cyan}${m.name}${colors.reset} (${new Date(m.applied_at).toLocaleDateString()})`);
                });
            } else {
                logCheck('Database migrations', false, 'No migrations found');
                return false;
            }
        }
        
        // Verify required columns exist
        const requiredColumns = [
            { name: 'stroke_data', type: 'jsonb' },
            { name: 'data_format', type: 'character varying' },
            { name: 'display_image', type: 'text' }
        ];
        
        let allColumnsExist = true;
        for (const column of requiredColumns) {
            const columnCheck = await client.query(`
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_name = 'signatures' 
                AND column_name = $1;
            `, [column.name]);
            
            if (columnCheck.rows.length === 0) {
                logCheck(`Column '${column.name}'`, false, 'Missing');
                allColumnsExist = false;
            } else {
                const actualType = columnCheck.rows[0].data_type;
                if (actualType !== column.type) {
                    logCheck(`Column '${column.name}'`, false, `Wrong type: ${actualType} (expected ${column.type})`);
                    allColumnsExist = false;
                } else {
                    logCheck(`Column '${column.name}'`, true, `Type: ${column.type}`);
                }
            }
        }
        
        return allColumnsExist;
        
    } catch (error) {
        logCheck('Database migrations', false, error.message);
        return false;
    } finally {
        client.release();
    }
}

async function checkStrokeDataStorage() {
    logSection('STROKE DATA STORAGE & RETRIEVAL');
    const client = await pool.connect();
    
    try {
        // Create test stroke data
        const testStrokeData = [
            [
                { x: 100, y: 100, time: 1000, pressure: 0.5 },
                { x: 150, y: 120, time: 1050, pressure: 0.7 },
                { x: 200, y: 100, time: 1100, pressure: 0.5 }
            ],
            [
                { x: 100, y: 150, time: 1200, pressure: 0.6 },
                { x: 200, y: 150, time: 1300, pressure: 0.6 }
            ]
        ];
        
        // Store test data
        const startStore = performance.now();
        const storeResult = await client.query(`
            INSERT INTO signatures (user_id, stroke_data, data_format, created_at)
            VALUES (1, $1, 'stroke_data', NOW())
            RETURNING id;
        `, [JSON.stringify(testStrokeData)]);
        const storeTime = performance.now() - startStore;
        
        const testId = storeResult.rows[0].id;
        logCheck('Store stroke data', true, `ID: ${testId}, Time: ${formatDuration(storeTime)}`);
        
        // Retrieve test data
        const startRetrieve = performance.now();
        const retrieveResult = await client.query(`
            SELECT stroke_data, data_format 
            FROM signatures 
            WHERE id = $1;
        `, [testId]);
        const retrieveTime = performance.now() - startRetrieve;
        
        if (retrieveResult.rows.length > 0) {
            const retrieved = retrieveResult.rows[0];
            const dataMatches = JSON.stringify(retrieved.stroke_data) === JSON.stringify(testStrokeData);
            
            logCheck('Retrieve stroke data', dataMatches, 
                `Format: ${retrieved.data_format}, Time: ${formatDuration(retrieveTime)}`);
            
            if (!dataMatches) {
                console.log('  Expected:', JSON.stringify(testStrokeData).substring(0, 100));
                console.log('  Received:', JSON.stringify(retrieved.stroke_data).substring(0, 100));
            }
        } else {
            logCheck('Retrieve stroke data', false, 'No data found');
        }
        
        // Cleanup
        await client.query('DELETE FROM signatures WHERE id = $1', [testId]);
        
        // Check storage performance
        if (storeTime > 500) {
            logCheck('Storage performance', false, `Slow: ${formatDuration(storeTime)} (>500ms)`, true);
        }
        if (retrieveTime > 200) {
            logCheck('Retrieval performance', false, `Slow: ${formatDuration(retrieveTime)} (>200ms)`, true);
        }
        
        return true;
        
    } catch (error) {
        logCheck('Stroke data storage', false, error.message);
        return false;
    } finally {
        client.release();
    }
}

async function checkImageGeneration() {
    logSection('IMAGE GENERATION FROM STROKE DATA');
    
    try {
        const testStrokeData = [
            [
                { x: 50, y: 50, time: 0 },
                { x: 150, y: 50, time: 100 },
                { x: 150, y: 150, time: 200 },
                { x: 50, y: 150, time: 300 },
                { x: 50, y: 50, time: 400 }
            ]
        ];
        
        // Test basic image generation
        const startGen = performance.now();
        const imageData = generateImageFromStrokes(testStrokeData);
        const genTime = performance.now() - startGen;
        
        if (imageData && imageData.startsWith('data:image/png;base64,')) {
            const imageSize = imageData.length;
            logCheck('Generate PNG image', true, 
                `Size: ${(imageSize / 1024).toFixed(1)}KB, Time: ${formatDuration(genTime)}`);
            
            // Verify base64 is valid
            try {
                const base64Data = imageData.split(',')[1];
                Buffer.from(base64Data, 'base64');
                logCheck('Valid base64 encoding', true);
            } catch (error) {
                logCheck('Valid base64 encoding', false, 'Invalid base64');
            }
        } else {
            logCheck('Generate PNG image', false, 'Invalid image format');
            return false;
        }
        
        // Test with different options
        const thumbnailData = generateImageFromStrokes(testStrokeData, {
            width: 100,
            height: 50,
            strokeWidth: 1
        });
        
        if (thumbnailData && thumbnailData.startsWith('data:image/png;base64,')) {
            logCheck('Generate thumbnail', true, `Size: ${(thumbnailData.length / 1024).toFixed(1)}KB`);
        } else {
            logCheck('Generate thumbnail', false);
        }
        
        // Test with empty data
        const emptyImage = generateImageFromStrokes([]);
        logCheck('Handle empty stroke data', emptyImage && emptyImage.includes('base64'), 
            'Returns valid empty image');
        
        // Performance check
        if (genTime > 100) {
            logCheck('Image generation performance', false, 
                `Slow: ${formatDuration(genTime)} (>100ms)`, true);
        }
        
        return true;
        
    } catch (error) {
        logCheck('Image generation', false, error.message);
        return false;
    }
}

async function checkMLFeatureExtraction() {
    logSection('ML FEATURE EXTRACTION (19 FEATURES)');
    
    const requiredFeatures = [
        'stroke_count', 'total_points', 'total_duration_ms', 'avg_points_per_stroke',
        'avg_velocity', 'max_velocity', 'min_velocity', 'velocity_std',
        'width', 'height', 'area', 'aspect_ratio', 'center_x', 'center_y',
        'avg_stroke_length', 'total_length', 'length_variation', 
        'avg_stroke_duration', 'duration_variation'
    ];
    
    try {
        // Create realistic stroke data with timing
        const testStrokeData = [
            [
                { x: 100, y: 100, time: 0, pressure: 0.5 },
                { x: 150, y: 120, time: 50, pressure: 0.7 },
                { x: 200, y: 100, time: 100, pressure: 0.5 },
                { x: 250, y: 80, time: 150, pressure: 0.3 }
            ],
            [
                { x: 100, y: 150, time: 300, pressure: 0.6 },
                { x: 150, y: 170, time: 350, pressure: 0.8 },
                { x: 200, y: 150, time: 400, pressure: 0.6 }
            ],
            [
                { x: 120, y: 200, time: 600, pressure: 0.4 },
                { x: 180, y: 220, time: 650, pressure: 0.6 },
                { x: 240, y: 200, time: 700, pressure: 0.4 }
            ]
        ];
        
        // Test feature extraction
        const metrics = extractStrokeMetrics(testStrokeData);
        
        if (!metrics) {
            logCheck('Extract stroke metrics', false, 'No metrics returned');
            return false;
        }
        
        logCheck('Extract stroke metrics', true, `${Object.keys(metrics).length} metrics extracted`);
        
        // Verify basic metrics
        const basicChecks = [
            { name: 'stroke_count', expected: 3, actual: metrics.strokeCount },
            { name: 'total_points', expected: 10, actual: metrics.totalPoints }
        ];
        
        for (const check of basicChecks) {
            if (check.actual === check.expected) {
                logCheck(`Metric: ${check.name}`, true, `Value: ${check.actual}`);
            } else {
                logCheck(`Metric: ${check.name}`, false, 
                    `Expected: ${check.expected}, Got: ${check.actual}`);
            }
        }
        
        // Test with database integration
        const client = await pool.connect();
        try {
            // Get a real signature with metrics
            const result = await client.query(`
                SELECT id, stroke_data, metrics 
                FROM signatures 
                WHERE data_format = 'stroke_data' 
                AND stroke_data IS NOT NULL 
                LIMIT 1;
            `);
            
            if (result.rows.length > 0) {
                const sig = result.rows[0];
                const extractedMetrics = extractStrokeMetrics(sig.stroke_data);
                
                if (extractedMetrics) {
                    // Check if we can extract all required features
                    let missingFeatures = [];
                    for (const feature of requiredFeatures) {
                        if (!(feature in sig.metrics) && 
                            !(feature in extractedMetrics) &&
                            !(feature.replace(/_/g, '') in extractedMetrics)) {
                            missingFeatures.push(feature);
                        }
                    }
                    
                    if (missingFeatures.length === 0) {
                        logCheck('All 19 ML features available', true);
                    } else {
                        logCheck('All 19 ML features available', false, 
                            `Missing: ${missingFeatures.join(', ')}`);
                    }
                } else {
                    logCheck('Extract features from database', false, 'Failed to extract metrics');
                }
            } else {
                logCheck('Database feature extraction', false, 'No stroke data signatures found', true);
            }
            
        } finally {
            client.release();
        }
        
        return true;
        
    } catch (error) {
        logCheck('ML feature extraction', false, error.message);
        return false;
    }
}

async function checkBackwardCompatibility() {
    logSection('BACKWARD COMPATIBILITY');
    const client = await pool.connect();
    
    try {
        // Check for base64 signatures
        const base64Check = await client.query(`
            SELECT COUNT(*) as count 
            FROM signatures 
            WHERE data_format = 'base64' OR 
                  (data_format IS NULL AND signature_data IS NOT NULL);
        `);
        
        const base64Count = parseInt(base64Check.rows[0].count);
        
        if (base64Count === 0) {
            logCheck('Base64 signatures', true, 'All signatures migrated to stroke format');
        } else {
            logCheck('Base64 signatures exist', true, `Found ${base64Count} base64 signatures`);
            
            // Test retrieval of base64 signature
            const base64Sig = await client.query(`
                SELECT id, signature_data, data_format 
                FROM signatures 
                WHERE (data_format = 'base64' OR data_format IS NULL) 
                AND signature_data IS NOT NULL 
                LIMIT 1;
            `);
            
            if (base64Sig.rows.length > 0) {
                const sig = base64Sig.rows[0];
                logCheck('Retrieve base64 signature', true, `ID: ${sig.id}`);
                
                // Check if it can be converted
                try {
                    const sigData = typeof sig.signature_data === 'string' 
                        ? JSON.parse(sig.signature_data) 
                        : sig.signature_data;
                    
                    if (sigData.raw || sigData.strokes || sigData.data || Array.isArray(sigData)) {
                        logCheck('Base64 signature convertible', true, 'Contains stroke data');
                    } else {
                        logCheck('Base64 signature format', true, 'Pure base64 (no stroke data)');
                    }
                } catch (error) {
                    logCheck('Base64 signature format', true, 'Binary base64 data');
                }
            }
        }
        
        // Test mixed format retrieval
        const mixedResult = await client.query(`
            SELECT 
                COUNT(CASE WHEN data_format = 'stroke_data' THEN 1 END) as stroke_count,
                COUNT(CASE WHEN data_format = 'base64' OR data_format IS NULL THEN 1 END) as base64_count
            FROM signatures;
        `);
        
        const mixed = mixedResult.rows[0];
        logCheck('Mixed format support', true, 
            `Stroke: ${mixed.stroke_count}, Base64: ${mixed.base64_count}`);
        
        return true;
        
    } catch (error) {
        logCheck('Backward compatibility', false, error.message);
        return false;
    } finally {
        client.release();
    }
}

async function checkAPIPerformance() {
    logSection('API PERFORMANCE CHECKS');
    
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001';
    const performanceThreshold = 3000; // 3 seconds
    
    try {
        // Check if server is running
        const healthStart = performance.now();
        const healthCheck = await axios.get(`${baseURL}/`, { timeout: 5000 });
        const healthTime = performance.now() - healthStart;
        
        if (healthCheck.status === 200) {
            logCheck('Server health check', healthTime < performanceThreshold, 
                `Response time: ${formatDuration(healthTime)}`);
        }
        
        // Get test signature ID
        const client = await pool.connect();
        let testId;
        
        try {
            const result = await client.query(`
                SELECT id FROM signatures 
                WHERE stroke_data IS NOT NULL 
                LIMIT 1;
            `);
            
            if (result.rows.length > 0) {
                testId = result.rows[0].id;
            } else {
                // Create test signature
                const createResult = await client.query(`
                    INSERT INTO signatures (user_id, stroke_data, data_format)
                    VALUES (1, $1, 'stroke_data')
                    RETURNING id;
                `, [JSON.stringify([[{x:0,y:0,time:0}]])]);
                testId = createResult.rows[0].id;
            }
        } finally {
            client.release();
        }
        
        // Test critical endpoints
        const endpoints = [
            {
                name: 'Get signature data',
                url: `/api/signature/${testId}`,
                threshold: 500
            },
            {
                name: 'Generate signature image',
                url: `/api/signature/${testId}/image`,
                threshold: 1000
            },
            {
                name: 'Dashboard stats',
                url: '/api/dashboard-stats',
                threshold: 2000
            },
            {
                name: 'Recent activity',
                url: '/api/recent-activity',
                threshold: 1500
            }
        ];
        
        let allPass = true;
        
        for (const endpoint of endpoints) {
            try {
                const start = performance.now();
                const response = await axios.get(`${baseURL}${endpoint.url}`, {
                    timeout: performanceThreshold
                });
                const duration = performance.now() - start;
                
                const passed = response.status === 200 && duration < endpoint.threshold;
                const isWarning = response.status === 200 && duration >= endpoint.threshold;
                
                logCheck(endpoint.name, passed, 
                    `${formatDuration(duration)} (threshold: ${endpoint.threshold}ms)`, 
                    isWarning);
                
                if (!passed && !isWarning) allPass = false;
                
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    logCheck(endpoint.name, false, 'Server not running');
                } else if (error.response?.status === 404) {
                    logCheck(endpoint.name, false, 'Endpoint not found', true);
                } else {
                    logCheck(endpoint.name, false, error.message);
                }
                allPass = false;
            }
        }
        
        return allPass;
        
    } catch (error) {
        logCheck('API performance', false, `Server not accessible: ${error.message}`);
        return false;
    }
}

async function checkDashboardCompatibility() {
    logSection('DASHBOARD COMPATIBILITY');
    
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001';
    
    try {
        // Check dashboard stats endpoint
        const statsResponse = await axios.get(`${baseURL}/api/dashboard-stats`);
        
        if (statsResponse.status === 200 && statsResponse.data) {
            const stats = statsResponse.data;
            const requiredFields = ['users', 'accuracy', 'authAttempts', 'falsePositiveRate'];
            
            const missingFields = requiredFields.filter(field => !(field in stats));
            
            if (missingFields.length === 0) {
                logCheck('Dashboard stats API', true, 'All required fields present');
            } else {
                logCheck('Dashboard stats API', false, `Missing fields: ${missingFields.join(', ')}`);
            }
        }
        
        // Check user details endpoint with stroke data
        const client = await pool.connect();
        try {
            // Get a user with stroke data signatures
            const userResult = await client.query(`
                SELECT DISTINCT u.username 
                FROM users u 
                JOIN signatures s ON u.id = s.user_id 
                WHERE s.data_format = 'stroke_data' 
                LIMIT 1;
            `);
            
            if (userResult.rows.length > 0) {
                const username = userResult.rows[0].username;
                const detailsResponse = await axios.get(`${baseURL}/api/user/${username}/details`);
                
                if (detailsResponse.status === 200 && detailsResponse.data) {
                    const details = detailsResponse.data;
                    
                    // Check if ML features are present
                    if (details.mlFeatures && Object.keys(details.mlFeatures).length > 0) {
                        logCheck('User ML features', true, 
                            `${Object.keys(details.mlFeatures).length} features available`);
                    } else {
                        logCheck('User ML features', false, 'No ML features found');
                    }
                    
                    // Check if signatures have stroke data
                    if (details.signatures && details.signatures.length > 0) {
                        const hasStrokeData = details.signatures.some(sig => 
                            sig.stroke_data || sig.data_format === 'stroke_data'
                        );
                        logCheck('Dashboard stroke data support', hasStrokeData, 
                            hasStrokeData ? 'Stroke data accessible' : 'No stroke data in response');
                    }
                } else {
                    logCheck('User details API', false, 'Invalid response');
                }
            } else {
                logCheck('Dashboard compatibility', false, 'No users with stroke data found', true);
            }
            
        } finally {
            client.release();
        }
        
        // Check if dashboard HTML files exist
        const dashboardFiles = [
            'frontend/ml-dashboard.html',
            'frontend/ml-dashboard-v2.html'
        ];
        
        for (const file of dashboardFiles) {
            const fullPath = path.join(process.cwd(), '..', file);
            if (fs.existsSync(fullPath)) {
                logCheck(`Dashboard file: ${file}`, true, 'Exists');
            } else {
                logCheck(`Dashboard file: ${file}`, false, 'Not found', true);
            }
        }
        
        return true;
        
    } catch (error) {
        logCheck('Dashboard compatibility', false, error.message);
        return false;
    }
}

// Generate summary report
function generateSummaryReport() {
    const totalChecks = checks.passed.length + checks.failed.length + checks.warnings.length;
    const criticalFailures = checks.failed.length;
    
    console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.bright}PRE-DEPLOYMENT VERIFICATION SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);
    
    console.log(`Total Checks: ${totalChecks}`);
    console.log(`${colors.green}Passed: ${checks.passed.length}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${checks.warnings.length}${colors.reset}`);
    console.log(`${colors.red}Failed: ${checks.failed.length}${colors.reset}`);
    
    if (checks.warnings.length > 0) {
        console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
        checks.warnings.forEach((w, i) => {
            console.log(`  ${i + 1}. ${w.name}: ${w.message}`);
        });
    }
    
    if (checks.failed.length > 0) {
        console.log(`\n${colors.red}Failed Checks:${colors.reset}`);
        checks.failed.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.name}: ${f.message}`);
        });
    }
    
    console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
    
    if (criticalFailures === 0) {
        console.log(`${colors.green}✓ SYSTEM READY FOR DEPLOYMENT${colors.reset}`);
        if (checks.warnings.length > 0) {
            console.log(`${colors.yellow}  (with ${checks.warnings.length} warnings - review before production)${colors.reset}`);
        }
    } else {
        console.log(`${colors.red}✗ DEPLOYMENT BLOCKED - ${criticalFailures} CRITICAL ISSUES${colors.reset}`);
        console.log(`${colors.red}  Fix all failed checks before deploying to production${colors.reset}`);
    }
    
    console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);
    
    // Save report to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
    const reportPath = path.join(__dirname, `pre-deploy-report-${timestamp}.json`);
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: totalChecks,
            passed: checks.passed.length,
            warnings: checks.warnings.length,
            failed: checks.failed.length,
            readyForDeployment: criticalFailures === 0
        },
        checks: checks
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${reportPath}`);
    
    return criticalFailures === 0 ? 0 : 1;
}

// Main execution
async function runPreDeploymentChecks() {
    console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║          Pre-Deployment Verification Script                ║
║                                                           ║
║  Checking stroke data system readiness for production...  ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
    
    try {
        // Run all checks
        await checkDatabaseMigrations();
        await checkStrokeDataStorage();
        await checkImageGeneration();
        await checkMLFeatureExtraction();
        await checkBackwardCompatibility();
        await checkAPIPerformance();
        await checkDashboardCompatibility();
        
        // Generate summary and exit
        const exitCode = generateSummaryReport();
        process.exit(exitCode);
        
    } catch (error) {
        console.error(`\n${colors.red}Fatal error during pre-deployment checks:${colors.reset}`);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(`\n${colors.red}Uncaught exception:${colors.reset}`, error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`\n${colors.red}Unhandled rejection at:${colors.reset}`, promise);
    console.error(`${colors.red}Reason:${colors.reset}`, reason);
    process.exit(1);
});

// Run the pre-deployment checks
runPreDeploymentChecks();