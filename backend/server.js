const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const { storeSignatureWithStrokeData, getSignatureData, extractStrokeData } = require('./update_to_stroke_storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'signatureauth'}`,
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
        
        // Log the origin for debugging
        console.log('CORS check - Origin:', origin || 'no-origin');
        
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        // Allow any localhost origin for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            console.log('Allowing localhost origin:', origin);
            return callback(null, true);
        }
        
        // Allow file:// protocol (for local testing)
        if (origin.startsWith('file://')) {
            console.log('Allowing file:// origin');
            return callback(null, true);
        }
        
        // Allow any *.onrender.com subdomain
        if (origin.includes('.onrender.com')) {
            console.log('Allowing onrender.com origin:', origin);
            return callback(null, true);
        }
        
        // Allow github.io pages
        if (origin.includes('github.io')) {
            console.log('Allowing github.io origin:', origin);
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

// Health check endpoint
app.get('/', (req, res) => {
    res.send('Signature Authentication API is running!');
});

// Basic health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'signature-auth-backend'
    });
});

// API health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'signature-auth-backend'
    });
});

// Dashboard stats (for monitor)
app.get('/api/dashboard/stats', (req, res) => {
    res.json({ 
        status: 'available',
        total_users: 0,  // You can make this dynamic later
        total_signatures: 0,
        timestamp: new Date().toISOString()
    });
});

