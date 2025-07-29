require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigrations() {
    console.log('Running database migrations...\n');
    
    try {
        // Get all migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = await fs.readdir(migrationsDir);
        const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
        
        console.log(`Found ${sqlFiles.length} migration files:`);
        sqlFiles.forEach(f => console.log(`  - ${f}`));
        console.log('');
        
        // Run each migration
        for (const file of sqlFiles) {
            console.log(`Running migration: ${file}`);
            
            try {
                const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
                await pool.query(sql);
                console.log(`✅ ${file} completed successfully\n`);
            } catch (error) {
                console.error(`❌ Error running ${file}:`, error.message);
                console.error('Stopping migrations due to error.\n');
                break;
            }
        }
        
        console.log('Migration process completed.');
        
    } catch (error) {
        console.error('Error reading migrations directory:', error);
    } finally {
        await pool.end();
    }
}

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    console.error('Please set it to your PostgreSQL connection string');
    process.exit(1);
}

// Run migrations
runMigrations();