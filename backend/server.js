const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// In-memory storage (just for demo - resets when server restarts)
const users = {};

// Add this function after your imports but before the endpoints
function extractSignatureFeatures(signatureDataUrl) {
    // Extract basic features from the signature data
    // In a real app, you'd use image processing, but for demo we'll use simpler metrics
    
    // Remove the data URL prefix to get just the base64 data
    const base64Data = signatureDataUrl.split(',')[1] || '';
    
    return {
        // Length of the signature data (indicates complexity)
        dataLength: base64Data.length,
        // Simple hash to create a fingerprint
        hash: base64Data.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0),
        // Store first and last parts for basic comparison
        prefix: base64Data.substring(0, 50),
        suffix: base64Data.substring(base64Data.length - 50)
    };
}

function compareSignatures(signature1, signature2) {
    const features1 = extractSignatureFeatures(signature1);
    const features2 = extractSignatureFeatures(signature2);
    
    // Calculate similarity score (0-100)
    let score = 0;
    
    // Compare data length (size similarity)
    const lengthDiff = Math.abs(features1.dataLength - features2.dataLength);
    const lengthSimilarity = Math.max(0, 100 - (lengthDiff / features1.dataLength * 100));
    score += lengthSimilarity * 0.3; // 30% weight
    
    // Compare prefix and suffix (stroke similarity)
    if (features1.prefix === features2.prefix) score += 35;
    if (features1.suffix === features2.suffix) score += 35;
    
    return score;
}

// Register endpoint - save signature
app.post('/register', (req, res) => {
    const { username, signature } = req.body;
    
    if (!username || !signature) {
        return res.status(400).json({ error: 'Username and signature required' });
    }
    
    // Store user's signature
    users[username] = {
        signature: signature,
        registeredAt: new Date()
    };
    
    res.json({ 
        success: true, 
        message: `User ${username} registered successfully!` 
    });
});

// Login endpoint - check signature
app.post('/login', (req, res) => {
    const { username, signature } = req.body;
    
    if (!username || !signature) {
        return res.status(400).json({ error: 'Username and signature required' });
    }
    
    // Check if user exists
    if (!users[username]) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Compare signatures
    const similarityScore = compareSignatures(users[username].signature, signature);
    
    // Require at least 70% similarity
    if (similarityScore >= 70) {
        res.json({ 
            success: true, 
            message: `Welcome back, ${username}!`,
            similarityScore: Math.round(similarityScore),
            token: 'demo-jwt-token-' + Date.now()
        });
    } else {
        res.status(401).json({ 
            error: 'Signature does not match',
            similarityScore: Math.round(similarityScore),
            hint: 'Try signing more similarly to your registration signature'
        });
    }
});

// List users endpoint (for debugging)
app.get('/users', (req, res) => {
    const userList = Object.keys(users).map(username => ({
        username,
        registeredAt: users[username].registeredAt
    }));
    res.json(userList);
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Server is working!',
        version: '1.0.1',
        endpoints: ['POST /register', 'POST /login', 'GET /users', 'GET /test']
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
});