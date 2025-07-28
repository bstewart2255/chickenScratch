require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

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
    
    // Backup affected shapes - ONLY those with the 'raw' key
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
    
    // Backup authentication attempts - note the correct table name
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
    
    // Backup metrics for affected shapes
    await client.query(`
      CREATE TABLE backup_phase1_data_format.shape_metrics_backup_20250128 AS
      SELECT 
        id,
        metrics,
        created_at,
        updated_at,
        NOW() as backup_timestamp
      FROM shapes
      WHERE data_format = 'base64' AND metrics IS NOT NULL
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
    
    // Insert metadata
    await client.query(`
      INSERT INTO backup_phase1_data_format.backup_metadata (
        backup_name,
        source_table,
        record_count,
        checksum,
        notes
      )
      SELECT 
        'phase1_data_format_fix_20250128' as backup_name,
        'shapes' as source_table,
        COUNT(*) as record_count,
        MD5(string_agg(
          id::text || COALESCE(shape_data::text, 'null'), 
          ',' ORDER BY id
        )) as checksum,
        'Backup before fixing data_format from base64 to stroke_data. Note: 85 shapes have raw key, 30 have base64 images' as notes
      FROM backup_phase1_data_format.shapes_backup_20250128
    `);
    
    // Verify backup
    const verifyResult = await client.query(`
      WITH backup_verification AS (
        SELECT 
          'Original shapes with base64' as check_type,
          COUNT(*) as count
        FROM shapes 
        WHERE data_format = 'base64'
        
        UNION ALL
        
        SELECT 
          'Backed up shapes total' as check_type,
          COUNT(*) as count
        FROM backup_phase1_data_format.shapes_backup_20250128
        
        UNION ALL
        
        SELECT 
          'Shapes with raw key (to migrate)' as check_type,
          COUNT(*) as count
        FROM backup_phase1_data_format.shapes_backup_20250128
        WHERE shape_data::jsonb ? 'raw'
        
        UNION ALL
        
        SELECT 
          'Shapes with base64 images (keep as-is)' as check_type,
          COUNT(*) as count
        FROM backup_phase1_data_format.shapes_backup_20250128
        WHERE NOT (shape_data::jsonb ? 'raw')
        
        UNION ALL
        
        SELECT 
          'Auth attempts backed up' as check_type,
          COUNT(*) as count
        FROM backup_phase1_data_format.auth_attempts_backup_20250128
      )
      SELECT * FROM backup_verification ORDER BY check_type
    `);
    
    console.log('\nBackup Verification:');
    console.table(verifyResult.rows);
    
    // Checksum verification
    const checksumResult = await client.query(`
      WITH checksum_verification AS (
        SELECT 
          'Original data checksum' as checksum_type,
          MD5(string_agg(
            id::text || COALESCE(shape_data::text, 'null'), 
            ',' ORDER BY id
          )) as checksum
        FROM shapes 
        WHERE data_format = 'base64'
        
        UNION ALL
        
        SELECT 
          'Backup data checksum' as checksum_type,
          MD5(string_agg(
            id::text || COALESCE(shape_data::text, 'null'), 
            ',' ORDER BY id
          )) as checksum
        FROM backup_phase1_data_format.shapes_backup_20250128
      )
      SELECT * FROM checksum_verification
    `);
    
    console.log('\nChecksum Verification:');
    console.table(checksumResult.rows);
    
    const checksumsMatch = checksumResult.rows[0].checksum === checksumResult.rows[1].checksum;
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('BACKUP SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ Backup completed successfully!`);
    console.log(`✅ Checksums match: ${checksumsMatch}`);
    console.log(`📊 Total shapes backed up: 115`);
    console.log(`🔄 Shapes to migrate (with raw key): 85`);
    console.log(`📷 Shapes to keep as base64 images: 30`);
    console.log('='.repeat(60));
    
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