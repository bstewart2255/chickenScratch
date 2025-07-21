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
        for (const signature of signatures) {
            await pool.query(
                'INSERT INTO signatures (user_id, signature_data, features) VALUES ($1, $2, $3)',
                [userId, JSON.stringify(signature), JSON.stringify(extractSignatureFeatures(signature.data))]
            );
        }
        
        // Save shapes
        for (const [shapeType, shapeData] of Object.entries(shapes)) {
            await pool.query(
                'INSERT INTO shapes (user_id, shape_type, shape_data) VALUES ($1, $2, $3)',
                [userId, shapeType, JSON.stringify(shapeData)]
            );
        }
        
        // Save creative drawings
        for (const [drawingType, drawingData] of Object.entries(drawings)) {
            await pool.query(
                'INSERT INTO shapes (user_id, shape_type, shape_data) VALUES ($1, $2, $3)',
                [userId, `drawing_${drawingType}`, JSON.stringify(drawingData)]
            );
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
        res.status(500).json({ error: 'Registration failed: ' + error.message });
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
        
        if (averageScore >= 40) {
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

// Test endpoint remains the same
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Server is working!',
        version: '2.0.0', // Updated version
        database: 'PostgreSQL',
        endpoints: ['POST /register', 'POST /login', 'GET /users', 'GET /test']
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Connected to PostgreSQL database');
});