// Updated API endpoints to use database instead of in-memory storage
// Replace the corresponding endpoints in server.js with these implementations

// Helper function to generate session ID
function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 1. Check if username is available for sign-up (with proper index usage)
app.post('/api/check-username', async (req, res) => {
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    try {
        console.log('Checking username availability:', username);
        
        // Use LOWER() to leverage the index
        const result = await pool.query(
            'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
            [username]
        );
        
        if (result.rows.length > 0) {
            console.log('Username already taken:', username);
            res.status(409).json({ 
                error: 'Username already taken',
                available: false 
            });
        } else {
            console.log('Username available:', username);
            res.status(200).json({ 
                message: 'Username is available',
                available: true 
            });
        }
    } catch (error) {
        console.error('Error checking username:', error);
        res.status(500).json({ error: 'Failed to check username availability' });
    }
});

// 2. Check if username exists for sign-in (with proper index usage)
app.post('/api/check-user-exists', async (req, res) => {
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    try {
        console.log('Checking if user exists:', username);
        
        // Use LOWER() to leverage the index
        const result = await pool.query(
            'SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)',
            [username]
        );
        
        if (result.rows.length > 0) {
            console.log('User found:', username);
            res.status(200).json({ 
                exists: true,
                username: result.rows[0].username
            });
        } else {
            console.log('User not found:', username);
            res.status(404).json({ 
                error: 'User not found',
                exists: false 
            });
        }
    } catch (error) {
        console.error('Error checking user existence:', error);
        res.status(500).json({ error: 'Failed to check user existence' });
    }
});

// 3. Save individual drawing/signature steps during the flow (using database)
app.post('/api/save-drawing', async (req, res) => {
    const { signature, raw, step, type, instruction, timestamp, username, metrics, sessionId } = req.body;
    
    if (!username || !step || !type) {
        return res.status(400).json({ 
            error: 'Username, step, and type are required' 
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log(`Saving drawing for ${username} - Step ${step}: ${type}`);
        
        let enrollmentId;
        let currentSessionId = sessionId;
        
        // Check if we have an existing enrollment session
        if (currentSessionId) {
            const enrollmentResult = await client.query(
                'SELECT id FROM temp_enrollments WHERE session_id = $1 AND status = $2',
                [currentSessionId, 'in_progress']
            );
            
            if (enrollmentResult.rows.length > 0) {
                enrollmentId = enrollmentResult.rows[0].id;
                
                // Update the updated_at timestamp
                await client.query(
                    'UPDATE temp_enrollments SET updated_at = NOW() WHERE id = $1',
                    [enrollmentId]
                );
            }
        }
        
        // Create new enrollment if needed
        if (!enrollmentId) {
            currentSessionId = generateSessionId();
            const flowType = step === 1 && type === 'signature' && !sessionId ? 'signin' : 'signup';
            
            const enrollmentResult = await client.query(
                `INSERT INTO temp_enrollments (session_id, username, flow_type, device_info, metadata) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING id`,
                [
                    currentSessionId,
                    username.toLowerCase(),
                    flowType,
                    req.headers['user-agent'] || 'Unknown',
                    JSON.stringify({ 
                        timestamp: timestamp || Date.now(),
                        ip: req.ip 
                    })
                ]
            );
            enrollmentId = enrollmentResult.rows[0].id;
        }
        
        // Save the drawing step
        await client.query(
            `INSERT INTO temp_enrollment_steps 
             (enrollment_id, step_number, step_type, instruction, signature_data, raw_data, metrics) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (enrollment_id, step_number) 
             DO UPDATE SET 
                signature_data = EXCLUDED.signature_data,
                raw_data = EXCLUDED.raw_data,
                metrics = EXCLUDED.metrics,
                completed_at = NOW()`,
            [
                enrollmentId,
                step,
                type,
                instruction,
                signature,
                JSON.stringify(raw),
                JSON.stringify(metrics || {})
            ]
        );
        
        // Get progress
        const progressResult = await client.query(
            'SELECT * FROM get_enrollment_progress($1)',
            [currentSessionId]
        );
        
        const progress = progressResult.rows[0];
        
        await client.query('COMMIT');
        
        console.log(`Saved drawing step ${step} for ${username}. Progress: ${progress.completed_steps}/${progress.total_steps}`);
        
        res.status(200).json({ 
            success: true,
            message: `Drawing step ${step} saved successfully`,
            sessionId: currentSessionId,
            progress: {
                totalSteps: progress.total_steps,
                completedSteps: progress.completed_steps,
                remainingSteps: progress.remaining_steps,
                isComplete: progress.is_complete
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving drawing:', error);
        res.status(500).json({ error: 'Failed to save drawing' });
    } finally {
        client.release();
    }
});

// 4. Get enrollment progress
app.get('/api/enrollment-progress/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM get_enrollment_progress($1)',
            [sessionId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error getting progress:', error);
        res.status(500).json({ error: 'Failed to get enrollment progress' });
    }
});

// 5. Clean up expired enrollments (can be called periodically)
app.post('/api/cleanup-enrollments', async (req, res) => {
    try {
        await pool.query('SELECT cleanup_expired_enrollments()');
        res.json({ success: true, message: 'Cleanup completed' });
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ error: 'Cleanup failed' });
    }
});

// Updated register endpoint to use database temp storage
app.post('/register', async (req, res) => {
    let { username, signatures, shapes, drawings, metadata, useTemporaryData, sessionId } = req.body;
    
    // If using temporary data from database
    if (useTemporaryData && sessionId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Get enrollment data
            const enrollmentResult = await client.query(
                `SELECT te.*, 
                        COUNT(tes.id) as step_count
                 FROM temp_enrollments te
                 LEFT JOIN temp_enrollment_steps tes ON te.id = tes.enrollment_id
                 WHERE te.session_id = $1 AND te.status = 'in_progress'
                 GROUP BY te.id`,
                [sessionId]
            );
            
            if (enrollmentResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'No enrollment session found or already completed' 
                });
            }
            
            const enrollment = enrollmentResult.rows[0];
            username = enrollment.username;
            
            // Get all steps
            const stepsResult = await client.query(
                `SELECT * FROM temp_enrollment_steps 
                 WHERE enrollment_id = $1 
                 ORDER BY step_number`,
                [enrollment.id]
            );
            
            // Organize data into expected format
            signatures = [];
            shapes = {};
            drawings = {};
            
            stepsResult.rows.forEach(step => {
                const data = {
                    data: step.signature_data,
                    raw: step.raw_data,
                    metrics: step.metrics || {},
                    timestamp: step.completed_at
                };
                
                if (step.step_type === 'signature') {
                    signatures.push(data);
                } else if (step.step_type === 'shape') {
                    shapes[step.instruction || 'shape'] = data;
                } else if (step.step_type === 'drawing') {
                    drawings[step.instruction || 'drawing'] = {
                        ...data,
                        prompt: step.instruction
                    };
                }
            });
            
            // Mark enrollment as completed
            await client.query(
                'UPDATE temp_enrollments SET status = $1, updated_at = NOW() WHERE id = $2',
                ['completed', enrollment.id]
            );
            
            await client.query('COMMIT');
            
            console.log(`Using database enrollment data for ${username}: ${stepsResult.rows.length} steps`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error retrieving enrollment data:', error);
            return res.status(500).json({ error: 'Failed to retrieve enrollment data' });
        } finally {
            client.release();
        }
    }
    
    // Continue with existing registration logic...
    // [Rest of the registration code remains the same]
});

