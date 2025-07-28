const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Use the DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL || 
  'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function executeSQLFile(filePath, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Executing: ${description}`);
  console.log(`File: ${filePath}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    const sql = await fs.readFile(filePath, 'utf8');
    
    // Split by semicolons but handle DO blocks specially
    const statements = [];
    let currentStatement = '';
    let inDoBlock = false;
    
    const lines = sql.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for DO block start
      if (trimmedLine.toUpperCase().startsWith('DO $$')) {
        inDoBlock = true;
      }
      
      currentStatement += line + '\n';
      
      // Check for DO block end
      if (inDoBlock && trimmedLine.endsWith('$$;')) {
        inDoBlock = false;
        statements.push(currentStatement.trim());
        currentStatement = '';
      } else if (!inDoBlock && trimmedLine.endsWith(';') && !trimmedLine.startsWith('--')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    
    // Execute each statement
    for (const statement of statements) {
      if (statement && !statement.trim().startsWith('--') && statement.trim().length > 0) {
        try {
          // Skip psql-specific commands
          if (statement.includes('\\set')) continue;
          
          console.log(`\nExecuting statement...`);
          const result = await pool.query(statement);
          
          // Display results if any
          if (result.rows && result.rows.length > 0) {
            console.table(result.rows);
          } else if (result.command) {
            console.log(`Command: ${result.command}, Rows affected: ${result.rowCount}`);
          }
        } catch (err) {
          console.error(`Error executing statement: ${err.message}`);
          // Continue with other statements unless it's critical
          if (err.message.includes('SAFETY VIOLATION') || err.message.includes('ABORTED')) {
            throw err;
          }
        }
      }
    }
    
    console.log(`\n✓ ${description} completed successfully`);
    return true;
  } catch (error) {
    console.error(`\n✗ Error during ${description}:`, error.message);
    throw error;
  }
}

async function runMigration() {
  const phase = process.argv[2] || '1';
  
  try {
    switch(phase) {
      case '1':
        // Pre-migration validation
        await executeSQLFile(
          path.join(__dirname, '../phase1_data_format_fix/01_pre_migration_validation.sql'),
          'Pre-Migration Validation'
        );
        console.log('\n🔍 Pre-migration validation complete. Review the results above.');
        console.log('If all checks pass, run: node execute_migration.js 2');
        break;
        
      case '2':
        // Backup procedure
        await executeSQLFile(
          path.join(__dirname, '../phase1_data_format_fix/02_backup_procedure.sql'),
          'Backup Procedure'
        );
        console.log('\n💾 Backup complete. Proceed to migration.');
        console.log('Run: node execute_migration.js 3');
        break;
        
      case '3':
        // Migration
        await executeSQLFile(
          path.join(__dirname, '../phase1_data_format_fix/03_migration_script.sql'),
          'Data Format Migration'
        );
        console.log('\n🔄 Migration complete. Run validation.');
        console.log('Run: node execute_migration.js 4');
        break;
        
      case '4':
        // Post-migration validation
        await executeSQLFile(
          path.join(__dirname, '../phase1_data_format_fix/04_post_migration_validation.sql'),
          'Post-Migration Validation'
        );
        console.log('\n✅ Post-migration validation complete. Review results above.');
        break;
        
      case 'rollback':
        // Emergency rollback
        console.log('\n⚠️  WARNING: About to execute rollback procedure!');
        console.log('This will restore all data to pre-migration state.');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await executeSQLFile(
          path.join(__dirname, '../phase1_data_format_fix/05_rollback_script.sql'),
          'Emergency Rollback'
        );
        console.log('\n🔙 Rollback complete.');
        break;
        
      default:
        console.log('Usage: node execute_migration.js [phase]');
        console.log('Phases:');
        console.log('  1 - Pre-migration validation');
        console.log('  2 - Backup procedure');
        console.log('  3 - Migration execution');
        console.log('  4 - Post-migration validation');
        console.log('  rollback - Emergency rollback');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);