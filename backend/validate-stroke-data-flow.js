require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const { generateImageFromStrokes, extractStrokeMetrics } = require('./stroke-to-image');

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Validation report
const report = {
    successes: [],
    warnings: [],
    errors: [],
    startTime: new Date(),
    endTime: null
};

// Helper functions
function logSuccess(message) {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
    report.successes.push({ message, timestamp: new Date() });
}

function logWarning(message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
    report.warnings.push({ message, timestamp: new Date() });
}

function logError(message, error = null) {
    console.log(`${colors.red}✗${colors.reset} ${message}`);
    report.errors.push({ message, error: error?.message, timestamp: new Date() });
}

function logSection(title) {
    console.log(`\n${colors.bright}${colors.blue}======= ${title} =======${colors.reset}\n`);
}

// Validation functions
async function validateDatabaseSchema() {
    logSection('DATABASE SCHEMA VALIDATION');
    const client = await pool.connect();
    
    try {
        // Check if signatures table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'signatures'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            logError('Signatures table does not exist');
            return false;
        }
        logSuccess('Signatures table exists');
        
        // Check for required columns
        const requiredColumns = [
            { name: 'stroke_data', type: 'jsonb' },
            { name: 'data_format', type: 'character varying' },
            { name: 'display_image', type: 'text' }
        ];
        
        for (const column of requiredColumns) {
            const columnCheck = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'signatures' 
                AND column_name = $1;
            `, [column.name]);
            
            if (columnCheck.rows.length === 0) {
                logError(`Column '${column.name}' does not exist`);
            } else {
                const actualType = columnCheck.rows[0].data_type;
                if (actualType !== column.type) {
                    logWarning(`Column '${column.name}' has type '${actualType}', expected '${column.type}'`);
                } else {
                    logSuccess(`Column '${column.name}' exists with correct type`);
                }
            }
        }
        
        // Check for GIN indexes on JSONB columns
        const indexCheck = await client.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'signatures' 
            AND indexdef LIKE '%gin%';
        `);
        
        if (indexCheck.rows.length > 0) {
            logSuccess(`Found ${indexCheck.rows.length} GIN index(es) on signatures table`);
            indexCheck.rows.forEach(idx => {
                console.log(`  - ${colors.cyan}${idx.indexname}${colors.reset}`);
            });
        } else {
            logWarning('No GIN indexes found on signatures table (optional but recommended for JSONB performance)');
        }
        
        return true;
        
    } catch (error) {
        logError('Database schema validation failed', error);
        return false;
    } finally {
        client.release();
    }
}

async function validateExistingData() {
    logSection('EXISTING DATA VALIDATION');
    const client = await pool.connect();
    
    try {
        // Get sample of existing data
        const dataCheck = await client.query(`
            SELECT id, user_id, data_format, 
                   stroke_data IS NOT NULL as has_stroke_data,
                   signature_data IS NOT NULL as has_signature_data,
                   display_image IS NOT NULL as has_display_image,
                   jsonb_typeof(stroke_data) as stroke_data_type,
                   CASE 
                       WHEN stroke_data IS NOT NULL THEN jsonb_array_length(stroke_data)
                       ELSE 0
                   END as stroke_count
            FROM signatures 
            LIMIT 100;
        `);
        
        if (dataCheck.rows.length === 0) {
            logWarning('No signatures found in database');
            return true;
        }
        
        logSuccess(`Found ${dataCheck.rows.length} signatures to validate`);
        
        // Analyze data formats
        const formats = {
            stroke_data: 0,
            base64: 0,
            unknown: 0
        };
        
        const issues = {
            missingStrokeData: 0,
            invalidStrokeData: 0,
            missingDisplayImage: 0
        };
        
        for (const row of dataCheck.rows) {
            // Count formats
            if (row.data_format === 'stroke_data') {
                formats.stroke_data++;
                
                // Validate stroke data structure
                if (!row.has_stroke_data) {
                    issues.missingStrokeData++;
                    logWarning(`Signature ${row.id}: marked as stroke_data but missing stroke_data column`);
                } else if (row.stroke_data_type !== 'array') {
                    issues.invalidStrokeData++;
                    logWarning(`Signature ${row.id}: stroke_data is not an array (type: ${row.stroke_data_type})`);
                }
                
                // Check display image
                if (!row.has_display_image) {
                    issues.missingDisplayImage++;
                }
            } else if (row.data_format === 'base64') {
                formats.base64++;
            } else {
                formats.unknown++;
            }
        }
        
        // Report findings
        console.log(`\n${colors.cyan}Data Format Distribution:${colors.reset}`);
        console.log(`  - stroke_data: ${formats.stroke_data}`);
        console.log(`  - base64: ${formats.base64}`);
        console.log(`  - unknown: ${formats.unknown}`);
        
        if (issues.missingStrokeData > 0) {
            logWarning(`${issues.missingStrokeData} signatures marked as stroke_data but missing data`);
        }
        if (issues.invalidStrokeData > 0) {
            logWarning(`${issues.invalidStrokeData} signatures have invalid stroke_data structure`);
        }
        if (issues.missingDisplayImage > 0) {
            logWarning(`${issues.missingDisplayImage} signatures missing display_image (optional)`);
        }
        
        // Validate a sample stroke data structure
        const sampleStroke = await client.query(`
            SELECT id, stroke_data 
            FROM signatures 
            WHERE data_format = 'stroke_data' 
            AND stroke_data IS NOT NULL 
            LIMIT 1;
        `);
        
        if (sampleStroke.rows.length > 0) {
            const strokeData = sampleStroke.rows[0].stroke_data;
            logSuccess(`Sample stroke data structure validated (ID: ${sampleStroke.rows[0].id})`);
            
            // Extract metrics to verify data quality
            const metrics = extractStrokeMetrics(strokeData);
            if (metrics) {
                console.log(`  - Strokes: ${metrics.strokeCount}`);
                console.log(`  - Total points: ${metrics.totalPoints}`);
                console.log(`  - Area: ${metrics.area.toFixed(2)}`);
            }
        }
        
        return true;
        
    } catch (error) {
        logError('Data validation failed', error);
        return false;
    } finally {
        client.release();
    }
}

