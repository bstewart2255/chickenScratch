// backend/verifyMetrics.js
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth',
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