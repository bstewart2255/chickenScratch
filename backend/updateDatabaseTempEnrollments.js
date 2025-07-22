// Script to add temp_enrollments tables to the database
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function updateDatabase() {
    console.log('🔄 Starting database update for temp enrollments...\n');
    
    try {
        // Create temp_enrollments table
        console.log('Creating temp_enrollments table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS temp_enrollments (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL UNIQUE,
                username VARCHAR(255) NOT NULL,
                flow_type VARCHAR(20) NOT NULL CHECK (flow_type IN ('signup', 'signin')),
                status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired')),
                device_info TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
            )
        `);
        console.log('✅ temp_enrollments table created');

        // Create temp_enrollment_steps table
        console.log('\nCreating temp_enrollment_steps table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS temp_enrollment_steps (
                id SERIAL PRIMARY KEY,
                enrollment_id INTEGER NOT NULL REFERENCES temp_enrollments(id) ON DELETE CASCADE,
                step_number INTEGER NOT NULL,
                step_type VARCHAR(20) NOT NULL CHECK (step_type IN ('signature', 'shape', 'drawing')),
                instruction TEXT,
                signature_data TEXT NOT NULL,
                raw_data JSONB,
                metrics JSONB DEFAULT '{}',
                completed_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(enrollment_id, step_number)
            )
        `);
        console.log('✅ temp_enrollment_steps table created');

        // Add indexes
        console.log('\nCreating indexes...');
        
        await pool.query('CREATE INDEX IF NOT EXISTS idx_temp_enrollments_session_id ON temp_enrollments(session_id)');
        console.log('✅ Created index on session_id');
        
        await pool.query('CREATE INDEX IF NOT EXISTS idx_temp_enrollments_username ON temp_enrollments(LOWER(username))');
        console.log('✅ Created index on username');
        
        await pool.query('CREATE INDEX IF NOT EXISTS idx_temp_enrollments_status ON temp_enrollments(status)');
        console.log('✅ Created index on status');
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_temp_enrollments_expires_at ON temp_enrollments(expires_at) WHERE status = 'in_progress'`);
        console.log('✅ Created partial index on expires_at');
        
        await pool.query('CREATE INDEX IF NOT EXISTS idx_temp_enrollment_steps_enrollment_id ON temp_enrollment_steps(enrollment_id)');
        console.log('✅ Created index on enrollment_id');
        
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username))');
        console.log('✅ Created index on users.username');

        // Create cleanup function
        console.log('\nCreating cleanup function...');
        await pool.query(`
            CREATE OR REPLACE FUNCTION cleanup_expired_enrollments() RETURNS void AS $$
            BEGIN
                UPDATE temp_enrollments 
                SET status = 'expired' 
                WHERE status = 'in_progress' 
                AND expires_at < NOW();
                
                DELETE FROM temp_enrollments 
                WHERE status = 'expired' 
                AND expires_at < (NOW() - INTERVAL '7 days');
            END;
            $$ LANGUAGE plpgsql
        `);
        console.log('✅ Created cleanup_expired_enrollments function');

        // Create progress function
        console.log('\nCreating progress tracking function...');
        await pool.query(`
            CREATE OR REPLACE FUNCTION get_enrollment_progress(p_session_id VARCHAR) 
            RETURNS TABLE (
                total_steps INTEGER,
                completed_steps INTEGER,
                last_step_number INTEGER,
                last_step_type VARCHAR,
                remaining_steps INTEGER,
                is_complete BOOLEAN
            ) AS $$
            BEGIN
                RETURN QUERY
                SELECT 
                    CASE 
                        WHEN te.flow_type = 'signup' THEN 11
                        WHEN te.flow_type = 'signin' THEN 1
                        ELSE 0
                    END as total_steps,
                    COUNT(tes.id)::INTEGER as completed_steps,
                    MAX(tes.step_number)::INTEGER as last_step_number,
                    (SELECT step_type FROM temp_enrollment_steps WHERE enrollment_id = te.id ORDER BY step_number DESC LIMIT 1) as last_step_type,
                    CASE 
                        WHEN te.flow_type = 'signup' THEN 11 - COUNT(tes.id)::INTEGER
                        WHEN te.flow_type = 'signin' THEN 1 - COUNT(tes.id)::INTEGER
                        ELSE 0
                    END as remaining_steps,
                    CASE 
                        WHEN te.flow_type = 'signup' AND COUNT(tes.id) >= 11 THEN true
                        WHEN te.flow_type = 'signin' AND COUNT(tes.id) >= 1 THEN true
                        ELSE false
                    END as is_complete
                FROM temp_enrollments te
                LEFT JOIN temp_enrollment_steps tes ON te.id = tes.enrollment_id
                WHERE te.session_id = p_session_id
                GROUP BY te.id, te.flow_type;
            END;
            $$ LANGUAGE plpgsql
        `);
        console.log('✅ Created get_enrollment_progress function');

        // Create completion function
        console.log('\nCreating completion function...');
        await pool.query(`
            CREATE OR REPLACE FUNCTION complete_enrollment(p_session_id VARCHAR) 
            RETURNS TABLE (
                success BOOLEAN,
                user_id INTEGER,
                message TEXT
            ) AS $$
            DECLARE
                v_enrollment_id INTEGER;
                v_username VARCHAR;
                v_flow_type VARCHAR;
                v_user_id INTEGER;
                v_is_complete BOOLEAN;
            BEGIN
                SELECT te.id, te.username, te.flow_type, 
                       CASE 
                           WHEN te.flow_type = 'signup' AND COUNT(tes.id) >= 11 THEN true
                           WHEN te.flow_type = 'signin' AND COUNT(tes.id) >= 1 THEN true
                           ELSE false
                       END as is_complete
                INTO v_enrollment_id, v_username, v_flow_type, v_is_complete
                FROM temp_enrollments te
                LEFT JOIN temp_enrollment_steps tes ON te.id = tes.enrollment_id
                WHERE te.session_id = p_session_id
                AND te.status = 'in_progress'
                GROUP BY te.id;
                
                IF NOT FOUND THEN
                    RETURN QUERY SELECT false, NULL::INTEGER, 'Enrollment session not found or already completed'::TEXT;
                    RETURN;
                END IF;
                
                IF NOT v_is_complete THEN
                    RETURN QUERY SELECT false, NULL::INTEGER, 'Enrollment is not complete'::TEXT;
                    RETURN;
                END IF;
                
                IF v_flow_type = 'signup' THEN
                    UPDATE temp_enrollments SET status = 'completed', updated_at = NOW() 
                    WHERE id = v_enrollment_id;
                    
                    RETURN QUERY SELECT true, NULL::INTEGER, 'Sign-up enrollment completed - ready for processing'::TEXT;
                
                ELSIF v_flow_type = 'signin' THEN
                    SELECT id INTO v_user_id FROM users WHERE LOWER(username) = LOWER(v_username);
                    
                    UPDATE temp_enrollments SET status = 'completed', updated_at = NOW() 
                    WHERE id = v_enrollment_id;
                    
                    RETURN QUERY SELECT true, v_user_id, 'Sign-in enrollment completed'::TEXT;
                END IF;
            END;
            $$ LANGUAGE plpgsql
        `);
        console.log('✅ Created complete_enrollment function');

        // Verify tables
        console.log('\n📊 Verifying schema...');
        const tables = await pool.query(`
            SELECT table_name, 
                   (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
            FROM information_schema.tables t
            WHERE table_schema = 'public' 
            AND table_name IN ('temp_enrollments', 'temp_enrollment_steps')
            ORDER BY table_name
        `);
        
        console.log('\nTables created:');
        tables.rows.forEach(table => {
            console.log(`- ${table.table_name}: ${table.column_count} columns`);
        });

        // Show sample queries
        console.log('\n📝 Sample queries for the new tables:\n');
        console.log('-- Start a new enrollment session:');
        console.log(`INSERT INTO temp_enrollments (session_id, username, flow_type, device_info) 
VALUES ('session_123', 'testuser', 'signup', 'Mozilla/5.0...')
RETURNING id;\n`);

        console.log('-- Save a drawing step:');
        console.log(`INSERT INTO temp_enrollment_steps (enrollment_id, step_number, step_type, instruction, signature_data, raw_data, metrics)
VALUES (1, 1, 'signature', 'Sign your name', 'data:image/png;base64,...', '{"strokes":[]}', '{"stroke_count":3}');\n`);

        console.log('-- Check enrollment progress:');
        console.log(`SELECT * FROM get_enrollment_progress('session_123');\n`);

        console.log('-- Complete enrollment:');
        console.log(`SELECT * FROM complete_enrollment('session_123');\n`);

        console.log('-- Clean up expired enrollments:');
        console.log(`SELECT cleanup_expired_enrollments();\n`);

        console.log('✨ Database update completed successfully!\n');

    } catch (error) {
        console.error('❌ Error updating database:', error);
        console.error('Error details:', error.message);
    } finally {
        await pool.end();
    }
}

// Run the update
updateDatabase();