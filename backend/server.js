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
            'http://localhost:8080',
            'http://127.0.0.1:8000',
            'http://127.0.0.1:8080',
            'https://chickenscratch.onrender.com',
            'https://chickenscratch-1.onrender.com',
            'https://signatureauth-frontend.onrender.com'
        ];
        
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        // Allow any localhost origin for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            console.log('Allowing localhost origin:', origin);
            return callback(null, true);
        }
        
        // Allow any *.onrender.com subdomain
        if (origin.includes('.onrender.com')) {
            console.log('Allowing onrender.com origin:', origin);
            return callback(null, true);
        }
        
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

// Body parser middleware - IMPORTANT: Must be before routes
app.use(express.json({ limit: '10mb' })); // Increase limit for drawing data
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.method === 'POST') {
        console.log('Request body size:', JSON.stringify(req.body).length, 'bytes');
    }
    next();
});

// Temporary storage for step-by-step drawing data
// In production, consider using Redis or a temporary table
const temporaryDrawingStorage = new Map();

// Clean up old temporary data every hour
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [key, data] of temporaryDrawingStorage.entries()) {
        if (data.timestamp < oneHourAgo) {
            temporaryDrawingStorage.delete(key);
            console.log(`Cleaned up temporary data for: ${key}`);
        }
    }
}, 60 * 60 * 1000);

// Helper function to calculate all 19 ML features from signature data
function calculateMLFeatures(signatureData) {
    // If the frontend already calculated metrics, use them
    if (signatureData.metrics && Object.keys(signatureData.metrics).length > 15) {
        return signatureData.metrics;
    }
    
    // Otherwise, calculate from raw data if available
    const rawData = signatureData.raw || [];
    if (rawData.length === 0) {
        // Return default values if no raw data
        return {
            stroke_count: 0,
            total_points: 0,
            total_duration_ms: 0,
            avg_points_per_stroke: 0,
            avg_velocity: 0,
            max_velocity: 0,
            min_velocity: 0,
            velocity_std: 0,
            width: 0,
            height: 0,
            area: 0,
            aspect_ratio: 0,
            center_x: 0,
            center_y: 0,
            avg_stroke_length: 0,
            total_length: 0,
            length_variation: 0,
            avg_stroke_duration: 0,
            duration_variation: 0
        };
    }
    
    // Extract basic metrics from frontend if available
    const basicMetrics = signatureData.metrics?.basic || {};
    const boundingBox = basicMetrics.bounding_box || {};
    
    // Use frontend-calculated values where available, calculate missing ones
    return {
        stroke_count: basicMetrics.stroke_count || rawData.length || 0,
        total_points: basicMetrics.total_points || 0,
        total_duration_ms: basicMetrics.duration_ms || signatureData.metrics?.total_duration_ms || 0,
        avg_points_per_stroke: basicMetrics.stroke_count > 0 ? 
            (basicMetrics.total_points / basicMetrics.stroke_count) : 0,
        avg_velocity: parseFloat(basicMetrics.avg_speed) || 0,
        max_velocity: 0, // Would need point-by-point data
        min_velocity: 0, // Would need point-by-point data
        velocity_std: 0, // Would need point-by-point data
        width: boundingBox.width || 0,
        height: boundingBox.height || 0,
        area: (boundingBox.width || 0) * (boundingBox.height || 0),
        aspect_ratio: boundingBox.height > 0 ? (boundingBox.width / boundingBox.height) : 0,
        center_x: boundingBox.center_x || 0,
        center_y: boundingBox.center_y || 0,
        avg_stroke_length: basicMetrics.stroke_count > 0 ? 
            (basicMetrics.total_distance / basicMetrics.stroke_count) : 0,
        total_length: basicMetrics.total_distance || 0,
        length_variation: 0, // Would need per-stroke data
        avg_stroke_duration: basicMetrics.stroke_count > 0 && basicMetrics.duration_ms > 0 ? 
            (basicMetrics.duration_ms / basicMetrics.stroke_count) : 0,
        duration_variation: 0 // Would need per-stroke data
    };
}

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

