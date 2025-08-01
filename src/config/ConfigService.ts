import { z } from 'zod';

const ConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('development'),
  
  server: z.object({
    port: z.number().min(1).max(65535).default(3003),
    host: z.string().default('0.0.0.0'),
    corsOrigin: z.string().url().optional().or(z.literal('*')).default('*'),
    maxRequestSize: z.string().default('10mb'),
  }),
  
  database: z.object({
    host: z.string().min(1),
    port: z.number().min(1).max(65535).default(5432),
    database: z.string().min(1),
    user: z.string().min(1),
    password: z.string().min(1),
    ssl: z.boolean().default(false),
    maxConnections: z.number().min(1).default(20),
    idleTimeoutMillis: z.number().min(0).default(30000),
    connectionTimeoutMillis: z.number().min(0).default(2000),
  }),
  
  api: z.object({
    baseUrl: z.string().url().default('http://localhost:3003'),
    timeout: z.number().min(0).default(30000),
    retries: z.number().min(0).default(3),
  }),
  
  security: z.object({
    jwtSecret: z.string().min(32).optional(),
    bcryptRounds: z.number().min(1).max(20).default(10),
    sessionTimeout: z.number().min(0).default(3600000), // 1 hour in ms
    maxLoginAttempts: z.number().min(1).default(5),
    lockoutDuration: z.number().min(0).default(900000), // 15 minutes in ms
  }),
  
  features: z.object({
    enableMLDashboard: z.boolean().default(true),
    enableEnhancedBiometrics: z.boolean().default(true),
    enableDebugMode: z.boolean().default(false),
    enableApiLogging: z.boolean().default(true),
    enablePerformanceMonitoring: z.boolean().default(false),
  }),
  
  biometric: z.object({
    minStrokeCount: z.number().min(1).default(5),
    maxStrokeCount: z.number().min(1).default(1000),
    samplingRate: z.number().min(1).default(60),
    pressureNormalization: z.boolean().default(true),
    deviceConsistencyThreshold: z.number().min(0).max(1).default(0.8),
  }),
  
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'simple']).default('json'),
    maxFiles: z.number().min(1).default(5),
    maxFileSize: z.string().default('10m'),
  }),
});

// Define Config type based on the schema
export type Config = z.infer<typeof ConfigSchema>;

class ConfigService {
  private static instance: ConfigService;
  private config: Config;

  private constructor() {
    this.config = this.loadConfig();
    this.validateRequiredConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfig(): Config {
    const env = process.env.NODE_ENV || 'development';
    
    // Load environment-specific defaults
    const defaults = this.getEnvironmentDefaults(env);
    
    // Parse environment variables
    const rawConfig = {
      env,
      server: {
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : defaults.server.port,
        host: process.env.HOST || defaults.server.host,
        corsOrigin: process.env.CORS_ORIGIN || defaults.server.corsOrigin,
        maxRequestSize: process.env.MAX_REQUEST_SIZE || defaults.server.maxRequestSize,
      },
      database: {
        host: process.env.DB_HOST || defaults.database.host,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : defaults.database.port,
        database: process.env.DB_NAME || defaults.database.database,
        user: process.env.DB_USER || defaults.database.user,
        password: process.env.DB_PASSWORD || defaults.database.password,
        ssl: process.env.DB_SSL === 'true',
        maxConnections: process.env.DB_MAX_CONNECTIONS 
          ? parseInt(process.env.DB_MAX_CONNECTIONS, 10) 
          : defaults.database.maxConnections,
        idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT 
          ? parseInt(process.env.DB_IDLE_TIMEOUT, 10) 
          : defaults.database.idleTimeoutMillis,
        connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT 
          ? parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) 
          : defaults.database.connectionTimeoutMillis,
      },
      api: {
        baseUrl: process.env.API_BASE_URL || defaults.api.baseUrl,
        timeout: process.env.API_TIMEOUT 
          ? parseInt(process.env.API_TIMEOUT, 10) 
          : defaults.api.timeout,
        retries: process.env.API_RETRIES 
          ? parseInt(process.env.API_RETRIES, 10) 
          : defaults.api.retries,
      },
      security: {
        jwtSecret: process.env.JWT_SECRET,
        bcryptRounds: process.env.BCRYPT_ROUNDS 
          ? parseInt(process.env.BCRYPT_ROUNDS, 10) 
          : defaults.security.bcryptRounds,
        sessionTimeout: process.env.SESSION_TIMEOUT 
          ? parseInt(process.env.SESSION_TIMEOUT, 10) 
          : defaults.security.sessionTimeout,
        maxLoginAttempts: process.env.MAX_LOGIN_ATTEMPTS 
          ? parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) 
          : defaults.security.maxLoginAttempts,
        lockoutDuration: process.env.LOCKOUT_DURATION 
          ? parseInt(process.env.LOCKOUT_DURATION, 10) 
          : defaults.security.lockoutDuration,
      },
      features: {
        enableMLDashboard: process.env.ENABLE_ML_DASHBOARD !== 'false',
        enableEnhancedBiometrics: process.env.ENABLE_ENHANCED_BIOMETRICS !== 'false',
        enableDebugMode: process.env.ENABLE_DEBUG_MODE === 'true',
        enableApiLogging: process.env.ENABLE_API_LOGGING !== 'false',
        enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
      },
      biometric: {
        minStrokeCount: process.env.MIN_STROKE_COUNT 
          ? parseInt(process.env.MIN_STROKE_COUNT, 10) 
          : defaults.biometric.minStrokeCount,
        maxStrokeCount: process.env.MAX_STROKE_COUNT 
          ? parseInt(process.env.MAX_STROKE_COUNT, 10) 
          : defaults.biometric.maxStrokeCount,
        samplingRate: process.env.SAMPLING_RATE 
          ? parseInt(process.env.SAMPLING_RATE, 10) 
          : defaults.biometric.samplingRate,
        pressureNormalization: process.env.PRESSURE_NORMALIZATION !== 'false',
        deviceConsistencyThreshold: process.env.DEVICE_CONSISTENCY_THRESHOLD 
          ? parseFloat(process.env.DEVICE_CONSISTENCY_THRESHOLD) 
          : defaults.biometric.deviceConsistencyThreshold,
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || defaults.logging.level,
        format: (process.env.LOG_FORMAT as any) || defaults.logging.format,
        maxFiles: process.env.LOG_MAX_FILES 
          ? parseInt(process.env.LOG_MAX_FILES, 10) 
          : defaults.logging.maxFiles,
        maxFileSize: process.env.LOG_MAX_FILE_SIZE || defaults.logging.maxFileSize,
      },
    };

