import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { databaseService } from './DatabaseService';
import { BiometricEngine } from './BiometricEngine';
import { authenticationService } from './AuthenticationService';
import { extractStrokeData } from './update_to_stroke_storage';
import { config } from '../src/config/ConfigService';
import { logger } from '../src/utils/Logger';
import { ErrorHandler, ValidationError } from '../src/utils/ErrorHandler';
// import type { DeviceCapabilities } from '../src/types/core/biometric'; // Unused import

const app: express.Application = express();
const serverConfig = config.getServer();
const featuresConfig = config.getFeatures();
const PORT = serverConfig.port;

// Performance monitoring thresholds
const ENDPOINT_THRESHOLDS = {
  register: 500,      // ms
  authenticate: 300,  // ms
  store: 200,         // ms
  health: 50          // ms
} as const;

// Request timing middleware
interface TimedRequest extends Request {
  startTime?: number;
}

// Endpoint performance tracking
class EndpointMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  trackEndpoint(endpoint: string, duration: number): void {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, []);
    }
    
    const endpointMetrics = this.metrics.get(endpoint)!;
    endpointMetrics.push(duration);
    
    // Keep only last 1000 requests per endpoint
    if (endpointMetrics.length > 1000) {
      endpointMetrics.shift();
    }
    
    // Check against threshold
    const threshold = ENDPOINT_THRESHOLDS[endpoint as keyof typeof ENDPOINT_THRESHOLDS] || 200;
    if (duration > threshold) {
      logger.warn('Slow endpoint detected', {
        endpoint,
        duration_ms: duration,
        threshold_ms: threshold
      });
    }
  }
  
  getStats(endpoint?: string): Record<string, any> {
    if (endpoint) {
      const metrics = this.metrics.get(endpoint) || [];
      if (metrics.length === 0) return {};
      
      return {
        endpoint,
        avgDuration: metrics.reduce((a, b) => a + b, 0) / metrics.length,
        minDuration: Math.min(...metrics),
        maxDuration: Math.max(...metrics),
        requestCount: metrics.length
      };
    }
    
    // Return all endpoint stats
    const allStats: Record<string, any> = {};
    this.metrics.forEach((_metrics, endpoint) => {
      allStats[endpoint] = this.getStats(endpoint);
    });
    return allStats;
  }
}

const endpointMonitor = new EndpointMonitor();
const biometricEngine = new BiometricEngine();

// CORS configuration
const corsOptions: cors.CorsOptions = {
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
    
    logger.debug('CORS check', { origin: origin || 'no-origin' });
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Allow any localhost origin for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      logger.debug('Allowing localhost origin', { origin });
      return callback(null, true);
    }
    
    // Allow file:// protocol (for local testing)
    if (origin.startsWith('file://')) {
      logger.debug('Allowing file:// origin');
      return callback(null, true);
    }
    
    // Allow any *.onrender.com subdomain
    if (origin.includes('.onrender.com')) {
      logger.debug('Allowing onrender.com origin', { origin });
      return callback(null, true);
    }
    
    // Allow github.io pages
    if (origin.includes('github.io')) {
      logger.debug('Allowing github.io origin', { origin });
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('Blocked origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: serverConfig.maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: serverConfig.maxRequestSize }));

// Request timing middleware
app.use((req: TimedRequest, res: Response, next: NextFunction) => {
  req.startTime = performance.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Track response time
  res.on('finish', () => {
    if (req.startTime) {
      const duration = performance.now() - req.startTime;
      const endpoint = req.path.split('/').pop() || 'unknown';
      endpointMonitor.trackEndpoint(endpoint, duration);
      
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration
      });
    }
  });
  
  next();
});

// Temporary storage for step-by-step drawing data
const temporaryDrawingStorage = new Map<string, { data: any; timestamp: number }>();

// Clean up old temporary data every hour
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [key, data] of temporaryDrawingStorage.entries()) {
    if (data.timestamp < oneHourAgo) {
      temporaryDrawingStorage.delete(key);
      logger.info('Cleaned up temporary data', { key });
    }
  }
}, 60 * 60 * 1000);

// Health check endpoints
app.get('/', (_req: Request, res: Response) => {
  res.send('Signature Authentication API is running!');
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'signature-auth-backend'
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'signature-auth-backend',
    performance: endpointMonitor.getStats()
  });
});

