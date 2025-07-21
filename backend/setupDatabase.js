const { Pool } = require('pg');

// Use your External Database URL for this one-time setup
const pool = new Pool({
  connectionString: 'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth',
  ssl: {
    rejectUnauthorized: false
  }
});

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