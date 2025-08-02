require('dotenv').config();
// backend/verifyMetrics.js
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: { rejectUnauthorized: false }
});

async function verifyMetrics() {
    try {
        // Check if columns exist
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'signatures' 
            AND column_name = 'metrics'
        `);
        
        console.log('✅ Metrics column exists:', result.rows.length > 0);
        
        // Try inserting test data
        const testResult = await pool.query(`
            SELECT COUNT(*) as total,
                   COUNT(metrics) as with_metrics 
            FROM signatures
        `);
        
        console.log('Signatures:', testResult.rows[0]);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

verifyMetrics();