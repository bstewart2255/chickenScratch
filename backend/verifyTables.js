// Script to verify database tables exist
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function verifyTables() {
    try {
        console.log('Checking database tables...\n');
        
        // List all tables
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('📊 Tables in database:');
        tablesResult.rows.forEach(row => {
            console.log(`  ✓ ${row.table_name}`);
        });
        
        // Check specifically for auth_attempts
        const authTableExists = tablesResult.rows.some(row => row.table_name === 'auth_attempts');
        
        console.log('\n🔍 Auth attempts table status:');
        if (authTableExists) {
            console.log('  ✅ auth_attempts table EXISTS');
            
            // Get column info
            const columnsResult = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'auth_attempts'
                ORDER BY ordinal_position
            `);
            
            console.log('\n  Columns:');
            columnsResult.rows.forEach(col => {
                console.log(`    - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });
            
            // Get row count
            const countResult = await pool.query('SELECT COUNT(*) as count FROM auth_attempts');
            console.log(`\n  Row count: ${countResult.rows[0].count}`);
            
        } else {
            console.log('  ❌ auth_attempts table DOES NOT EXIST');
            console.log('\n  To create it, run: npm run update-db');
        }
        
        // Check other required tables
        console.log('\n📋 Other required tables:');
        const requiredTables = ['users', 'signatures', 'shapes'];
        requiredTables.forEach(tableName => {
            const exists = tablesResult.rows.some(row => row.table_name === tableName);
            console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
        });
        
    } catch (error) {
        console.error('Error checking tables:', error.message);
        if (error.message.includes('does not exist')) {
            console.log('\n💡 The database might not be initialized. Run: npm run setup-db');
        }
    } finally {
        await pool.end();
    }
}

verifyTables();