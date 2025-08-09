import { ErrorHandler } from '../../../src/utils/ErrorHandler';
import { ValidationError, AuthenticationError, DatabaseError, NotFoundError, RateLimitError } from '../../../src/types/core/errors';
import { mockRequest, mockResponse, mockNext } from '../../helpers/mocks';

describe('ErrorHandler', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('handleError', () => {
    it('should handle ValidationError', () => {
      const error = new ValidationError('Invalid input');
      const context = { field: 'username' };

      const result = ErrorHandler.handleError(error, context);

      expect(result.statusCode).toBe(400);
      expect(result.error).toEqual({
        type: 'ValidationError',
        message: 'Invalid input',
        code: 'ValidationError',
        details: undefined
      });
    });

    it('should handle AuthenticationError', () => {
      const error = new AuthenticationError('Unauthorized', 'signature', 'Invalid credentials');
      const context = { userId: '123' };

      const result = ErrorHandler.handleError(error, context);

      expect(result.statusCode).toBe(401);
      expect(result.error).toEqual({
        type: 'AuthenticationError',
        message: 'Unauthorized',
        code: 'AuthenticationError',
        details: undefined
      });
    });

    it('should handle DatabaseError', () => {
      const error = new DatabaseError('Database connection failed', 'DB_OPERATION');
      const context = { query: 'SELECT * FROM users' };

      const result = ErrorHandler.handleError(error, context);

      expect(result.statusCode).toBe(500);
      expect(result.error).toEqual({
        type: 'DatabaseError',
        message: 'Database connection failed',
        code: 'DatabaseError',
        details: undefined
      });
    });

    it('should handle generic Error', () => {
      const error = new Error('Generic error');
      const context = { operation: 'test' };

      const result = ErrorHandler.handleError(error, context);

      expect(result.statusCode).toBe(500);
      expect(result.error).toEqual({
        type: 'Error',
        message: 'Generic error'
      });
    });

    it('should handle Zod validation errors', () => {
      const { z } = require('zod');
      const schema = z.object({ name: z.string() });
      const error = schema.safeParse({ name: 123 }).success ? null : schema.safeParse({ name: 123 }).error;
      
      if (!error) throw new Error('Failed to create Zod error');

      const result = ErrorHandler.handleError(error, { field: 'name' });

      expect(result.statusCode).toBe(400);
      expect(result.error.type).toBe('ValidationError');
      expect(result.error.message).toBe('Validation failed');
    });

    it('should handle database connection errors', () => {
      const error = new Error('ECONNREFUSED: connect');
      const context = { host: 'localhost' };

      const result = ErrorHandler.handleError(error, context);

      expect(result.statusCode).toBe(500);
      expect(result.error.type).toBe('DatabaseError');
      expect(result.error.message).toBe('Database connection failed');
    });

    it('should handle unknown errors', () => {
      const error = 'String error';
      const context = { source: 'test' };

      const result = ErrorHandler.handleError(error, context);

      expect(result.statusCode).toBe(500);
      expect(result.error.type).toBe('UnknownError');
      expect(result.error.message).toBe('An unexpected error occurred');
    });
  });

  describe('createErrorResponse', () => {
    it('should create standardized error response for BaseError', () => {
      const error = new ValidationError('Test error');
      const result = ErrorHandler.createErrorResponse(error);

      expect(result).toEqual({
        error: {
          type: 'ValidationError',
          message: 'Test error',
          code: 'ValidationError',
          details: undefined
        },
        statusCode: 400
      });
    });

    it('should create response for custom error types', () => {
      const error = new NotFoundError('User', '123');
      const result = ErrorHandler.createErrorResponse(error);

      expect(result.statusCode).toBe(404);
      expect(result.error.type).toBe('NotFoundError');
    });
  });

  describe('logError', () => {
    it('should log errors with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', operation: 'login' };

      ErrorHandler.logError(error, context);

      // The logger is mocked, so we just verify the method doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('wrapAsync', () => {
    it('should wrap async function with error handling', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrapped = ErrorHandler.wrapAsync(asyncFn, 'test-context');
      
      const result = await wrapped('arg1', 'arg2');

      expect(result).toBe('success');
      expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should catch and re-throw errors', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrapped = ErrorHandler.wrapAsync(asyncFn, 'test-context');
      
      await expect(wrapped('arg1')).rejects.toThrow('Async error');
    });
  });

  describe('fromDatabaseError', () => {
    it('should create DatabaseError from PostgreSQL error', () => {
      const pgError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        constraint: 'users_username_key',
        table: 'users',
        column: 'username'
      };

      const result = ErrorHandler.fromDatabaseError(pgError);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Duplicate entry');
    });

    it('should handle unknown database errors', () => {
      const pgError = {
        code: '99999',
        message: 'Unknown database error'
      };

      const result = ErrorHandler.fromDatabaseError(pgError);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Database operation failed');
    });
  });

  describe('fromValidation', () => {
    it('should create ValidationError from field validation', () => {
      const result = ErrorHandler.fromValidation('username', 'Username is required', 'test');

      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('Username is required');
      expect(result.validationErrors).toEqual([
        { field: 'username', message: 'Username is required', value: 'test' }
      ]);
    });
  });

  describe('notFound', () => {
    it('should create NotFoundError with resource and id', () => {
      const result = ErrorHandler.notFound('User', '123');

      expect(result).toBeInstanceOf(NotFoundError);
      expect(result.message).toBe('User with id 123 not found');
    });

    it('should create NotFoundError without id', () => {
      const result = ErrorHandler.notFound('User');

      expect(result).toBeInstanceOf(NotFoundError);
      expect(result.message).toBe('User with id unknown not found');
    });
  });

  describe('unauthorized', () => {
    it('should create AuthenticationError', () => {
      const result = ErrorHandler.unauthorized('Invalid token');

      expect(result).toBeInstanceOf(AuthenticationError);
      expect(result.message).toBe('Invalid token');
      expect(result.authType).toBe('signature');
    });
  });

  describe('rateLimited', () => {
    it('should create RateLimitError', () => {
      const result = ErrorHandler.rateLimited(100, 60000);

      expect(result).toBeInstanceOf(RateLimitError);
      expect(result.limit).toBe(100);
      expect(result.windowMs).toBe(60000);
      expect(result.retryAfter).toBe(60);
    });
  });

  describe('isRetryable', () => {
    it('should identify retryable errors', () => {
      const networkError = new Error('ECONNREFUSED: connect');
      const timeoutError = new Error('ETIMEDOUT: timeout');

      expect(ErrorHandler.isRetryable(networkError)).toBe(true);
      expect(ErrorHandler.isRetryable(timeoutError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const validationError = new ValidationError('Invalid input');
      const authError = new AuthenticationError('Unauthorized', 'signature', 'Invalid');

      expect(ErrorHandler.isRetryable(validationError)).toBe(false);
      expect(ErrorHandler.isRetryable(authError)).toBe(false);
    });
  });

  describe('serialize', () => {
    it('should serialize BaseError', () => {
      const error = new ValidationError('Test error');
      const result = ErrorHandler.serialize(error);

      expect(result).toEqual({
        type: 'ValidationError',
        message: 'Test error',
        code: 'ValidationError',
        details: undefined,
        timestamp: expect.any(String)
      });
    });

    it('should serialize generic Error', () => {
      const error = new Error('Generic error');
      const result = ErrorHandler.serialize(error);

      expect(result).toEqual({
        type: 'Error',
        message: 'Generic error',
        stack: expect.any(String)
      });
    });

    it('should serialize unknown errors', () => {
      const error = 'String error';
      const result = ErrorHandler.serialize(error);

      expect(result).toEqual({
        type: 'Unknown',
        value: 'String error'
      });
    });
  });

  describe('expressErrorHandler', () => {
    it('should create Express error middleware', () => {
      const middleware = ErrorHandler.expressErrorHandler();
      expect(typeof middleware).toBe('function');
    });

    it('should handle errors in Express middleware', () => {
      const middleware = ErrorHandler.expressErrorHandler();
      const error = new ValidationError('Invalid input');
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      middleware(error, req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          type: 'ValidationError',
          message: 'Invalid input',
          code: 'ValidationError',
          details: undefined
        },
        statusCode: 400
      });
    });
  });
});