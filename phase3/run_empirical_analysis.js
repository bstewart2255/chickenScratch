const { Client } = require('pg');
const fs = require('fs');

// Database connection configuration
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'signatureauth'}`;

async function runEmpiricalAnalysis() {
    const client = new Client({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('Connected to database successfully\n');

        // Read the SQL file
        const sqlContent = fs.readFileSync('./empirical_data_analysis.sql', 'utf8');
        
        // Split into individual queries
        const queries = sqlContent
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0 && !q.startsWith('--'));

        const results = [];

        // Execute each query
        for (const query of queries) {
            // Skip pure comment blocks
            if (query.match(/^[\s\n]*--/)) continue;
            
            try {
                console.log(`\nExecuting: ${query.substring(0, 100)}...`);
                const result = await client.query(query + ';');
                
                if (result.rows && result.rows.length > 0) {
                    results.push({
                        query: query.substring(0, 200) + '...',
                        rows: result.rows,
                        rowCount: result.rowCount
                    });
                    
                    // Print results to console
                    console.log(`Results (${result.rowCount} rows):`);
                    console.table(result.rows);
                }
            } catch (error) {
                console.error(`Error executing query: ${error.message}`);
                results.push({
                    query: query.substring(0, 200) + '...',
                    error: error.message
                });
            }
        }

        // Save results to file
        fs.writeFileSync('./empirical_analysis_results.json', JSON.stringify(results, null, 2));
        console.log('\nResults saved to empirical_analysis_results.json');

    } catch (error) {
        console.error('Database connection error:', error);
    } finally {
        await client.end();
    }
}

// Run the analysis
runEmpiricalAnalysis();