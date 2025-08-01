/**
 * Configuration type definitions for the application
 * Ensures type safety for all configuration values
 */

/**
 * Database configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  pool?: {
    min: number;
    max: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
  debug?: boolean;
}

/**
 * Redis configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: {
    session: number;
    cache: number;
    rateLimit: number;
  };
}

/**
 * JWT configuration
 */
export interface JWTConfig {
  secret: string;
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  expiresIn: string | number; // e.g., '1h', '7d', 3600
  refreshExpiresIn: string | number;
  issuer?: string;
  audience?: string;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    maxAge?: number;
  };
  bodyParser: {
    jsonLimit: string;
    urlencodedLimit: string;
  };
  trustProxy: boolean | string | number;
  compression: boolean;
}

/**
 * Biometric engine configuration
 */
export interface BiometricConfig {
  signature: {
    minPoints: number;
    maxPoints: number;
    minStrokes: number;
    maxStrokes: number;
    minDuration: number; // milliseconds
    maxDuration: number;
    qualityThreshold: number; // 0-1
  };
  comparison: {
    algorithm: 'dtw' | 'euclidean' | 'hybrid';
    weights: {
      pressure: number;
      timing: number;
      geometry: number;
      velocity: number;
    };
    thresholds: {
      authentication: number;
      verification: number;
      enrollment: number;
    };
  };
  enhancement: {
    enablePressureNormalization: boolean;
    enableTimeWarping: boolean;
    enableNoiseReduction: boolean;
    enableFeatureExtraction: boolean;
  };
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  bcrypt: {
    saltRounds: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests?: boolean;
    keyGenerator?: string;
  };
  session: {
    secret: string;
    name: string;
    resave: boolean;
    saveUninitialized: boolean;
    rolling: boolean;
    cookie: {
      secure: boolean;
      httpOnly: boolean;
      maxAge: number;
      sameSite: 'strict' | 'lax' | 'none';
    };
  };
  headers: {
    hsts: boolean;
    noSniff: boolean;
    xssFilter: boolean;
    ieNoOpen: boolean;
    frameguard: 'deny' | 'sameorigin' | false;
  };
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  format: 'json' | 'pretty' | 'simple';
  transports: Array<{
    type: 'console' | 'file' | 'syslog' | 'http';
    level?: string;
    filename?: string;
    maxSize?: string;
    maxFiles?: number;
    url?: string;
  }>;
  errorTracking?: {
    enabled: boolean;
    dsn?: string;
    environment?: string;
  };
}

/**
 * Email configuration
 */
export interface EmailConfig {
  enabled: boolean;
  provider: 'smtp' | 'sendgrid' | 'ses' | 'mailgun';
  from: {
    name: string;
    email: string;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  apiKey?: string;
  templates?: {
    enrollment: string;
    verification: string;
    passwordReset: string;
  };
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  type: 'local' | 's3' | 'gcs' | 'azure';
  basePath: string;
  local?: {
    directory: string;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
  gcs?: {
    bucket: string;
    projectId: string;
    keyFilename: string;
  };
  azure?: {
    containerName: string;
    accountName: string;
    accountKey: string;
  };
}

/**
 * Feature flags configuration
 */
export interface FeatureFlags {
  enableMFA: boolean;
  enableAPIKeys: boolean;
  enableWebhooks: boolean;
  enableAdvancedAnalytics: boolean;
  enableBatchOperations: boolean;
  enableExperimentalFeatures: boolean;
  maintenanceMode: boolean;
}

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  name: 'development' | 'test' | 'staging' | 'production';
  debug: boolean;
  verbose: boolean;
  mockExternalServices: boolean;
}

/**
 * Complete application configuration
 */
export interface AppConfig {
  env: EnvironmentConfig;
  server: ServerConfig;
  database: DatabaseConfig;
  redis?: RedisConfig;
  jwt: JWTConfig;
  biometric: BiometricConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
  email?: EmailConfig;
  storage?: StorageConfig;
  features: FeatureFlags;
  custom?: Record<string, any>;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    value?: any;
  }>;
  warnings: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Configuration loader options
 */
export interface ConfigLoaderOptions {
  envFile?: string;
  configFile?: string;
  validate?: boolean;
  defaults?: Partial<AppConfig>;
  overrides?: Partial<AppConfig>;
}

/**
 * Type guard for complete configuration
 */
export function isCompleteConfig(config: any): config is AppConfig {
  return (
    config &&
    typeof config === 'object' &&
    config.env &&
    config.server &&
    config.database &&
    config.jwt &&
    config.biometric &&
    config.security &&
    config.logging &&
    config.features
  );
}

/**
 * Environment variable mapping
 */
export interface EnvVarMapping {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  REDIS_URL?: string;
  JWT_SECRET: string;
  SESSION_SECRET: string;
  LOG_LEVEL?: string;
  CORS_ORIGIN?: string;
  RATE_LIMIT_MAX?: number;
  RATE_LIMIT_WINDOW?: number;
  BCRYPT_ROUNDS?: number;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Configuration defaults
 */
export const DEFAULT_CONFIG: Partial<AppConfig> = {
  env: {
    name: 'development',
    debug: true,
    verbose: false,
    mockExternalServices: false
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    cors: {
      origin: true,
      credentials: true
    },
    bodyParser: {
      jsonLimit: '10mb',
      urlencodedLimit: '10mb'
    },
    trustProxy: false,
    compression: true
  },
  biometric: {
    signature: {
      minPoints: 10,
      maxPoints: 10000,
      minStrokes: 1,
      maxStrokes: 100,
      minDuration: 100,
      maxDuration: 60000,
      qualityThreshold: 0.7
    },
    comparison: {
      algorithm: 'hybrid',
      weights: {
        pressure: 0.3,
        timing: 0.3,
        geometry: 0.3,
        velocity: 0.1
      },
      thresholds: {
        authentication: 0.8,
        verification: 0.85,
        enrollment: 0.7
      }
    },
    enhancement: {
      enablePressureNormalization: true,
      enableTimeWarping: true,
      enableNoiseReduction: true,
      enableFeatureExtraction: true
    }
  },
  features: {
    enableMFA: false,
    enableAPIKeys: true,
    enableWebhooks: false,
    enableAdvancedAnalytics: false,
    enableBatchOperations: false,
    enableExperimentalFeatures: false,
    maintenanceMode: false
  }
};