require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runPostValidation() {
  try {
    console.log('Running post-migration validation...\n');
    
    // 1. Primary Success Criteria
    const primaryCheck = await pool.query(`
      SELECT COUNT(*) as count 
      FROM shapes 
      WHERE data_format = 'base64' AND shape_data::jsonb ? 'raw'
    `);
    
    console.log('1. PRIMARY CHECK - Base64 formats with raw key remaining:');
    console.log(`   Count: ${primaryCheck.rows[0].count}`);
    console.log(`   Status: ${parseInt(primaryCheck.rows[0].count) === 0 ? '✅ PASSED - No base64 formats with raw key found' : '❌ FAILED - Base64 formats with raw key still exist'}`);
    
    // 2. Verify migrated records
    const migrationCheck = await pool.query(`
      SELECT COUNT(*) as migrated_count
      FROM shapes s
      JOIN backup_phase1_data_format.shapes_backup_20250128 b ON s.id = b.id
      WHERE s.data_format = 'stroke_data' AND b.shape_data::jsonb ? 'raw'
    `);
    
    console.log('\n2. Migrated records format check:');
    console.log(`   Count: ${migrationCheck.rows[0].migrated_count}`);
    console.log(`   Status: ${parseInt(migrationCheck.rows[0].migrated_count) === 85 ? '✅ PASSED - All 85 records migrated' : '❌ FAILED - Expected 85, found ' + migrationCheck.rows[0].migrated_count}`);
    
    // 3. Data integrity check
    const integrityCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_checked,
        COUNT(*) FILTER (WHERE s.shape_data = b.shape_data) as data_preserved
      FROM shapes s
      JOIN backup_phase1_data_format.shapes_backup_20250128 b ON s.id = b.id
      WHERE b.shape_data::jsonb ? 'raw'
    `);
    
    console.log('\n3. Data integrity check:');
    console.log(`   Total checked: ${integrityCheck.rows[0].total_checked}`);
    console.log(`   Data preserved: ${integrityCheck.rows[0].data_preserved}`);
    console.log(`   Status: ${integrityCheck.rows[0].total_checked === integrityCheck.rows[0].data_preserved ? '✅ PASSED - All data preserved' : '❌ FAILED - Data corruption detected'}`);
    
    // 4. Base64 images preserved
    const imagesCheck = await pool.query(`
      SELECT COUNT(*) as image_count
      FROM shapes 
      WHERE data_format = 'base64' AND NOT (shape_data::jsonb ? 'raw')
    `);
    
    console.log('\n4. Base64 images preserved:');
    console.log(`   Count: ${imagesCheck.rows[0].image_count}`);
    console.log(`   Status: ${parseInt(imagesCheck.rows[0].image_count) === 30 ? '✅ PASSED - All 30 base64 images preserved' : '❌ WARNING - Expected 30, found ' + imagesCheck.rows[0].image_count}`);
    
    // 5. Stroke data validation
    const strokeDataCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_stroke_data,
        COUNT(*) FILTER (WHERE shape_data::jsonb ? 'raw') as has_raw_key,
        COUNT(*) FILTER (WHERE jsonb_array_length((shape_data::jsonb->'raw')::jsonb) > 0) as has_strokes
      FROM shapes
      WHERE data_format = 'stroke_data'
        AND id IN (SELECT id FROM backup_phase1_data_format.shapes_backup_20250128 WHERE shape_data::jsonb ? 'raw')
    `);
    
    console.log('\n5. Stroke data validation:');
    console.log(`   Total stroke_data shapes: ${strokeDataCheck.rows[0].total_stroke_data}`);
    console.log(`   Has raw key: ${strokeDataCheck.rows[0].has_raw_key}`);
    console.log(`   Has strokes: ${strokeDataCheck.rows[0].has_strokes}`);
    console.log(`   Status: ${strokeDataCheck.rows[0].total_stroke_data === strokeDataCheck.rows[0].has_raw_key ? '✅ PASSED - All shapes have raw data' : '❌ FAILED - Missing raw data'}`);
    
    // 6. Migration log summary
    const logSummary = await pool.query(`
      SELECT 
        COUNT(*) as total_log_entries,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_operations,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_operations,
        SUM(affected_records) FILTER (WHERE operation = 'batch_update') as total_updated
      FROM backup_phase1_data_format.migration_log
      WHERE migration_phase = 'phase1_data_format'
    `);
    
    console.log('\n6. Migration log summary:');
    console.log(`   Total log entries: ${logSummary.rows[0].total_log_entries}`);
    console.log(`   Successful operations: ${logSummary.rows[0].successful_operations}`);
    console.log(`   Failed operations: ${logSummary.rows[0].failed_operations}`);
    console.log(`   Total records updated: ${logSummary.rows[0].total_updated}`);
    console.log(`   Status: ${parseInt(logSummary.rows[0].failed_operations) === 0 ? '✅ PASSED - No failures logged' : '❌ FAILED - Errors found in log'}`);
    
    // Final Summary
    const summary = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM shapes WHERE data_format = 'base64' AND shape_data::jsonb ? 'raw') as remaining_base64_with_raw,
        (SELECT COUNT(*) FROM shapes WHERE data_format = 'stroke_data' 
         AND id IN (SELECT id FROM backup_phase1_data_format.shapes_backup_20250128 WHERE shape_data::jsonb ? 'raw')) as migrated_count,
        (SELECT COUNT(*) FROM backup_phase1_data_format.shapes_backup_20250128 WHERE shape_data::jsonb ? 'raw') as expected_count,
        (SELECT COUNT(*) FROM shapes WHERE data_format = 'base64' AND NOT (shape_data::jsonb ? 'raw')) as preserved_images
    `);
    
    console.log('\n' + '='.repeat(60));
    console.log('FINAL VALIDATION SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Migration Status: ${parseInt(summary.rows[0].remaining_base64_with_raw) === 0 && summary.rows[0].migrated_count == summary.rows[0].expected_count ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Remaining base64 records with raw key: ${summary.rows[0].remaining_base64_with_raw}`);
    console.log(`Successfully migrated: ${summary.rows[0].migrated_count}`);
    console.log(`Expected migrations: ${summary.rows[0].expected_count}`);
    console.log(`Preserved base64 images: ${summary.rows[0].preserved_images}`);
    console.log(`Validation timestamp: ${new Date().toISOString()}`);
    
    const allPassed = parseInt(summary.rows[0].remaining_base64_with_raw) === 0 && 
                     parseInt(summary.rows[0].migrated_count) === 85 && 
                     parseInt(summary.rows[0].preserved_images) === 30;
    
    console.log(`\nAll checks passed: ${allPassed ? '✅ YES' : '❌ NO'}`);
    console.log(`Next steps: ${allPassed ? 'Migration successful. Proceed with application testing.' : 'Migration issues detected. Review logs and consider rollback.'}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('Error during validation:', error.message);
  } finally {
    await pool.end();
  }
}

runPostValidation();