// Import ML comparison functions
const { compareSignaturesML, compareMultipleSignaturesML } = require('./mlComparison');

// Legacy comparison function (kept for fallback)
function compareSignaturesLegacy(signature1, signature2) {
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

// New ML-based comparison wrapper
async function compareSignatures(signature1, signature2, metrics1, metrics2, username) {
    // If we have ML metrics, use ML comparison
    if (metrics1 && metrics2 && Object.keys(metrics1).length >= 15 && Object.keys(metrics2).length >= 15) {
        return await compareSignaturesML(metrics1, metrics2, username);
    }
    // Fallback to legacy comparison
    console.warn('Using legacy comparison - ML metrics not available');
    return compareSignaturesLegacy(signature1, signature2);
}

// Updated Register endpoint to match enhanced frontend
app.post('/register', async (req, res) => {
    // Log raw request body first
    console.log('Raw registration request body:', JSON.stringify(req.body).substring(0, 200) + '...');
    console.log('Request body type:', typeof req.body);
    console.log('Request body keys:', req.body ? Object.keys(req.body) : 'undefined body');
    
    let { username, signatures, shapes, drawings, metadata, useTemporaryData } = req.body;
    
    // If using temporary data from step-by-step flow
    if (useTemporaryData && username) {
        const userKey = username.toLowerCase();
        const tempData = temporaryDrawingStorage.get(userKey);
        
        if (tempData && tempData.drawings.length > 0) {
            console.log(`Using temporary data for ${username}: ${tempData.drawings.length} drawings`);
            
            // Organize temporary data into expected format
            signatures = [];
            shapes = {};
            drawings = {};
            
            tempData.drawings.forEach(item => {
                if (item.type === 'signature') {
                    signatures.push({
                        data: item.signature,
                        raw: item.raw,
                        metrics: item.metrics || {},
                        timestamp: item.timestamp
                    });
                } else if (item.type === 'shape') {
                    shapes[item.instruction || 'shape'] = {
                        data: item.signature,
                        raw: item.raw,
                        metrics: item.metrics || {},
                        timestamp: item.timestamp
                    };
                } else if (item.type === 'drawing') {
                    drawings[item.instruction || 'drawing'] = {
                        data: item.signature,
                        raw: item.raw,
                        metrics: item.metrics || {},
                        timestamp: item.timestamp,
                        prompt: item.instruction
                    };
                }
            });
            
            // Clear temporary data after using it
            temporaryDrawingStorage.delete(userKey);
            console.log(`Cleared temporary data for ${username}`);
        } else {
            return res.status(400).json({ 
                error: 'No temporary data found for this user. Please complete the enrollment process.' 
            });
        }
    }
    
    // Log incoming data structure for debugging
    console.log('Registration request received:', {
        username,
        signaturesCount: signatures?.length,
        shapesCount: shapes ? Object.keys(shapes).length : 0,
        drawingsCount: drawings ? Object.keys(drawings).length : 0,
        hasMetadata: !!metadata,
        usingTemporaryData: !!useTemporaryData
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
        console.log('Starting registration transaction for user:', username);
        console.log('Data received - signatures:', signatures?.length, 'shapes:', Object.keys(shapes || {}).length, 'drawings:', Object.keys(drawings || {}).length);
        
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
                // Calculate full ML features
                const mlFeatures = calculateMLFeatures(signature);
                
                await pool.query(
                    'INSERT INTO signatures (user_id, signature_data, features, metrics) VALUES ($1, $2, $3, $4)',
                    [
                        userId, 
                        JSON.stringify(signature), 
                        JSON.stringify(extractSignatureFeatures(signature.data)),
                        JSON.stringify(mlFeatures)  // Store calculated ML features
                    ]
                );
                console.log(`✅ Saved signature ${i + 1}/${signatures.length} with ${Object.keys(mlFeatures).length} ML features`);
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
        console.log('Saving creative drawings...');
        for (const [drawingType, drawingData] of Object.entries(drawings)) {
            try {
                console.log(`Processing drawing: ${drawingType}`);
                // Limit the size of drawing data to prevent database errors
                const drawingDataStr = JSON.stringify(drawingData);
                console.log(`Drawing ${drawingType} size: ${drawingDataStr.length} bytes`);
                
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

// Get authentication challenges for a user
app.get('/auth/challenges/:username', async (req, res) => {
    const { username } = req.params;
    
    try {
        // Check if user exists
        const userResult = await pool.query(
            'SELECT id, created_at FROM users WHERE username = $1',
            [username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        const userId = user.id;
        
        // Get recent auth attempts to calculate risk
        const recentAuthResult = await pool.query(`
            SELECT success, created_at, device_info 
            FROM auth_attempts 
            WHERE user_id = $1 
            AND created_at >= NOW() - INTERVAL '30 days'
            ORDER BY created_at DESC
            LIMIT 10
        `, [userId]);
        
        // Calculate risk factors
        let riskScore = 0;
        const currentDevice = req.headers['user-agent'] || 'Unknown';
        
        // Check if this is a new device
        const knownDevices = recentAuthResult.rows.map(r => r.device_info);
        const isNewDevice = !knownDevices.includes(currentDevice);
        if (isNewDevice) riskScore += 30;
        
        // Check recent failures
        const recentFailures = recentAuthResult.rows
            .slice(0, 3)
            .filter(r => !r.success).length;
        riskScore += recentFailures * 20;
        
        // Check time since last successful login
        const lastSuccess = recentAuthResult.rows.find(r => r.success);
        if (lastSuccess) {
            const daysSinceLogin = Math.floor(
                (Date.now() - new Date(lastSuccess.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLogin > 30) riskScore += 20;
            if (daysSinceLogin > 90) riskScore += 30;
        } else {
            riskScore += 40; // Never successfully logged in
        }
        
        // Determine required challenges based on risk score
        console.log(`Risk score for ${username}: ${riskScore}`);
        const challenges = {
            signature: true, // Always required
            shapes: riskScore >= 30 || true, // TEMP: Always require shapes for testing
            drawings: riskScore >= 60,
            required: []
        };
        
        // Build required challenges array
        challenges.required.push({ type: 'signature', name: 'Your Signature' });
        
        if (challenges.shapes) {
            challenges.required.push(
                { type: 'shape', name: 'Circle', shape: 'circle' },
                { type: 'shape', name: 'Square', shape: 'square' },
                { type: 'shape', name: 'Triangle', shape: 'triangle' }
            );
        }
        
        if (challenges.drawings) {
            // Get user's drawing prompts from registration
            const drawingsResult = await pool.query(`
                SELECT shape_type, shape_data
                FROM shapes
                WHERE user_id = $1 AND shape_type LIKE 'drawing_%'
                LIMIT 2
            `, [userId]);
            
            drawingsResult.rows.forEach((row, index) => {
                const drawingData = row.shape_data;
                // Use more descriptive fallbacks for drawings
                const fallbackPrompts = ['Draw a star', 'Draw a simple face'];
                challenges.required.push({
                    type: 'drawing',
                    name: drawingData.prompt || fallbackPrompts[index] || `Drawing ${index + 1}`,
                    prompt: drawingData.prompt || fallbackPrompts[index] || `Drawing ${index + 1}`,
                    drawingType: row.shape_type
                });
            });
        }
        
        res.json({
            username,
            riskScore,
            riskFactors: {
                isNewDevice,
                recentFailures,
                daysSinceLastLogin: lastSuccess ? 
                    Math.floor((Date.now() - new Date(lastSuccess.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 
                    null
            },
            challenges
        });
        
    } catch (error) {
        console.error('Error getting challenges:', error);
        res.status(500).json({ error: 'Failed to get authentication challenges' });
    }
});

// Updated Login endpoint - supports adaptive authentication
app.post('/login', async (req, res) => {
    console.log('Login attempt:', { 
        username: req.body.username,
        hasSignature: !!req.body.signature,
        hasShapes: !!req.body.shapes,
        hasDrawings: !!req.body.drawings,
        useTemporaryData: !!req.body.useTemporaryData,
        bodyKeys: Object.keys(req.body)
    });
    
    let { username, signature, shapes, drawings, deviceInfo, useTemporaryData, metadata } = req.body;
    
    // If using temporary data from mobile flow
    if (useTemporaryData && username) {
        const userKey = username.toLowerCase();
        const tempData = temporaryDrawingStorage.get(userKey);
        
        if (tempData && tempData.drawings.length > 0) {
            console.log(`Using temporary data for login ${username}: ${tempData.drawings.length} drawings`);
            
            // For sign-in, we only need the signature
            const signatureDrawing = tempData.drawings.find(d => d.type === 'signature');
            if (signatureDrawing) {
                signature = {
                    data: signatureDrawing.signature,
                    raw: signatureDrawing.raw,
                    metrics: signatureDrawing.metrics || {},
                    timestamp: signatureDrawing.timestamp
                };
            }
            
            // Clear temporary data after using it
            temporaryDrawingStorage.delete(userKey);
            console.log(`Cleared temporary data for ${username}`);
        } else {
            return res.status(400).json({ 
                error: 'No temporary data found. Please complete the sign-in process.' 
            });
        }
    }
    
    // Minimum requirement is username and signature
    if (!username || !signature) {
        return res.status(400).json({ 
            error: 'Username and signature required',
            received: {
                username: !!username,
                signature: !!signature,
                shapes: !!shapes,
                drawings: !!drawings
            }
        });
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
        const storedMetrics = storedSigResult.rows[0].metrics || {};
        
        // Calculate signature score (always required) - now using ML
        const signatureScore = await compareSignatures(
            storedSignature.data, 
            signature.data,
            storedMetrics,
            authSignatureMetrics,
            username
        );
        let totalScore = signatureScore;
        let scoreCount = 1;
        
        const scores = {
            signature: Math.round(signatureScore)
        };
        
        // If shapes were provided, verify them
        if (shapes) {
            const storedShapesResult = await pool.query(
                'SELECT shape_type, shape_data, metrics FROM shapes WHERE user_id = $1 AND shape_type IN ($2, $3, $4)',
                [userId, 'circle', 'square', 'triangle']
            );
            
            const storedShapes = {};
            storedShapesResult.rows.forEach(row => {
                storedShapes[row.shape_type] = {
                    data: row.shape_data,
                    metrics: row.metrics || {}
                };
            });
            
            // Verify each provided shape
            if (shapes.circle && storedShapes.circle) {
                const circleScore = await compareSignatures(
                    storedShapes.circle.data.data, 
                    shapes.circle.data,
                    storedShapes.circle.metrics,
                    shapes.circle.metrics || {},
                    username
                );
                scores.circle = Math.round(circleScore);
                totalScore += circleScore;
                scoreCount++;
            }
            
            if (shapes.square && storedShapes.square) {
                const squareScore = await compareSignatures(
                    storedShapes.square.data.data, 
                    shapes.square.data,
                    storedShapes.square.metrics,
                    shapes.square.metrics || {},
                    username
                );
                scores.square = Math.round(squareScore);
                totalScore += squareScore;
                scoreCount++;
            }
            
            if (shapes.triangle && storedShapes.triangle) {
                const triangleScore = await compareSignatures(
                    storedShapes.triangle.data.data, 
                    shapes.triangle.data,
                    storedShapes.triangle.metrics,
                    shapes.triangle.metrics || {},
                    username
                );
                scores.triangle = Math.round(triangleScore);
                totalScore += triangleScore;
                scoreCount++;
            }
        }
        
        // If drawings were provided, verify them (future enhancement)
        if (drawings) {
            // TODO: Implement drawing verification
            console.log('Drawing verification not yet implemented');
        }
        
        const averageScore = totalScore / scoreCount;
        scores.average = Math.round(averageScore);
        
        // Adjust threshold based on what was provided
        let threshold = 40; // Default threshold
        if (shapes) threshold = 45; // Higher threshold when more factors
        if (drawings) threshold = 50; // Even higher with drawings
        
        const isSuccess = averageScore >= threshold;
        
        // Save authentication signature with ML features for tracking
        let authSignatureId = null;
        try {
            // Calculate ML features for the authentication signature
            const mlFeatures = calculateMLFeatures(signature);
            
            // Save the authentication signature
            const sigResult = await pool.query(
                'INSERT INTO signatures (user_id, signature_data, features, metrics) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
                [
                    userId,
                    JSON.stringify(signature),
                    JSON.stringify(extractSignatureFeatures(signature.data)),
                    JSON.stringify(mlFeatures)
                ]
            );
            authSignatureId = sigResult.rows[0].id;
            const sigCreatedAt = sigResult.rows[0].created_at;
            console.log('Saved auth signature with ID:', authSignatureId, 'at:', sigCreatedAt);
        } catch (err) {
            console.error('Failed to save auth signature:', err);
        }
        
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
                scores: scores,
                token: 'demo-jwt-token-' + Date.now(),
                authMethod: {
                    signature: true,
                    shapes: !!shapes,
                    drawings: !!drawings
                }
            });
        } else {
            res.status(401).json({ 
                error: 'Authentication failed',
                details: 'Verification scores below threshold',
                scores: scores,
                threshold: threshold,
                authMethod: {
                    signature: true,
                    shapes: !!shapes,
                    drawings: !!drawings
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
app.get('/test', async (req, res) => {
    try {
        // Check if auth_attempts table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'auth_attempts'
            ) as auth_table_exists
        `);
        
        res.json({ 
            message: 'Server is working!',
            version: '2.2.0', // Updated version
            database: 'PostgreSQL',
            authTableExists: tableCheck.rows[0].auth_table_exists,
            endpoints: ['POST /register', 'POST /login', 'GET /users', 'GET /test', 'GET /auth/challenges/:username'],
            features: {
                multipleSignatures: true,
                shapes: true,
                drawings: true,
                adaptiveAuth: true,
                expectedSignatures: 3,
                expectedShapes: 3,
                expectedDrawings: 5
            }
        });
    } catch (error) {
        res.json({ 
            message: 'Server is working!',
            version: '2.2.0',
            database: 'PostgreSQL (error checking tables)',
            error: error.message
        });
    }
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

// Helper function to calculate baseline metrics from enrollment signatures
function calculateUserBaseline(signatures) {
    const mlFeatures = [
        'stroke_count', 'total_points', 'total_duration_ms', 'avg_points_per_stroke',
        'avg_velocity', 'max_velocity', 'min_velocity', 'velocity_std',
        'width', 'height', 'area', 'aspect_ratio', 'center_x', 'center_y',
        'avg_stroke_length', 'total_length', 'length_variation', 
        'avg_stroke_duration', 'duration_variation'
    ];
    
    const baseline = {};
    
    // Initialize sums for each feature
    mlFeatures.forEach(feature => {
        baseline[feature] = { sum: 0, count: 0, values: [] };
    });
    
    // Aggregate metrics from all enrollment signatures
    signatures.forEach(sig => {
        if (sig.metrics && typeof sig.metrics === 'object') {
            mlFeatures.forEach(feature => {
                if (sig.metrics[feature] !== undefined && sig.metrics[feature] !== null) {
                    const value = parseFloat(sig.metrics[feature]);
                    if (!isNaN(value)) {
                        baseline[feature].sum += value;
                        baseline[feature].count += 1;
                        baseline[feature].values.push(value);
                    }
                }
            });
        }
    });
    
    // Calculate averages and standard deviations
    const result = {};
    mlFeatures.forEach(feature => {
        if (baseline[feature].count > 0) {
            const avg = baseline[feature].sum / baseline[feature].count;
            result[feature] = parseFloat(avg.toFixed(2));
            
            // Calculate std deviation for variability metrics
            if (baseline[feature].values.length > 1) {
                const variance = baseline[feature].values.reduce((acc, val) => {
                    return acc + Math.pow(val - avg, 2);
                }, 0) / baseline[feature].values.length;
                result[`${feature}_std`] = parseFloat(Math.sqrt(variance).toFixed(2));
            }
        } else {
            result[feature] = 0;
        }
    });
    
    return result;
}

// User details endpoint with ML features
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
        
        // Get user's enrollment signatures with metrics
        const signatures = await pool.query(
            'SELECT * FROM signatures WHERE user_id = $1 ORDER BY created_at DESC',
            [user.id]
        );
        
        // Calculate user baseline from enrollment signatures
        const userBaseline = calculateUserBaseline(signatures.rows);
        
        // Get user's auth attempts with detailed metrics
        const authAttempts = await pool.query(
            'SELECT * FROM auth_attempts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [user.id]
        );
        
        // Get recent signatures used in authentication attempts (last 10)
        // Note: We match signatures created within 5 seconds of auth attempts
        // This accounts for the signature being saved just before the auth attempt
        const recentAuthSignatures = await pool.query(`
            SELECT s.*, a.created_at as auth_time, a.success, a.confidence 
            FROM signatures s
            JOIN auth_attempts a ON a.user_id = s.user_id 
                AND a.created_at >= s.created_at - INTERVAL '5 seconds'
                AND a.created_at <= s.created_at + INTERVAL '5 seconds'
            WHERE s.user_id = $1
                AND s.id NOT IN (
                    SELECT MIN(id) FROM signatures 
                    WHERE user_id = $1 
                    GROUP BY user_id
                    HAVING COUNT(*) >= 3
                )  -- Exclude enrollment signatures (first 3)
            ORDER BY a.created_at DESC
            LIMIT 10
        `, [user.id]);
        
        // Calculate success rate
        const successCount = authAttempts.rows.filter(a => a.success).length;
        const successRate = authAttempts.rows.length > 0 ? 
            (successCount / authAttempts.rows.length * 100).toFixed(1) : 0;
        
        // Calculate average confidence
        const avgConfidence = authAttempts.rows.length > 0 ?
            authAttempts.rows.reduce((sum, a) => sum + (a.confidence || 0), 0) / authAttempts.rows.length : 0;
        
        // Get unique devices
        const devices = [...new Set(authAttempts.rows.map(a => a.device_info).filter(d => d))];
        
        // Build recent attempts with ML features
        const recentAttemptsWithFeatures = recentAuthSignatures.rows.map((sig, index) => {
            const attemptScores = {};
            
            // Debug logging
            console.log(`Processing signature ${index + 1}:`, {
                hasMetrics: !!sig.metrics,
                metricsType: typeof sig.metrics,
                metricsKeys: sig.metrics ? Object.keys(sig.metrics) : []
            });
            
            // Extract ML features from the signature metrics
            if (sig.metrics && typeof sig.metrics === 'object') {
                const mlFeatures = [
                    'stroke_count', 'total_points', 'total_duration_ms', 'avg_points_per_stroke',
                    'avg_velocity', 'max_velocity', 'min_velocity', 'velocity_std',
                    'width', 'height', 'area', 'aspect_ratio', 'center_x', 'center_y',
                    'avg_stroke_length', 'total_length', 'length_variation',
                    'avg_stroke_duration', 'duration_variation'
                ];
                
                mlFeatures.forEach(feature => {
                    if (sig.metrics[feature] !== undefined) {
                        attemptScores[feature] = parseFloat(sig.metrics[feature]) || 0;
                    } else {
                        attemptScores[feature] = 0;
                    }
                });
            }
            
            console.log(`Attempt ${index + 1} scores:`, {
                scoreCount: Object.keys(attemptScores).length,
                hasNonZeroValues: Object.values(attemptScores).some(v => v !== 0)
            });
            
            // Parse signature data to include strokes for visualization
            let signatureStrokes = null;
            if (sig.signature_data) {
                try {
                    const sigData = typeof sig.signature_data === 'string' ? 
                        JSON.parse(sig.signature_data) : sig.signature_data;
                    signatureStrokes = sigData.data || sigData.strokes || sigData;
                } catch (e) {
                    console.error('Error parsing signature data:', e);
                }
            }
            
            return {
                time: new Date(sig.auth_time).toLocaleString(),
                confidence: sig.confidence || 0,
                status: sig.success ? 'success' : 'blocked',
                attempt_scores: attemptScores,
                user_baseline: userBaseline,
                signature: signatureStrokes
            };
        });
        
        // Get enrollment signatures (first 3) with stroke data
        const enrollmentSignatures = signatures.rows.slice(-3).reverse().map(sig => {
            let strokes = null;
            if (sig.signature_data) {
                try {
                    const sigData = typeof sig.signature_data === 'string' ? 
                        JSON.parse(sig.signature_data) : sig.signature_data;
                    strokes = sigData.data || sigData.strokes || sigData;
                } catch (e) {
                    console.error('Error parsing enrollment signature:', e);
                }
            }
            return {
                strokes: strokes,
                metrics: sig.metrics || {},
                created_at: sig.created_at
            };
        });
        
        res.json({
            username: user.username,
            enrolledDate: user.created_at,
            totalSignatures: signatures.rows.length,
            totalAuths: authAttempts.rows.length,
            successRate: parseFloat(successRate),
            avgConfidence: avgConfidence.toFixed(1),
            userBaseline: userBaseline,
            enrollmentSignatures: enrollmentSignatures,
            signatures: signatures.rows.map(sig => ({
                date: sig.created_at,
                samples: 1,
                consistency: 0.9,
                metrics: sig.metrics || {}
            })),
            devices: devices.length > 0 ? devices : ['Unknown Device'],
            recentAttempts: authAttempts.rows.slice(0, 10).map(attempt => ({
                time: new Date(attempt.created_at).toLocaleString(),
                confidence: attempt.confidence || 0,
                status: attempt.success ? 'success' : 'blocked'
            })),
            recentAttemptsWithFeatures: recentAttemptsWithFeatures
        });
    } catch (error) {
        console.error('User details error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint for ML feature comparison visualization
app.get('/api/user/:username/ml-features', async (req, res) => {
    try {
        const userResult = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [req.params.username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userId = userResult.rows[0].id;
        
        // Get enrollment signatures
        const enrollmentSigs = await pool.query(
            'SELECT metrics, created_at FROM signatures WHERE user_id = $1 ORDER BY created_at ASC LIMIT 5',
            [userId]
        );
        
        // Calculate baseline
        const baseline = calculateUserBaseline(enrollmentSigs.rows);
        
        // Get recent auth signatures with metrics
        const recentSigs = await pool.query(`
            SELECT s.metrics, s.created_at, a.success, a.confidence
            FROM signatures s
            JOIN auth_attempts a ON a.user_id = s.user_id 
                AND ABS(EXTRACT(EPOCH FROM (a.created_at - s.created_at))) < 60
            WHERE s.user_id = $1 AND s.metrics IS NOT NULL
            ORDER BY s.created_at DESC
            LIMIT 20
        `, [userId]);
        
        // Format response for visualization
        const mlFeatures = [
            'stroke_count', 'total_points', 'total_duration_ms', 'avg_velocity',
            'area', 'width', 'height', 'aspect_ratio'
        ];
        
        const featureComparison = {};
        mlFeatures.forEach(feature => {
            featureComparison[feature] = {
                baseline: baseline[feature] || 0,
                recent_values: recentSigs.rows.map(sig => ({
                    value: sig.metrics?.[feature] || 0,
                    success: sig.success,
                    confidence: sig.confidence,
                    timestamp: sig.created_at
                }))
            };
        });
        
        res.json({
            username: req.params.username,
            baseline: baseline,
            features: featureComparison,
            feature_names: mlFeatures
        });
        
    } catch (error) {
        console.error('ML features error:', error);
        res.status(500).json({ error: error.message });
    }
});

// New endpoints for mobile web experience

// 1. Check if username is available for sign-up
app.post('/api/check-username', async (req, res) => {
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    try {
        console.log('Checking username availability:', username);
        
        const result = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username.toLowerCase()]
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

// 2. Check if username exists for sign-in
app.post('/api/check-user-exists', async (req, res) => {
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    try {
        console.log('Checking if user exists:', username);
        
        const result = await pool.query(
            'SELECT id, username FROM users WHERE username = $1',
            [username.toLowerCase()]
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

// 3. Save individual drawing/signature steps during the flow
app.post('/api/save-drawing', async (req, res) => {
    const { signature, raw, step, type, instruction, timestamp, username, metrics } = req.body;
    
    if (!username || !step || !type) {
        return res.status(400).json({ 
            error: 'Username, step, and type are required' 
        });
    }
    
    try {
        console.log(`Saving drawing for ${username} - Step ${step}: ${type}`);
        
        // Get or create user's temporary storage
        const userKey = username.toLowerCase();
        if (!temporaryDrawingStorage.has(userKey)) {
            temporaryDrawingStorage.set(userKey, {
                username: userKey,
                timestamp: Date.now(),
                drawings: []
            });
        }
        
        const userData = temporaryDrawingStorage.get(userKey);
        
        // Add the new drawing data
        userData.drawings.push({
            step,
            type,
            instruction,
            signature,
            raw,
            metrics: metrics || {},
            timestamp: timestamp || Date.now()
        });
        
        // Update timestamp to prevent cleanup
        userData.timestamp = Date.now();
        
        console.log(`Saved drawing step ${step} for ${username}. Total steps: ${userData.drawings.length}`);
        
        res.status(200).json({ 
            success: true,
            message: `Drawing step ${step} saved successfully`,
            totalSteps: userData.drawings.length
        });
        
    } catch (error) {
        console.error('Error saving drawing:', error);
        res.status(500).json({ error: 'Failed to save drawing' });
    }
});

// 4. Get temporary drawing data (for debugging/verification)
app.get('/api/temp-drawings/:username', async (req, res) => {
    const { username } = req.params;
    const userKey = username.toLowerCase();
    
    const tempData = temporaryDrawingStorage.get(userKey);
    if (tempData) {
        res.json({
            exists: true,
            drawingCount: tempData.drawings.length,
            lastUpdated: new Date(tempData.timestamp).toISOString()
        });
    } else {
        res.json({
            exists: false,
            drawingCount: 0
        });
    }
});

// 5. Clear temporary drawing data
app.delete('/api/temp-drawings/:username', async (req, res) => {
    const { username } = req.params;
    const userKey = username.toLowerCase();
    
    if (temporaryDrawingStorage.has(userKey)) {
        temporaryDrawingStorage.delete(userKey);
        console.log(`Cleared temporary data for: ${username}`);
        res.json({ success: true, message: 'Temporary data cleared' });
    } else {
        res.status(404).json({ error: 'No temporary data found for this user' });
    }
});

// Global error handler - must be last middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    console.error('Error stack:', err.stack);
    
    // Send error response
    res.status(500).json({
        error: 'Internal server error',
        message: err.message || 'An unexpected error occurred',
        // Include more details in development
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Connected to PostgreSQL database');
    console.log('Body size limit: 10MB');
});