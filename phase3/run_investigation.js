const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth',
  ssl: {
    rejectUnauthorized: false
  }
});

async function runInvestigation() {
  try {
    console.log('Running legacy data investigation...\n');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync('./phase3/legacy_data_investigation.sql', 'utf8');
    
    // Split into individual queries
    const queries = sqlContent
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.match(/^[\s\n]*--/));
    
    for (const query of queries) {
      // Skip pure comment blocks
      if (query.match(/^[\s\n]*--/)) continue;
      
      try {
        console.log(`\nExecuting: ${query.substring(0, 100)}...`);
        const result = await pool.query(query + ';');
        
        if (result.rows && result.rows.length > 0) {
          console.log(`Results (${result.rowCount} rows):`);
          
          // Special handling for pretty printed JSON
          if (result.rows[0].pretty_data) {
            result.rows.forEach(row => {
              console.log(`\nID: ${row.id}, Format: ${row.data_format}`);
              console.log('Data Structure:');
              console.log(row.pretty_data);
            });
          } else {
            console.table(result.rows);
          }
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Investigation error:', error);
  } finally {
    await pool.end();
  }
}

runInvestigation();