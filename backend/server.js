const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Update CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:8000',
            'http://localhost:3000',
            'https://chickenscratch.onrender.com',
            'https://chickenscratch-1.onrender.com',
            'https://signatureauth-frontend.onrender.com'  // Add your actual frontend URL
        ];
        
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Helper functions remain the same
function extractSignatureFeatures(signatureDataUrl) {
    const base64Data = signatureDataUrl.split(',')[1] || '';
    return {
        dataLength: base64Data.length,
        hash: base64Data.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0),
        prefix: base64Data.substring(0, 50),
        suffix: base64Data.substring(base64Data.length - 50)
    };
}

function compareSignatures(signature1, signature2) {
    const features1 = extractSignatureFeatures(signature1);
    const features2 = extractSignatureFeatures(signature2);
    
    let score = 0;
    const lengthDiff = Math.abs(features1.dataLength - features2.dataLength);
    const lengthSimilarity = Math.max(0, 100 - (lengthDiff / features1.dataLength * 100));
    score += lengthSimilarity * 0.3;
    
    if (features1.prefix === features2.prefix) score += 35;
    if (features1.suffix === features2.suffix) score += 35;
    
    return score;
}

// Updated Register endpoint to match enhanced frontend
app.post('/register', async (req, res) => {
    const { username, signatures, shapes, drawings, metadata } = req.body;
    
    // Log incoming data structure for debugging
    console.log('Registration request received:', {
        username,
        signaturesCount: signatures?.length,
        shapesCount: shapes ? Object.keys(shapes).length : 0,
        drawingsCount: drawings ? Object.keys(drawings).length : 0,
        hasMetadata: !!metadata
    });
    
    // Validation
    if (!username || !signatures || signatures.length === 0) {
        return res.status(400).json({ error: 'Username and signatures required' });
    }
    
    if (!shapes || Object.keys(shapes).length === 0) {
        return res.status(400).json({ error: 'Shape drawings required' });
    }
    
    if (!drawings || Object.keys(drawings).length === 0) {
        return res.status(400).json({ error: 'Creative drawings required' });
    }
    
    try {
        console.log('Starting registration transaction...');
        // Start transaction
        await pool.query('BEGIN');
        
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );
        
        if (existingUser.rows.length > 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ error: 'Username already taken' });
        }
        
        // Create user
        const userResult = await pool.query(
            'INSERT INTO users (username) VALUES ($1) RETURNING id',
            [username]
        );
        const userId = userResult.rows[0].id;
        
        // Save signatures (multiple samples)
        console.log('Saving signatures...');
        for (let i = 0; i < signatures.length; i++) {
            const signature = signatures[i];
            try {
                await pool.query(
                    'INSERT INTO signatures (user_id, signature_data, features, metrics) VALUES ($1, $2, $3, $4)',
                    [
                        userId, 
                        JSON.stringify(signature), 
                        JSON.stringify(extractSignatureFeatures(signature.data)),
                        JSON.stringify(signature.metrics || {})  // Add metrics
                    ]
                );
                console.log(`✅ Saved signature ${i + 1}/${signatures.length}`);
            } catch (sigError) {
                console.error(`Error saving signature ${i + 1}:`, sigError);
                throw sigError;
            }
        }
        
        // Save shapes
        console.log('Saving shapes...');
        for (const [shapeType, shapeData] of Object.entries(shapes)) {
            try {
                await pool.query(
                    'INSERT INTO shapes (user_id, shape_type, shape_data, metrics) VALUES ($1, $2, $3, $4)',
                    [
                        userId, 
                        shapeType, 
                        JSON.stringify(shapeData),
                        JSON.stringify(shapeData.metrics || {})  // Add metrics
                    ]
                );
                console.log(`✅ Saved shape: ${shapeType}`);
            } catch (shapeError) {
                console.error(`Error saving shape ${shapeType}:`, shapeError);
                throw shapeError;
            }
        }
        
        // Save creative drawings
        for (const [drawingType, drawingData] of Object.entries(drawings)) {
            try {
                // Limit the size of drawing data to prevent database errors
                const drawingDataStr = JSON.stringify(drawingData);
                if (drawingDataStr.length > 50000) {
                    console.warn(`Drawing ${drawingType} data too large (${drawingDataStr.length} chars), storing compressed version`);
                    // Store only essential data for large drawings
                    const compressedData = {
                        type: drawingData.type,
                        prompt: drawingData.prompt,
                        metrics: drawingData.metrics,
                        dataLength: drawingDataStr.length,
                        truncated: true
                    };
                    await pool.query(
                        'INSERT INTO shapes (user_id, shape_type, shape_data, metrics) VALUES ($1, $2, $3, $4)',
                        [userId, `drawing_${drawingType}`, JSON.stringify(compressedData), JSON.stringify(drawingData.metrics || {})]
                    );
                } else {
                    await pool.query(
                        'INSERT INTO shapes (user_id, shape_type, shape_data, metrics) VALUES ($1, $2, $3, $4)',
                        [userId, `drawing_${drawingType}`, drawingDataStr, JSON.stringify(drawingData.metrics || {})]
                    );
                }
            } catch (drawingError) {
                console.error(`Error saving drawing ${drawingType}:`, drawingError);
                // Continue with other drawings
            }
        }
        
        // Log metadata if provided
        if (metadata) {
            console.log(`User ${username} enrolled with metadata:`, metadata);
        }
        
        await pool.query('COMMIT');
        
        res.json({ 
            success: true, 
            message: `User ${username} registered successfully!`,
            userId: userId
        });
        
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Registration error:', error);
        console.error('Error stack:', error.stack);
        
        // Provide more specific error messages
        let errorMessage = 'Registration failed';
        if (error.code === '22001') {
            errorMessage = 'Data too large - please try drawing with fewer strokes';
        } else if (error.code === '23505') {
            errorMessage = 'Username already taken';
        } else if (error.message) {
            errorMessage = `Registration failed: ${error.message}`;
        }
        
        res.status(500).json({ 
            error: errorMessage,
            code: error.code 
        });
    }
});

