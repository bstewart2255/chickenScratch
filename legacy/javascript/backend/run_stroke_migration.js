require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const pool = require('./db.js');

async function runStrokeMigration() {
    console.log('🔧 Running stroke data migration...\n');
    
    try {
        // Read the migration SQL file
        const sqlFile = path.join(__dirname, 'migrate_to_stroke_data.sql');
        const sqlContent = await fs.readFile(sqlFile, 'utf8');
        
        // Split the SQL into individual statements
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`Found ${statements.length} migration statements to run\n`);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            try {
                console.log(`Running migration statement ${i + 1}/${statements.length}...`);
                console.log(`Statement: ${statement.substring(0, 100)}...`);
                
                const result = await pool.query(statement);
                
                if (result.rows && result.rows.length > 0) {
                    console.log('Result:', result.rows[0]);
                } else {
                    console.log('Statement executed successfully');
                }
                console.log('');
                
            } catch (error) {
                // Check if it's a "relation already exists" error (which is OK)
                if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
                    console.log('⚠️ Statement skipped (already exists):', error.message);
                } else {
                    console.error(`❌ Error in statement ${i + 1}:`, error.message);
                }
                console.log('');
            }
        }
        
        console.log('✅ Stroke data migration completed');
        
    } catch (error) {
        console.error('❌ Error reading migration file:', error.message);
    } finally {
        await pool.end();
    }
}

// Run stroke migration
runStrokeMigration().catch(console.error); 