const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Enable CORS for frontend
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// In-memory storage (just for demo - resets when server restarts)
const users = {};

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
    
    // In a real app, you'd compare signatures properly
    // For demo, we'll just check they're not empty
    if (signature && users[username].signature) {
        res.json({ 
            success: true, 
            message: `Welcome back, ${username}!`,
            token: 'demo-jwt-token-' + Date.now()
        });
    } else {
        res.status(401).json({ error: 'Invalid signature' });
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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
});