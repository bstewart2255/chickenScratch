const { Pool } = require('pg');

const connectionString = 'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runBackup() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Creating backup schema...');
    await client.query('CREATE SCHEMA IF NOT EXISTS backup_phase1_data_format');
    
    console.log('Creating backup tables...');
    
    // Backup affected shapes
    await client.query(`
      CREATE TABLE backup_phase1_data_format.shapes_backup_20250128 AS
      SELECT 
        s.*,
        NOW() as backup_timestamp,
        current_user as backup_by,
        'pre_data_format_fix' as backup_reason
      FROM shapes s
      WHERE s.data_format = 'base64'
    `);
    
    console.log('Creating indexes...');
    await client.query('CREATE INDEX idx_shapes_backup_id ON backup_phase1_data_format.shapes_backup_20250128(id)');
    await client.query('CREATE INDEX idx_shapes_backup_data_format ON backup_phase1_data_format.shapes_backup_20250128(data_format)');
    
    // Backup authentication attempts
    await client.query(`
      CREATE TABLE backup_phase1_data_format.auth_attempts_backup_20250128 AS
      SELECT 
        aa.*,
        NOW() as backup_timestamp
      FROM authentication_attempts aa
      WHERE aa.shape_id IN (
        SELECT id FROM shapes WHERE data_format = 'base64'
      )
    `);
    
    // Create metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_phase1_data_format.backup_metadata (
        backup_id SERIAL PRIMARY KEY,
        backup_name VARCHAR(255),
        backup_timestamp TIMESTAMP DEFAULT NOW(),
        source_table VARCHAR(255),
        record_count INTEGER,
        checksum VARCHAR(32),
        backup_by VARCHAR(255) DEFAULT current_user,
        notes TEXT
      )
    `);
    
    // Verify backup
    const verifyResult = await client.query(`
      WITH backup_verification AS (
        SELECT 
          'Original shapes count' as check_type,
          COUNT(*) as count
        FROM shapes 
        WHERE data_format = 'base64'
        
        UNION ALL
        
        SELECT 
          'Backed up shapes count' as check_type,
          COUNT(*) as count
        FROM backup_phase1_data_format.shapes_backup_20250128
        
        UNION ALL
        
        SELECT 
          'Shapes with raw key' as check_type,
          COUNT(*) as count
        FROM backup_phase1_data_format.shapes_backup_20250128
        WHERE shape_data::jsonb ? 'raw'
      )
      SELECT * FROM backup_verification
    `);
    
    console.log('\nBackup Verification:');
    console.table(verifyResult.rows);
    
    await client.query('COMMIT');
    console.log('\n✅ Backup completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Backup failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runBackup().catch(console.error);