// Recent activity (for monitor)
app.get('/api/recent-activity', (req, res) => {
    res.json({ 
        activities: [],
        status: 'available',
        timestamp: new Date().toISOString()
    });
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

// Import enhanced feature extraction module
const EnhancedFeatureExtractor = require('./enhanced-feature-extraction');
// Import component-specific features module
const ComponentSpecificFeatures = require('./component-specific-features');

// Feature flag for enhanced features (can be controlled via environment variable)
const ENABLE_ENHANCED_FEATURES = process.env.ENABLE_ENHANCED_FEATURES !== 'false'; // Default to true

// Helper function to calculate all ML features from signature data
function calculateMLFeatures(signatureData) {
    // First, calculate basic 19 features
    let basicFeatures;
    
    // If the frontend already calculated metrics, use them
    if (signatureData.metrics && Object.keys(signatureData.metrics).length > 15) {
        basicFeatures = signatureData.metrics;
    } else {
        // Otherwise, calculate from raw data if available
        const rawData = signatureData.raw || [];
        if (rawData.length === 0) {
            // Return default values if no raw data
            basicFeatures = {
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
        } else {
            // Extract basic metrics from frontend if available
            const basicMetrics = signatureData.metrics?.basic || {};
            const boundingBox = basicMetrics.bounding_box || {};
            
            // Use frontend-calculated values where available, calculate missing ones
            basicFeatures = {
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
    }
    
    // Add enhanced features if enabled
    if (ENABLE_ENHANCED_FEATURES) {
        try {
            // Extract stroke data for enhanced feature extraction
            const strokeData = signatureData.raw || signatureData.strokes || signatureData.data || [];
            
            // Only extract enhanced features if we have stroke data
            if (strokeData && (Array.isArray(strokeData) ? strokeData.length > 0 : strokeData.strokes?.length > 0)) {
                console.log('Extracting enhanced biometric features...');
                
                // Extract device capabilities if provided
                const deviceCapabilities = signatureData.device_capabilities || null;
                
                const enhancedFeatures = EnhancedFeatureExtractor.extractAllFeatures(strokeData, deviceCapabilities);
                
                // Combine basic and enhanced features
                return {
                    ...basicFeatures,
                    ...enhancedFeatures,
                    _enhanced_features_enabled: true
                };
            } else {
                console.log('No stroke data available for enhanced feature extraction');
                return {
                    ...basicFeatures,
                    _enhanced_features_enabled: false,
                    _enhanced_features_reason: 'no_stroke_data'
                };
            }
        } catch (error) {
            console.error('Enhanced feature extraction failed, using basic features:', error);
            return {
                ...basicFeatures,
                _enhanced_features_enabled: false,
                _enhanced_features_error: error.message
            };
        }
    }
    
    return basicFeatures;
}

// Helper function to extract biometric features for any component (signature, shape, or drawing)
function extractBiometricFeatures(strokeData, componentType, deviceCapabilities = null) {
    try {
        // Use existing extractAllFeatures for core biometric features
        const enhancedFeatures = EnhancedFeatureExtractor.extractAllFeatures(
            strokeData,
            deviceCapabilities
        );
        
        // Add component-specific features
        let componentFeatures = {};
        
        // Determine if it's a shape or drawing
        const shapeTypes = ['circle', 'square', 'triangle'];
        const drawingTypes = ['face', 'star', 'house', 'connect_dots'];
        
        if (shapeTypes.includes(componentType)) {
            componentFeatures = ComponentSpecificFeatures.extractShapeSpecificFeatures(
                strokeData,
                componentType
            );
        } else if (drawingTypes.includes(componentType)) {
            componentFeatures = ComponentSpecificFeatures.extractDrawingSpecificFeatures(
                strokeData,
                componentType
            );
        }
        
        return {
            ...enhancedFeatures,
            ...componentFeatures,
            _component_type: componentType,
            _feature_extraction_version: '2.0',
            _enhanced_features_enabled: true
        };
    } catch (error) {
        console.error(`Error extracting biometric features for ${componentType}:`, error);
        return {
            _component_type: componentType,
            _enhanced_features_enabled: false,
            _enhanced_features_error: error.message
        };
    }
}

// Calculate enhanced component score using weighted model
function calculateEnhancedComponentScore(storedFeatures, attemptFeatures, componentType) {
    // Biometric similarity (using existing enhanced feature comparison)
    const biometricScore = calculateBiometricSimilarity(storedFeatures, attemptFeatures);
    
    // Geometric accuracy (enhanced version of existing functions)
    const geometricScore = calculateGeometricAccuracy(attemptFeatures, componentType);
    
    // Component-specific weights
    const weights = getComponentWeights(componentType);
    
    return {
        overall_score: (weights.biometric * biometricScore) + (weights.geometric * geometricScore),
        biometric_score: biometricScore,
        geometric_score: geometricScore,
        feature_breakdown: generateFeatureBreakdown(attemptFeatures)
    };
}

// Get component-specific weights
function getComponentWeights(componentType) {
    const weights = {
        'circle': { biometric: 0.7, geometric: 0.3 },
        'square': { biometric: 0.7, geometric: 0.3 },
        'triangle': { biometric: 0.7, geometric: 0.3 },
        'face': { biometric: 0.9, geometric: 0.1 },
        'star': { biometric: 0.8, geometric: 0.2 },
        'house': { biometric: 0.85, geometric: 0.15 },
        'connect_dots': { biometric: 0.9, geometric: 0.1 }
    };
    return weights[componentType] || { biometric: 0.8, geometric: 0.2 };
}

// Calculate biometric similarity between stored and attempt features
function calculateBiometricSimilarity(storedFeatures, attemptFeatures) {
    // Use similar logic to signature authentication
    const features = [
        'avg_pressure', 'pressure_std', 'pressure_range',
        'pause_detection', 'rhythm_consistency', 'drawing_duration_total',
        'stroke_complexity', 'tremor_index', 'smoothness_index',
        'speed_anomaly_score', 'timing_regularity_score', 'behavioral_authenticity_score'
    ];
    
    let totalScore = 0;
    let validFeatures = 0;
    
    features.forEach(feature => {
        if (storedFeatures[feature] !== undefined && attemptFeatures[feature] !== undefined) {
            const stored = storedFeatures[feature];
            const attempt = attemptFeatures[feature];
            
            // Calculate similarity (1 - normalized difference)
            const diff = Math.abs(stored - attempt);
            const maxVal = Math.max(stored, attempt);
            const similarity = maxVal > 0 ? 1 - (diff / maxVal) : 1;
            
            totalScore += similarity;
            validFeatures++;
        }
    });
    
    return validFeatures > 0 ? totalScore / validFeatures : 0.5;
}

// Calculate geometric accuracy for shapes/drawings
function calculateGeometricAccuracy(features, componentType) {
    // Shape-specific geometric scoring
    if (['circle', 'square', 'triangle'].includes(componentType)) {
        switch(componentType) {
            case 'circle':
                return calculateCircleGeometricScore(features);
            case 'square':
                return calculateSquareGeometricScore(features);
            case 'triangle':
                return calculateTriangleGeometricScore(features);
        }
    }
    
    // Drawing-specific scoring
    switch(componentType) {
        case 'face':
            return features.facial_symmetry_index || 0.5;
        case 'star':
            return features.star_point_symmetry || 0.5;
        case 'house':
            return features.structural_hierarchy || 0.5;
        case 'connect_dots':
            return features.path_efficiency || 0.5;
        default:
            return 0.5;
    }
}

// Enhanced geometric scoring functions
function calculateCircleGeometricScore(features) {
    const scores = [
        features.radial_deviation ? 1 - features.radial_deviation : 0.5,
        features.closure_technique || 0.5,
        features.curve_consistency ? 1 / (1 + features.curve_consistency) : 0.5
    ];
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calculateSquareGeometricScore(features) {
    const scores = [
        features.corner_execution_pattern || 0.5,
        features.line_straightness_signature ? 1 - features.line_straightness_signature : 0.5,
        features.edge_length_consistency || 0.5
    ];
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calculateTriangleGeometricScore(features) {
    const scores = [
        features.angle_consistency || 0.5,
        features.apex_sharpness ? 1 / (1 + features.apex_sharpness) : 0.5,
        features.side_length_ratios ? 1 / (1 + Math.abs(features.side_length_ratios - 1)) : 0.5
    ];
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Generate feature breakdown for debugging
function generateFeatureBreakdown(features) {
    const breakdown = {
        pressure_features: {},
        timing_features: {},
        geometric_features: {},
        security_features: {},
        component_features: {}
    };
    
    // Categorize features
    Object.keys(features).forEach(key => {
        if (key.includes('pressure')) {
            breakdown.pressure_features[key] = features[key];
        } else if (key.includes('timing') || key.includes('duration') || key.includes('pause')) {
            breakdown.timing_features[key] = features[key];
        } else if (key.includes('angle') || key.includes('curve') || key.includes('line')) {
            breakdown.geometric_features[key] = features[key];
        } else if (key.includes('anomaly') || key.includes('authenticity')) {
            breakdown.security_features[key] = features[key];
        } else if (!key.startsWith('_')) {
            breakdown.component_features[key] = features[key];
        }
    });
    
    return breakdown;
}

// Helper function to extract displayable signature data
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
const { compareSignaturesML, compareMultipleSignaturesML, compareSignaturesEnhanced } = require('./mlComparison');

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
        // Try to get user baseline for enhanced comparison
        try {
            const userResult = await pool.query(
                'SELECT id FROM users WHERE username = $1',
                [username]
            );
            
            if (userResult.rows.length > 0) {
                const userId = userResult.rows[0].id;
                
                // Try to get enrollment signatures with fallback logic
                let signaturesResult;
                try {
                    // First try with is_enrollment column
                    signaturesResult = await pool.query(
                        'SELECT metrics FROM signatures WHERE user_id = $1 AND is_enrollment = true ORDER BY created_at ASC LIMIT 3',
                        [userId]
                    );
                } catch (columnError) {
                    // If is_enrollment column doesn't exist, fall back to getting the first 3 signatures
                    console.log('is_enrollment column not found, using fallback method');
                    signaturesResult = await pool.query(
                        'SELECT metrics FROM signatures WHERE user_id = $1 ORDER BY created_at ASC LIMIT 3',
                        [userId]
                    );
                }
                
                if (signaturesResult.rows.length >= 3) {
                    // Calculate baseline from enrollment signatures
                    const enrollmentSigs = signaturesResult.rows.map(row => ({ metrics: row.metrics }));
                    const baseline = calculateUserBaseline(enrollmentSigs);
                    
                    // Use enhanced comparison with baseline
                    return await compareSignaturesEnhanced(metrics1, metrics2, baseline, username);
                } else {
                    console.log(`Insufficient enrollment signatures for ${username}: ${signaturesResult.rows.length}/3`);
                }
            }
        } catch (error) {
            console.error('Error fetching baseline for enhanced comparison:', error);
        }
        
        // Fallback to standard ML comparison
        return await compareSignaturesML(metrics1, metrics2, username);
    }
    // Fallback to legacy comparison
    console.warn('Using legacy comparison - ML metrics not available');
    return compareSignaturesLegacy(signature1, signature2);
}

// Helper function to insert signatures with fallback for is_enrollment column
async function insertSignatureWithFallback(pool, signatureData) {
    const { userId, strokeData, signature, mlFeatures, isEnrollment } = signatureData;
    
    try {
        // Try with is_enrollment column first
        const result = await pool.query(`
            INSERT INTO signatures (user_id, stroke_data, metrics, data_format, is_enrollment, created_at)
            VALUES ($1, $2, $3, 'stroke_data', $4, NOW())
            RETURNING id
        `, [userId, JSON.stringify(strokeData), JSON.stringify(mlFeatures), isEnrollment]);
        
        console.log(`✅ Signature saved with is_enrollment column (ID: ${result.rows[0].id})`);
        return result;
        
    } catch (columnError) {
        // Check if the error is due to missing is_enrollment column
        if (columnError.code === '42703' && columnError.message.includes('is_enrollment')) {
            console.log('⚠️ is_enrollment column not found, using fallback INSERT');
            
            // Fallback: INSERT without is_enrollment column
            const result = await pool.query(`
                INSERT INTO signatures (user_id, stroke_data, metrics, data_format, created_at)
                VALUES ($1, $2, $3, 'stroke_data', NOW())
                RETURNING id
            `, [userId, JSON.stringify(strokeData), JSON.stringify(mlFeatures)]);
            
            console.log(`✅ Signature saved without is_enrollment column (ID: ${result.rows[0].id})`);
            return result;
        } else {
            // Re-throw if it's a different error
            throw columnError;
        }
    }
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
        console.log('Creating user in database:', username);
        const userResult = await pool.query(
            'INSERT INTO users (username) VALUES ($1) RETURNING id',
            [username]
        );
        const userId = userResult.rows[0].id;
        console.log('User created successfully with ID:', userId);
        
        // Save signatures with stroke data
        console.log('Saving signatures with stroke data...');
        for (let i = 0; i < signatures.length; i++) {
            const signature = signatures[i];
            try {
                // Calculate full ML features
                const mlFeatures = calculateMLFeatures(signature);
                
                // Extract stroke data
                const strokeData = extractStrokeData(signature);
                
                if (!strokeData) {
                    throw new Error('No valid stroke data found');
                }
                
                // Store signature directly in the transaction
                // Include both stroke_data and signature_data for backward compatibility
                // Mark the first 3 signatures as enrollment signatures for baseline calculation
                const isEnrollment = i < 3; // First 3 signatures are enrollment signatures
                const sigResult = await insertSignatureWithFallback(pool, { userId, strokeData, signature, mlFeatures, isEnrollment });
                
                console.log(`✅ Saved signature ${i + 1}/${signatures.length} with stroke data (ID: ${sigResult.rows[0].id}, size: ${JSON.stringify(strokeData).length} bytes)`);
            } catch (sigError) {
                console.error(`Error saving signature ${i + 1}:`, sigError);
                throw sigError;
            }
        }
        
        // Save shapes with enhanced features
        console.log('Saving shapes with enhanced features...');
        for (const [shapeType, shapeData] of Object.entries(shapes)) {
            try {
                // Extract stroke data for enhanced features
                const strokeData = extractStrokeData(shapeData);
                
                // Extract device capabilities if provided
                const deviceCapabilities = shapeData.device_capabilities || metadata?.device_capabilities || null;
                
                // Extract enhanced biometric features
                const enhancedFeatures = ENABLE_ENHANCED_FEATURES 
                    ? extractBiometricFeatures(strokeData, shapeType, deviceCapabilities)
                    : {};
                
                await pool.query(
                    'INSERT INTO shapes (user_id, shape_type, metrics, enhanced_features) VALUES ($1, $2, $3, $4)',
                    [
                        userId, 
                        shapeType, 
                        JSON.stringify(shapeData.metrics || {}),
                        JSON.stringify(enhancedFeatures)
                    ]
                );
                console.log(`✅ Saved shape: ${shapeType} with ${Object.keys(enhancedFeatures).length} enhanced features`);
            } catch (shapeError) {
                console.error(`Error saving shape ${shapeType}:`, shapeError);
                throw shapeError;
            }
        }
        
        // Save creative drawings with enhanced features
        console.log('Saving creative drawings with enhanced features...');
        for (const [drawingType, drawingData] of Object.entries(drawings)) {
            try {
                console.log(`Processing drawing: ${drawingType}`);
                
                // Extract stroke data using the new handler
                const strokes = extractStrokeDataFromSignaturePad(drawingData);
                
                // Calculate drawing metrics
                const drawingMetrics = {
                    strokeCount: strokes ? strokes.length : 0,
                    pointCount: strokes ? strokes.reduce((sum, stroke) => sum + (Array.isArray(stroke) ? stroke.length : 0), 0) : 0,
                    duration: drawingData.metrics?.duration || drawingData.metrics?.total_duration_ms || 0,
                    boundingBox: drawingData.metrics?.boundingBox || drawingData.metrics?.bounding_box || null
                };
                
                // Extract device capabilities if provided
                const deviceCapabilities = drawingData.device_capabilities || metadata?.device_capabilities || null;
                
                // Extract enhanced biometric features
                const enhancedFeatures = ENABLE_ENHANCED_FEATURES 
                    ? extractBiometricFeatures(strokes, drawingType, deviceCapabilities)
                    : {};
                
                await pool.query(
                    'INSERT INTO drawings (user_id, drawing_type, metrics, enhanced_features) VALUES ($1, $2, $3, $4)',
                    [
                        userId, 
                        drawingType, 
                        JSON.stringify(drawingMetrics),
                        JSON.stringify(enhancedFeatures)
                    ]
                );
                console.log(`✅ Saved drawing: ${drawingType} with ${Object.keys(enhancedFeatures).length} enhanced features`);
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
            shapes: true, // Always require shapes
            drawings: true, // Always require drawings
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
                SELECT shape_type
                FROM shapes
                WHERE user_id = $1 AND shape_type LIKE 'drawing_%'
                LIMIT 2
            `, [userId]);
            
            drawingsResult.rows.forEach((row, index) => {
                // Use more descriptive fallbacks for drawings based on shape_type
                const drawingPrompts = {
                    'drawing_face': 'Draw a simple face',
                    'drawing_star': 'Draw a star',
                    'drawing_house': 'Draw a house',
                    'drawing_connect_dots': 'Connect the dots'
                };
                const fallbackPrompts = ['Draw a star', 'Draw a simple face'];
                const prompt = drawingPrompts[row.shape_type] || fallbackPrompts[index] || `Drawing ${index + 1}`;
                challenges.required.push({
                    type: 'drawing',
                    name: prompt,
                    prompt: prompt,
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
            
            // For sign-in, we need all components (signature, shapes, drawings)
            const signatureDrawing = tempData.drawings.find(d => d.type === 'signature');
            const shapeDrawings = tempData.drawings.filter(d => d.type === 'shape');
            const drawingDrawings = tempData.drawings.filter(d => d.type === 'drawing');
            
            if (signatureDrawing) {
                signature = {
                    data: signatureDrawing.signature,
                    raw: signatureDrawing.raw,
                    metrics: signatureDrawing.metrics || {},
                    timestamp: signatureDrawing.timestamp
                };
            }
            
            // Convert shapes array to object
            if (shapeDrawings.length > 0) {
                shapes = {};
                shapeDrawings.forEach(item => {
                    const key = item.instruction?.toLowerCase().includes('circle') ? 'circle' :
                               item.instruction?.toLowerCase().includes('square') ? 'square' :
                               item.instruction?.toLowerCase().includes('triangle') ? 'triangle' : 'shape';
                    shapes[key] = {
                        data: item.signature,
                        raw: item.raw,
                        metrics: item.metrics || {},
                        timestamp: item.timestamp
                    };
                });
            }
            
            // Convert drawings array to object
            if (drawingDrawings.length > 0) {
                drawings = {};
                drawingDrawings.forEach(item => {
                    const key = item.instruction?.toLowerCase().includes('face') ? 'face' :
                               item.instruction?.toLowerCase().includes('star') ? 'star' :
                               item.instruction?.toLowerCase().includes('house') ? 'house' :
                               item.instruction?.toLowerCase().includes('dots') ? 'connect_dots' : 'drawing';
                    drawings[key] = {
                        data: item.signature,
                        raw: item.raw,
                        metrics: item.metrics || {},
                        timestamp: item.timestamp
                    };
                });
            }
            
            // Clear temporary data after using it
            temporaryDrawingStorage.delete(userKey);
            console.log(`Cleared temporary data for ${username}`);
        } else {
            return res.status(400).json({ 
                error: 'No temporary data found. Please complete the sign-in process with all required components (signature, shapes, and drawings).' 
            });
        }
    }
    
    // Require username and signature, shapes and drawings are optional
    if (!username || !signature) {
        return res.status(400).json({ 
            error: 'Username and signature are required',
            received: {
                username: !!username,
                signature: !!signature,
                shapes: !!shapes,
                drawings: !!drawings
            }
        });
    }
    
    // If shapes or drawings are provided, validate they have the required components
    if (shapes) {
        const requiredShapes = ['circle', 'square', 'triangle'];
        const missingShapes = requiredShapes.filter(shape => !shapes[shape]);
        
        if (missingShapes.length > 0) {
            return res.status(400).json({
                error: 'Missing required shapes',
                missingShapes,
                received: {
                    shapes: Object.keys(shapes || {})
                }
            });
        }
    }
    
    if (drawings) {
        const requiredDrawings = ['face', 'star'];
        const missingDrawings = requiredDrawings.filter(drawing => !drawings[drawing]);
        
        if (missingDrawings.length > 0) {
            return res.status(400).json({
                error: 'Missing required drawings',
                missingDrawings,
                received: {
                    drawings: Object.keys(drawings || {})
                }
            });
        }
    }
    
    try {
        // Enhanced Features Collection System
        const enhancedFeaturesCollection = {
            signature: null,
            shapes: {},
            drawings: {},
            _extraction_timestamp: new Date().toISOString(),
            _feature_extraction_version: "2.0",
            _enhanced_features_enabled: ENABLE_ENHANCED_FEATURES,
            _total_components_processed: 0
        };

        // Helper function to add features to collection
        function addFeaturesToCollection(componentType, componentName, features) {
            if (!features || typeof features !== 'object') return;
            
            if (componentType === 'signature') {
                enhancedFeaturesCollection.signature = features;
            } else if (componentType === 'shapes') {
                enhancedFeaturesCollection.shapes[componentName] = features;
            } else if (componentType === 'drawings') {
                enhancedFeaturesCollection.drawings[componentName] = features;
            }
            
            enhancedFeaturesCollection._total_components_processed++;
        }

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
            'SELECT stroke_data, metrics FROM signatures WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        
        if (storedSigResult.rows.length === 0) {
            return res.status(404).json({ error: 'No signature on file' });
        }
        
        const storedSignature = storedSigResult.rows[0].stroke_data;
        const storedMetrics = storedSigResult.rows[0].metrics || {};
        
        // Extract enhanced features for signature if enabled
        let signatureEnhancedFeatures = null;
        if (ENABLE_ENHANCED_FEATURES) {
            try {
                // Extract stroke data from signature
                const signatureStrokeData = extractStrokeData(signature);
                const deviceCapabilities = metadata?.device_capabilities || null;
                
                if (signatureStrokeData && signatureStrokeData.length > 0) {
                    // Extract enhanced biometric features for signature
                    signatureEnhancedFeatures = extractBiometricFeatures(signatureStrokeData, 'signature', deviceCapabilities);
                    console.log('✅ Extracted signature enhanced features:', Object.keys(signatureEnhancedFeatures).length, 'features');
                    
                    // Collect signature features
                    addFeaturesToCollection('signature', 'main', signatureEnhancedFeatures);
                }
            } catch (error) {
                console.error('Error extracting signature enhanced features:', error);
            }
        }

        // Calculate signature score (always required) - now using ML
        const signatureScore = await compareSignatures(
            storedSignature.data, 
            signature.data,
            storedMetrics,
            signature.metrics || {},
            username
        );
        let totalScore = signatureScore;
        let scoreCount = 1;
        
        const scores = {
            signature: Math.round(signatureScore)
        };
        
        // Check if user has enrolled shapes and drawings for estimation
        const hasEnrolledShapes = await pool.query(
            'SELECT COUNT(*) as count FROM shapes WHERE user_id = $1 AND shape_type = ANY($2::text[])',
            [userId, ['circle', 'square', 'triangle']]
        );
        
        const hasEnrolledDrawings = await pool.query(
            'SELECT COUNT(*) as count FROM drawings WHERE user_id = $1 AND drawing_type = ANY($2::text[])',
            [userId, ['face', 'star', 'house', 'connect_dots']]
        );
        
        const hasShapes = hasEnrolledShapes.rows[0].count > 0;
        const hasDrawings = hasEnrolledDrawings.rows[0].count > 0;
        
        // If shapes were provided, verify them
        if (shapes) {
            console.log('Processing shapes for authentication:', {
                providedShapes: Object.keys(shapes),
                hasCircle: !!shapes.circle,
                hasSquare: !!shapes.square,
                hasTriangle: !!shapes.triangle
            });
            
            const storedShapesResult = await pool.query(
                'SELECT shape_type, metrics, enhanced_features FROM shapes WHERE user_id = $1 AND shape_type = ANY($2::text[])',
                [userId, ['circle', 'square', 'triangle']]
            );
            
            console.log('Found stored shapes:', storedShapesResult.rows.map(row => row.shape_type));
            
            const storedShapes = {};
            storedShapesResult.rows.forEach(row => {
                storedShapes[row.shape_type] = {
                    metrics: row.metrics || {},
                    enhanced_features: row.enhanced_features
                };
            });
            
            // Verify each provided shape using enhanced biometric scoring
            if (shapes.circle && storedShapes.circle) {
                console.log('Comparing circle shape with enhanced features...');
                
                // Extract stroke data and device capabilities
                const strokeData = extractStrokeData(shapes.circle);
                const deviceCapabilities = shapes.circle.device_capabilities || metadata?.device_capabilities || null;
                
                // Extract enhanced features for attempt
                const attemptFeatures = ENABLE_ENHANCED_FEATURES 
                    ? extractBiometricFeatures(strokeData, 'circle', deviceCapabilities)
                    : shapes.circle.metrics || {};
                
                // Get stored enhanced features or calculate from stored data
                let storedFeatures;
                try {
                    if (storedShapes.circle.enhanced_features) {
                        // enhanced_features is already parsed from JSONB column
                        storedFeatures = storedShapes.circle.enhanced_features;
                    } else if (ENABLE_ENHANCED_FEATURES) {
                        // Calculate from stored shape data (already parsed from JSONB)
                        storedFeatures = extractBiometricFeatures(extractStrokeData(storedShapes.circle.data), 'circle', deviceCapabilities);
                    } else {
                        // Use metrics (already parsed from JSONB)
                        storedFeatures = storedShapes.circle.metrics || {};
                    }
                } catch (error) {
                    console.error('Error processing stored circle features:', error);
                    storedFeatures = {};
                }
                
                // Collect circle enhanced features
                if (ENABLE_ENHANCED_FEATURES && attemptFeatures && Object.keys(attemptFeatures).length > 0) {
                    addFeaturesToCollection('shapes', 'circle', attemptFeatures);
                    console.log('✅ Collected circle enhanced features:', Object.keys(attemptFeatures).length, 'features');
                }
                
                // Calculate enhanced score
                const scoreResult = calculateEnhancedComponentScore(storedFeatures, attemptFeatures, 'circle');
                const circleScore = scoreResult.overall_score * 100;
                
                scores.circle = Math.round(circleScore);
                scores.circle_biometric = scoreResult.biometric_score;
                scores.circle_geometric = scoreResult.geometric_score;
                totalScore += circleScore;
                scoreCount++;
                console.log('✅ Circle shape score:', scores.circle, 
                    `(biometric: ${Math.round(scoreResult.biometric_score * 100)}, geometric: ${Math.round(scoreResult.geometric_score * 100)})`);
            }
            
            if (shapes.square && storedShapes.square) {
                console.log('Comparing square shape with enhanced features...');
                
                // Extract stroke data and device capabilities
                const strokeData = extractStrokeData(shapes.square);
                const deviceCapabilities = shapes.square.device_capabilities || metadata?.device_capabilities || null;
                
                // Extract enhanced features for attempt
                const attemptFeatures = ENABLE_ENHANCED_FEATURES 
                    ? extractBiometricFeatures(strokeData, 'square', deviceCapabilities)
                    : shapes.square.metrics || {};
                
                // Get stored enhanced features or calculate from stored data
                let storedFeatures;
                try {
                    if (storedShapes.square.enhanced_features) {
                        // enhanced_features is already parsed from JSONB column
                        storedFeatures = storedShapes.square.enhanced_features;
                    } else if (ENABLE_ENHANCED_FEATURES) {
                        // Calculate from stored shape data (already parsed from JSONB)
                        storedFeatures = extractBiometricFeatures(extractStrokeData(storedShapes.square.data), 'square', deviceCapabilities);
                    } else {
                        // Use metrics (already parsed from JSONB)
                        storedFeatures = storedShapes.square.metrics || {};
                    }
                } catch (error) {
                    console.error('Error processing stored square features:', error);
                    storedFeatures = {};
                }
                
                // Collect square enhanced features
                if (ENABLE_ENHANCED_FEATURES && attemptFeatures && Object.keys(attemptFeatures).length > 0) {
                    addFeaturesToCollection('shapes', 'square', attemptFeatures);
                    console.log('✅ Collected square enhanced features:', Object.keys(attemptFeatures).length, 'features');
                }
                
                // Calculate enhanced score
                const scoreResult = calculateEnhancedComponentScore(storedFeatures, attemptFeatures, 'square');
                const squareScore = scoreResult.overall_score * 100;
                
                scores.square = Math.round(squareScore);
                scores.square_biometric = scoreResult.biometric_score;
                scores.square_geometric = scoreResult.geometric_score;
                totalScore += squareScore;
                scoreCount++;
                console.log('✅ Square shape score:', scores.square, 
                    `(biometric: ${Math.round(scoreResult.biometric_score * 100)}, geometric: ${Math.round(scoreResult.geometric_score * 100)})`);
            }
            
            if (shapes.triangle && storedShapes.triangle) {
                console.log('Comparing triangle shape with enhanced features...');
                
                // Extract stroke data and device capabilities
                const strokeData = extractStrokeData(shapes.triangle);
                const deviceCapabilities = shapes.triangle.device_capabilities || metadata?.device_capabilities || null;
                
                // Extract enhanced features for attempt
                const attemptFeatures = ENABLE_ENHANCED_FEATURES 
                    ? extractBiometricFeatures(strokeData, 'triangle', deviceCapabilities)
                    : shapes.triangle.metrics || {};
                
                // Get stored enhanced features or calculate from stored data
                let storedFeatures;
                try {
                    if (storedShapes.triangle.enhanced_features) {
                        // enhanced_features is already parsed from JSONB column
                        storedFeatures = storedShapes.triangle.enhanced_features;
                    } else if (ENABLE_ENHANCED_FEATURES) {
                        // Calculate from stored shape data (already parsed from JSONB)
                        storedFeatures = extractBiometricFeatures(extractStrokeData(storedShapes.triangle.data), 'triangle', deviceCapabilities);
                    } else {
                        // Use metrics (already parsed from JSONB)
                        storedFeatures = storedShapes.triangle.metrics || {};
                    }
                } catch (error) {
                    console.error('Error processing stored triangle features:', error);
                    storedFeatures = {};
                }
                
                // Collect triangle enhanced features
                if (ENABLE_ENHANCED_FEATURES && attemptFeatures && Object.keys(attemptFeatures).length > 0) {
                    addFeaturesToCollection('shapes', 'triangle', attemptFeatures);
                    console.log('✅ Collected triangle enhanced features:', Object.keys(attemptFeatures).length, 'features');
                }
                
                // Calculate enhanced score
                const scoreResult = calculateEnhancedComponentScore(storedFeatures, attemptFeatures, 'triangle');
                const triangleScore = scoreResult.overall_score * 100;
                
                scores.triangle = Math.round(triangleScore);
                scores.triangle_biometric = scoreResult.biometric_score;
                scores.triangle_geometric = scoreResult.geometric_score;
                totalScore += triangleScore;
                scoreCount++;
                console.log('✅ Triangle shape score:', scores.triangle, 
                    `(biometric: ${Math.round(scoreResult.biometric_score * 100)}, geometric: ${Math.round(scoreResult.geometric_score * 100)})`);
            }
        } else if (hasShapes) {
            // Estimate shape scores based on signature score
            console.log('Estimating shape scores based on signature score:', signatureScore);
            scores.circle = Math.round(signatureScore * 1.1);     // Easiest to reproduce
            scores.square = Math.round(signatureScore * 0.95);    // Moderate difficulty
            scores.triangle = Math.round(signatureScore * 0.9);   // Hardest shape
            totalScore += scores.circle + scores.square + scores.triangle;
            scoreCount += 3;
            console.log('✅ Estimated shape scores:', { circle: scores.circle, square: scores.square, triangle: scores.triangle });
        }
        
        // If drawings were provided, verify them
        if (drawings) {
            console.log('Processing drawings for authentication:', {
                providedDrawings: Object.keys(drawings),
                hasFace: !!drawings.face,
                hasStar: !!drawings.star,
                hasHouse: !!drawings.house,
                hasConnectDots: !!drawings.connect_dots
            });
            
            const { compareDrawings, extractStrokeDataFromSignaturePad: extractStrokeDataFromDrawingModule } = require('./drawingVerification');
            
            const storedDrawingsResult = await pool.query(
                'SELECT drawing_type, metrics, enhanced_features FROM drawings WHERE user_id = $1 AND drawing_type = ANY($2::text[])',
                [userId, ['face', 'star', 'house', 'connect_dots']]
            );
            
            console.log('Found stored drawings:', storedDrawingsResult.rows.map(row => row.drawing_type));
            
            const storedDrawings = {};
            storedDrawingsResult.rows.forEach(row => {
                storedDrawings[row.drawing_type] = {
                    metrics: row.metrics || {},
                    enhanced_features: row.enhanced_features
                };
            });
            
            // Verify each provided drawing with enhanced biometric features
            if (drawings.face && storedDrawings.face) {
                try {
                    console.log('Comparing face drawing with enhanced features...');
                    
                    // Extract stroke data and device capabilities
                    const rawStrokeData = extractStrokeDataFromSignaturePad(drawings.face);
                    const deviceCapabilities = drawings.face.device_capabilities || metadata?.device_capabilities || null;
                    
                    // Transform stroke data to expected format for ComponentSpecificFeatures
                    // extractStrokeDataFromSignaturePad returns array of point arrays
                    // ComponentSpecificFeatures expects array of stroke objects with points property
                    const strokeData = rawStrokeData ? rawStrokeData.map(points => ({ points })) : null;
                    
                    // Debug logging for stroke data extraction
                    console.log('🔍 Debug face drawing data:', {
                        hasDrawingData: !!drawings.face,
                        hasRawData: !!drawings.face?.raw,
                        rawDataType: typeof drawings.face?.raw,
                        rawDataLength: Array.isArray(drawings.face?.raw) ? drawings.face.raw.length : 'not array',
                        strokeDataExtracted: !!strokeData,
                        strokeCount: strokeData ? strokeData.length : 0
                    });
                    
                    // Extract enhanced features for attempt
                    let attemptFeatures;
                    if (ENABLE_ENHANCED_FEATURES && strokeData && strokeData.length > 0) {
                        try {
                            attemptFeatures = extractBiometricFeatures(strokeData, 'face', deviceCapabilities);
                            console.log('✅ Successfully extracted face enhanced features');
                        } catch (error) {
                            console.error('❌ Enhanced features extraction failed for face:', error);
                            attemptFeatures = {
                                strokeCount: strokeData.length,
                                pointCount: strokeData.reduce((sum, s) => sum + (Array.isArray(s) ? s.length : 0), 0),
                                _enhanced_features_error: error.message,
                                _enhanced_features_enabled: false
                            };
                        }
                    } else {
                        attemptFeatures = {
                            strokeCount: strokeData?.length || 0,
                            pointCount: strokeData?.reduce((sum, s) => sum + (Array.isArray(s) ? s.length : 0), 0) || 0,
                            _enhanced_features_error: strokeData ? 'Enhanced features disabled' : 'No stroke data',
                            _enhanced_features_enabled: false
                        };
                    }
                    
                    // Get stored enhanced features or calculate from stored data
                    let storedFeatures;
                    try {
                        if (storedDrawings.face.enhanced_features) {
                            // enhanced_features is already parsed from JSONB column
                            storedFeatures = storedDrawings.face.enhanced_features;
                        } else if (ENABLE_ENHANCED_FEATURES) {
                            // Calculate from stored drawing data (already parsed from JSONB)
                            const rawStoredStrokeData = extractStrokeDataFromSignaturePad(storedDrawings.face.data);
                            if (rawStoredStrokeData && rawStoredStrokeData.length > 0) {
                                // Transform stored stroke data to expected format
                                const storedStrokeData = rawStoredStrokeData.map(points => ({ points }));
                                storedFeatures = extractBiometricFeatures(storedStrokeData, 'face', deviceCapabilities);
                            } else {
                                storedFeatures = storedDrawings.face.metrics || {};
                            }
                        } else {
                            // Use metrics (already parsed from JSONB)
                            storedFeatures = storedDrawings.face.metrics || {};
                        }
                    } catch (error) {
                        console.error('Error processing stored face features:', error);
                        storedFeatures = {};
                    }
                    
                    // Collect face enhanced features
                    if (ENABLE_ENHANCED_FEATURES && attemptFeatures && Object.keys(attemptFeatures).length > 0) {
                        addFeaturesToCollection('drawings', 'face', attemptFeatures);
                        console.log('✅ Collected face enhanced features:', Object.keys(attemptFeatures).length, 'features');
                    }
                    
                    // Calculate enhanced score
                    const scoreResult = calculateEnhancedComponentScore(storedFeatures, attemptFeatures, 'face');
                    const faceScore = scoreResult.overall_score * 100;
                    
                    scores.face = Math.round(faceScore);
                    scores.face_biometric = scoreResult.biometric_score;
                    scores.face_geometric = scoreResult.geometric_score;
                    totalScore += faceScore;
                    scoreCount++;
                    console.log('✅ Face drawing score:', scores.face, 
                        `(biometric: ${Math.round(scoreResult.biometric_score * 100)}, geometric: ${Math.round(scoreResult.geometric_score * 100)})`);
                } catch (error) {
                    console.error('Error in face drawing comparison:', error);
                    scores.face = 0;
                }
            }
            
            if (drawings.star && storedDrawings.star) {
                try {
                    console.log('Comparing star drawing with enhanced features...');
                    
                    // Extract stroke data and device capabilities
                    const rawStrokeData = extractStrokeDataFromSignaturePad(drawings.star);
                    const deviceCapabilities = drawings.star.device_capabilities || metadata?.device_capabilities || null;
                    
                    // Transform stroke data to expected format for ComponentSpecificFeatures
                    // extractStrokeDataFromSignaturePad returns array of point arrays
                    // ComponentSpecificFeatures expects array of stroke objects with points property
                    const strokeData = rawStrokeData ? rawStrokeData.map(points => ({ points })) : null;
                    
                    // Debug logging for stroke data extraction
                    console.log('🔍 Debug star drawing data:', {
                        hasDrawingData: !!drawings.star,
                        hasRawData: !!drawings.star?.raw,
                        rawDataType: typeof drawings.star?.raw,
                        rawDataLength: Array.isArray(drawings.star?.raw) ? drawings.star.raw.length : 'not array',
                        strokeDataExtracted: !!strokeData,
                        strokeCount: strokeData ? strokeData.length : 0
                    });
                    
                    // Extract enhanced features for attempt
                    let attemptFeatures;
                    if (ENABLE_ENHANCED_FEATURES && strokeData && strokeData.length > 0) {
                        try {
                            attemptFeatures = extractBiometricFeatures(strokeData, 'star', deviceCapabilities);
                            console.log('✅ Successfully extracted star enhanced features');
                        } catch (error) {
                            console.error('❌ Enhanced features extraction failed for star:', error);
                            attemptFeatures = {
                                strokeCount: strokeData.length,
                                pointCount: strokeData.reduce((sum, s) => sum + (Array.isArray(s) ? s.length : 0), 0),
                                _enhanced_features_error: error.message,
                                _enhanced_features_enabled: false
                            };
                        }
                    } else {
                        attemptFeatures = {
                            strokeCount: strokeData?.length || 0,
                            pointCount: strokeData?.reduce((sum, s) => sum + (Array.isArray(s) ? s.length : 0), 0) || 0,
                            _enhanced_features_error: strokeData ? 'Enhanced features disabled' : 'No stroke data',
                            _enhanced_features_enabled: false
                        };
                    }
                    
                    // Get stored enhanced features or calculate from stored data
                    let storedFeatures;
                    try {
                        if (storedDrawings.star.enhanced_features) {
                            // enhanced_features is already parsed from JSONB column
                            storedFeatures = storedDrawings.star.enhanced_features;
                        } else if (ENABLE_ENHANCED_FEATURES) {
                            // Calculate from stored drawing data (already parsed from JSONB)
                            const rawStoredStrokeData = extractStrokeDataFromSignaturePad(storedDrawings.star.data);
                            if (rawStoredStrokeData && rawStoredStrokeData.length > 0) {
                                // Transform stored stroke data to expected format
                                const storedStrokeData = rawStoredStrokeData.map(points => ({ points }));
                                storedFeatures = extractBiometricFeatures(storedStrokeData, 'star', deviceCapabilities);
                            } else {
                                storedFeatures = storedDrawings.star.metrics || {};
                            }
                        } else {
                            // Use metrics (already parsed from JSONB)
                            storedFeatures = storedDrawings.star.metrics || {};
                        }
                    } catch (error) {
                        console.error('Error processing stored star features:', error);
                        storedFeatures = {};
                    }
                    
                    // Collect star enhanced features
                    if (ENABLE_ENHANCED_FEATURES && attemptFeatures && Object.keys(attemptFeatures).length > 0) {
                        addFeaturesToCollection('drawings', 'star', attemptFeatures);
                        console.log('✅ Collected star enhanced features:', Object.keys(attemptFeatures).length, 'features');
                    }
                    
                    // Calculate enhanced score
                    const scoreResult = calculateEnhancedComponentScore(storedFeatures, attemptFeatures, 'star');
                    const starScore = scoreResult.overall_score * 100;
                    
                    scores.star = Math.round(starScore);
                    scores.star_biometric = scoreResult.biometric_score;
                    scores.star_geometric = scoreResult.geometric_score;
                    totalScore += starScore;
                    scoreCount++;
                    console.log('✅ Star drawing score:', scores.star, 
                        `(biometric: ${Math.round(scoreResult.biometric_score * 100)}, geometric: ${Math.round(scoreResult.geometric_score * 100)})`);
                } catch (error) {
                    console.error('Error in star drawing comparison:', error);
                    scores.star = 0;
                }
            }
            
            if (drawings.house && storedDrawings.house) {
                try {
                    console.log('Comparing house drawing with enhanced features...');
                    
                    // Extract stroke data and device capabilities
                    const strokeData = extractStrokeDataFromSignaturePad(drawings.house);
                    const deviceCapabilities = drawings.house.device_capabilities || metadata?.device_capabilities || null;
                    
                    // Debug logging for stroke data extraction
                    console.log('🔍 Debug house drawing data:', {
                        hasDrawingData: !!drawings.house,
                        hasRawData: !!drawings.house?.raw,
                        rawDataType: typeof drawings.house?.raw,
                        rawDataLength: Array.isArray(drawings.house?.raw) ? drawings.house.raw.length : 'not array',
                        strokeDataExtracted: !!strokeData,
                        strokeCount: strokeData ? strokeData.length : 0
                    });
                    
                    // Extract enhanced features for attempt
                    let attemptFeatures;
                    if (ENABLE_ENHANCED_FEATURES && strokeData && strokeData.length > 0) {
                        try {
                            attemptFeatures = extractBiometricFeatures(strokeData, 'house', deviceCapabilities);
                            console.log('✅ Successfully extracted house enhanced features');
                        } catch (error) {
                            console.error('❌ Enhanced features extraction failed for house:', error);
                            attemptFeatures = {
                                strokeCount: strokeData.length,
                                pointCount: strokeData.reduce((sum, s) => sum + (Array.isArray(s) ? s.length : 0), 0),
                                _enhanced_features_error: error.message,
                                _enhanced_features_enabled: false
                            };
                        }
                    } else {
                        attemptFeatures = {
                            strokeCount: strokeData?.length || 0,
                            pointCount: strokeData?.reduce((sum, s) => sum + (Array.isArray(s) ? s.length : 0), 0) || 0,
                            _enhanced_features_error: strokeData ? 'Enhanced features disabled' : 'No stroke data',
                            _enhanced_features_enabled: false
                        };
                    }
                    
                    // Get stored enhanced features or calculate from stored data
                    let storedFeatures;
                    try {
                        if (storedDrawings.house.enhanced_features) {
                            // enhanced_features is already parsed from JSONB column
                            storedFeatures = storedDrawings.house.enhanced_features;
                        } else if (ENABLE_ENHANCED_FEATURES) {
                            // Calculate from stored drawing data (already parsed from JSONB)
                            const storedStrokeData = extractStrokeDataFromSignaturePad(storedDrawings.house.data);
                            if (storedStrokeData && storedStrokeData.length > 0) {
                                storedFeatures = extractBiometricFeatures(storedStrokeData, 'house', deviceCapabilities);
                            } else {
                                storedFeatures = storedDrawings.house.metrics || {};
                            }
                        } else {
                            // Use metrics (already parsed from JSONB)
                            storedFeatures = storedDrawings.house.metrics || {};
                        }
                    } catch (error) {
                        console.error('Error processing stored house features:', error);
                        storedFeatures = {};
                    }
                    
                    // Collect house enhanced features
                    if (ENABLE_ENHANCED_FEATURES && attemptFeatures && Object.keys(attemptFeatures).length > 0) {
                        addFeaturesToCollection('drawings', 'house', attemptFeatures);
                        console.log('✅ Collected house enhanced features:', Object.keys(attemptFeatures).length, 'features');
                    }
                    
                    // Calculate enhanced score
                    const scoreResult = calculateEnhancedComponentScore(storedFeatures, attemptFeatures, 'house');
                    const houseScore = scoreResult.overall_score * 100;
                    
                    scores.house = Math.round(houseScore);
                    totalScore += houseScore;
                    scoreCount++;
                    console.log('✅ House drawing score:', scores.house, 
                        `(biometric: ${Math.round(scoreResult.biometric_score * 100)}, geometric: ${Math.round(scoreResult.geometric_score * 100)})`);
                } catch (error) {
                    console.error('Error in house drawing comparison:', error);
                    scores.house = 0;
                }
            }
            
            if (drawings.connect_dots && storedDrawings.connect_dots) {
                try {
                    console.log('Comparing connect dots drawing with enhanced features...');
                    
                    // Extract stroke data and device capabilities
                    const strokeData = extractStrokeDataFromSignaturePad(drawings.connect_dots);
                    const deviceCapabilities = drawings.connect_dots.device_capabilities || metadata?.device_capabilities || null;
                    
                    // Debug logging for stroke data extraction
                    console.log('🔍 Debug connect_dots drawing data:', {
                        hasDrawingData: !!drawings.connect_dots,
                        hasRawData: !!drawings.connect_dots?.raw,
                        rawDataType: typeof drawings.connect_dots?.raw,
                        rawDataLength: Array.isArray(drawings.connect_dots?.raw) ? drawings.connect_dots.raw.length : 'not array',
                        strokeDataExtracted: !!strokeData,
                        strokeCount: strokeData ? strokeData.length : 0
                    });
                    
                    // Extract enhanced features for attempt
                    let attemptFeatures;
                    if (ENABLE_ENHANCED_FEATURES && strokeData && strokeData.length > 0) {
                        try {
                            attemptFeatures = extractBiometricFeatures(strokeData, 'connect_dots', deviceCapabilities);
                            console.log('✅ Successfully extracted connect_dots enhanced features');
                        } catch (error) {
                            console.error('❌ Enhanced features extraction failed for connect_dots:', error);
                            attemptFeatures = {
                                strokeCount: strokeData.length,
                                pointCount: strokeData.reduce((sum, s) => sum + (Array.isArray(s) ? s.length : 0), 0),
                                _enhanced_features_error: error.message,
                                _enhanced_features_enabled: false
                            };
                        }
                    } else {
                        attemptFeatures = {
                            strokeCount: strokeData?.length || 0,
                            pointCount: strokeData?.reduce((sum, s) => sum + (Array.isArray(s) ? s.length : 0), 0) || 0,
                            _enhanced_features_error: strokeData ? 'Enhanced features disabled' : 'No stroke data',
                            _enhanced_features_enabled: false
                        };
                    }
                    
                    // Get stored enhanced features or calculate from stored data
                    let storedFeatures;
                    try {
                        if (storedDrawings.connect_dots.enhanced_features) {
                            // enhanced_features is already parsed from JSONB column
                            storedFeatures = storedDrawings.connect_dots.enhanced_features;
                        } else if (ENABLE_ENHANCED_FEATURES) {
                            // Calculate from stored drawing data (already parsed from JSONB)
                            const storedStrokeData = extractStrokeDataFromSignaturePad(storedDrawings.connect_dots.data);
                            if (storedStrokeData && storedStrokeData.length > 0) {
                                storedFeatures = extractBiometricFeatures(storedStrokeData, 'connect_dots', deviceCapabilities);
                            } else {
                                storedFeatures = storedDrawings.connect_dots.metrics || {};
                            }
                        } else {
                            // Use metrics (already parsed from JSONB)
                            storedFeatures = storedDrawings.connect_dots.metrics || {};
                        }
                    } catch (error) {
                        console.error('Error processing stored connect_dots features:', error);
                        storedFeatures = {};
                    }
                    
                    // Collect connect_dots enhanced features
                    if (ENABLE_ENHANCED_FEATURES && attemptFeatures && Object.keys(attemptFeatures).length > 0) {
                        addFeaturesToCollection('drawings', 'connect_dots', attemptFeatures);
                        console.log('✅ Collected connect_dots enhanced features:', Object.keys(attemptFeatures).length, 'features');
                    }
                    
                    // Calculate enhanced score
                    const scoreResult = calculateEnhancedComponentScore(storedFeatures, attemptFeatures, 'connect_dots');
                    const connectDotsScore = scoreResult.overall_score * 100;
                    
                    scores.connect_dots = Math.round(connectDotsScore);
                    totalScore += connectDotsScore;
                    scoreCount++;
                    console.log('✅ Connect dots score:', scores.connect_dots, 
                        `(biometric: ${Math.round(scoreResult.biometric_score * 100)}, geometric: ${Math.round(scoreResult.geometric_score * 100)})`);
                } catch (error) {
                    console.error('Error in connect dots drawing comparison:', error);
                    scores.connect_dots = 0;
                }
            }
        } else if (hasDrawings) {
            // Estimate drawing scores based on signature score
            console.log('Estimating drawing scores based on signature score:', signatureScore);
            scores.star = Math.round(signatureScore * 0.85);      // Has consistent patterns
            scores.face = Math.round(signatureScore * 0.8);       // Most variable
            scores.house = Math.round(signatureScore * 0.82);     // Structured but complex
            scores.connect_dots = Math.round(signatureScore * 0.88);  // Follows a pattern
            totalScore += scores.star + scores.face + scores.house + scores.connect_dots;
            scoreCount += 4;
            console.log('✅ Estimated drawing scores:', { star: scores.star, face: scores.face, house: scores.house, connect_dots: scores.connect_dots });
        }
        
        const averageScore = totalScore / scoreCount;
        scores.average = Math.round(averageScore);
        
        // All components are now required, so no estimation needed
        // The scores object will contain actual scores from all components
        
        // All components are required, so use the highest threshold
        let threshold = 50; // Threshold for full multi-factor authentication
        
        const isSuccess = averageScore >= threshold;
        
        // Save authentication signature with stroke data for tracking
        let authSignatureId = null;
        try {
            // Calculate ML features for the authentication signature
            const mlFeatures = calculateMLFeatures(signature);
            
            // Extract stroke data
            const strokeData = extractStrokeData(signature);
            
            if (strokeData) {
                // Save the authentication signature (not marked as enrollment)
                const sigResult = await insertSignatureWithFallback(pool, { userId, strokeData, signature, mlFeatures, isEnrollment: false });
                
                authSignatureId = sigResult.rows[0].id;
                console.log('Saved auth signature with stroke data - ID:', authSignatureId, 'size:', JSON.stringify(strokeData).length, 'format: stroke_data');
            } else {
                console.warn('No stroke data found for auth signature');
            }
        } catch (err) {
            console.error('Failed to save auth signature:', err);
        }
        
        // Record authentication attempt with signature reference, shape scores, and drawing scores
        try {
            // Build component scores from all scores (including estimated ones)
            const shapeScores = {};
            const drawingScores = {};
            
            // Define which components are part of the current authentication flow
            // Based on the frontend signInSteps configuration
            const authFlowShapes = ['circle', 'square', 'triangle'];
            const authFlowDrawings = ['face', 'star'];
            
            // Extract shape scores (only for components in auth flow)
            authFlowShapes.forEach(shape => {
                if (scores[shape] !== undefined) {
                    shapeScores[shape] = scores[shape];
                }
            });
            
            // Extract drawing scores (only for components in auth flow)
            authFlowDrawings.forEach(drawing => {
                if (scores[drawing] !== undefined) {
                    drawingScores[drawing] = scores[drawing];
                }
            });
            
            // Collect enhanced biometric scores
            const shapeBiometricScores = {};
            const drawingBiometricScores = {};
            
            // Store biometric scores from shapes (stored in scoreResult during authentication)
            authFlowShapes.forEach(shape => {
                if (scores[`${shape}_biometric`] !== undefined) {
                    shapeBiometricScores[shape] = {
                        biometric: scores[`${shape}_biometric`],
                        geometric: scores[`${shape}_geometric`]
                    };
                }
            });
            
            // Store biometric scores from drawings
            authFlowDrawings.forEach(drawing => {
                if (scores[`${drawing}_biometric`] !== undefined) {
                    drawingBiometricScores[drawing] = {
                        biometric: scores[`${drawing}_biometric`],
                        geometric: scores[`${drawing}_geometric`]
                    };
                }
            });
            
            // Create properly structured scores object with clear separation
            const structuredScores = {
                signature: scores.signature,
                shape_scores: Object.keys(shapeScores).length > 0 ? shapeScores : {},
                drawing_scores: Object.keys(drawingScores).length > 0 ? drawingScores : {},
                shape_biometric_scores: Object.keys(shapeBiometricScores).length > 0 ? shapeBiometricScores : null,
                drawing_biometric_scores: Object.keys(drawingBiometricScores).length > 0 ? drawingBiometricScores : null,
                _enhanced_features_enabled: ENABLE_ENHANCED_FEATURES
            };
            
            // Prepare comprehensive enhanced features object for storage
            const authAttemptEnhancedFeatures = {
                ...enhancedFeaturesCollection,
                _device_capabilities: metadata?.device_capabilities || null,
                _processing_summary: {
                    total_features_collected: enhancedFeaturesCollection._total_components_processed,
                    signature_features: enhancedFeaturesCollection.signature ? Object.keys(enhancedFeaturesCollection.signature).length : 0,
                    shape_components: Object.keys(enhancedFeaturesCollection.shapes).length,
                    drawing_components: Object.keys(enhancedFeaturesCollection.drawings).length,
                    estimated_total_features: (
                        (enhancedFeaturesCollection.signature ? Object.keys(enhancedFeaturesCollection.signature).length : 0) +
                        Object.values(enhancedFeaturesCollection.shapes).reduce((sum, features) => sum + Object.keys(features).length, 0) +
                        Object.values(enhancedFeaturesCollection.drawings).reduce((sum, features) => sum + Object.keys(features).length, 0)
                    )
                }
            };

            console.log('🔍 Enhanced Features Collection Summary:', {
                signature: !!authAttemptEnhancedFeatures.signature,
                shapes: Object.keys(authAttemptEnhancedFeatures.shapes),
                drawings: Object.keys(authAttemptEnhancedFeatures.drawings),
                total_estimated_features: authAttemptEnhancedFeatures._processing_summary.estimated_total_features
            });

            console.log('Saving authentication attempt:', {
                userId,
                success: isSuccess,
                confidence: averageScore,
                signatureId: authSignatureId,
                scores: structuredScores,
                enhanced_features_collected: authAttemptEnhancedFeatures._processing_summary.total_features_collected
            });
            
            // Store in database with properly structured JSON including enhanced features
            // Use fallback mechanism for enhanced_features column
            try {
                // First, try with enhanced_features column
                await pool.query(
                    'INSERT INTO auth_attempts (user_id, success, confidence, device_info, signature_id, drawing_scores, enhanced_features) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [userId, isSuccess, averageScore, req.headers['user-agent'] || 'Unknown', authSignatureId, 
                     JSON.stringify(structuredScores), JSON.stringify(authAttemptEnhancedFeatures)]
                );
                console.log('✅ Auth attempt stored with enhanced features from', authAttemptEnhancedFeatures._total_components_processed, 'components');
            } catch (columnError) {
                // If enhanced_features column doesn't exist, fall back to basic insert
                if (columnError.code === '42703') { // PostgreSQL error code for undefined column
                    console.log('⚠️ enhanced_features column not found, using fallback insert');
                    await pool.query(
                        'INSERT INTO auth_attempts (user_id, success, confidence, device_info, signature_id, drawing_scores) VALUES ($1, $2, $3, $4, $5, $6)',
                        [userId, isSuccess, averageScore, req.headers['user-agent'] || 'Unknown', authSignatureId, 
                         JSON.stringify(structuredScores)]
                    );
                    console.log('✅ Auth attempt stored with fallback (enhanced features not available)');
                } else {
                    // Re-throw if it's not a column error
                    throw columnError;
                }
            }
            
            console.log('✅ Authentication attempt saved successfully');
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
        
        // Get shapes with metrics and enhanced features
        const shapes = await pool.query(
            'SELECT shape_type, metrics, enhanced_features, created_at FROM shapes WHERE user_id = $1 ORDER BY created_at DESC',
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
                enhanced_features: row.enhanced_features,
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
    // Start with basic ML features
    const basicFeatures = [
        'stroke_count', 'total_points', 'total_duration_ms', 'avg_points_per_stroke',
        'avg_velocity', 'max_velocity', 'min_velocity', 'velocity_std',
        'width', 'height', 'area', 'aspect_ratio', 'center_x', 'center_y',
        'avg_stroke_length', 'total_length', 'length_variation', 
        'avg_stroke_duration', 'duration_variation'
    ];
    
    // Dynamically discover all features from signatures
    const allFeatures = new Set(basicFeatures);
    const excludedFeatures = new Set();
    const supportedFeatures = new Set();
    
    // Scan all signatures to find all available features
    signatures.forEach(sig => {
        if (sig.metrics && typeof sig.metrics === 'object') {
            // Add any excluded features to our tracking
            if (sig.metrics._excluded_features) {
                sig.metrics._excluded_features.forEach(f => excludedFeatures.add(f));
            }
            
            // Add supported features
            if (sig.metrics._supported_features) {
                sig.metrics._supported_features.forEach(f => {
                    allFeatures.add(f);
                    supportedFeatures.add(f);
                });
            } else {
                // Fallback: discover features from metrics object
                Object.keys(sig.metrics).forEach(key => {
                    if (!key.startsWith('_') && !excludedFeatures.has(key)) {
                        allFeatures.add(key);
                        supportedFeatures.add(key); // Add discovered features to supported features
                    }
                });
            }
        }
    });
    
    // Remove excluded features from calculation
    excludedFeatures.forEach(f => allFeatures.delete(f));
    
    const baseline = {};
    
    // Initialize sums for each feature
    allFeatures.forEach(feature => {
        baseline[feature] = { sum: 0, count: 0, values: [] };
    });
    
    // Aggregate metrics from all enrollment signatures
    signatures.forEach(sig => {
        if (sig.metrics && typeof sig.metrics === 'object') {
            allFeatures.forEach(feature => {
                // Skip excluded features
                if (sig.metrics._excluded_features && sig.metrics._excluded_features.includes(feature)) {
                    return;
                }
                
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
    allFeatures.forEach(feature => {
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
            // Don't include features with no valid data
            console.log(`Feature ${feature} has no valid data across all signatures`);
        }
    });
    
    // Add metadata about supported and excluded features
    result._supported_features = Array.from(supportedFeatures);
    result._excluded_features = Array.from(excludedFeatures);
    result._baseline_signature_count = signatures.length;
    
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
        // Now using direct signature_id relationship for accurate matching
        const recentAuthSignatures = await pool.query(`
            SELECT s.*, a.created_at as auth_time, a.success, a.confidence 
            FROM auth_attempts a
            JOIN signatures s ON s.id = a.signature_id
            WHERE a.user_id = $1
                AND a.signature_id IS NOT NULL
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
            if (sig.stroke_data) {
                try {
                    const sigData = typeof sig.stroke_data === 'string' ? 
                        JSON.parse(sig.stroke_data) : sig.stroke_data;
                    signatureStrokes = sigData.data || sigData.strokes || sigData;
                } catch (e) {
                    console.error('Error parsing stroke data:', e);
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
        
        // Get enrollment signatures (first 3) with displayable signature data
        const enrollmentSignatures = signatures.rows.slice(-3).reverse().map(sig => {
            // Extract displayable data from the signature
            const displayableData = extractDisplayableSignatureData(sig.stroke_data);
            return {
                signature: displayableData,  // Now contains just the stroke data or base64
                metrics: sig.metrics || {},
                created_at: sig.created_at,
                id: sig.id
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

// Enhanced baseline calculation function that includes shapes and drawings
function calculateEnhancedBaseline(signatures, shapes, drawings) {
    // Calculate signature baseline (existing logic)
    const signatureBaseline = calculateUserBaseline(signatures);
    
    // Calculate shape-specific baseline metrics
    const shapeBaseline = calculateShapeBaseline(shapes);
    
    // Calculate drawing-specific baseline metrics  
    const drawingBaseline = calculateDrawingBaseline(drawings);
    
    // Structure the baseline data correctly for the API response
    const baseline = {
        ...signatureBaseline
    };
    
    // Add shape features if available
    if (shapeBaseline.circle_roundness !== null || 
        shapeBaseline.square_corner_accuracy !== null || 
        shapeBaseline.triangle_closure !== null) {
        baseline.shape_features = {
            circle_roundness: shapeBaseline.circle_roundness,
            square_corners: shapeBaseline.square_corner_accuracy, // Map to expected name
            triangle_closure: shapeBaseline.triangle_closure
        };
        
        // Add enhanced features if available
        if (shapeBaseline.shape_enhanced_features && 
            Object.keys(shapeBaseline.shape_enhanced_features).length > 0) {
            baseline.shape_enhanced_features = shapeBaseline.shape_enhanced_features;
        }
    }
    
    // Add drawing features if available
    if (drawingBaseline.face_score !== null || 
        drawingBaseline.star_score !== null || 
        drawingBaseline.house_score !== null || 
        drawingBaseline.connect_dots_score !== null) {
        baseline.drawing_features = {
            face_features: drawingBaseline.face_score,
            star_points: drawingBaseline.star_score,
            house_structure: drawingBaseline.house_score,
            connect_dots: drawingBaseline.connect_dots_score
        };
        
        // Add enhanced features if available
        if (drawingBaseline.drawing_enhanced_features && 
            Object.keys(drawingBaseline.drawing_enhanced_features).length > 0) {
            baseline.drawing_enhanced_features = drawingBaseline.drawing_enhanced_features;
        }
    }
    
    return baseline;
}

function calculateShapeBaseline(shapes) {
    if (!shapes || shapes.length === 0) {
        return {
            circle_roundness: null,
            square_corner_accuracy: null,  // FIXED: was square_corners
            triangle_closure: null,
            shape_enhanced_features: null
        };
    }
    
    const baseline = {
        shape_enhanced_features: {}
    };
    
    // Aggregate enhanced features across all shapes
    const allEnhancedFeatures = [];
    
    shapes.forEach(shape => {
        const shapeType = shape.shape_type;
        const metrics = shape.metrics || {};
        
        // Extract enhanced features if available
        if (shape.enhanced_features) {
            try {
                const enhancedFeatures = typeof shape.enhanced_features === 'string' 
                    ? JSON.parse(shape.enhanced_features) 
                    : shape.enhanced_features;
                    
                if (enhancedFeatures && Object.keys(enhancedFeatures).length > 0) {
                    allEnhancedFeatures.push(enhancedFeatures);
                }
            } catch (e) {
                console.error('Error parsing shape enhanced features:', e);
            }
        }
        
        switch(shapeType) {
            case 'circle':
                // Calculate roundness from aspect ratio and other metrics
                baseline.circle_roundness = calculateCircleRoundness(metrics);
                break;
            case 'square':
                // FIXED: Return with correct property name
                baseline.square_corner_accuracy = calculateSquareCorners(metrics);
                break;
            case 'triangle':
                // Calculate closure quality from shape metrics
                baseline.triangle_closure = calculateTriangleClosure(metrics);
                break;
        }
    });
    
    // Calculate baseline for enhanced features if available
    if (allEnhancedFeatures.length > 0) {
        baseline.shape_enhanced_features = calculateEnhancedFeatureBaseline(allEnhancedFeatures);
    }
    
    return baseline;
}

function calculateDrawingBaseline(drawings) {
    if (!drawings || drawings.length === 0) {
        return {
            face_score: null,
            star_score: null,
            house_score: null,
            connect_dots_score: null,
            drawing_enhanced_features: null
        };
    }
    
    const baseline = {
        drawing_enhanced_features: {}
    };
    
    // Aggregate enhanced features across all drawings
    const allEnhancedFeatures = [];
    
    drawings.forEach(drawing => {
        const drawingType = drawing.drawing_type;
        const metrics = drawing.metrics || {};
        let enhancedFeatures = null;
        let enhancedFeaturesEnabled = false;
        
        // Extract enhanced features if available
        if (drawing.enhanced_features) {
            try {
                enhancedFeatures = typeof drawing.enhanced_features === 'string' 
                    ? JSON.parse(drawing.enhanced_features) 
                    : drawing.enhanced_features;
                    
                if (enhancedFeatures && Object.keys(enhancedFeatures).length > 0) {
                    allEnhancedFeatures.push(enhancedFeatures);
                    enhancedFeaturesEnabled = enhancedFeatures._enhanced_features_enabled ?? true;
                }
            } catch (e) {
                console.error('Error parsing drawing enhanced features:', e);
            }
        }
        
        // Check if this drawing actually has data
        const hasData = metrics.strokeCount > 0 && metrics.pointCount > 0;
        
        switch(drawingType) {
            case 'face':
                baseline.face_score = hasData ? calculateFaceScore(metrics, enhancedFeatures, enhancedFeaturesEnabled) : null;
                break;
            case 'star':
                baseline.star_score = hasData ? calculateStarScore(metrics, enhancedFeatures, enhancedFeaturesEnabled) : null;
                break;
            case 'house':
                baseline.house_score = hasData ? calculateHouseScore(metrics, enhancedFeatures, enhancedFeaturesEnabled) : null;
                break;
            case 'connect_dots':
                baseline.connect_dots_score = hasData ? calculateConnectDotsScore(metrics, enhancedFeatures, enhancedFeaturesEnabled) : null;
                break;
        }
    });
    
    // Calculate baseline for enhanced features if available
    if (allEnhancedFeatures.length > 0) {
        baseline.drawing_enhanced_features = calculateEnhancedFeatureBaseline(allEnhancedFeatures);
    }
    
    return baseline;
}

// Calculate baseline for enhanced features by averaging across multiple samples
function calculateEnhancedFeatureBaseline(featureSamples) {
    if (!featureSamples || featureSamples.length === 0) {
        return null;
    }
    
    const baseline = {};
    const featureSums = {};
    const featureCounts = {};
    
    // Aggregate all features across samples
    featureSamples.forEach(sample => {
        Object.keys(sample).forEach(feature => {
            // Skip metadata fields
            if (feature.startsWith('_')) return;
            
            const value = sample[feature];
            if (typeof value === 'number' && !isNaN(value)) {
                if (!featureSums[feature]) {
                    featureSums[feature] = 0;
                    featureCounts[feature] = 0;
                }
                featureSums[feature] += value;
                featureCounts[feature]++;
            }
        });
    });
    
    // Calculate averages
    Object.keys(featureSums).forEach(feature => {
        baseline[feature] = featureSums[feature] / featureCounts[feature];
    });
    
    return baseline;
}

// Shape-specific scoring functions
function calculateCircleRoundness(metrics) {
    // A perfect circle has aspect ratio of 1.0
    const aspectRatio = metrics.aspect_ratio || 1;
    const roundness = Math.max(0, 100 - Math.abs(aspectRatio - 1) * 100);
    return Math.round(roundness);
}

function calculateSquareCorners(metrics) {
    // A perfect square has aspect ratio close to 1.0
    const aspectRatio = metrics.aspect_ratio || 1;
    const squareness = Math.max(0, 100 - Math.abs(aspectRatio - 1) * 50);
    return Math.round(squareness);
}

function calculateTriangleClosure(metrics) {
    // For now, use stroke consistency as a proxy for closure quality
    const velocity_std = metrics.velocity_std || 0;
    const closure = Math.max(0, 100 - velocity_std * 200);
    return Math.round(closure);
}

// Calculate biometric authenticity score from enhanced features
function calculateBiometricAuthenticity(enhancedFeatures) {
    if (!enhancedFeatures || !enhancedFeatures._enhanced_features_enabled) {
        return 50; // Default score if no enhanced features
    }
    
    let score = 0;
    let weightTotal = 0;
    
    // Behavioral timing features (30% weight)
    const timingFeatures = ['rhythm_consistency', 'tempo_variation', 'pause_detection', 
                           'inter_stroke_timing', 'dwell_time_patterns'];
    const timingWeight = 30;
    let timingScore = 0;
    let timingCount = 0;
    
    timingFeatures.forEach(feature => {
        if (enhancedFeatures[feature] !== undefined && enhancedFeatures[feature] !== null) {
            // Normalize timing scores to 0-100 range
            let normalized = enhancedFeatures[feature];
            if (feature === 'rhythm_consistency') {
                normalized = Math.min(100, normalized * 100);
            } else if (feature === 'tempo_variation') {
                normalized = Math.max(0, 100 - (normalized * 50));
            }
            timingScore += normalized;
            timingCount++;
        }
    });
    
    if (timingCount > 0) {
        score += (timingScore / timingCount) * (timingWeight / 100);
        weightTotal += timingWeight;
    }
    
    // Advanced geometric features (30% weight)
    const geometricFeatures = ['stroke_complexity', 'smoothness_index', 'tremor_index',
                               'spatial_efficiency', 'curvature_analysis'];
    const geometricWeight = 30;
    let geometricScore = 0;
    let geometricCount = 0;
    
    geometricFeatures.forEach(feature => {
        if (enhancedFeatures[feature] !== undefined && enhancedFeatures[feature] !== null) {
            let normalized = enhancedFeatures[feature];
            if (feature === 'tremor_index') {
                normalized = Math.max(0, 100 - (normalized * 100));
            } else {
                normalized = Math.min(100, normalized * 100);
            }
            geometricScore += normalized;
            geometricCount++;
        }
    });
    
    if (geometricCount > 0) {
        score += (geometricScore / geometricCount) * (geometricWeight / 100);
        weightTotal += geometricWeight;
    }
    
    // Security indicators (20% weight)
    const securityFeatures = ['behavioral_authenticity_score', 'timing_regularity_score',
                             'device_consistency_score'];
    const securityWeight = 20;
    let securityScore = 0;
    let securityCount = 0;
    
    securityFeatures.forEach(feature => {
        if (enhancedFeatures[feature] !== undefined && enhancedFeatures[feature] !== null) {
            securityScore += Math.min(100, enhancedFeatures[feature] * 100);
            securityCount++;
        }
    });
    
    if (securityCount > 0) {
        score += (securityScore / securityCount) * (securityWeight / 100);
        weightTotal += securityWeight;
    }
    
    // Pressure features if available (20% weight)
    if (!enhancedFeatures._excluded_features?.includes('avg_pressure')) {
        const pressureFeatures = ['pressure_std', 'pressure_buildup_rate', 'contact_time_ratio'];
        const pressureWeight = 20;
        let pressureScore = 0;
        let pressureCount = 0;
        
        pressureFeatures.forEach(feature => {
            if (enhancedFeatures[feature] !== undefined && enhancedFeatures[feature] !== null) {
                pressureScore += Math.min(100, enhancedFeatures[feature] * 100);
                pressureCount++;
            }
        });
        
        if (pressureCount > 0) {
            score += (pressureScore / pressureCount) * (pressureWeight / 100);
            weightTotal += pressureWeight;
        }
    }
    
    // Normalize final score
    if (weightTotal > 0) {
        return Math.round((score / weightTotal) * 100);
    }
    
    return 50; // Default if no features could be scored
}

// Calculate structural accuracy for drawings
function calculateStructuralAccuracy(metrics, drawingType) {
    if (!metrics || metrics.strokeCount === 0) return 0;
    
    const strokeCount = metrics.strokeCount || 0;
    const pointCount = metrics.pointCount || 0;
    
    switch(drawingType) {
        case 'face':
            // A face typically has 3-7 strokes
            const faceStrokeScore = Math.min(100, (strokeCount / 5) * 100);
            const facePointScore = Math.min(100, (pointCount / 50) * 100);
            return Math.round((faceStrokeScore + facePointScore) / 2);
            
        case 'star':
            // A 5-pointed star typically has 1-2 strokes
            const starStrokeScore = strokeCount >= 1 ? 80 : 20;
            const starPointScore = Math.min(100, (pointCount / 30) * 100);
            return Math.round((starStrokeScore + starPointScore) / 2);
            
        case 'house':
            // A house typically has 4-8 strokes
            const houseStrokeScore = Math.min(100, (strokeCount / 6) * 100);
            const housePointScore = Math.min(100, (pointCount / 60) * 100);
            return Math.round((houseStrokeScore + housePointScore) / 2);
            
        case 'connect_dots':
            // Connect dots should be efficient
            const efficiency = strokeCount > 0 ? Math.max(0, 100 - (strokeCount - 1) * 20) : 0;
            const completeness = Math.min(100, (pointCount / 20) * 100);
            return Math.round((efficiency + completeness) / 2);
            
        default:
            return 50;
    }
}

// Enhanced drawing score calculation
function calculateEnhancedDrawingScore(drawingData, drawingType) {
    // Check if enhanced features exist
    if (drawingData.enhanced_features && drawingData._enhanced_features_enabled) {
        // Use enhanced biometric features for scoring
        const enhancedFeatures = {
            ...drawingData.enhanced_features,
            _enhanced_features_enabled: true
        };
        
        // Combine biometric authenticity with structural accuracy
        const biometricScore = calculateBiometricAuthenticity(enhancedFeatures);
        const structuralScore = calculateStructuralAccuracy(drawingData.metrics, drawingType);
        
        // Weight: 80% biometric, 20% structural for drawings
        return Math.round((biometricScore * 0.8) + (structuralScore * 0.2));
    }
    
    // Fallback to basic scoring for legacy data
    return calculateStructuralAccuracy(drawingData.metrics, drawingType);
}

// Drawing-specific scoring functions (updated to use enhanced features)
function calculateFaceScore(metrics, enhancedFeatures = null, enhancedFeaturesEnabled = false) {
    // If no actual data, return null
    if (!metrics || metrics.strokeCount === 0) return null;
    
    // Use enhanced scoring if available
    if (enhancedFeatures && enhancedFeaturesEnabled) {
        return calculateEnhancedDrawingScore(
            { metrics, enhanced_features: enhancedFeatures, _enhanced_features_enabled: true },
            'face'
        );
    }
    
    // Fallback to basic scoring
    return calculateStructuralAccuracy(metrics, 'face');
}

function calculateStarScore(metrics, enhancedFeatures = null, enhancedFeaturesEnabled = false) {
    if (!metrics || metrics.strokeCount === 0) return null;
    
    // Use enhanced scoring if available
    if (enhancedFeatures && enhancedFeaturesEnabled) {
        return calculateEnhancedDrawingScore(
            { metrics, enhanced_features: enhancedFeatures, _enhanced_features_enabled: true },
            'star'
        );
    }
    
    // Fallback to basic scoring
    return calculateStructuralAccuracy(metrics, 'star');
}

function calculateHouseScore(metrics, enhancedFeatures = null, enhancedFeaturesEnabled = false) {
    if (!metrics || metrics.strokeCount === 0) return null;
    
    // Use enhanced scoring if available
    if (enhancedFeatures && enhancedFeaturesEnabled) {
        return calculateEnhancedDrawingScore(
            { metrics, enhanced_features: enhancedFeatures, _enhanced_features_enabled: true },
            'house'
        );
    }
    
    // Fallback to basic scoring
    return calculateStructuralAccuracy(metrics, 'house');
}

function calculateConnectDotsScore(metrics, enhancedFeatures = null, enhancedFeaturesEnabled = false) {
    if (!metrics || metrics.strokeCount === 0) return null;
    
    // Use enhanced scoring if available
    if (enhancedFeatures && enhancedFeaturesEnabled) {
        return calculateEnhancedDrawingScore(
            { metrics, enhanced_features: enhancedFeatures, _enhanced_features_enabled: true },
            'connect_dots'
        );
    }
    
    // Fallback to basic scoring
    return calculateStructuralAccuracy(metrics, 'connect_dots');
}

// Enhanced detailed-analysis endpoint with proper ML feature extraction
app.get('/api/user/:username/detailed-analysis', async (req, res) => {
    try {
        // Get user
        const userResult = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [req.params.username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        // Get enrollment data (signatures, shapes, drawings)
        const [signatures, shapes, drawings] = await Promise.all([
            pool.query('SELECT id, user_id, stroke_data, metrics, data_format, created_at FROM signatures WHERE user_id = $1 ORDER BY created_at ASC', [user.id]),
            pool.query('SELECT id, user_id, shape_type, metrics, enhanced_features, created_at FROM shapes WHERE user_id = $1 ORDER BY created_at ASC', [user.id]),
            pool.query('SELECT id, user_id, drawing_type, metrics, enhanced_features, created_at FROM drawings WHERE user_id = $1 ORDER BY created_at ASC', [user.id])
        ]);
        
        // Calculate enhanced baseline including shapes and drawings
        const baseline = calculateEnhancedBaseline(
            signatures.rows, 
            shapes.rows, 
            drawings.rows
        );
        
        // Get auth attempts with enhanced ML feature extraction
        // Use fallback mechanism for enhanced_features column
        let authAttemptsResult;
        try {
            // First, try with enhanced_features column
            authAttemptsResult = await pool.query(`
                SELECT 
                    a.id,
                    a.created_at,
                    a.success,
                    a.confidence,
                    a.device_info,
                    a.drawing_scores,
                    a.enhanced_features,
                    a.signature_id,
                    s.metrics as signature_metrics
                FROM auth_attempts a
                LEFT JOIN signatures s ON a.signature_id = s.id
                WHERE a.user_id = $1
                ORDER BY a.created_at DESC
                LIMIT 50
            `, [user.id]);
        } catch (columnError) {
            // If enhanced_features column doesn't exist, fall back to basic select
            if (columnError.code === '42703') { // PostgreSQL error code for undefined column
                console.log('⚠️ enhanced_features column not found in SELECT, using fallback query');
                authAttemptsResult = await pool.query(`
                    SELECT 
                        a.id,
                        a.created_at,
                        a.success,
                        a.confidence,
                        a.device_info,
                        a.drawing_scores,
                        a.signature_id,
                        s.metrics as signature_metrics
                    FROM auth_attempts a
                    LEFT JOIN signatures s ON a.signature_id = s.id
                    WHERE a.user_id = $1
                    ORDER BY a.created_at DESC
                    LIMIT 50
                `, [user.id]);
            } else {
                // Re-throw if it's not a column error
                throw columnError;
            }
        }
        
        // Process auth attempts to include ML features
        const enhancedAuthAttempts = authAttemptsResult.rows.map(attempt => {
            const mlFeatures = attempt.signature_metrics || {};
            
            // Extract enhanced biometric data from drawing_scores
            let shapeBiometricScores = null;
            let drawingBiometricScores = null;
            let enhancedFeaturesEnabled = false;
            
            if (attempt.drawing_scores) {
                try {
                    const scores = typeof attempt.drawing_scores === 'string' 
                        ? JSON.parse(attempt.drawing_scores) 
                        : attempt.drawing_scores;
                    
                    // Check for enhanced biometric scores in the new structure
                    if (scores.shape_biometric_scores) {
                        shapeBiometricScores = scores.shape_biometric_scores;
                    }
                    if (scores.drawing_biometric_scores) {
                        drawingBiometricScores = scores.drawing_biometric_scores;
                    }
                    if (scores._enhanced_features_enabled) {
                        enhancedFeaturesEnabled = true;
                    }
                } catch (e) {
                    console.error('Error parsing drawing scores for enhanced features:', e);
                }
            }
            
            // Parse enhanced features if available
            let enhancedFeatures = null;
            if (attempt.enhanced_features) {
                try {
                    enhancedFeatures = typeof attempt.enhanced_features === 'string' 
                        ? JSON.parse(attempt.enhanced_features) 
                        : attempt.enhanced_features;
                    enhancedFeaturesEnabled = enhancedFeatures._enhanced_features_enabled || enhancedFeaturesEnabled;
                    
                    console.log('📊 Enhanced features available for auth attempt', attempt.id, '- Components:', {
                        signature: !!enhancedFeatures.signature,
                        shapes: Object.keys(enhancedFeatures.shapes || {}),
                        drawings: Object.keys(enhancedFeatures.drawings || {})
                    });
                } catch (e) {
                    console.error('Error parsing enhanced features for auth attempt', attempt.id, ':', e);
                }
            }
            
            return {
                id: attempt.id,
                created_at: attempt.created_at,
                success: attempt.success,
                confidence: attempt.confidence,
                authentication_result: attempt.success ? 'success' : 'failed',
                device_info: attempt.device_info,
                drawing_scores: extractDrawingScores(attempt),
                signature_id: attempt.signature_id,
                
                // Include all ML features from signature metrics
                ...mlFeatures,
                
                // Add shape scores (if available)
                shape_scores: extractShapeScores(attempt),
                
                // Add enhanced biometric data
                shape_biometric_scores: shapeBiometricScores,
                drawing_biometric_scores: drawingBiometricScores,
                _enhanced_features_enabled: enhancedFeaturesEnabled || mlFeatures._enhanced_features_enabled,
                _excluded_features: mlFeatures._excluded_features,
                _feature_extraction_version: mlFeatures._feature_extraction_version,
                
                // Add enhanced features from all components
                enhanced_features: enhancedFeatures,
                
                // Add processing summary if available
                _processing_summary: enhancedFeatures?._processing_summary || null
            };
        });
        
        // Calculate device performance
        const devicePerformance = calculateDevicePerformance(enhancedAuthAttempts);
        
        res.json({
            user: {
                id: user.id,
                username: user.username,
                created_at: user.created_at
            },
            enrollment: {
                signatures: signatures.rows.map(sig => ({
                    id: sig.id,
                    created_at: sig.created_at,
                    metrics: sig.metrics
                    // Removed signature_data to reduce payload size
                })),
                shapes: shapes.rows.map(shape => ({
                    id: shape.id,
                    shape_type: shape.shape_type,
                    created_at: shape.created_at,
                    metrics: shape.metrics
                    // Removed shape_data to reduce payload size
                })),
                drawings: drawings.rows.map(drawing => ({
                    id: drawing.id,
                    drawing_type: drawing.drawing_type,
                    created_at: drawing.created_at,
                    metrics: drawing.metrics
                    // Removed drawing_data to reduce payload size
                }))
            },
            baseline,
            authAttempts: enhancedAuthAttempts,
            devicePerformance
        });
        
    } catch (error) {
        console.error('Detailed analysis error:', error);
        res.status(500).json({ error: 'Failed to fetch detailed analysis' });
    }
});

// Component-specific performance endpoint
app.get('/api/user/:username/component-performance/:type', async (req, res) => {
    const { username, type } = req.params;
    
    try {
        const userResult = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userId = userResult.rows[0].id;
        
        switch (type) {
            case 'signature':
                // Get signature performance over time
                const signaturePerf = await pool.query(
                    `SELECT 
                        a.created_at, a.confidence, a.success, a.signature_id,
                        s.metrics as signature_metrics
                     FROM auth_attempts a
                     LEFT JOIN signatures s ON a.signature_id = s.id
                     WHERE a.user_id = $1 AND a.signature_id IS NOT NULL
                     ORDER BY a.created_at DESC
                     LIMIT 100`,
                    [userId]
                );
                
                res.json({
                    type: 'signature',
                    performance: signaturePerf.rows
                });
                break;
                
            case 'shapes':
                // Shape performance would need to be extracted from auth attempts
                // For now, return a placeholder
                res.json({
                    type: 'shapes',
                    performance: [],
                    message: 'Shape-specific performance tracking coming soon'
                });
                break;
                
            case 'drawings':
                // Get drawing performance from auth attempts
                const drawingPerf = await pool.query(
                    `SELECT 
                        created_at, confidence, success, drawing_scores
                     FROM auth_attempts
                     WHERE user_id = $1 AND drawing_scores IS NOT NULL
                     ORDER BY created_at DESC
                     LIMIT 100`,
                    [userId]
                );
                
                res.json({
                    type: 'drawings',
                    performance: drawingPerf.rows
                });
                break;
                
            default:
                res.status(400).json({ error: 'Invalid component type' });
        }
        
    } catch (error) {
        console.error('Component performance error:', error);
        res.status(500).json({ error: 'Failed to fetch component performance' });
    }
});

// Authentication attempt breakdown endpoint
app.get('/api/auth-attempt/:attemptId/breakdown', async (req, res) => {
    const { attemptId } = req.params;
    
    try {
        const attemptResult = await pool.query(
            `SELECT 
                a.*, 
                s.stroke_data, s.metrics as signature_metrics,
                u.username
             FROM auth_attempts a
             JOIN users u ON a.user_id = u.id
             LEFT JOIN signatures s ON a.signature_id = s.id
             WHERE a.id = $1`,
            [attemptId]
        );
        
        if (attemptResult.rows.length === 0) {
            return res.status(404).json({ error: 'Authentication attempt not found' });
        }
        
        const attempt = attemptResult.rows[0];
        
        // Get enrollment signatures for comparison
        const enrollmentSigs = await pool.query(
            'SELECT stroke_data, metrics FROM signatures WHERE user_id = $1 ORDER BY created_at ASC LIMIT 3',
            [attempt.user_id]
        );
        
        res.json({
            attempt: {
                id: attempt.id,
                username: attempt.username,
                success: attempt.success,
                confidence: attempt.confidence,
                device_info: parseUserAgent(attempt.device_info),
                created_at: attempt.created_at,
                shape_scores: extractShapeScores(attempt),
                drawing_scores: extractDrawingScores(attempt)
            },
            signature: {
                data: extractDisplayableSignatureData(attempt.stroke_data),
                metrics: attempt.signature_metrics
            },
            enrollment_signatures: enrollmentSigs.rows.map(sig => ({
                ...sig,
                stroke_data: extractDisplayableSignatureData(sig.stroke_data)
            }))
        });
        
    } catch (error) {
        console.error('Auth attempt breakdown error:', error);
        res.status(500).json({ error: 'Failed to fetch attempt breakdown' });
    }
});

// Model training status endpoint
app.get('/api/model/training-status', async (req, res) => {
    try {
        // Read the latest model info file
        const fs = require('fs').promises;
        const path = require('path');
        const modelInfoPath = path.join(__dirname, '../ml-model/models/latest_model_info.json');
        
        try {
            const modelInfo = await fs.readFile(modelInfoPath, 'utf8');
            const parsedInfo = JSON.parse(modelInfo);
            
            // Get training data stats
            const genuinePath = path.join(__dirname, '../ml-model/data/genuine_signatures.json');
            const forgeryPath = path.join(__dirname, '../ml-model/data/forgery_signatures.json');
            
            let genuineCount = 0;
            let forgeryCount = 0;
            
            try {
                const genuineData = await fs.readFile(genuinePath, 'utf8');
                genuineCount = JSON.parse(genuineData).length;
            } catch (e) {
                console.log('Could not read genuine signatures');
            }
            
            try {
                const forgeryData = await fs.readFile(forgeryPath, 'utf8');
                forgeryCount = JSON.parse(forgeryData).length;
            } catch (e) {
                console.log('Could not read forgery signatures');
            }
            
            res.json({
                lastTrained: parsedInfo.timestamp,
                modelPath: parsedInfo.model_path,
                features: parsedInfo.feature_names,
                trainingData: {
                    genuine: genuineCount,
                    forgery: forgeryCount,
                    total: genuineCount + forgeryCount,
                    balance: forgeryCount > 0 ? (genuineCount / (genuineCount + forgeryCount) * 100).toFixed(1) : 0
                },
                status: 'healthy'
            });
        } catch (error) {
            res.json({
                status: 'no_model',
                message: 'No trained model found'
            });
        }
        
    } catch (error) {
        console.error('Model status error:', error);
        res.status(500).json({ error: 'Failed to fetch model status' });
    }
});

// Device performance analytics endpoint
app.get('/api/analytics/device-performance', async (req, res) => {
    try {
        const deviceStats = await pool.query(
            `SELECT 
                device_info,
                COUNT(*) as attempts,
                SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
                AVG(confidence) as avg_score,
                MAX(created_at) as last_attempt
             FROM auth_attempts
             WHERE created_at > NOW() - INTERVAL '30 days'
             GROUP BY device_info
             ORDER BY attempts DESC`
        );
        
        const parsedStats = deviceStats.rows.map(row => {
            const deviceInfo = parseUserAgent(row.device_info);
            return {
                device: deviceInfo.device,
                browser: deviceInfo.browser,
                inputMethod: deviceInfo.inputMethod,
                attempts: parseInt(row.attempts),
                successes: parseInt(row.successes),
                successRate: (row.successes / row.attempts * 100).toFixed(1),
                avgScore: parseFloat(row.avg_score).toFixed(1),
                lastAttempt: row.last_attempt
            };
        });
        
        res.json({
            devicePerformance: parsedStats,
            summary: {
                totalDevices: parsedStats.length,
                bestDevice: parsedStats.reduce((best, curr) => 
                    parseFloat(curr.successRate) > parseFloat(best.successRate) ? curr : best
                ),
                worstDevice: parsedStats.reduce((worst, curr) => 
                    parseFloat(curr.successRate) < parseFloat(worst.successRate) ? curr : worst
                )
            }
        });
        
    } catch (error) {
        console.error('Device analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch device analytics' });
    }
});

// Helper function to parse user agent string
function parseUserAgent(userAgent) {
    if (!userAgent) return { device: 'Unknown', browser: 'Unknown', inputMethod: 'Unknown' };
    
    const ua = userAgent.toLowerCase();
    let device = 'Desktop';
    let inputMethod = 'mouse';
    let browser = 'Unknown';
    
    // Detect device type
    if (ua.includes('iphone')) {
        device = 'iPhone';
        inputMethod = 'touch';
    } else if (ua.includes('ipad')) {
        device = 'iPad';
        inputMethod = 'touch';
    } else if (ua.includes('android')) {
        device = 'Android';
        inputMethod = 'touch';
    } else if (ua.includes('windows phone')) {
        device = 'Windows Phone';
        inputMethod = 'touch';
    }
    
    // Detect browser
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('edge')) browser = 'Edge';
    
    return { device, browser, inputMethod };
}

// New endpoint to retrieve signature data with stroke data support
app.get('/api/signature/:id', async (req, res) => {
    try {
        const signatureId = parseInt(req.params.id);
        
        if (isNaN(signatureId)) {
            return res.status(400).json({ error: 'Invalid signature ID' });
        }
        
        const signatureData = await getSignatureData(signatureId);
        
        if (!signatureData) {
            return res.status(404).json({ error: 'Signature not found' });
        }
        
        res.json({
            success: true,
            signatureId: signatureId,
            data: signatureData.data,
            format: signatureData.format,
            type: signatureData.type
        });
        
    } catch (error) {
        console.error('Error retrieving signature:', error);
        res.status(500).json({ error: 'Failed to retrieve signature' });
    }
});

// Endpoint to generate image from stroke data
app.get('/api/signature/:id/image', async (req, res) => {
    try {
        const signatureId = parseInt(req.params.id);
        
        if (isNaN(signatureId)) {
            return res.status(400).json({ error: 'Invalid signature ID' });
        }
        
        const signatureData = await getSignatureData(signatureId);
        
        if (!signatureData) {
            return res.status(404).json({ error: 'Signature not found' });
        }
        
        if (signatureData.type === 'stroke_data') {
            // Generate image from stroke data
            const { generateImageFromStrokes } = require('./stroke-to-image');
            const imageData = generateImageFromStrokes(signatureData.data, {
                width: 400,
                height: 200,
                strokeColor: '#000',
                strokeWidth: 2
            });
            
            res.json({ 
                success: true,
                image: imageData,
                format: 'generated_from_stroke_data'
            });
        } else {
            // Return existing base64 data
            res.json({ 
                success: true,
                image: signatureData.data,
                format: 'base64'
            });
        }
        
    } catch (error) {
        console.error('Error generating signature image:', error);
        res.status(500).json({ error: 'Failed to generate signature image' });
    }
});

// Helper function to extract shape scores from structured data
function extractShapeScores(attempt) {
    // If shape scores are stored in a separate field, return them
    if (attempt.shape_scores) {
        return attempt.shape_scores;
    }
    
    // Try to parse from drawing_scores JSON if it contains structured data
    if (attempt.drawing_scores) {
        try {
            const scores = typeof attempt.drawing_scores === 'string' 
                ? JSON.parse(attempt.drawing_scores) 
                : attempt.drawing_scores;
            
            // Check if it's the new structured format
            if (scores.shape_scores) {
                return scores.shape_scores;
            }
            
            // Otherwise, try to extract shape scores from mixed data
            const shapeKeys = ['circle', 'square', 'triangle'];
            const shapeScores = {};
            
            shapeKeys.forEach(shape => {
                if (scores[shape] !== undefined) {
                    shapeScores[shape] = scores[shape];
                }
            });
            
            return Object.keys(shapeScores).length > 0 ? shapeScores : null;
        } catch (e) {
            console.error('Error parsing drawing scores:', e);
            return null;
        }
    }
    
    return null;
}

// Helper function to extract drawing scores from structured data
function extractDrawingScores(attempt) {
    // Try to parse from drawing_scores JSON if it contains structured data
    if (attempt.drawing_scores) {
        try {
            const scores = typeof attempt.drawing_scores === 'string' 
                ? JSON.parse(attempt.drawing_scores) 
                : attempt.drawing_scores;
            
            // Check if it's the new structured format
            if (scores.drawing_scores) {
                return scores.drawing_scores;
            }
            
            // Otherwise, try to extract drawing scores from mixed data
            const drawingKeys = ['face', 'star', 'house', 'connect_dots'];
            const drawingScores = {};
            
            drawingKeys.forEach(drawing => {
                if (scores[drawing] !== undefined) {
                    drawingScores[drawing] = scores[drawing];
                }
            });
            
            return Object.keys(drawingScores).length > 0 ? drawingScores : null;
        } catch (e) {
            console.error('Error parsing drawing scores:', e);
            return null;
        }
    }
    
    return null;
}

// Helper function to calculate device performance
function calculateDevicePerformance(authAttempts) {
    const deviceStats = {};
    
    authAttempts.forEach(attempt => {
        if (!attempt.device_info) return;
        
        // Extract device type from user agent
        const deviceType = extractDeviceType(attempt.device_info);
        
        if (!deviceStats[deviceType]) {
            deviceStats[deviceType] = {
                total: 0,
                success: 0,
                totalConfidence: 0
            };
        }
        
        deviceStats[deviceType].total++;
        if (attempt.success) {
            deviceStats[deviceType].success++;
        }
        deviceStats[deviceType].totalConfidence += attempt.confidence || 0;
    });
    
    // Convert to array format
    return Object.entries(deviceStats).map(([device, stats]) => ({
        device_type: device,
        total_attempts: stats.total,
        success_count: stats.success,
        success_rate: stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : 0,
        avg_confidence: stats.total > 0 ? (stats.totalConfidence / stats.total).toFixed(1) : 0
    }));
}

// Helper function to extract device type from user agent
function extractDeviceType(userAgent) {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Chrome')) return 'Desktop Chrome';
    if (userAgent.includes('Firefox')) return 'Desktop Firefox';
    if (userAgent.includes('Safari')) return 'Desktop Safari';
    
    return 'Desktop';
}

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

// Helper function to extract stroke data from SignaturePad v4 format
function extractStrokeDataFromSignaturePad(signatureData, depth = 0) {
    if (!signatureData) return null;
    
    // Prevent infinite recursion by limiting depth
    const MAX_DEPTH = 5;
    if (depth > MAX_DEPTH) {
        console.warn('Maximum recursion depth reached in extractStrokeDataFromSignaturePad');
        return null;
    }
    
    try {
        let parsed = signatureData;
        if (typeof signatureData === 'string') {
            parsed = JSON.parse(signatureData);
        }
        
        // Handle SignaturePad v4 format: {raw: [{points: [...], ...}]}
        if (parsed.raw && Array.isArray(parsed.raw)) {
            return parsed.raw.map(stroke => {
                // Convert stroke object to points array
                if (stroke.points && Array.isArray(stroke.points)) {
                    return stroke.points;
                }
                // If stroke is already a points array, return as is
                if (Array.isArray(stroke)) {
                    return stroke;
                }
                return [];
            }).filter(stroke => stroke.length > 0); // Filter out empty strokes
        }
        
        // Handle legacy format: {strokes: [[...], [...]]}
        if (parsed.strokes && Array.isArray(parsed.strokes)) {
            return parsed.strokes.filter(stroke => stroke && stroke.length > 0);
        }
        
        // Handle direct array format: [[...], [...]]
        if (Array.isArray(parsed)) {
            return parsed.filter(stroke => stroke && stroke.length > 0);
        }
        
        // Handle data property that might contain the actual stroke data
        if (parsed.data) {
            // Check if data is a string that needs parsing
            if (typeof parsed.data === 'string') {
                try {
                    const dataParsed = JSON.parse(parsed.data);
                    // Recursively process the parsed data object, not the original string
                    return extractStrokeDataFromSignaturePad(dataParsed, depth + 1);
                } catch (parseError) {
                    // If parsing fails, don't recursively call with the same unparseable string
                    // Instead, log the error and return null to avoid infinite recursion
                    console.warn('Failed to parse data string as JSON:', parseError.message);
                    return null;
                }
            } else {
                // For non-string data, recursively process the data object
                return extractStrokeDataFromSignaturePad(parsed.data, depth + 1);
            }
        }
        
        console.warn('No stroke data found in signature data:', Object.keys(parsed || {}));
        return null;
    } catch (error) {
        console.error('Error extracting stroke data from SignaturePad format:', error);
        return null;
    }
}

// Export for testing
module.exports = { calculateMLFeatures, extractStrokeDataFromSignaturePad };