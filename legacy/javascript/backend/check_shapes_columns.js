require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

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