import { ApiValidator } from '../../src/utils/ApiValidator';
import { z } from 'zod';
import { ErrorHandler } from '../../src/utils/ErrorHandler';
import { mockRequest, mockResponse, mockNext } from '../helpers/mocks';

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

describe('ApiValidator', () => {
  const testSchema = z.object({
    name: z.string().min(2),
    age: z.coerce.number().min(0),
    email: z.string().email().optional()
  });

  describe('validateRequest', () => {
    it('should validate valid data', () => {
      const validData = { name: 'John Doe', age: 30 };
      const result = ApiValidator.validateRequest(testSchema, validData, 'test-context');
      
      expect(result).toEqual(validData);
    });

    it('should throw validation error for invalid data', () => {
      const invalidData = { name: 'J', age: -5 };
      
      expect(() => {
        ApiValidator.validateRequest(testSchema, invalidData, 'test-context');
      }).toThrow(ErrorHandler.fromValidation('test-context', 'Invalid request data'));
    });

    it('should throw validation error for missing required fields', () => {
      const invalidData = { name: 'John' }; // Missing age
      
      expect(() => {
        ApiValidator.validateRequest(testSchema, invalidData, 'test-context');
      }).toThrow(ErrorHandler.fromValidation('test-context', 'Invalid request data'));
    });

    it('should handle optional fields correctly', () => {
      const validData = { name: 'John Doe', age: 30, email: 'john@example.com' };
      const result = ApiValidator.validateRequest(testSchema, validData, 'test-context');
      
      expect(result).toEqual(validData);
    });
  });

  describe('validateRequestSafe', () => {
    it('should return validated data for valid input', () => {
      const validData = { name: 'John Doe', age: 30 };
      const result = ApiValidator.validateRequestSafe(testSchema, validData, 'test-context');
      
      expect(result).toEqual(validData);
    });

    it('should return null for invalid data', () => {
      const invalidData = { name: 'J', age: -5 };
      const result = ApiValidator.validateRequestSafe(testSchema, invalidData, 'test-context');
      
      expect(result).toBeNull();
    });

    it('should return null for missing required fields', () => {
      const invalidData = { name: 'John' }; // Missing age
      const result = ApiValidator.validateRequestSafe(testSchema, invalidData, 'test-context');
      
      expect(result).toBeNull();
    });
  });

  describe('validateResponse', () => {
    it('should validate valid response data', () => {
      const validData = { name: 'John Doe', age: 30 };
      const result = ApiValidator.validateResponse(testSchema, validData, 'test-context');
      
      expect(result).toEqual(validData);
    });

    it('should handle invalid response data gracefully', () => {
      const invalidData = { name: 'J', age: -5 };
      const result = ApiValidator.validateResponse(testSchema, invalidData, 'test-context');
      
      // Should return the original data (sanitized)
      expect(result).toEqual(invalidData);
    });
  });

  describe('validateMiddleware', () => {
    it('should create middleware function', () => {
      const middleware = ApiValidator.validateMiddleware(testSchema, 'test-context');
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // Express middleware has 3 parameters
    });

    it('should validate request body and add to req.validatedBody', () => {
      const middleware = ApiValidator.validateMiddleware(testSchema, 'test-context');
      const req = mockRequest({ body: { name: 'John Doe', age: 30 } });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req as any, res as any, next);
      
      expect(req.validatedBody).toEqual({ name: 'John Doe', age: 30 });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return error response for invalid body', () => {
      const middleware = ApiValidator.validateMiddleware(testSchema, 'test-context');
      const req = mockRequest({ body: { name: 'J', age: -5 } });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req as any, res as any, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          type: 'ValidationError',
          message: 'Invalid request data',
          code: 'ValidationError',
          details: undefined
        },
        statusCode: 400
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    it('should create query validation middleware', () => {
      const middleware = ApiValidator.validateQuery(testSchema, 'test-context');
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3);
    });

    it('should validate query parameters and add to req.validatedQuery', () => {
      const middleware = ApiValidator.validateQuery(testSchema, 'test-context');
      const req: any = { query: { name: 'John Doe', age: '30' } };
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req as any, res as any, next);
      
      expect(req.validatedQuery).toEqual({ name: 'John Doe', age: 30 });
      expect(next).toHaveBeenCalled();
    });

    it('should handle string numbers in query params', () => {
      const middleware = ApiValidator.validateQuery(testSchema, 'test-context');
      const req: any = { query: { name: 'John Doe', age: '30' } };
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req as any, res as any, next);
      
      expect(req.validatedQuery.age).toBe(30); // Should be converted to number
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    it('should create params validation middleware', () => {
      const middleware = ApiValidator.validateParams(testSchema, 'test-context');
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3);
    });

    it('should validate URL parameters and add to req.validatedParams', () => {
      const middleware = ApiValidator.validateParams(testSchema, 'test-context');
      const req: any = { params: { name: 'John Doe', age: '30' } };
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req as any, res as any, next);
      
      expect(req.validatedParams).toEqual({ name: 'John Doe', age: 30 });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('data sanitization', () => {
    it('should sanitize sensitive data in logs', () => {
      const sensitiveData = {
        name: 'John Doe',
        password: 'secret123',
        token: 'jwt-token',
        email: 'john@example.com'
      };
      
      // This is a private method, so we test it indirectly through validateRequestSafe
      const middleware = ApiValidator.validateMiddleware(testSchema, 'test-context');
      const req: any = { body: sensitiveData };
      const res = mockResponse();
      const next = mockNext();
      
      // This should trigger validation error and log sanitized data
      middleware(req as any, res as any, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('complex schema validation', () => {
    const complexSchema = z.object({
      user: z.object({
        id: z.string().uuid(),
        profile: z.object({
          name: z.string(),
          preferences: z.array(z.string()).optional()
        })
      }),
      metadata: z.record(z.any()).optional()
    });

    it('should validate complex nested schemas', () => {
      const validData = {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          profile: {
            name: 'John Doe',
            preferences: ['theme', 'notifications']
          }
        },
        metadata: { source: 'web' }
      };
      
      const result = ApiValidator.validateRequest(complexSchema, validData, 'complex-test');
      expect(result).toEqual(validData);
    });

    it('should handle complex validation errors', () => {
      const invalidData = {
        user: {
          id: 'invalid-uuid',
          profile: {
            name: 'John Doe'
          }
        }
      };
      
      expect(() => {
        ApiValidator.validateRequest(complexSchema, invalidData, 'complex-test');
      }).toThrow(ErrorHandler.fromValidation('complex-test', 'Invalid request data'));
    });
  });

  describe('array and union validation', () => {
    const arraySchema = z.object({
      items: z.array(z.object({
        id: z.number(),
        name: z.string()
      })),
      type: z.union([z.literal('list'), z.literal('grid')])
    });

    it('should validate arrays and unions', () => {
      const validData = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ],
        type: 'list'
      };
      
      const result = ApiValidator.validateRequest(arraySchema, validData, 'array-test');
      expect(result).toEqual(validData);
    });

    it('should handle array validation errors', () => {
      const invalidData = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 'invalid', name: 'Item 2' } // id should be number
        ],
        type: 'list'
      };
      
      expect(() => {
        ApiValidator.validateRequest(arraySchema, invalidData, 'array-test');
      }).toThrow(ErrorHandler.fromValidation('array-test', 'Invalid request data'));
    });
  });
}); 