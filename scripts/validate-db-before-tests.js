#!/usr/bin/env node

/**
 * Pre-test database validation
 * Ensures database configuration is correct before running tests
 * Prevents "root" user connection attempts
 */

const { Pool } = require('pg');

function validateEnvironment() {
  console.log('🔍 Pre-test Database Configuration Validation\n');

  // Check if we're in a CI environment
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  // Check OS environment
  console.log('=== OS Environment ===');
  console.log(`USER: ${process.env.USER || 'not set'}`);
  console.log(`HOME: ${process.env.HOME || 'not set'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`CI Environment: ${isCI ? 'Yes' : 'No'}`);

  // Check database environment
  console.log('\n=== Database Environment ===');
  const dbVars = {
    'DATABASE_URL': process.env.DATABASE_URL,
    'DB_USER': process.env.DB_USER,
    'DB_HOST': process.env.DB_HOST,
    'DB_PORT': process.env.DB_PORT,
    'DB_NAME': process.env.DB_NAME,
    'DB_PASSWORD': process.env.DB_PASSWORD ? '***' : undefined,
    'PGUSER': process.env.PGUSER,
    'PGHOST': process.env.PGHOST,
    'PGPORT': process.env.PGPORT,
    'PGDATABASE': process.env.PGDATABASE,
    'PGPASSWORD': process.env.PGPASSWORD ? '***' : undefined,
    'POSTGRES_USER': process.env.POSTGRES_USER,
    'POSTGRES_PASSWORD': process.env.POSTGRES_PASSWORD ? '***' : undefined,
    'POSTGRES_DB': process.env.POSTGRES_DB
  };

  Object.entries(dbVars).forEach(([key, value]) => {
    if (value !== undefined) {
      console.log(`${key}: ${value}`);
    }
  });

  // Critical validation: Check for root user
  console.log('\n=== Validation Results ===');
  
  let hasErrors = false;

  // In CI environment, be more lenient about OS USER being root
  // since GitHub Actions runners always have USER=root
  if (process.env.USER === 'root' && !process.env.DB_USER && !process.env.PGUSER && !isCI) {
    console.error('❌ ERROR: OS user is "root" and no DB_USER or PGUSER is set!');
    console.error('   This may cause PostgreSQL to attempt connection as "root"');
    hasErrors = true;
  } else if (process.env.USER === 'root' && isCI) {
    console.log('ℹ️  CI Environment detected: OS USER=root is expected in GitHub Actions');
  }

  // Check explicit root user settings
  const rootVars = [];
  if (process.env.DB_USER === 'root') rootVars.push('DB_USER');
  if (process.env.PGUSER === 'root') rootVars.push('PGUSER');
  if (process.env.POSTGRES_USER === 'root') rootVars.push('POSTGRES_USER');

  if (rootVars.length > 0) {
    console.error(`❌ ERROR: The following variables are set to "root": ${rootVars.join(', ')}`);
    hasErrors = true;
  }

  // Check DATABASE_URL
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (url.username === 'root') {
        console.error('❌ ERROR: DATABASE_URL contains "root" user!');
        hasErrors = true;
      } else {
        console.log(`✅ DATABASE_URL user: ${url.username}`);
      }
    } catch (e) {
      console.error('❌ ERROR: Invalid DATABASE_URL format');
      hasErrors = true;
    }
  }

  // Determine what user will be used
  const effectiveUser = process.env.DB_USER || 
                       process.env.PGUSER || 
                       (process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).username : null) ||
                       'postgres'; // Default to postgres instead of process.env.USER

  console.log(`\n📋 Effective database user: ${effectiveUser}`);
  console.log(`📋 OS USER: ${process.env.USER || 'not set'}`);
  console.log(`📋 DB_USER: ${process.env.DB_USER || 'not set'}`);
  console.log(`📋 PGUSER: ${process.env.PGUSER || 'not set'}`);
  console.log(`📋 DATABASE_URL user: ${process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).username : 'not set'}`);

  if (effectiveUser === 'root') {
    console.error('\n❌ CRITICAL: Database will attempt to connect as "root" user!');
    console.error('\n💡 Solutions:');
    console.error('   1. Set DB_USER=postgres in your environment');
    console.error('   2. Set PGUSER=postgres in your environment');
    console.error('   3. Update DATABASE_URL to use postgres user');
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n❌ Validation failed! Fix the issues above before running tests.');
    process.exit(1);
  }

  console.log('\n✅ Database configuration validated successfully!');
  console.log('   No "root" user issues detected.');
}

// Test actual connection
async function testConnection() {
  console.log('\n🔌 Testing database connection...');

  // Build connection config explicitly
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'signature_auth_test',
    user: process.env.DB_USER || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres'
  };

  // Final check
  if (config.user === 'root') {
    console.error('❌ STOPPED: Would attempt connection as "root" user!');
    process.exit(1);
  }

  const pool = new Pool(config);

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT current_user, version()');
    console.log(`✅ Connected successfully as: ${result.rows[0].current_user}`);
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    if (error.message.includes('role "root"')) {
      console.error('\n💡 The database is rejecting "root" user connection.');
      console.error('   Check your environment variables and configuration.');
    }
    process.exit(1);
  }
}

// Run validation
async function main() {
  validateEnvironment();
  await testConnection();
  console.log('\n🎉 All validations passed! Ready to run tests.');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { validateEnvironment, testConnection };