require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: {
        rejectUnauthorized: false
    }
});

async function makeSignatureDataNullable() {
    const client = await pool.connect();
    
    try {
        console.log('Making signature_data column nullable...');
        
        // Check current constraint
        const constraintCheck = await client.query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'signatures' 
            AND column_name = 'signature_data';
        `);
        
        if (constraintCheck.rows.length > 0) {
            const currentStatus = constraintCheck.rows[0];
            console.log(`Current status - Column: ${currentStatus.column_name}, Nullable: ${currentStatus.is_nullable}`);
            
            if (currentStatus.is_nullable === 'NO') {
                // Make the column nullable
                await client.query('ALTER TABLE signatures ALTER COLUMN signature_data DROP NOT NULL;');
                console.log('✓ Successfully made signature_data column nullable');
            } else {
                console.log('✓ signature_data column is already nullable');
            }
        } else {
            console.log('⚠️  signature_data column not found');
        }
        
        // Verify the change
        const verifyCheck = await client.query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'signatures' 
            AND column_name = 'signature_data';
        `);
        
        if (verifyCheck.rows.length > 0) {
            console.log(`\nVerification - Column: ${verifyCheck.rows[0].column_name}, Nullable: ${verifyCheck.rows[0].is_nullable}`);
        }
        
        console.log('\n✅ Migration completed successfully');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
makeSignatureDataNullable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));