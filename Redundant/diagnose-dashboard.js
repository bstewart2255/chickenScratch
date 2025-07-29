#!/usr/bin/env node

const fetch = require('node-fetch');
const { Pool } = require('pg');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/signature_auth';

async function diagnose() {
    console.log('🔍 ML Dashboard Diagnostic Tool\n');
    console.log(`API URL: ${API_URL}`);
    console.log(`Database: ${DATABASE_URL}\n`);
    
    // 1. Check API endpoint
    console.log('1️⃣ Testing API Endpoint...');
    try {
        const response = await fetch(`${API_URL}/api/user/migrationtest/detailed-analysis`);
        console.log(`   Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✓ User found: ${data.user.username}`);
            console.log(`   ✓ Auth attempts: ${data.authAttempts.length}`);
            
            // Check for component scores
            const attemptsWithScores = data.authAttempts.filter(a => a.shape_scores || a.drawing_scores);
            console.log(`   ✓ Attempts with component scores: ${attemptsWithScores.length}`);
            
            // Show sample attempt
            if (data.authAttempts.length > 0) {
                const latest = data.authAttempts[0];
                console.log('\n   Latest attempt:');
                console.log(`   - ID: ${latest.id}`);
                console.log(`   - Confidence: ${latest.confidence}`);
                console.log(`   - Shape scores: ${JSON.stringify(latest.shape_scores)}`);
                console.log(`   - Drawing scores: ${JSON.stringify(latest.drawing_scores)}`);
            }
            
            // Save full response for inspection
            require('fs').writeFileSync('api-response.json', JSON.stringify(data, null, 2));
            console.log('\n   📄 Full API response saved to api-response.json');
        }
    } catch (error) {
        console.log(`   ❌ API Error: ${error.message}`);
    }
    
    // 2. Check database schema
    console.log('\n2️⃣ Checking Database Schema...');
    const pool = new Pool({ connectionString: DATABASE_URL });
    
    try {
        // Check auth_attempts table structure
        const schemaResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'auth_attempts' 
            ORDER BY ordinal_position
        `);
        
        console.log('   auth_attempts table columns:');
        schemaResult.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type}`);
        });
        
        // Check if drawing_scores column exists
        const hasDrawingScores = schemaResult.rows.some(col => col.column_name === 'drawing_scores');
        console.log(`\n   ${hasDrawingScores ? '✓' : '❌'} drawing_scores column exists`);
        
        // Get sample auth attempts
        console.log('\n3️⃣ Sample Database Records...');
        const sampleResult = await pool.query(`
            SELECT id, user_id, confidence, drawing_scores, created_at
            FROM auth_attempts
            WHERE user_id = (SELECT id FROM users WHERE username = 'migrationtest')
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log(`   Found ${sampleResult.rows.length} recent attempts for migrationtest:`);
        sampleResult.rows.forEach((row, idx) => {
            console.log(`\n   Attempt ${idx + 1}:`);
            console.log(`   - ID: ${row.id}`);
            console.log(`   - Confidence: ${row.confidence}`);
            console.log(`   - Drawing scores: ${row.drawing_scores ? JSON.stringify(row.drawing_scores) : 'NULL'}`);
            console.log(`   - Created: ${row.created_at}`);
        });
        
    } catch (error) {
        console.log(`   ❌ Database Error: ${error.message}`);
    } finally {
        await pool.end();
    }
    
    // 3. Check file modifications
    console.log('\n4️⃣ Recent File Modifications...');
    const { execSync } = require('child_process');
    try {
        const backendMod = execSync('stat -f "%m" backend/server.js').toString().trim();
        const frontendMod = execSync('stat -f "%m" frontend/ml-dashboard-v2.html').toString().trim();
        
        console.log(`   backend/server.js last modified: ${new Date(parseInt(backendMod) * 1000).toLocaleString()}`);
        console.log(`   frontend/ml-dashboard-v2.html last modified: ${new Date(parseInt(frontendMod) * 1000).toLocaleString()}`);
    } catch (error) {
        console.log('   Could not check file modification times');
    }
    
    // 4. Check which dashboard is being used
    console.log('\n5️⃣ Dashboard Version Check...');
    console.log('   Likely using: frontend/ml-dashboard-v2.html');
    console.log('   Alternative: frontend/ml-dashboard.html (older version)');
    console.log('\n   ⚠️  Make sure you\'re accessing the correct URL:');
    console.log('   Correct: /frontend/ml-dashboard-v2.html');
    console.log('   Wrong: /frontend/ml-dashboard.html');
    
    // 5. Deployment check
    console.log('\n6️⃣ Deployment Checklist...');
    console.log('   [ ] Server restarted after backend changes?');
    console.log('   [ ] Browser cache cleared (Cmd+Shift+R)?');
    console.log('   [ ] Correct dashboard URL being accessed?');
    console.log('   [ ] Changes pushed to production server?');
    console.log('   [ ] Database migrations run on production?');
    
    console.log('\n✅ Diagnostic complete!\n');
}

// Run diagnostic
diagnose().catch(console.error);