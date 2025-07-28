require('dotenv').config();
const pool = require('./db.js');

async function createBackup() {
    console.log('💾 Creating backup before Phase 2 processing...\n');
    
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '_').split('T')[0] + '_' + 
                         new Date().toISOString().replace(/[:.]/g, '_').split('T')[1].split('.')[0];
        const backupTableName = `shapes_metrics_backup_phase2_${timestamp}`;
        
        console.log(`Creating backup table: ${backupTableName}`);
        
        const backupQuery = `
            CREATE TABLE "${backupTableName}" AS
            SELECT id, user_id, shape_type, metrics, created_at, CURRENT_TIMESTAMP as backup_timestamp
            FROM shapes
            WHERE shape_type IN ('circle', 'square', 'triangle')
        `;
        
        await pool.query(backupQuery);
        
        // Verify backup was created
        const verifyQuery = `SELECT COUNT(*) as backup_count FROM "${backupTableName}"`;
        const result = await pool.query(verifyQuery);
        
        console.log(`✅ Backup created successfully with ${result.rows[0].backup_count} records`);
        console.log(`Backup table: ${backupTableName}`);
        
        return backupTableName;
        
    } catch (error) {
        console.error('❌ Error creating backup:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Create backup
createBackup().catch(console.error); 