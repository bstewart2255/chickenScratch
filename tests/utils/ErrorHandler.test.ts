import { ErrorHandler, ConflictError, NetworkError } from '../../src/utils/ErrorHandler';
import { 
  BaseError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  NotFoundError,
  RateLimitError
} from '../../src/types/core/errors';
import { z } from 'zod';

// Mock Logger to prevent console output during tests
jest.mock('../../src/utils/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock ConfigService to prevent process.exit
jest.mock('../../src/config/ConfigService', () => ({
  configService: {
    get: jest.fn().mockReturnValue({
      env: 'test',
      logging: { level: 'info' }
    })
  }
}));

describe('ErrorHandler', () => {
  describe('createErrorResponse', () => {
    it('should handle ValidationError', () => {
      const error = new ValidationError('Invalid input', [{ field: 'email', message: 'Invalid input', value: undefined }]);
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(400);
      expect(response.error.type).toBe('ValidationError');
      expect(response.error.message).toBe('Invalid input');
      expect(response.error.code).toBe('ValidationError');
      expect(response.error.details).toBeUndefined();
    });

    it('should handle AuthenticationError', () => {
      const error = new AuthenticationError('Invalid credentials', 'signature', 'Invalid credentials');
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(401);
      expect(response.error.type).toBe('AuthenticationError');
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('User', '123');
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(404);
      expect(response.error.type).toBe('NotFoundError');
    });

    it('should handle ConflictError', () => {
      const error = new ConflictError('Resource already exists');
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(409);
      expect(response.error.type).toBe('ConflictError');
    });

    it('should handle RateLimitError', () => {
      const error = new RateLimitError(100, 3600000, 3600);
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(429);
      expect(response.error.type).toBe('RateLimitError');
    });

    it('should handle DatabaseError', () => {
      const error = new DatabaseError('Connection failed', 'DB_OPERATION');
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(500);
      expect(response.error.type).toBe('DatabaseError');
    });

    it('should handle NetworkError', () => {
      const error = new NetworkError('Request timeout');
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(502);
      expect(response.error.type).toBe('NetworkError');
    });

    it('should handle Zod validation errors', () => {
      const schema = z.object({ email: z.string().email() });
      try {
        schema.parse({ email: 'invalid' });
      } catch (error) {
        const response = ErrorHandler.createErrorResponse(error);
        expect(response.statusCode).toBe(400);
        expect(response.error.type).toBe('ValidationError');
        expect(response.error.message).toBe('Validation failed');
        expect(response.error.details?.errors).toBeDefined();
        expect(response.error.details?.errors[0]).toMatchObject({
          path: 'email',
          message: expect.any(String),
          code: expect.any(String)
        });
      }
    });

    it('should handle database connection errors', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(500);
      expect(response.error.type).toBe('DatabaseError');
      expect(response.error.message).toBe('Database connection failed');
      expect(response.error.code).toBe('DB_CONNECTION_ERROR');
    });

    it('should handle timeout errors', () => {
      const error = new Error('ETIMEDOUT: Connection timed out');
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(500);
      expect(response.error.type).toBe('DatabaseError');
      expect(response.error.message).toBe('Database connection failed');
    });

    it('should handle generic errors', () => {
      const error = new Error('Something went wrong');
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.statusCode).toBe(500);
      expect(response.error.type).toBe('Error');
      expect(response.error.message).toBe('Something went wrong');
    });

    it('should handle unknown errors', () => {
      const response = ErrorHandler.createErrorResponse('string error');
      
      expect(response.statusCode).toBe(500);
      expect(response.error.type).toBe('UnknownError');
      expect(response.error.message).toBe('An unexpected error occurred');
    });
  });

  describe('wrapAsync', () => {
    it('should return result on success', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const wrapped = ErrorHandler.wrapAsync(fn, 'test-context');
      
      const result = await wrapped('arg1', 'arg2');
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should log and rethrow errors', async () => {
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = ErrorHandler.wrapAsync(fn, 'test-context');
      
      await expect(wrapped('arg1')).rejects.toThrow(error);
      expect(fn).toHaveBeenCalledWith('arg1');
    });
  });

  describe('fromDatabaseError', () => {
    it('should handle PostgreSQL duplicate entry error', () => {
      const pgError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        constraint: 'users_email_key',
        table: 'users',
        column: 'email'
      };
      
      const error = ErrorHandler.fromDatabaseError(pgError);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.message).toBe('Duplicate entry');
      expect(error.operation).toBe('DB_OPERATION');
      expect(error.context).toMatchObject({
        code: 'DUPLICATE_ENTRY',
        constraint: 'users_email_key',
        table: 'users',
        column: 'email'
      });
    });

    it('should handle foreign key violation', () => {
      const pgError = {
        code: '23503',
        message: 'insert or update on table violates foreign key constraint'
      };
      
      const error = ErrorHandler.fromDatabaseError(pgError);
      expect(error.message).toBe('Foreign key violation');
      expect(error.operation).toBe('DB_OPERATION');
      expect(error.context?.code).toBe('FK_VIOLATION');
    });

    it('should handle not null violation', () => {
      const pgError = {
        code: '23502',
        message: 'null value in column violates not-null constraint'
      };
      
      const error = ErrorHandler.fromDatabaseError(pgError);
      expect(error.message).toBe('Not null violation');
      expect(error.operation).toBe('DB_OPERATION');
      expect(error.context?.code).toBe('NOT_NULL_VIOLATION');
    });

    it('should handle string too long error', () => {
      const pgError = {
        code: '22001',
        message: 'value too long for type character varying'
      };
      
      const error = ErrorHandler.fromDatabaseError(pgError);
      expect(error.message).toBe('String data too long');
      expect(error.operation).toBe('DB_OPERATION');
      expect(error.context?.code).toBe('STRING_TOO_LONG');
    });

    it('should handle unknown database errors', () => {
      const pgError = {
        code: '99999',
        message: 'unknown error'
      };
      
      const error = ErrorHandler.fromDatabaseError(pgError);
      expect(error.message).toBe('Database operation failed');
      expect(error.operation).toBe('DB_OPERATION');
      expect(error.context?.code).toBe('DB_ERROR');
      expect(error.context?.originalError).toBe('unknown error');
    });
  });

  describe('fromValidation', () => {
    it('should create validation error', () => {
      const error = ErrorHandler.fromValidation('email', 'Invalid email format', 'test@');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid email format');
      expect(error.validationErrors).toEqual([{ field: 'email', message: 'Invalid email format', value: 'test@' }]);
    });
  });

  describe('notFound', () => {
    it('should create not found error with ID', () => {
      const error = ErrorHandler.notFound('User', 123);
      
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('User with id 123 not found');
      expect(error.resourceType).toBe('User');
      expect(error.resourceId).toBe(123);
    });

    it('should create not found error without ID', () => {
      const error = ErrorHandler.notFound('Configuration');
      
      expect(error.message).toBe('Configuration with id unknown not found');
      expect(error.resourceType).toBe('Configuration');
      expect(error.resourceId).toBe('unknown');
    });
  });

  describe('unauthorized', () => {
    it('should create authentication error with reason', () => {
      const error = ErrorHandler.unauthorized('Invalid token');
      
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Invalid token');
      expect(error.authType).toBe('signature');
      expect(error.reason).toBe('Invalid token');
    });

    it('should create authentication error without reason', () => {
      const error = ErrorHandler.unauthorized();
      
      expect(error.message).toBe('Authentication failed');
    });
  });

  describe('rateLimited', () => {
    it('should create rate limit error', () => {
      const error = ErrorHandler.rateLimited(100, 3600000); // 1 hour in ms
      
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.limit).toBe(100);
      expect(error.windowMs).toBe(3600000);
      expect(error.retryAfter).toBe(3600);
    });
  });

  describe('isRetryable', () => {
    it('should identify retryable errors', () => {
      expect(ErrorHandler.isRetryable(new NetworkError('Timeout'))).toBe(true);
      expect(ErrorHandler.isRetryable(new DatabaseError('Connection lost', 'DB_OPERATION'))).toBe(true);
      expect(ErrorHandler.isRetryable(new Error('ECONNREFUSED'))).toBe(true);
      expect(ErrorHandler.isRetryable(new Error('ETIMEDOUT'))).toBe(true);
      expect(ErrorHandler.isRetryable(new Error('ENOTFOUND'))).toBe(true);
      expect(ErrorHandler.isRetryable(new Error('ECONNRESET'))).toBe(true);
      expect(ErrorHandler.isRetryable(new Error('EPIPE'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(ErrorHandler.isRetryable(new ValidationError('Invalid input'))).toBe(false);
      expect(ErrorHandler.isRetryable(new AuthenticationError('Bad credentials', 'signature', 'Invalid credentials'))).toBe(false);
      expect(ErrorHandler.isRetryable(new Error('Generic error'))).toBe(false);
      expect(ErrorHandler.isRetryable('string error')).toBe(false);
    });
  });

  describe('serialize', () => {
    it('should serialize AppError', () => {
      const error = new ValidationError('Test error', [{ field: 'test', message: 'Test error' }]);
      const serialized = ErrorHandler.serialize(error);
      
      expect(serialized).toMatchObject({
        type: 'ValidationError',
        message: 'Test error',
        code: 'ValidationError',
        details: undefined,
        timestamp: expect.any(String)
      });
    });

    it('should serialize generic Error', () => {
      const error = new Error('Test error');
      const serialized = ErrorHandler.serialize(error);
      
      expect(serialized).toMatchObject({
        type: 'Error',
        message: 'Test error',
        stack: expect.any(String)
      });
    });

    it('should serialize unknown errors', () => {
      const serialized = ErrorHandler.serialize('string error');
      
      expect(serialized).toEqual({
        type: 'Unknown',
        value: 'string error'
      });
    });
  });

  describe('expressErrorHandler', () => {
    it('should create Express error middleware', () => {
      const middleware = ErrorHandler.expressErrorHandler();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(4); // Express error handlers have 4 parameters
    });

    it('should handle errors in Express', () => {
      const middleware = ErrorHandler.expressErrorHandler();
      const error = new ValidationError('Test error');
      const req = { method: 'GET', path: '/test', query: {}, body: {}, ip: '127.0.0.1' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      middleware(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          type: 'ValidationError',
          message: 'Test error',
          code: 'ValidationError',
          details: undefined
        },
        statusCode: 400
      });
    });
  });
});