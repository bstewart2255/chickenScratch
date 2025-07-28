const pool = require('../backend/db.js');

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT COUNT(*) FROM signatures');
    console.log('Signatures count:', result.rows[0].count);
    
    const result2 = await pool.query('SELECT COUNT(*) FROM shapes');
    console.log('Shapes count:', result2.rows[0].count);
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();