const { Pool } = require('pg');

const connectionString = 'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Tables in database:');
    console.table(tables.rows);
    
    // Check for auth-related tables
    const authTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%auth%'
      ORDER BY table_name
    `);
    
    console.log('\nAuth-related tables:');
    console.table(authTables.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();