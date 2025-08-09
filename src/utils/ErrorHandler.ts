import { z } from 'zod';
import { 
  BaseError, 
  ValidationError, 
  DatabaseError, 
  AuthenticationError,
  NotFoundError,
  RateLimitError
} from '../types/core/errors';
import { Logger } from './Logger';

// Re-export for convenience
export { ValidationError } from '../types/core/errors';

// Additional error types not in core
export class ConflictError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 409, true, context);
  }
}

export class NetworkError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 502, true, context);
  }
}

// Zod schema for error details (commented out as not currently used)
// const ErrorDetailsSchema = z.object({
//   code: z.string().optional(),
//   field: z.string().optional(),
//   value: z.any().optional(),
//   constraint: z.string().optional(),
//   details: z.record(z.any()).optional()
// });

// HTTP status code mapping
const ERROR_STATUS_MAP: Record<string, number> = {
  ValidationError: 400,
  AuthenticationError: 401,
  NotFoundError: 404,
  ConflictError: 409,
  RateLimitError: 429,
  DatabaseError: 500,
  NetworkError: 502,
  BaseError: 500
};

export class ErrorHandler {
  private static logger = new Logger('ErrorHandler');

  /**
   * Create a standardized error response
   */
  static createErrorResponse(error: unknown): {
    error: {
      type: string;
      message: string;
      code?: string;
      details?: Record<string, any>;
    };
    statusCode: number;
  } {
    // Handle custom app errors
    if (error instanceof BaseError) {
      return {
        error: {
          type: error.constructor.name,
          message: error.message,
          code: (error as any).code || error.name,
          details: (error as BaseError).context
        },
        statusCode: ERROR_STATUS_MAP[error.constructor.name] || 500
      };
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        error: {
          type: 'ValidationError',
          message: 'Validation failed',
          details: {
            errors: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
              code: err.code
            }))
          }
        },
        statusCode: 400
      };
    }

    // Handle native errors
    if (error instanceof Error) {
      // Database errors
      if (error.message.includes('ECONNREFUSED') || 
          error.message.includes('ETIMEDOUT')) {
        return {
          error: {
            type: 'DatabaseError',
            message: 'Database connection failed',
            code: 'DB_CONNECTION_ERROR'
          },
          statusCode: 500
        };
      }

      // Generic error
      return {
        error: {
          type: 'Error',
          message: error.message
        },
        statusCode: 500
      };
    }

    // Unknown error
    return {
      error: {
        type: 'UnknownError',
        message: 'An unexpected error occurred'
      },
      statusCode: 500
    };
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: unknown, context?: Record<string, any>): void {
    const errorResponse = this.createErrorResponse(error);
    
    // Determine log level based on status code
    if (errorResponse.statusCode >= 500) {
      this.logger.error('Server error occurred', {
        ...errorResponse.error,
        context,
        stack: error instanceof Error ? error.stack : undefined
      });
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn('Client error occurred', {
        ...errorResponse.error,
        context
      });
    } else {
      this.logger.info('Error occurred', {
        ...errorResponse.error,
        context
      });
    }
  }

  /**
   * Wrap async function with error handling
   */
  static wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: string
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.logError(error, { context, args });
        throw error;
      }
    }) as T;
  }

  /**
   * Create error from database error
   */
  static fromDatabaseError(error: any): DatabaseError {
    // PostgreSQL error codes
    const pgErrorMap: Record<string, { message: string; code: string }> = {
      '23505': { message: 'Duplicate entry', code: 'DUPLICATE_ENTRY' },
      '23503': { message: 'Foreign key violation', code: 'FK_VIOLATION' },
      '23502': { message: 'Not null violation', code: 'NOT_NULL_VIOLATION' },
      '22001': { message: 'String data too long', code: 'STRING_TOO_LONG' }
    };

    const pgCode = error.code || '';
    const mapped = pgErrorMap[pgCode];

    if (mapped) {
      return new DatabaseError(mapped.message, 'DB_OPERATION', undefined, {
        code: mapped.code,
        originalError: error.message,
        constraint: error.constraint,
        table: error.table,
        column: error.column
      });
    }

    return new DatabaseError(
      'Database operation failed',
      'DB_OPERATION',
      undefined,
      { code: 'DB_ERROR', originalError: error.message }
    );
  }

  /**
   * Create error from validation failure
   */
  static fromValidation(field: string, message: string, value?: any): ValidationError {
    return new ValidationError(
      message,
      [{ field, message, value }]
    );
  }

  /**
   * Create error for missing resource
   */
  static notFound(resource: string, id?: string | number): NotFoundError {
    if (id !== undefined) {
      return new NotFoundError(resource, id);
    }
    // If no ID provided, use a placeholder
    return new NotFoundError(resource, 'unknown');
  }

  /**
   * Create error for authentication failure
   */
  static unauthorized(reason?: string): AuthenticationError {
    return new AuthenticationError(
      reason || 'Authentication failed',
      'signature',
      reason || 'Invalid credentials'
    );
  }

  /**
   * Create error for rate limiting
   */
  static rateLimited(limit: number, windowMs: number): RateLimitError {
    const retryAfter = Math.ceil(windowMs / 1000); // Convert to seconds
    return new RateLimitError(
      limit,
      windowMs,
      retryAfter
    );
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof NetworkError || error instanceof DatabaseError) {
      return true;
    }

    if (error instanceof Error) {
      const retryableMessages = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNRESET',
        'EPIPE'
      ];
      
      return retryableMessages.some(msg => error.message.includes(msg));
    }

    return false;
  }

  /**
   * Serialize error for logging or transmission
   */
  static serialize(error: unknown): Record<string, any> {
    if (error instanceof BaseError) {
      return {
        type: error.constructor.name,
        message: error.message,
        code: (error as any).code || error.name,
        details: (error as BaseError).context,
        timestamp: (error as BaseError).timestamp
      };
    }

    if (error instanceof Error) {
      return {
        type: error.constructor.name,
        message: error.message,
        stack: error.stack
      };
    }

    return {
      type: 'Unknown',
      value: String(error)
    };
  }

  /**
   * Express error middleware
   */
  static expressErrorHandler() {
    return (err: any, req: any, res: any, _next: any) => {
      const errorResponse = this.createErrorResponse(err);
      
      this.logError(err, {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        ip: req.ip
      });

      res.status(errorResponse.statusCode).json(errorResponse);
    };
  }

  /**
   * Handle error and create appropriate response
   * This is a convenience method that combines createErrorResponse and logError
   */
  static handleError(error: unknown, context?: Record<string, any>) {
    this.logError(error, context);
    return this.createErrorResponse(error);
  }
}