// Updated login endpoint to use database temp storage
app.post('/login', async (req, res) => {
    let { username, signature, shapes, drawings, deviceInfo, useTemporaryData, sessionId, metadata } = req.body;
    
    // If using temporary data from database
    if (useTemporaryData && sessionId) {
        const client = await pool.connect();
        
        try {
            // Get enrollment data with signature
            const result = await client.query(
                `SELECT te.username, tes.* 
                 FROM temp_enrollments te
                 JOIN temp_enrollment_steps tes ON te.id = tes.enrollment_id
                 WHERE te.session_id = $1 
                 AND te.status = 'in_progress'
                 AND tes.step_type = 'signature'
                 ORDER BY tes.step_number
                 LIMIT 1`,
                [sessionId]
            );
            
            if (result.rows.length === 0) {
                return res.status(400).json({ 
                    error: 'No signature found in session. Please complete the sign-in process.' 
                });
            }
            
            const stepData = result.rows[0];
            username = stepData.username;
            
            signature = {
                data: stepData.signature_data,
                raw: stepData.raw_data,
                metrics: stepData.metrics || {},
                timestamp: stepData.completed_at
            };
            
            // Mark enrollment as completed
            await client.query(
                `UPDATE temp_enrollments 
                 SET status = 'completed', updated_at = NOW() 
                 WHERE session_id = $1`,
                [sessionId]
            );
            
            console.log(`Using database signature for login: ${username}`);
            
        } catch (error) {
            console.error('Error retrieving login data:', error);
            return res.status(500).json({ error: 'Failed to retrieve login data' });
        } finally {
            client.release();
        }
    }
    
    // Continue with existing login logic...
    // [Rest of the login code remains the same]
});