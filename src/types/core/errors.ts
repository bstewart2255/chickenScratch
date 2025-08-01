import { configService } from '../../config/ConfigService';

/**
 * Custom error classes for the signature authentication system
 * All errors extend Error with proper typing and serialization
 */

/**
 * Base error class for all application errors
 */
export abstract class BaseError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.context = context;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serializes error for API responses
   */
  public toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      ...(configService.isDevelopment() && { stack: this.stack })
    };
  }
}

/**
 * Validation errors for input data
 */
export class ValidationError extends BaseError {
  public readonly validationErrors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string; value?: any }> = [],
    context?: Record<string, any>
  ) {
    super(message, 400, true, context);
    this.validationErrors = validationErrors;
  }

  public toJSON(): object {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    };
  }
}

/**
 * Database operation errors
 */
export class DatabaseError extends BaseError {
  public readonly query?: string;
  public readonly operation: string;

  constructor(
    message: string,
    operation: string,
    query?: string,
    context?: Record<string, any>
  ) {
    super(message, 500, false, context);
    this.operation = operation;
    this.query = query;
  }

  public toJSON(): object {
    return {
      ...super.toJSON(),
      operation: this.operation,
      ...(configService.isDevelopment() && { query: this.query })
    };
  }
}

/**
 * Authentication and authorization errors
 */
export class AuthenticationError extends BaseError {
  public readonly authType: 'signature' | 'token' | 'session';
  public readonly reason: string;

  constructor(
    message: string,
    authType: 'signature' | 'token' | 'session',
    reason: string,
    context?: Record<string, any>
  ) {
    super(message, 401, true, context);
    this.authType = authType;
    this.reason = reason;
  }

  public toJSON(): object {
    return {
      ...super.toJSON(),
      authType: this.authType,
      reason: this.reason
    };
  }
}

/**
 * Authorization errors (user authenticated but lacks permissions)
 */
export class AuthorizationError extends BaseError {
  public readonly resource: string;
  public readonly action: string;

  constructor(
    message: string,
    resource: string,
    action: string,
    context?: Record<string, any>
  ) {
    super(message, 403, true, context);
    this.resource = resource;
    this.action = action;
  }

  public toJSON(): object {
    return {
      ...super.toJSON(),
      resource: this.resource,
      action: this.action
    };
  }
}

/**
 * Biometric processing errors
 */
export class BiometricError extends BaseError {
  public readonly processingStage: 'capture' | 'extraction' | 'comparison' | 'storage';
  public readonly biometricType: 'signature' | 'shape' | 'drawing';

  constructor(
    message: string,
    processingStage: 'capture' | 'extraction' | 'comparison' | 'storage',
    biometricType: 'signature' | 'shape' | 'drawing',
    context?: Record<string, any>
  ) {
    super(message, 422, true, context);
    this.processingStage = processingStage;
    this.biometricType = biometricType;
  }

  public toJSON(): object {
    return {
      ...super.toJSON(),
      processingStage: this.processingStage,
      biometricType: this.biometricType
    };
  }
}

/**
 * Canvas operation errors
 */
export class CanvasError extends BaseError {
  public readonly canvasOperation: string;
  public readonly canvasId?: string;

  constructor(
    message: string,
    canvasOperation: string,
    canvasId?: string,
    context?: Record<string, any>
  ) {
    super(message, 400, true, context);
    this.canvasOperation = canvasOperation;
    this.canvasId = canvasId;
  }

  public toJSON(): object {
    return {
      ...super.toJSON(),
      canvasOperation: this.canvasOperation,
      canvasId: this.canvasId
    };
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends BaseError {
  public readonly configKey: string;
  public readonly requiredType: string;

  constructor(
    message: string,
    configKey: string,
    requiredType: string,
    context?: Record<string, any>
  ) {
    super(message, 500, false, context);
    this.configKey = configKey;
    this.requiredType = requiredType;
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends BaseError {
  public readonly resourceType: string;
  public readonly resourceId: string | number;

  constructor(
    resourceType: string,
    resourceId: string | number,
    context?: Record<string, any>
  ) {
    super(`${resourceType} with id ${resourceId} not found`, 404, true, context);
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends BaseError {
  public readonly limit: number;
  public readonly windowMs: number;
  public readonly retryAfter: number;

  constructor(
    limit: number,
    windowMs: number,
    retryAfter: number,
    context?: Record<string, any>
  ) {
    super(`Rate limit exceeded. Try again in ${retryAfter}ms`, 429, true, context);
    this.limit = limit;
    this.windowMs = windowMs;
    this.retryAfter = retryAfter;
  }

  public toJSON(): object {
    return {
      ...super.toJSON(),
      limit: this.limit,
      windowMs: this.windowMs,
      retryAfter: this.retryAfter
    };
  }
}

/**
 * Migration-specific errors
 */
export class MigrationError extends BaseError {
  public readonly migrationPhase: number;
  public readonly fileName: string;

  constructor(
    message: string,
    migrationPhase: number,
    fileName: string,
    context?: Record<string, any>
  ) {
    super(message, 500, false, context);
    this.migrationPhase = migrationPhase;
    this.fileName = fileName;
  }
}

/**
 * Type guard to check if error is operational
 */
export function isOperationalError(error: Error): error is BaseError {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Error handler utility
 */
export function handleError(error: Error): {
  statusCode: number;
  message: string;
  details?: any;
} {
  if (error instanceof BaseError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      details: error.toJSON()
    };
  }

  // Unknown errors are treated as non-operational
  console.error('Unexpected error:', error);
  return {
    statusCode: 500,
    message: 'An unexpected error occurred',
    details: configService.isDevelopment() ? error.message : undefined
  };
}

/**
 * Express error middleware type
 */
export type ErrorRequestHandler = (
  error: Error,
  req: any,
  res: any,
  next: any
) => void;