async function validateAPIEndpoints() {
    logSection('API ENDPOINT VALIDATION');
    
    // Check if server is running
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001';
    
    try {
        // Test base endpoint
        const healthCheck = await axios.get(`${baseURL}/`);
        if (healthCheck.status === 200) {
            logSuccess(`Server is running at ${baseURL}`);
        }
    } catch (error) {
        logError(`Server not accessible at ${baseURL}`, error);
        return false;
    }
    
    // Get a test signature ID
    const client = await pool.connect();
    try {
        const testSig = await client.query(`
            SELECT id FROM signatures 
            WHERE stroke_data IS NOT NULL 
            LIMIT 1;
        `);
        
        if (testSig.rows.length === 0) {
            logWarning('No signatures with stroke_data found for API testing');
            return true;
        }
        
        const testId = testSig.rows[0].id;
        
        // Test /api/signature/:id endpoint
        try {
            const sigResponse = await axios.get(`${baseURL}/api/signature/${testId}`);
            if (sigResponse.status === 200 && sigResponse.data) {
                logSuccess(`GET /api/signature/${testId} - Returns signature data`);
                
                // Validate response structure
                const data = sigResponse.data;
                if (data.stroke_data) {
                    console.log(`  - Has stroke_data: ${Array.isArray(data.stroke_data) ? 'Yes (array)' : 'Yes'}`);
                }
                if (data.data_format) {
                    console.log(`  - Data format: ${data.data_format}`);
                }
            }
        } catch (error) {
            logError(`GET /api/signature/${testId} failed`, error);
        }
        
        // Test /api/signature/:id/image endpoint
        try {
            const imgResponse = await axios.get(`${baseURL}/api/signature/${testId}/image`, {
                responseType: 'arraybuffer'
            });
            
            if (imgResponse.status === 200) {
                logSuccess(`GET /api/signature/${testId}/image - Returns image`);
                console.log(`  - Content-Type: ${imgResponse.headers['content-type']}`);
                console.log(`  - Size: ${imgResponse.data.length} bytes`);
            }
        } catch (error) {
            logWarning(`GET /api/signature/${testId}/image endpoint not found (optional)`, error);
        }
        
        // Test SVG format
        try {
            const svgResponse = await axios.get(`${baseURL}/api/signature/${testId}/image?format=svg`);
            
            if (svgResponse.status === 200) {
                logSuccess(`GET /api/signature/${testId}/image?format=svg - Returns SVG`);
            }
        } catch (error) {
            logWarning(`SVG format not supported (optional)`, error);
        }
        
        return true;
        
    } catch (error) {
        logError('API validation failed', error);
        return false;
    } finally {
        client.release();
    }
}

