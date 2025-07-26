require('dotenv').config();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper function to extract stroke data from signature pad data
function extractStrokeData(signatureData) {
    if (!signatureData) return null;
    
    try {
        let parsed = signatureData;
        if (typeof signatureData === 'string') {
            parsed = JSON.parse(signatureData);
        }
        
        // If we already have raw stroke data, use it
        if (parsed.raw && Array.isArray(parsed.raw)) {
            return parsed.raw;
        }
        
        // If we have strokes data, use it
        if (parsed.strokes && Array.isArray(parsed.strokes)) {
            return parsed.strokes;
        }
        
        // If we have data array, use it
        if (parsed.data && Array.isArray(parsed.data)) {
            return parsed.data;
        }
        
        // If it's a direct array, use it
        if (Array.isArray(parsed)) {
            return parsed;
        }
        
        console.warn('No stroke data found in signature data');
        return null;
    } catch (error) {
        console.error('Error extracting stroke data:', error);
        return null;
    }
}

// Function to convert existing base64 data to stroke data
async function migrateExistingData() {
    const client = await pool.connect();
    
    try {
        console.log('Starting migration of existing base64 data...');
        
        // Get all signatures with base64 data
        const result = await client.query(`
            SELECT id, signature_data, user_id 
            FROM signatures 
            WHERE data_format = 'base64' 
            AND signature_data IS NOT NULL
        `);
        
        console.log(`Found ${result.rows.length} signatures to migrate`);
        
        let migrated = 0;
        let errors = 0;
        
        for (const row of result.rows) {
            try {
                const strokeData = extractStrokeData(row.signature_data);
                
                if (strokeData) {
                    // Update the record with stroke data
                    await client.query(`
                        UPDATE signatures 
                        SET stroke_data = $1, data_format = 'stroke_data'
                        WHERE id = $2
                    `, [JSON.stringify(strokeData), row.id]);
                    
                    migrated++;
                    console.log(`Migrated signature ${row.id} for user ${row.user_id}`);
                } else {
                    console.warn(`No stroke data found for signature ${row.id}`);
                    errors++;
                }
            } catch (error) {
                console.error(`Error migrating signature ${row.id}:`, error);
                errors++;
            }
        }
        
        console.log(`Migration complete: ${migrated} migrated, ${errors} errors`);
        
    } finally {
        client.release();
    }
}

// Function to update the signature storage endpoint
async function storeSignatureWithStrokeData(userId, signatureData, metrics = {}) {
    const client = await pool.connect();
    
    try {
        // Extract stroke data
        const strokeData = extractStrokeData(signatureData);
        
        if (!strokeData) {
            throw new Error('No valid stroke data found');
        }
        
        // Store stroke data instead of base64
        const result = await client.query(`
            INSERT INTO signatures (user_id, stroke_data, metrics, data_format, created_at)
            VALUES ($1, $2, $3, 'stroke_data', NOW())
            RETURNING id
        `, [userId, JSON.stringify(strokeData), JSON.stringify(metrics)]);
        
        console.log(`Stored stroke data for user ${userId}, signature ID: ${result.rows[0].id}`);
        
        return {
            success: true,
            signatureId: result.rows[0].id,
            dataFormat: 'stroke_data',
            size: JSON.stringify(strokeData).length
        };
        
    } finally {
        client.release();
    }
}

// Function to retrieve signature data (with fallback to base64)
async function getSignatureData(signatureId) {
    const client = await pool.connect();
    
    try {
        const result = await client.query(`
            SELECT stroke_data, signature_data, data_format
            FROM signatures 
            WHERE id = $1
        `, [signatureId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const row = result.rows[0];
        
        // Return stroke data if available
        if (row.stroke_data && row.data_format === 'stroke_data') {
            return {
                type: 'stroke_data',
                data: row.stroke_data,
                format: 'stroke_data'
            };
        }
        
        // Fallback to base64 data
        if (row.signature_data) {
            return {
                type: 'base64',
                data: row.signature_data,
                format: 'base64'
            };
        }
        
        return null;
        
    } finally {
        client.release();
    }
}

// Export functions for use in server.js
module.exports = {
    extractStrokeData,
    migrateExistingData,
    storeSignatureWithStrokeData,
    getSignatureData
};

// Run migration if called directly
if (require.main === module) {
    migrateExistingData()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
} 