    // Validate and parse with Zod
    try {
      return ConfigSchema.parse(rawConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Configuration validation failed:');
        error.errors.forEach(err => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      }
      throw error;
    }
  }

  private getEnvironmentDefaults(env: string): Config {
    const baseDefaults: Config = {
      env: env as 'development' | 'staging' | 'production',
      server: {
        port: 3003,
        host: '0.0.0.0',
        corsOrigin: '*',
        maxRequestSize: '10mb',
      },
      database: {
        host: 'localhost',
        port: 5432,
        database: 'signature_auth',
        user: 'postgres',
        password: 'postgres',
        ssl: false,
        maxConnections: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
      api: {
        baseUrl: 'http://localhost:3003',
        timeout: 30000,
        retries: 3,
      },
      security: {
        bcryptRounds: 10,
        sessionTimeout: 3600000,
        maxLoginAttempts: 5,
        lockoutDuration: 900000,
      },
      features: {
        enableMLDashboard: true,
        enableEnhancedBiometrics: true,
        enableDebugMode: false,
        enableApiLogging: true,
        enablePerformanceMonitoring: false,
      },
      biometric: {
        minStrokeCount: 5,
        maxStrokeCount: 1000,
        samplingRate: 60,
        pressureNormalization: true,
        deviceConsistencyThreshold: 0.8,
      },
      logging: {
        level: 'info',
        format: 'json',
        maxFiles: 5,
        maxFileSize: '10m',
      },
    };

    // Environment-specific overrides
    switch (env) {
      case 'production':
        baseDefaults.server.corsOrigin = process.env.FRONTEND_URL || 'https://signature-auth.example.com';
        baseDefaults.database.ssl = true;
        baseDefaults.features.enableDebugMode = false;
        baseDefaults.logging.level = 'error';
        baseDefaults.logging.format = 'json';
        break;
      case 'staging':
        baseDefaults.server.corsOrigin = process.env.FRONTEND_URL || 'https://staging.signature-auth.example.com';
        baseDefaults.database.ssl = true;
        baseDefaults.features.enableDebugMode = false;
        baseDefaults.logging.level = 'warn';
        break;
      case 'development':
      default:
        baseDefaults.features.enableDebugMode = true;
        baseDefaults.logging.level = 'debug';
        baseDefaults.logging.format = 'simple';
        break;
    }

    return baseDefaults;
  }

  private validateRequiredConfig(): void {
    const errors: string[] = [];

    // Required fields that must be provided via environment variables
    if (!this.config.database.host) {
      errors.push('DB_HOST is required');
    }
    if (!this.config.database.database) {
      errors.push('DB_NAME is required');
    }
    if (!this.config.database.user) {
      errors.push('DB_USER is required');
    }
    if (!this.config.database.password) {
      errors.push('DB_PASSWORD is required');
    }

    // JWT secret is required in non-development environments
    if (this.config.env !== 'development' && !this.config.security.jwtSecret) {
      errors.push('JWT_SECRET is required in production/staging environments');
    }

    if (errors.length > 0) {
      console.error('Missing required configuration:');
      errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
  }

  public get(): Config {
    return this.config;
  }

  public getServer() {
    return this.config.server;
  }

  public getDatabase() {
    return this.config.database;
  }

  public getApi() {
    return this.config.api;
  }

  public getSecurity() {
    return this.config.security;
  }

  public getFeatures() {
    return this.config.features;
  }

  public getBiometric() {
    return this.config.biometric;
  }

  public getLogging() {
    return this.config.logging;
  }

  public isProduction(): boolean {
    return this.config.env === 'production';
  }

  public isStaging(): boolean {
    return this.config.env === 'staging';
  }

  public isDevelopment(): boolean {
    return this.config.env === 'development';
  }
}

// Create and export singleton instance
export const configService = ConfigService.getInstance();