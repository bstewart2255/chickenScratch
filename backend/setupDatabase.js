require('dotenv').config();
const { Pool } = require('pg');

// Validate database configuration before connecting
function validateDatabaseConfig() {
  const dbUser = process.env.DB_USER || process.env.PGUSER || 'postgres';
  const dbHost = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  const dbPort = process.env.DB_PORT || process.env.PGPORT || '5432';
  const dbName = process.env.DB_NAME || process.env.PGDATABASE || 'signatureauth';
  const dbPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres';

  // Check for root user
  if (dbUser === 'root' || process.env.USER === 'root' && !process.env.DB_USER) {
    console.error('❌ ERROR: Database connection attempted with "root" user!');
    console.error('   Please set DB_USER or PGUSER to "postgres" or another valid database user.');
    console.error('   Current configuration:');
    console.error(`   - DB_USER: ${process.env.DB_USER || 'not set'}`);
    console.error(`   - PGUSER: ${process.env.PGUSER || 'not set'}`);
    console.error(`   - OS USER: ${process.env.USER || 'not set'}`);
    process.exit(1);
  }

  // Log configuration for debugging
  console.log('Database configuration:');
  console.log(`  Host: ${dbHost}`);
  console.log(`  Port: ${dbPort}`);
  console.log(`  Database: ${dbName}`);
  console.log(`  User: ${dbUser}`);

  return { dbUser, dbHost, dbPort, dbName, dbPassword };
}

const config = validateDatabaseConfig();

// Use explicit configuration - no fallback to OS user
const poolConfig = {
  host: config.dbHost,
  port: parseInt(config.dbPort),
  database: config.dbName,
  user: config.dbUser,
  password: config.dbPassword,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
};

// If DATABASE_URL is provided, parse it but still validate user
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (url.username === 'root') {
      console.error('❌ ERROR: DATABASE_URL contains "root" user!');
      process.exit(1);
    }
    poolConfig.connectionString = process.env.DATABASE_URL;
  } catch (e) {
    console.log('Using individual connection parameters instead of DATABASE_URL');
  }
}

const pool = new Pool(poolConfig);

async function setupDatabase() {
  try {
    console.log('Creating tables...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Users table created');
    
    // Create signatures table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS signatures (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        signature_data JSONB NOT NULL,
        features JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Signatures table created');
    
    // Create shapes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shapes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        shape_type VARCHAR(50),
        shape_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Shapes table created');

    // Add metrics column to existing tables
    await pool.query(`
        ALTER TABLE signatures ADD COLUMN IF NOT EXISTS metrics JSONB
    `);
    console.log('✅ Added metrics column to signatures table');

    await pool.query(`
        ALTER TABLE shapes ADD COLUMN IF NOT EXISTS metrics JSONB
    `);
    console.log('✅ Added metrics column to shapes table');
    
    console.log('\n🎉 Database setup complete!');
    
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase();