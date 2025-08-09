require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    try {
        console.log('\n📊 Database Contents:\n');
        
        // Check users
        const users = await pool.query('SELECT * FROM users');
        console.log(`Users (${users.rows.length}):`);
        users.rows.forEach(user => {
            console.log(`  - ${user.username} (created: ${user.created_at})`);
        });
        
        // Check signatures
        const signatures = await pool.query('SELECT COUNT(*) FROM signatures');
        console.log(`\nTotal signatures: ${signatures.rows[0].count}`);
        
        // Check shapes
        const shapes = await pool.query('SELECT COUNT(*), shape_type FROM shapes GROUP BY shape_type');
        console.log('\nShapes:');
        shapes.rows.forEach(shape => {
            console.log(`  - ${shape.shape_type}: ${shape.count}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkData();