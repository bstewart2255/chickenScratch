require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runEnrollmentMigration() {
    try {
        console.log('🔄 Starting enrollment migration...');
        
        // Read and execute the migration SQL
        const migrationPath = path.join(__dirname, 'migrations', 'add_enrollment_flag.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📝 Executing migration SQL...');
        await pool.query(migrationSQL);
        console.log('✅ Migration SQL executed successfully');
        
        // Update existing signatures to mark the first 3 signatures per user as enrollment signatures
        console.log('🔄 Updating existing signatures to mark enrollment signatures...');
        
        const updateResult = await pool.query(`
            WITH ranked_signatures AS (
                SELECT 
                    id,
                    user_id,
                    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
                FROM signatures
                WHERE is_enrollment IS NULL OR is_enrollment = false
            )
            UPDATE signatures 
            SET is_enrollment = true
            WHERE id IN (
                SELECT id 
                FROM ranked_signatures 
                WHERE rn <= 3
            )
        `);
        
        console.log(`✅ Updated ${updateResult.rowCount} signatures as enrollment signatures`);
        
        // Verify the migration
        console.log('🔍 Verifying migration...');
        const verifyResult = await pool.query(`
            SELECT 
                COUNT(*) as total_signatures,
                COUNT(CASE WHEN is_enrollment = true THEN 1 END) as enrollment_signatures,
                COUNT(DISTINCT user_id) as total_users,
                COUNT(DISTINCT CASE WHEN is_enrollment = true THEN user_id END) as users_with_enrollment
            FROM signatures
        `);
        
        const stats = verifyResult.rows[0];
        console.log('📊 Migration verification results:');
        console.log(`   Total signatures: ${stats.total_signatures}`);
        console.log(`   Enrollment signatures: ${stats.enrollment_signatures}`);
        console.log(`   Total users: ${stats.total_users}`);
        console.log(`   Users with enrollment signatures: ${stats.users_with_enrollment}`);
        
        console.log('✅ Enrollment migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the migration if this script is executed directly
if (require.main === module) {
    runEnrollmentMigration()
        .then(() => {
            console.log('🎉 Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { runEnrollmentMigration }; 