const { Pool } = require('pg');

const connectionString = 'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function investigate() {
  try {
    // Check shapes without raw key
    console.log('\nInvestigating shapes with base64 format but no raw key...\n');
    
    const shapesWithoutRaw = await pool.query(`
      SELECT id, created_at, 
             jsonb_pretty(shape_data::jsonb) as shape_data_preview,
             jsonb_object_keys(shape_data::jsonb) as keys
      FROM shapes 
      WHERE data_format = 'base64' 
        AND NOT (shape_data::jsonb ? 'raw')
      LIMIT 5
    `);
    
    console.log('Sample of shapes without raw key:');
    for (const row of shapesWithoutRaw.rows) {
      console.log(`\nID: ${row.id}`);
      console.log(`Created: ${row.created_at}`);
      console.log(`Keys in shape_data: ${row.keys}`);
      console.log(`Data preview: ${row.shape_data_preview}`);
    }
    
    // Check what keys these shapes have
    const keysAnalysis = await pool.query(`
      SELECT DISTINCT jsonb_object_keys(shape_data::jsonb) as key
      FROM shapes 
      WHERE data_format = 'base64' 
        AND NOT (shape_data::jsonb ? 'raw')
    `);
    
    console.log('\nDistinct keys found in shapes without raw:');
    console.table(keysAnalysis.rows);
    
    // Check if these are actually base64 encoded data
    const checkBase64 = await pool.query(`
      SELECT id, 
             length(shape_data::text) as data_length,
             substring(shape_data::text, 1, 100) as data_preview
      FROM shapes 
      WHERE data_format = 'base64' 
        AND NOT (shape_data::jsonb ? 'raw')
      LIMIT 3
    `);
    
    console.log('\nChecking if these are actually base64 encoded:');
    console.table(checkBase64.rows);

  } catch (error) {
    console.error('Error investigating:', error.message);
  } finally {
    await pool.end();
  }
}

investigate();