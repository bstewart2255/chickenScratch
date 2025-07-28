require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkStatus() {
  try {
    // Check 1: Count shapes with base64 format
    const base64Count = await pool.query(
      "SELECT COUNT(*) as count FROM shapes WHERE data_format = 'base64'"
    );
    console.log(`\n1. Shapes with base64 format: ${base64Count.rows[0].count}`);

    // Check 2: Shapes with base64 that have raw data
    const withRawData = await pool.query(
      "SELECT COUNT(*) as count FROM shapes WHERE data_format = 'base64' AND shape_data::jsonb ? 'raw'"
    );
    console.log(`2. Shapes with base64 format that have raw stroke data: ${withRawData.rows[0].count}`);

    // Check 3: Shapes with base64 without raw data
    const withoutRawData = await pool.query(
      "SELECT COUNT(*) as count FROM shapes WHERE data_format = 'base64' AND NOT (shape_data::jsonb ? 'raw')"
    );
    console.log(`3. Shapes with base64 format WITHOUT raw key: ${withoutRawData.rows[0].count} (should be 0)`);

    // Check 4: Sample records
    const sampleRecords = await pool.query(
      "SELECT id, created_at, data_format FROM shapes WHERE data_format = 'base64' LIMIT 5"
    );
    console.log(`\n4. Sample of affected records:`);
    console.table(sampleRecords.rows);

    // Check 5: Distribution of data formats
    const distribution = await pool.query(
      "SELECT data_format, COUNT(*) as count FROM shapes GROUP BY data_format ORDER BY count DESC"
    );
    console.log(`\n5. Distribution of data formats:`);
    console.table(distribution.rows);

    // Check if backup exists
    const backupExists = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'backup_phase1_data_format' AND table_name = 'shapes_backup_20250128')"
    );
    console.log(`\n6. Backup table exists: ${backupExists.rows[0].exists}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION STATUS SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Records to migrate: ${base64Count.rows[0].count}`);
    console.log(`Expected: 115`);
    console.log(`Status: ${parseInt(base64Count.rows[0].count) === 115 ? '✓ READY' : parseInt(base64Count.rows[0].count) === 0 ? '✓ ALREADY MIGRATED' : '⚠ UNEXPECTED COUNT'}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error checking status:', error.message);
  } finally {
    await pool.end();
  }
}

checkStatus();