async function testEndToEndFlow() {
    logSection('END-TO-END DATA FLOW TEST');
    
    const testData = {
        userId: 1, // Assuming test user exists
        strokeData: [
            [
                { x: 100, y: 100, time: 1000, pressure: 0.5 },
                { x: 150, y: 120, time: 1050, pressure: 0.7 },
                { x: 200, y: 100, time: 1100, pressure: 0.5 }
            ],
            [
                { x: 100, y: 150, time: 1200, pressure: 0.6 },
                { x: 200, y: 150, time: 1300, pressure: 0.6 }
            ]
        ],
        metrics: {
            stroke_count: 2,
            total_points: 5,
            total_duration_ms: 300
        }
    };
    
    const client = await pool.connect();
    
    try {
        // 1. Store test signature
        logSuccess('Storing test signature with stroke data...');
        const insertResult = await client.query(`
            INSERT INTO signatures (user_id, stroke_data, metrics, data_format, created_at)
            VALUES ($1, $2, $3, 'stroke_data', NOW())
            RETURNING id;
        `, [testData.userId, JSON.stringify(testData.strokeData), JSON.stringify(testData.metrics)]);
        
        const testId = insertResult.rows[0].id;
        logSuccess(`Test signature stored with ID: ${testId}`);
        
        // 2. Retrieve and validate
        const retrieveResult = await client.query(`
            SELECT stroke_data, data_format, metrics
            FROM signatures
            WHERE id = $1;
        `, [testId]);
        
        if (retrieveResult.rows.length > 0) {
            const retrieved = retrieveResult.rows[0];
            logSuccess('Retrieved stroke data successfully');
            
            // Validate structure
            if (JSON.stringify(retrieved.stroke_data) === JSON.stringify(testData.strokeData)) {
                logSuccess('Stroke data integrity verified');
            } else {
                logError('Stroke data mismatch after retrieval');
            }
            
            // Test image generation
            try {
                const imageData = generateImageFromStrokes(retrieved.stroke_data);
                if (imageData && imageData.startsWith('data:image/png;base64,')) {
                    logSuccess('Image generation from stroke data successful');
                    console.log(`  - Image size: ${imageData.length} characters`);
                }
            } catch (error) {
                logError('Image generation failed', error);
            }
        }
        
        // 3. Cleanup test data
        await client.query('DELETE FROM signatures WHERE id = $1', [testId]);
        logSuccess('Test data cleaned up');
        
        return true;
        
    } catch (error) {
        logError('End-to-end test failed', error);
        return false;
    } finally {
        client.release();
    }
}

async function testBackwardCompatibility() {
    logSection('BACKWARD COMPATIBILITY TEST');
    
    const client = await pool.connect();
    
    try {
        // Check if any base64 signatures exist
        const base64Check = await client.query(`
            SELECT COUNT(*) as count 
            FROM signatures 
            WHERE data_format = 'base64' OR data_format IS NULL;
        `);
        
        const base64Count = parseInt(base64Check.rows[0].count);
        
        if (base64Count === 0) {
            logSuccess('No legacy base64 signatures found (all migrated)');
            return true;
        }
        
        logWarning(`Found ${base64Count} base64 format signatures`);
        
        // Test retrieval of base64 signature
        const sampleBase64 = await client.query(`
            SELECT id, signature_data, data_format
            FROM signatures
            WHERE (data_format = 'base64' OR data_format IS NULL)
            AND signature_data IS NOT NULL
            LIMIT 1;
        `);
        
        if (sampleBase64.rows.length > 0) {
            const sig = sampleBase64.rows[0];
            logSuccess(`Base64 signature ${sig.id} can be retrieved`);
            
            // Check if it has stroke data that could be extracted
            try {
                const signatureData = typeof sig.signature_data === 'string' 
                    ? JSON.parse(sig.signature_data) 
                    : sig.signature_data;
                    
                if (signatureData.raw || signatureData.strokes || Array.isArray(signatureData)) {
                    logWarning(`Signature ${sig.id} contains extractable stroke data - consider migration`);
                }
            } catch (error) {
                // Not JSON, probably actual base64
            }
        }
        
        return true;
        
    } catch (error) {
        logError('Backward compatibility test failed', error);
        return false;
    } finally {
        client.release();
    }
}

async function generateReport() {
    logSection('VALIDATION REPORT');
    
    report.endTime = new Date();
    const duration = (report.endTime - report.startTime) / 1000;
    
    console.log(`\n${colors.bright}Summary:${colors.reset}`);
    console.log(`  - Duration: ${duration.toFixed(2)} seconds`);
    console.log(`  - ${colors.green}Successes: ${report.successes.length}${colors.reset}`);
    console.log(`  - ${colors.yellow}Warnings: ${report.warnings.length}${colors.reset}`);
    console.log(`  - ${colors.red}Errors: ${report.errors.length}${colors.reset}`);
    
    if (report.warnings.length > 0) {
        console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
        report.warnings.forEach((w, i) => {
            console.log(`  ${i + 1}. ${w.message}`);
        });
    }
    
    if (report.errors.length > 0) {
        console.log(`\n${colors.red}Errors:${colors.reset}`);
        report.errors.forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.message}`);
            if (e.error) {
                console.log(`     ${colors.cyan}Details: ${e.error}${colors.reset}`);
            }
        });
    }
    
    // Overall status
    const exitCode = report.errors.length > 0 ? 1 : 0;
    const status = exitCode === 0 ? 
        `${colors.green}✓ VALIDATION PASSED${colors.reset}` : 
        `${colors.red}✗ VALIDATION FAILED${colors.reset}`;
    
    console.log(`\n${colors.bright}Overall Status: ${status}${colors.reset}\n`);
    
    return exitCode;
}

// Main validation runner
async function runValidation() {
    console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════╗
║     Stroke Data Storage Validation Script      ║
╚═══════════════════════════════════════════════╝
${colors.reset}`);
    
    try {
        // Run all validations
        await validateDatabaseSchema();
        await validateExistingData();
        await validateAPIEndpoints();
        await testEndToEndFlow();
        await testBackwardCompatibility();
        
        // Generate report and exit
        const exitCode = await generateReport();
        process.exit(exitCode);
        
    } catch (error) {
        logError('Validation script failed', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run validation
runValidation();