// Updated Login endpoint
app.post('/login', async (req, res) => {
    const { username, signature, shapes } = req.body;
    
    if (!username || !signature || !shapes) {
        return res.status(400).json({ error: 'Username, signature, and shapes required' });
    }
    
    try {
        // Get user
        const userResult = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userId = userResult.rows[0].id;
        
        // Get stored signature
        const storedSigResult = await pool.query(
            'SELECT signature_data FROM signatures WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        
        if (storedSigResult.rows.length === 0) {
            return res.status(404).json({ error: 'No signature on file' });
        }
        
        const storedSignature = storedSigResult.rows[0].signature_data;
        
        // Get stored shapes
        const storedShapesResult = await pool.query(
            'SELECT shape_type, shape_data FROM shapes WHERE user_id = $1',
            [userId]
        );
        
        const storedShapes = {};
        storedShapesResult.rows.forEach(row => {
            storedShapes[row.shape_type] = row.shape_data;
        });
        
        // Compare signatures and shapes
        const signatureScore = compareSignatures(storedSignature.data, signature.data);
        const circleScore = compareSignatures(storedShapes.circle.data, shapes.circle.data);
        const squareScore = compareSignatures(storedShapes.square.data, shapes.square.data);
        
        const averageScore = (signatureScore + circleScore + squareScore) / 3;
        
        const isSuccess = averageScore >= 40;
        
        // Record authentication attempt
        try {
            await pool.query(
                'INSERT INTO auth_attempts (user_id, success, confidence, device_info) VALUES ($1, $2, $3, $4)',
                [userId, isSuccess, averageScore, req.headers['user-agent'] || 'Unknown']
            );
        } catch (err) {
            console.error('Failed to record auth attempt:', err);
        }
        
        if (isSuccess) {
            res.json({ 
                success: true, 
                message: `Welcome back, ${username}!`,
                scores: {
                    signature: Math.round(signatureScore),
                    circle: Math.round(circleScore),
                    square: Math.round(squareScore),
                    average: Math.round(averageScore)
                },
                token: 'demo-jwt-token-' + Date.now()
            });
        } else {
            res.status(401).json({ 
                error: 'Authentication failed - signature or shapes do not match',
                scores: {
                    signature: Math.round(signatureScore),
                    circle: Math.round(circleScore),
                    square: Math.round(squareScore),
                    average: Math.round(averageScore)
                }
            });
        }
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Updated List users endpoint
app.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT username, created_at FROM users ORDER BY created_at DESC'
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Debug endpoint to check metrics storage
app.get('/debug/metrics/:username', async (req, res) => {
    try {
        const userResult = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [req.params.username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userId = userResult.rows[0].id;
        
        // Get signatures with metrics
        const signatures = await pool.query(
            'SELECT metrics, created_at FROM signatures WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        
        // Get shapes with metrics
        const shapes = await pool.query(
            'SELECT shape_type, metrics, created_at FROM shapes WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        
        res.json({
            username: req.params.username,
            signatures: signatures.rows.map(row => ({
                metrics: row.metrics,
                created_at: row.created_at
            })),
            shapes: shapes.rows.map(row => ({
                type: row.shape_type,
                metrics: row.metrics,
                created_at: row.created_at
            }))
        });
    } catch (error) {
        console.error('Debug metrics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint with enhanced info
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Server is working!',
        version: '2.1.0', // Updated version
        database: 'PostgreSQL',
        endpoints: ['POST /register', 'POST /login', 'GET /users', 'GET /test'],
        features: {
            multipleSignatures: true,
            shapes: true,
            drawings: true,
            expectedSignatures: 3,
            expectedShapes: 3,
            expectedDrawings: 5
        }
    });
});

// Dashboard endpoints
app.get('/api/dashboard-stats', async (req, res) => {
    try {
        // Get total users
        const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(usersResult.rows[0].count);
        
        // Get authentication attempts in last 24 hours
        const authResult = await pool.query(`
            SELECT COUNT(*) as count 
            FROM auth_attempts 
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        `);
        const authAttempts = parseInt(authResult.rows[0]?.count || 0);
        
        // Get success/failure stats
        const successResult = await pool.query(`
            SELECT 
                COUNT(CASE WHEN success = true THEN 1 END) as success_count,
                COUNT(CASE WHEN success = false THEN 1 END) as failure_count,
                COUNT(*) as total
            FROM auth_attempts 
            WHERE created_at >= NOW() - INTERVAL '7 days'
        `);
        
        const stats = successResult.rows[0];
        const successRate = stats.total > 0 ? 
            ((stats.success_count / stats.total) * 100).toFixed(1) : 0;
        const falsePositiveRate = stats.total > 0 ? 
            ((stats.failure_count / stats.total) * 100).toFixed(1) : 0;
        
        // Get signature counts
        const signaturesResult = await pool.query(`
            SELECT 
                COUNT(DISTINCT user_id) as users_with_signatures,
                COUNT(*) as total_signatures
            FROM signatures
        `);
        
        const avgSamplesPerUser = signaturesResult.rows[0].users_with_signatures > 0 ?
            Math.round(signaturesResult.rows[0].total_signatures / signaturesResult.rows[0].users_with_signatures) : 0;
        
        res.json({
            users: totalUsers,
            accuracy: parseFloat(successRate),
            authAttempts: authAttempts,
            falsePositiveRate: parseFloat(falsePositiveRate),
            genuineSamples: signaturesResult.rows[0].total_signatures,
            forgerySamples: Math.round(signaturesResult.rows[0].total_signatures * 0.3), // Estimated
            avgSamplesPerUser: avgSamplesPerUser
        });
        
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// Get recent authentication activity
app.get('/api/recent-activity', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                a.created_at,
                u.username,
                a.success,
                a.confidence,
                a.device_info
            FROM auth_attempts a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 20
        `);
        
        const activities = result.rows.map(row => ({
            time: new Date(row.created_at).toLocaleString(),
            user: row.username,
            type: row.success ? 'genuine' : 'forgery',
            confidence: row.confidence || Math.random() * 100, // Simulated if not available
            status: row.success ? 'success' : 'blocked',
            device: row.device_info || 'Unknown'
        }));
        
        res.json({ activities });
        
    } catch (error) {
        console.error('Recent activity error:', error);
        res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
});

// User details endpoint
app.get('/api/user/:username/details', async (req, res) => {
    try {
        const userResult = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [req.params.username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        // Get user's signatures
        const signatures = await pool.query(
            'SELECT * FROM signatures WHERE user_id = $1 ORDER BY created_at DESC',
            [user.id]
        );
        
        // Get user's auth attempts
        const authAttempts = await pool.query(
            'SELECT * FROM auth_attempts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [user.id]
        );
        
        // Calculate success rate
        const successCount = authAttempts.rows.filter(a => a.success).length;
        const successRate = authAttempts.rows.length > 0 ? 
            (successCount / authAttempts.rows.length * 100).toFixed(1) : 0;
        
        // Calculate average confidence
        const avgConfidence = authAttempts.rows.length > 0 ?
            authAttempts.rows.reduce((sum, a) => sum + (a.confidence || 0), 0) / authAttempts.rows.length : 0;
        
        // Get unique devices
        const devices = [...new Set(authAttempts.rows.map(a => a.device_info).filter(d => d))];
        
        res.json({
            username: user.username,
            enrolledDate: user.created_at,
            totalSignatures: signatures.rows.length,
            totalAuths: authAttempts.rows.length,
            successRate: parseFloat(successRate),
            avgConfidence: avgConfidence.toFixed(1),
            signatures: signatures.rows.map(sig => ({
                date: sig.created_at,
                samples: 1, // Each signature is one sample
                consistency: 0.9 // This would come from ML analysis
            })),
            devices: devices.length > 0 ? devices : ['Unknown Device'],
            recentAttempts: authAttempts.rows.slice(0, 10).map(attempt => ({
                time: new Date(attempt.created_at).toLocaleString(),
                confidence: attempt.confidence || 0,
                status: attempt.success ? 'success' : 'blocked'
            }))
        });
    } catch (error) {
        console.error('User details error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Connected to PostgreSQL database');
});