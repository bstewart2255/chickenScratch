const { Pool } = require('pg');

const connectionString = 'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkAuthAttempts() {
  try {
    // Check columns in auth_attempts
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'auth_attempts'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in auth_attempts table:');
    console.table(columns.rows);
    
    // Check if there's any shape-related column
    const shapeColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'auth_attempts'
        AND column_name LIKE '%shape%'
    `);
    
    console.log('\nShape-related columns:');
    console.table(shapeColumns.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAuthAttempts();