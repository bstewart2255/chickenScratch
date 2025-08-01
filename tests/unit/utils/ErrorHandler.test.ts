import { ErrorHandler } from '../../../src/utils/ErrorHandler';
import { AppError, ValidationError, AuthenticationError, DatabaseError } from '../../../src/types/errors';
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
    it('should handle AppError with custom status code', () => {
      const error = new AppError('Custom error', 400);
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Custom error',
          status: 400,
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Invalid input');
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid input',
          status: 400,
          timestamp: expect.any(String),
          type: 'ValidationError'
        }
      });
    });

    it('should handle AuthenticationError', () => {
      const error = new AuthenticationError('Unauthorized');
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Unauthorized',
          status: 401,
          timestamp: expect.any(String),
          type: 'AuthenticationError'
        }
      });
    });

    it('should handle DatabaseError', () => {
      const error = new DatabaseError('Database connection failed');
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Database connection failed',
          status: 500,
          timestamp: expect.any(String),
          type: 'DatabaseError'
        }
      });
    });

    it('should handle generic Error', () => {
      const error = new Error('Generic error');
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal server error',
          status: 500,
          timestamp: expect.any(String)
        }
      });
    });

    it('should include stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Dev error');
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          stack: expect.any(String)
        })
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Prod error');
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.error.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle errors with additional properties', () => {
      const error: any = new AppError('Error with details', 400);
      error.code = 'INVALID_INPUT';
      error.details = { field: 'username', reason: 'too short' };

      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: 'Error with details',
          code: 'INVALID_INPUT',
          details: { field: 'username', reason: 'too short' }
        })
      });
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrapped = ErrorHandler.asyncHandler(asyncFn);
      
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      await wrapped(req as any, res as any, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch async errors and pass to next', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrapped = ErrorHandler.asyncHandler(asyncFn);
      
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      await wrapped(req as any, res as any, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle sync errors in async functions', async () => {
      const error = new Error('Sync error in async');
      const asyncFn = jest.fn(() => {
        throw error;
      });
      const wrapped = ErrorHandler.asyncHandler(asyncFn);
      
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      await wrapped(req as any, res as any, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('isOperationalError', () => {
    it('should identify operational errors', () => {
      const appError = new AppError('Operational', 400);
      const validationError = new ValidationError('Validation failed');
      const authError = new AuthenticationError('Auth failed');

      expect(ErrorHandler.isOperationalError(appError)).toBe(true);
      expect(ErrorHandler.isOperationalError(validationError)).toBe(true);
      expect(ErrorHandler.isOperationalError(authError)).toBe(true);
    });

    it('should identify non-operational errors', () => {
      const genericError = new Error('Generic');
      const typeError = new TypeError('Type error');
      const rangeError = new RangeError('Range error');

      expect(ErrorHandler.isOperationalError(genericError)).toBe(false);
      expect(ErrorHandler.isOperationalError(typeError)).toBe(false);
      expect(ErrorHandler.isOperationalError(rangeError)).toBe(false);
    });

    it('should handle custom operational errors', () => {
      class CustomOperationalError extends Error {
        isOperational = true;
      }

      const customError = new CustomOperationalError('Custom');
      expect(ErrorHandler.isOperationalError(customError)).toBe(true);
    });
  });

  describe('formatError', () => {
    it('should format error for response', () => {
      const error = new AppError('Test error', 400);
      const formatted = ErrorHandler.formatError(error);

      expect(formatted).toEqual({
        message: 'Test error',
        status: 400,
        timestamp: expect.any(String)
      });
    });

    it('should include error type for specific errors', () => {
      const validationError = new ValidationError('Invalid data');
      const formatted = ErrorHandler.formatError(validationError);

      expect(formatted).toEqual({
        message: 'Invalid data',
        status: 400,
        timestamp: expect.any(String),
        type: 'ValidationError'
      });
    });

    it('should sanitize sensitive information', () => {
      const error: any = new DatabaseError('Connection failed');
      error.connectionString = 'postgresql://user:password@host/db';
      error.password = 'secret123';

      const formatted = ErrorHandler.formatError(error);

      expect(formatted.connectionString).toBeUndefined();
      expect(formatted.password).toBeUndefined();
      expect(formatted.message).toBe('Connection failed');
    });
  });

  describe('error logging', () => {
    it('should log errors with context', () => {
      const error = new Error('Test error');
      const req = mockRequest({
        method: 'POST',
        url: '/api/test',
        headers: { 'user-agent': 'test-agent' },
        ip: '127.0.0.1'
      });
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error:',
        expect.objectContaining({
          message: 'Test error',
          method: 'POST',
          url: '/api/test',
          ip: '127.0.0.1',
          userAgent: 'test-agent'
        })
      );
    });

    it('should not log in test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const error = new Error('Test error');
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(error, req as any, res as any, next);

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined errors', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      ErrorHandler.handleError(null as any, req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal server error',
          status: 500,
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle circular reference in error object', () => {
      const error: any = new Error('Circular error');
      error.circular = error;

      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      expect(() => {
        ErrorHandler.handleError(error, req as any, res as any, next);
      }).not.toThrow();

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle errors during error handling', () => {
      const error = new Error('Original error');
      const req = mockRequest();
      const res = mockResponse();
      
      // Make res.status throw an error
      (res.status as jest.Mock).mockImplementation(() => {
        throw new Error('Error in error handler');
      });
      
      const next = mockNext();

      expect(() => {
        ErrorHandler.handleError(error, req as any, res as any, next);
      }).not.toThrow();

      expect(next).toHaveBeenCalled();
    });
  });
});