// Dashboard stats endpoint
app.get('/api/dashboard/stats', async (_req: Request, res: Response) => {
  try {
    const userCount = await databaseService.query('SELECT COUNT(*) FROM users');
    const signatureCount = await databaseService.query('SELECT COUNT(*) FROM signatures');
    
    res.json({ 
      status: 'available',
      total_users: parseInt(userCount.rows[0].count),
      total_signatures: parseInt(signatureCount.rows[0].count),
      timestamp: new Date().toISOString(),
      performance: {
        database: databaseService.getQueryStats(),
        endpoints: endpointMonitor.getStats(),
        biometric: biometricEngine.getPerformanceStats()
      }
    });
  } catch (error) {
    logger.error('Dashboard stats error:', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Register endpoint
app.post('/api/register', async (req: Request, res: Response) => {
  const startTime = performance.now();
  
  try {
    const { username, email, signatureData, deviceCapabilities } = req.body;
    
    // Validate input
    if (!username || !signatureData) {
      throw new ValidationError('Username and signature data are required');
    }
    
    // Check if user exists
    let user = await databaseService.getUserByUsername(username);
    
    if (!user) {
      // Create new user
      user = await databaseService.createUser(username, email);
      if (!user) {
        throw new Error('Failed to create user');
      }
      logger.info('New user created', { userId: user.id, username });
    }
    
    // Extract features with performance tracking
    const featureStart = performance.now();
    const strokeData = extractStrokeData(signatureData);
    const featuresConfig = config.getFeatures();
    const enhancedFeatures = featuresConfig.enableEnhancedBiometrics
      ? biometricEngine.extractAllFeatures(strokeData, deviceCapabilities)
      : null;
    
    const featureDuration = performance.now() - featureStart;
    if (featureDuration > 100) {
      logger.warn('Slow feature extraction during registration', {
        duration_ms: featureDuration,
        username
      });
    }
    
          // Store signature
      const signature = await databaseService.createSignature(
        parseInt(user.id),
        strokeData,
        enhancedFeatures
      );
      if (!signature) {
        throw new Error('Failed to create signature');
      }
    
    const totalDuration = performance.now() - startTime;
    
    res.json({
      success: true,
      userId: user.id,
      signatureId: signature.id,
      performanceMetrics: {
        totalDuration,
        featureExtractionDuration: featureDuration
      }
    });
    
  } catch (error) {
    const totalDuration = performance.now() - startTime;
    logger.error('Registration error', {
      error,
      duration_ms: totalDuration
    });
    
    ErrorHandler.handleError(error, res);
  }
});

// Authenticate endpoint
app.post('/api/authenticate', async (req: Request, res: Response) => {
  const startTime = performance.now();
  
  try {
    const { username, signatureData, deviceCapabilities } = req.body;
    
    // Validate input
    if (!username || !signatureData) {
      throw new ValidationError('Username and signature data are required');
    }
    
    // Get user
    const user = await databaseService.getUserByUsername(username);
    if (!user) {
      throw new ValidationError('User not found');
    }
    
    // Get stored signatures
    const storedSignatures = await databaseService.getSignatures(parseInt(user.id));
    if (storedSignatures.length === 0) {
      throw new ValidationError('No signatures on file for user');
    }
    
    // Extract features from current signature
    const featureStart = performance.now();
    // const strokeData = extractStrokeData(signatureData); // Unused variable
    // currentFeatures extracted but not used - keeping for potential future use
    // const currentFeatures = biometricEngine.extractAllFeatures(strokeData, deviceCapabilities);
    
    const featureDuration = performance.now() - featureStart;
    
    // Get the most recent signature's features as baseline
    const baseline = storedSignatures[0]?.enhanced_features || {};
    
    // Compare signatures
    const authResult = await authenticationService.compareSignaturesEnhanced(
      storedSignatures[0]?.signature_data as any,
      signatureData,
      baseline as any,
      username
    );
    
    // Log authentication attempt
    await databaseService.createAuthenticationAttempt(
      parseInt(user.id),
      authResult.success,
      authResult.score,
      {
        method: authResult.method,
        performanceMetrics: authResult.performanceMetrics,
        deviceCapabilities
      }
    );
    
    const totalDuration = performance.now() - startTime;
    
    res.json({
      success: authResult.success,
      score: authResult.score,
      method: authResult.method,
      performanceMetrics: {
        totalDuration,
        featureExtractionDuration: featureDuration,
        ...(authResult.performanceMetrics && typeof authResult.performanceMetrics === 'object' 
          ? Object.fromEntries(
              Object.entries(authResult.performanceMetrics).filter(([key]) => key !== 'totalDuration')
            )
          : {})
      }
    });
    
  } catch (error) {
    const totalDuration = performance.now() - startTime;
    logger.error('Authentication error', {
      error,
      duration_ms: totalDuration
    });
    
    ErrorHandler.handleError(error, res);
  }
});

// Store temporary drawing data
app.post('/api/store-temp-drawing', (req: Request, res: Response) => {
  try {
    const { userId, drawingType, strokeData } = req.body;
    
    if (!userId || !drawingType || !strokeData) {
      throw new ValidationError('Missing required fields');
    }
    
    const key = `${userId}_${drawingType}`;
    temporaryDrawingStorage.set(key, {
      data: strokeData,
      timestamp: Date.now()
    });
    
    logger.info('Stored temporary drawing', { userId, drawingType });
    
    res.json({ success: true });
  } catch (error) {
    ErrorHandler.handleError(error, res);
  }
});

// Get temporary drawing data
app.get('/api/get-temp-drawing/:userId/:drawingType', (req: Request, res: Response) => {
  try {
    const { userId, drawingType } = req.params;
    const key = `${userId}_${drawingType}`;
    
    const data = temporaryDrawingStorage.get(key);
    
    if (!data) {
      res.json({ success: false, message: 'No data found' });
      return;
    }
    
    res.json({ 
      success: true, 
      strokeData: data.data,
      timestamp: data.timestamp
    });
  } catch (error) {
    ErrorHandler.handleError(error, res);
  }
});

// Performance metrics endpoint
app.get('/api/metrics/performance', (_req: Request, res: Response) => {
  res.json({
    endpoints: endpointMonitor.getStats(),
    database: databaseService.getQueryStats(),
    biometric: biometricEngine.getPerformanceStats(),
    authentication: authenticationService.getAuthStats()
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err });
  ErrorHandler.handleError(err, res);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    environment: process.env['NODE_ENV'],
    enableEnhancedFeatures: featuresConfig.enableEnhancedBiometrics,
    mlApiUrl: featuresConfig.mlApiUrl
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await databaseService.close();
  process.exit(0);
});

export default app;