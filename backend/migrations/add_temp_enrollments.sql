-- Migration: Add temporary enrollments table for step-by-step signature collection
-- Date: 2025-01-22
-- Purpose: Support mobile web experience with progressive data collection

-- Create temp_enrollments table
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
);

-- Create temp_enrollment_steps table for individual drawing steps
CREATE TABLE IF NOT EXISTS temp_enrollment_steps (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER NOT NULL REFERENCES temp_enrollments(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_type VARCHAR(20) NOT NULL CHECK (step_type IN ('signature', 'shape', 'drawing')),
    instruction TEXT,
    signature_data TEXT NOT NULL, -- Base64 encoded image
    raw_data JSONB, -- Raw signature pad data
    metrics JSONB DEFAULT '{}',
    completed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(enrollment_id, step_number)
);

-- Add indexes for performance
CREATE INDEX idx_temp_enrollments_session_id ON temp_enrollments(session_id);
CREATE INDEX idx_temp_enrollments_username ON temp_enrollments(LOWER(username));
CREATE INDEX idx_temp_enrollments_status ON temp_enrollments(status);
CREATE INDEX idx_temp_enrollments_expires_at ON temp_enrollments(expires_at) WHERE status = 'in_progress';
CREATE INDEX idx_temp_enrollment_steps_enrollment_id ON temp_enrollment_steps(enrollment_id);

-- Add index on users table for username lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

-- Function to clean up expired enrollments
CREATE OR REPLACE FUNCTION cleanup_expired_enrollments() RETURNS void AS $$
BEGIN
    UPDATE temp_enrollments 
    SET status = 'expired' 
    WHERE status = 'in_progress' 
    AND expires_at < NOW();
    
    -- Optional: Delete very old expired records (older than 7 days)
    DELETE FROM temp_enrollments 
    WHERE status = 'expired' 
    AND expires_at < (NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- Function to get enrollment progress
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
$$ LANGUAGE plpgsql;

-- Function to complete enrollment and transfer data
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
    -- Get enrollment details
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
    
    -- For sign-up, create user and transfer all data
    IF v_flow_type = 'signup' THEN
        -- This would be handled by the application layer
        -- Just mark as completed here
        UPDATE temp_enrollments SET status = 'completed', updated_at = NOW() 
        WHERE id = v_enrollment_id;
        
        RETURN QUERY SELECT true, NULL::INTEGER, 'Sign-up enrollment completed - ready for processing'::TEXT;
    
    -- For sign-in, just mark as completed
    ELSIF v_flow_type = 'signin' THEN
        -- Get user_id
        SELECT id INTO v_user_id FROM users WHERE LOWER(username) = LOWER(v_username);
        
        UPDATE temp_enrollments SET status = 'completed', updated_at = NOW() 
        WHERE id = v_enrollment_id;
        
        RETURN QUERY SELECT true, v_user_id, 'Sign-in enrollment completed'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired enrollments (if using pg_cron)
-- SELECT cron.schedule('cleanup-expired-enrollments', '*/15 * * * *', 'SELECT cleanup_expired_enrollments()');

-- Grant permissions (adjust based on your user setup)
-- GRANT ALL ON temp_enrollments TO your_app_user;
-- GRANT ALL ON temp_enrollment_steps TO your_app_user;
-- GRANT ALL ON temp_enrollments_id_seq TO your_app_user;
-- GRANT ALL ON temp_enrollment_steps_id_seq TO your_app_user;