const { Pool } = require('pg');

const connectionString = 'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkShapesColumns() {
  try {
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'shapes'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in shapes table:');
    console.table(columns.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkShapesColumns();