// Test script to add component scores to existing auth attempts for testing
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`
});

async function addTestComponentScores() {
    try {
        // Get recent auth attempts without component scores
        const result = await pool.query(`
            SELECT id, user_id, confidence 
            FROM auth_attempts 
            WHERE drawing_scores IS NULL 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        console.log(`Found ${result.rows.length} auth attempts without component scores`);
        
        for (const attempt of result.rows) {
            // Generate realistic test scores based on signature confidence
            const baseScore = attempt.confidence;
            const variation = 15; // +/- 15% variation
            
            const componentScores = {
                // Shape scores
                circle: Math.round(baseScore + (Math.random() - 0.5) * variation),
                square: Math.round(baseScore + (Math.random() - 0.5) * variation),
                triangle: Math.round(baseScore + (Math.random() - 0.5) * variation),
                // Drawing scores
                face: Math.round(baseScore + (Math.random() - 0.5) * variation),
                star: Math.round(baseScore + (Math.random() - 0.5) * variation),
                house: Math.round(baseScore + (Math.random() - 0.5) * variation),
                connect_dots: Math.round(baseScore + (Math.random() - 0.5) * variation)
            };
            
            // Ensure scores are within 0-100 range
            Object.keys(componentScores).forEach(key => {
                componentScores[key] = Math.max(0, Math.min(100, componentScores[key]));
            });
            
            // Update the auth attempt
            await pool.query(
                'UPDATE auth_attempts SET drawing_scores = $1 WHERE id = $2',
                [JSON.stringify(componentScores), attempt.id]
            );
            
            console.log(`Updated attempt ${attempt.id} with component scores:`, componentScores);
        }
        
        console.log('\nDone! Component scores added for testing.');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    addTestComponentScores();
}

module.exports = { addTestComponentScores };