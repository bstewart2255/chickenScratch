const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function validateMigrationReadiness() {
  const validationResults = {
    dataConsistency: true,
    schemaVersion: '',
    pendingMigrations: [],
    incompatibleFiles: [],
    databaseIssues: [],
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Check database schema consistency
    
    // Check database tables exist
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const existingTables = tableCheck.rows.map(r => r.table_name);
    const requiredTables = ['users', 'signatures', 'auth_attempts'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      validationResults.dataConsistency = false;
      validationResults.databaseIssues.push(
        `Missing required tables: ${missingTables.join(', ')}`
      );
    }

    // 2. Check for file naming inconsistencies
    const files = fs.readdirSync(__dirname);
    const inconsistentFiles = files.filter(f => 
      f.includes('_') && f.includes('-') && f.endsWith('.js')
    );
    validationResults.incompatibleFiles = inconsistentFiles;

    // 3. Verify all required files exist
    const requiredFiles = [
      'server.js',
      'db.js',
      'enhanced-feature-extraction.js',
      '../frontend/device-capabilities.js',
      '../frontend/index.html'
    ];
    
    const missingFiles = requiredFiles.filter(f => !fs.existsSync(path.join(__dirname, f)));
    if (missingFiles.length > 0) {
      validationResults.dataConsistency = false;
      validationResults.incompatibleFiles.push(...missingFiles.map(f => `Missing: ${f}`));
    }

  } catch (error) {
    validationResults.dataConsistency = false;
    validationResults.databaseIssues.push(error.message);
  }

  // Save validation results
  fs.writeFileSync(
    '.migration-validation.json',
    JSON.stringify(validationResults, null, 2)
  );

  return validationResults;
}

// Run validation
validateMigrationReadiness().then(results => {
  console.log('Migration Readiness:', results.dataConsistency ? 
    '✅ READY' : '❌ NOT READY');
  if (!results.dataConsistency) {
    console.log('Issues found:', results);
    process.exit(1);
  }
  process.exit(0);
}).catch(error => {
  console.error('Validation error:', error);
  process.exit(1);
});