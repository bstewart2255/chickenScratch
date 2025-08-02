#!/usr/bin/env node

/**
 * Database Configuration Validator
 * 
 * This script validates that the database configuration is correct and
 * no "root" user is being used in any environment.
 */

const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

function validateDatabaseConfig() {
  console.log('🔍 Validating Database Configuration...\n');

  // Check environment variables
  const envVars = {
    'NODE_ENV': process.env.NODE_ENV,
    'DATABASE_URL': process.env.DATABASE_URL,
    'DB_USER': process.env.DB_USER,
    'DB_HOST': process.env.DB_HOST,
    'DB_PORT': process.env.DB_PORT,
    'DB_NAME': process.env.DB_NAME,
    'PGUSER': process.env.PGUSER,
    'PGHOST': process.env.PGHOST,
    'PGPORT': process.env.PGPORT,
    'PGDATABASE': process.env.PGDATABASE,
    'POSTGRES_USER': process.env.POSTGRES_USER,
    'POSTGRES_DB': process.env.POSTGRES_DB
  };

  console.log('📋 Environment Variables:');
  Object.entries(envVars).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    const displayValue = value ? value : 'Not set';
    console.log(`  ${status} ${key}: ${displayValue}`);
  });

  // Check for "root" user usage
  const rootUserFound = Object.values(envVars).some(value => 
    value && value.toString().includes('root')
  );

  if (rootUserFound) {
    console.log('\n❌ ERROR: "root" user found in database configuration!');
    console.log('   This will cause connection failures. Please update to use "postgres" user.');
    process.exit(1);
  }

  // Validate DATABASE_URL if present
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      console.log('\n🔗 DATABASE_URL Analysis:');
      console.log(`  ✅ Protocol: ${url.protocol}`);
      console.log(`  ✅ Host: ${url.hostname}`);
      console.log(`  ✅ Port: ${url.port || '5432 (default)'}`);
      console.log(`  ✅ Database: ${url.pathname.slice(1)}`);
      console.log(`  ✅ User: ${url.username}`);
      
      if (url.username === 'root') {
        console.log('\n❌ ERROR: DATABASE_URL contains "root" user!');
        console.log('   Please update to use "postgres" user.');
        process.exit(1);
      }
    } catch (error) {
      console.log('\n❌ ERROR: Invalid DATABASE_URL format');
      console.log(`   Error: ${error.message}`);
      process.exit(1);
    }
  }

  // Test database connection
  console.log('\n🔌 Testing Database Connection...');
  
  const connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'signature_auth_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  };

  console.log('📋 Connection Config:');
  Object.entries(connectionConfig).forEach(([key, value]) => {
    if (key !== 'password') {
      console.log(`  ${key}: ${value}`);
    } else {
      console.log(`  ${key}: ${value ? '***' : 'Not set'}`);
    }
  });

  const pool = new Pool(connectionConfig);

  pool.connect((err, client, release) => {
    if (err) {
      console.log('\n❌ Database Connection Failed:');
      console.log(`   Error: ${err.message}`);
      
      if (err.message.includes('role "root"')) {
        console.log('\n💡 SOLUTION: The error indicates "root" user is being used.');
        console.log('   Please check your configuration and ensure "postgres" user is used instead.');
        console.log('\n   Quick fixes:');
        console.log('   1. Set DB_USER=postgres in your environment');
        console.log('   2. Update DATABASE_URL to use postgres user');
        console.log('   3. Check .env files for any "root" references');
      }
      
      process.exit(1);
    } else {
      console.log('\n✅ Database Connection Successful!');
      console.log(`   Connected as: ${client.user}`);
      console.log(`   Database: ${client.database}`);
      console.log(`   Host: ${client.host}:${client.port}`);
      
      // Test a simple query
      client.query('SELECT current_user, current_database()', (err, result) => {
        if (err) {
          console.log(`   Query test failed: ${err.message}`);
        } else {
          const row = result.rows[0];
          console.log(`   Current user: ${row.current_user}`);
          console.log(`   Current database: ${row.current_database}`);
          
          if (row.current_user === 'root') {
            console.log('\n❌ WARNING: Connected as "root" user!');
            console.log('   This may cause issues in production environments.');
          }
        }
        
        release();
        pool.end();
        console.log('\n🎉 Database configuration validation complete!');
      });
    }
  });
}

// Run validation
if (require.main === module) {
  validateDatabaseConfig();
}

module.exports = { validateDatabaseConfig }; 