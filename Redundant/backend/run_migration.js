require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration...\n');
    
    // Pre-migration safety check
    const safetyCheck = await client.query(`
      SELECT 
        COUNT(*) as total_to_migrate,
        COUNT(*) FILTER (WHERE shape_data::jsonb ? 'raw') as with_raw_key,
        COUNT(*) FILTER (WHERE NOT (shape_data::jsonb ? 'raw')) as without_raw_key
      FROM shapes 
      WHERE data_format = 'base64'
    `);
    
    console.log('Pre-migration check:');
    console.table(safetyCheck.rows);
    

    if (parseInt(safetyCheck.rows[0].with_raw_key) !== 85) {
      throw new Error(`Expected 85 shapes with raw key, found ${safetyCheck.rows[0].with_raw_key}`);
    }
    
    // Create migration log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_phase1_data_format.migration_log (
        log_id SERIAL PRIMARY KEY,
        migration_phase VARCHAR(50),
        operation VARCHAR(100),
        affected_records INTEGER,
        last_processed_id INTEGER,
        status VARCHAR(20),
        error_message TEXT,
        executed_at TIMESTAMP DEFAULT NOW(),
        executed_by VARCHAR(255) DEFAULT current_user
      )
    `);
    
    // Log migration start
    await client.query(`
      INSERT INTO backup_phase1_data_format.migration_log 
      (migration_phase, operation, status)
      VALUES ('phase1_data_format', 'migration_start', 'started')
    `);
    
    console.log('\nStarting batch migration...');
    
    // Perform migration in batches
    let totalUpdated = 0;
    let lastProcessedId = 0;
    const batchSize = 20;
    
    while (true) {
      // Get next batch
      const batch = await client.query(`
        SELECT id 
        FROM shapes 
        WHERE data_format = 'base64' 
          AND shape_data::jsonb ? 'raw'
          AND id > $1
        ORDER BY id
        LIMIT $2
      `, [lastProcessedId, batchSize]);
      
      if (batch.rows.length === 0) {
        break;
      }
      
      // Update batch
      const batchIds = batch.rows.map(r => r.id);
      const updateResult = await client.query(`
        UPDATE shapes 
        SET 
          data_format = 'stroke_data'
        WHERE id = ANY($1::integer[])
          AND data_format = 'base64'
          AND shape_data::jsonb ? 'raw'
          AND shape_data IS NOT NULL
        RETURNING id
      `, [batchIds]);
      
      const batchUpdated = updateResult.rowCount;
      totalUpdated += batchUpdated;
      lastProcessedId = Math.max(...batchIds);
      
      // Log batch completion
      await client.query(`
        INSERT INTO backup_phase1_data_format.migration_log 
        (migration_phase, operation, affected_records, status, last_processed_id)
        VALUES ('phase1_data_format', 'batch_update', $1, 'completed', $2)
      `, [batchUpdated, lastProcessedId]);
      
      console.log(`Batch completed: ${batchUpdated} records updated (Total: ${totalUpdated})`);
    }
    
    // Log migration completion
    await client.query(`
      INSERT INTO backup_phase1_data_format.migration_log 
      (migration_phase, operation, affected_records, status)
      VALUES ('phase1_data_format', 'migration_complete', $1, 'completed')
    `, [totalUpdated]);
    
    // Post-migration validation
    const postCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE data_format = 'base64') as remaining_base64,
        COUNT(*) FILTER (WHERE data_format = 'base64' AND shape_data::jsonb ? 'raw') as base64_with_raw,
        COUNT(*) FILTER (WHERE data_format = 'base64' AND NOT (shape_data::jsonb ? 'raw')) as base64_images,
        COUNT(*) FILTER (WHERE data_format = 'stroke_data') as stroke_data_count
      FROM shapes
    `);
    
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION RESULTS:');
    console.log('='.repeat(60));
    console.table(postCheck.rows);
    

    if (parseInt(postCheck.rows[0].base64_with_raw) === 0 && parseInt(postCheck.rows[0].base64_images) === 30) {
      console.log('\n✅ Migration completed successfully!');
      console.log(`✅ ${totalUpdated} shapes migrated from base64 to stroke_data`);
      console.log(`✅ 30 base64 image shapes preserved`);
      console.log(`✅ 0 shapes with raw key remain in base64 format`);
    } else {
      console.log('\n⚠️  Migration completed with unexpected results!');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Log error
    try {
      await client.query(`
        INSERT INTO backup_phase1_data_format.migration_log 
        (migration_phase, operation, status, error_message)
        VALUES ('phase1_data_format', 'migration_error', 'failed', $1)
      `, [error.message]);
    } catch (logError) {
      console.error('Failed to log error:', logError.message);
    }
    
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);