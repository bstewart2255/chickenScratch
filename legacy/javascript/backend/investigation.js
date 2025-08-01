const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: {
        rejectUnauthorized: false
    }
});

async function investigate() {
    try {
        const query3_signatures = await pool.query(`
            SELECT 
                id,
                'signature' as type,
                signature_data->0->0 as first_point
            FROM signatures 
            WHERE signature_data IS NOT NULL
            LIMIT 5;
        `);
        console.log('--- Query 3 Results (Signatures) ---');
        console.table(query3_signatures.rows);

        const query3_shapes = await pool.query(`
            SELECT 
                id,
                'shape' as type,
                shape_data->'raw'->0->0 as first_point
            FROM shapes 
            WHERE shape_data->'raw' IS NOT NULL
            LIMIT 5;
        `);
        console.log('--- Query 3 Results (Shapes) ---');
        console.table(query3_shapes.rows);

    } catch (error) {
        console.error('Error executing query:', error);
    } finally {
        await pool.end();
    }
}

investigate();