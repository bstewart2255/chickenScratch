// Test script to verify signature data extraction
require('dotenv').config();
const { Pool } = require('pg');

// Helper function (copy from server.js for testing)
function extractDisplayableSignatureData(signatureData) {
    if (!signatureData) return null;
    
    try {
        // Parse if it's a string
        let parsed = signatureData;
        if (typeof signatureData === 'string') {
            parsed = JSON.parse(signatureData);
        }
        
        // Handle different data formats
        // Format 1: {data: "base64...", raw: [strokes], metrics: {}, timestamp: 123}
        if (parsed.data && typeof parsed.data === 'string' && parsed.data.startsWith('data:')) {
            // Return base64 image directly
            return parsed.data;
        }
        
        // Format 2: {data: [strokes], ...} or {strokes: [strokes], ...}
        if (parsed.data && Array.isArray(parsed.data)) {
            return parsed.data;
        }
        if (parsed.strokes && Array.isArray(parsed.strokes)) {
            return parsed.strokes;
        }
        
        // Format 3: Direct array of strokes
        if (Array.isArray(parsed)) {
            return parsed;
        }
        
        // Format 4: {raw: [strokes], ...}
        if (parsed.raw && Array.isArray(parsed.raw)) {
            return parsed.raw;
        }
        
        console.warn('Unknown signature data format:', typeof parsed, Object.keys(parsed));
        return null;
    } catch (error) {
        console.error('Error extracting displayable signature data:', error);
        return null;
    }
}

// Test different signature formats
const testCases = [
    {
        name: 'Format 1: Base64 image',
        data: '{"data":"data:image/png;base64,iVBORw0KGgoAAAANS...","raw":[[{"x":10,"y":20}]],"metrics":{},"timestamp":123}'
    },
    {
        name: 'Format 2: Data array',
        data: '{"data":[[{"x":10,"y":20},{"x":30,"y":40}]],"metrics":{}}'
    },
    {
        name: 'Format 3: Direct array',
        data: '[[{"x":10,"y":20},{"x":30,"y":40}],[{"x":50,"y":60}]]'
    },
    {
        name: 'Format 4: Raw array',
        data: '{"raw":[[{"x":10,"y":20}]],"metrics":{}}'
    },
    {
        name: 'Format 5: Strokes array',
        data: '{"strokes":[[{"x":10,"y":20}]],"metrics":{}}'
    }
];

console.log('Testing signature data extraction...\n');

testCases.forEach(testCase => {
    console.log(`Testing ${testCase.name}:`);
    const result = extractDisplayableSignatureData(testCase.data);
    console.log('Input:', testCase.data.substring(0, 50) + '...');
    console.log('Output type:', typeof result);
    console.log('Is array:', Array.isArray(result));
    console.log('Is base64:', typeof result === 'string' && result.startsWith('data:'));
    console.log('Success:', result !== null);
    console.log('---\n');
});

// Test with actual database if provided username
const username = process.argv[2];
if (username) {
    console.log(`\nTesting with actual data for user: ${username}\n`);
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 
          `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`
    });
    
    (async () => {
        try {
            const userResult = await pool.query(
                'SELECT id FROM users WHERE username = $1',
                [username]
            );
            
            if (userResult.rows.length === 0) {
                console.log('User not found');
                process.exit(1);
            }
            
            const userId = userResult.rows[0].id;
            
            // Get signatures
            const signatures = await pool.query(
                'SELECT signature_data FROM signatures WHERE user_id = $1 LIMIT 3',
                [userId]
            );
            
            console.log(`Found ${signatures.rows.length} signatures\n`);
            
            signatures.rows.forEach((sig, index) => {
                console.log(`Signature ${index + 1}:`);
                const extracted = extractDisplayableSignatureData(sig.signature_data);
                console.log('Original type:', typeof sig.signature_data);
                console.log('Extracted type:', typeof extracted);
                console.log('Is array:', Array.isArray(extracted));
                console.log('Is base64:', typeof extracted === 'string' && extracted.startsWith('data:'));
                console.log('Success:', extracted !== null);
                console.log('---\n');
            });
            
        } catch (error) {
            console.error('Database error:', error);
        } finally {
            await pool.end();
        }
    })();
} else {
    console.log('\nTo test with actual database data, run: node test-signature-extraction.js <username>');
}