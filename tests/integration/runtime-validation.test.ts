import { 
  DataFormatConverter, 
  ErrorHandler, 
  Logger, 
  ApiValidator 
} from '../../src/utils';
import { DatabaseError } from '../../src/types/core/errors';
import {
  EnrollBiometricRequestSchema,
  AuthenticateRequestSchema,
  RegisterUserRequestSchema,
  ApiResponseSchema
} from '../../src/types/api/schemas';
import { z } from 'zod';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock ConfigService to prevent process.exit
jest.mock('../../src/config/ConfigService', () => ({
  configService: {
    get: jest.fn().mockReturnValue({
      env: 'development',
      logging: { level: 'info' }
    })
  }
}));

describe('Runtime Validation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Logger.setGlobalLogLevel(0); // DEBUG level
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Complete API Request Flow', () => {
    it('should handle valid biometric enrollment request with full validation', () => {
      const validRequest = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        enrollmentToken: 'valid-token-123',
        biometricType: 'signature' as const,
        biometricData: {
          strokes: [{
            id: 'stroke-1',
            points: [
              { x: 10, y: 20, pressure: 0.5, timestamp: 1000 },
              { x: 15, y: 25, pressure: 0.6, timestamp: 1100 }
            ],
            startTime: 1000,
            endTime: 1100,
            duration: 100,
            deviceType: 'pen' as const,
            color: '#000000',
            width: 2
          }],
          deviceCapabilities: {
            touch: true,
            pressure: true,
            tilt: false,
            precision: 'high' as const,
            pointerType: 'pen' as const,
            maxPressure: 1.0,
            timestamp: new Date().toISOString()
          },
          canvasSize: {
            width: 800,
            height: 600
          },
          timestamp: new Date().toISOString(),
          sessionId: 'session-123'
        },
        deviceCapabilities: {
          touch: true,
          pressure: true,
          tilt: false,
          precision: 'high' as const,
          pointerType: 'pen' as const,
          maxPressure: 1.0,
          timestamp: new Date().toISOString()
        },
        sessionId: 'session-123'
      };

      // Step 1: Validate request at boundary
      const validatedRequest = ApiValidator.validateRequest(
        EnrollBiometricRequestSchema,
        validRequest,
        'biometric-enrollment'
      );

      expect(validatedRequest).toEqual(validRequest);

      // Step 2: Convert and validate biometric data
      const strokeData = DataFormatConverter.parseStrokeData(validatedRequest.biometricData.strokes.map(stroke => stroke.points));
      expect(strokeData).toHaveLength(1);
      expect(strokeData[0]).toHaveLength(2);

      // Step 3: Process the request (simulated)
      const enrollmentResult = {
        enrollmentId: '123e4567-e89b-12d3-a456-426614174001',
        confidence: 0.95
      };

      // Step 4: Validate response before sending
      const responseSchema = ApiResponseSchema(z.object({
        enrollmentId: z.string().uuid(),
        confidence: z.number().min(0).max(1)
      }));

      const response = {
        success: true,
        data: enrollmentResult,
        timestamp: new Date().toISOString()
      };

      const validatedResponse = ApiValidator.validateResponse(
        responseSchema,
        response,
        'biometric-enrollment-response'
      );

      expect(validatedResponse).toEqual(response);
      expect(validatedResponse.data.enrollmentId).toBe(enrollmentResult.enrollmentId);
      expect(validatedResponse.data.confidence).toBe(enrollmentResult.confidence);
    });

    it('should handle invalid biometric enrollment request with proper error handling', () => {
      const invalidRequest = {
        userId: 'invalid-uuid',
        enrollmentToken: '', // Empty token
        biometricType: 'invalid-type', // Invalid type
        biometricData: {
          strokes: [], // Empty strokes
          deviceCapabilities: {
            touch: true,
            pressure: true,
            tilt: false,
            precision: 'invalid', // Invalid precision
            pointerType: 'invalid', // Invalid pointer type
            maxPressure: -1, // Invalid pressure
            timestamp: 'invalid-date' // Invalid date
          },
          canvasSize: {
            width: -100, // Invalid width
            height: 0 // Invalid height
          },
          timestamp: 'invalid-date',
          sessionId: 'session-123'
        },
        deviceCapabilities: {
          touch: true,
          pressure: true,
          tilt: false,
          precision: 'high',
          pointerType: 'pen',
          maxPressure: 1.0,
          timestamp: new Date().toISOString()
        }
      };

      // Step 1: Validation should fail
      expect(() => {
        ApiValidator.validateRequest(
          EnrollBiometricRequestSchema,
          invalidRequest,
          'biometric-enrollment'
        );
      }).toThrow(ErrorHandler.fromValidation('biometric-enrollment', 'Invalid request data'));

      // Step 2: Safe validation should return null
      const safeResult = ApiValidator.validateRequestSafe(
        EnrollBiometricRequestSchema,
        invalidRequest,
        'biometric-enrollment'
      );

      expect(safeResult).toBeNull();
    });

    it('should handle legacy signature data conversion with validation', () => {
      const legacySignatureData = {
        userId: 'user123',
        signatureData: {
          data: 'data:image/png;base64,iVBORw0KGgoAAAANS',
          raw: [[
            { x: 10, y: 20, pressure: 0.5, timestamp: 1000 },
            { x: 15, y: 25, pressure: 0.6, timestamp: 1100 }
          ]]
        },
        metrics: {
          speed: 100,
          pressure: 0.55,
          area: 500
        },
        timestamp: new Date().toISOString()
      };

      // Step 1: Convert legacy format
      const convertedData = DataFormatConverter.convertLegacySignature({
        data: legacySignatureData.signatureData.data,
        raw: legacySignatureData.signatureData.raw,
        metrics: legacySignatureData.metrics,
        timestamp: new Date(legacySignatureData.timestamp).getTime()
      });
      expect(convertedData).toBeTruthy();
      expect(convertedData?.stroke_data).toHaveLength(1);
      expect(convertedData?.stroke_data[0]).toHaveLength(2);

      // Step 2: Validate converted data
      const strokeData = DataFormatConverter.parseStrokeData(convertedData?.stroke_data);
      expect(strokeData).toHaveLength(1);
      expect(strokeData[0]).toHaveLength(2);

      // Step 3: Extract base64 image
      const base64Image = DataFormatConverter.extractBase64Image(legacySignatureData.signatureData);
      expect(base64Image).toBe(legacySignatureData.signatureData.data);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle validation errors with proper logging and error responses', () => {
      const invalidRequest = {
        email: 'invalid-email',
        username: 'a', // Too short
        fullName: 123 // Wrong type
      };

      try {
        ApiValidator.validateRequest(
          RegisterUserRequestSchema,
          invalidRequest,
          'user-registration'
        );
      } catch (error) {
        // Step 1: Create error response
        const errorResponse = ErrorHandler.createErrorResponse(error);
        expect(errorResponse.statusCode).toBe(400);
        expect(errorResponse.error.type).toBe('ValidationError');
        expect(errorResponse.error.message).toBe('Invalid request data');

        // Step 2: Log the error
        ErrorHandler.logError(error, { route: '/api/register' });

        // Step 3: Verify error is logged
        expect(mockConsoleError).toHaveBeenCalled();
      }
    });

    it('should handle database errors with proper conversion', () => {
      const dbError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        constraint: 'users_email_key',
        table: 'users',
        column: 'email'
      };

      const convertedError = ErrorHandler.fromDatabaseError(dbError);
      expect(convertedError).toBeInstanceOf(DatabaseError);
      expect(convertedError.message).toBe('Duplicate entry');
      expect(convertedError.operation).toBe('DB_OPERATION');
      expect(convertedError.context?.code).toBe('DUPLICATE_ENTRY');

      const errorResponse = ErrorHandler.createErrorResponse(convertedError);
      expect(errorResponse.statusCode).toBe(500);
      expect(errorResponse.error.type).toBe('DatabaseError');
    });
  });

  describe('Logging Integration', () => {
    it('should log structured data with proper validation', () => {
      const logger = new Logger('IntegrationTest');

      // Step 1: Log with valid metadata
      const validMetadata = {
        userId: 'user123',
        action: 'login',
        timestamp: new Date().toISOString()
      };

      logger.info('User action performed', validMetadata);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );

      // Step 2: Log with invalid metadata (should be sanitized)
      const invalidMetadata = {
        userId: 'user123',
        password: 'secret123', // Should be removed
        token: 'jwt-token', // Should be removed
        action: 'login'
      };

      logger.warn('Security warning', invalidMetadata);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
    });

    it('should measure and log operation timing', async () => {
      const logger = new Logger('TimingTest');

      const result = await logger.time('TestOperation', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('TestOperation completed')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"success":true')
      );
    });
  });

  describe('Data Format Conversion Integration', () => {
    it('should handle various data formats with validation', () => {
      // Test 1: Base64 conversion
      const base64Data = 'SGVsbG8gV29ybGQ='; // "Hello World"
      const buffer = DataFormatConverter.base64ToBuffer(base64Data);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe('Hello World');

      const convertedBack = DataFormatConverter.bufferToBase64(buffer);
      expect(convertedBack).toMatch(/^data:image\/png;base64,/);

      // Test 2: JSON parsing
      const jsonString = '{"test": "value", "number": 123}';
      const parsed = DataFormatConverter.parseJSON(jsonString);
      expect(parsed).toEqual({ test: 'value', number: 123 });

      // Test 3: Timestamp parsing
      const timestamp = DataFormatConverter.parseTimestamp('2024-01-01T00:00:00.000Z');
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBe(new Date('2024-01-01T00:00:00.000Z').getTime());

      // Test 4: Array handling
      const singleItem = 'test';
      const arrayResult = DataFormatConverter.ensureArray(singleItem);
      expect(arrayResult).toEqual(['test']);

      const existingArray = [1, 2, 3];
      const arrayResult2 = DataFormatConverter.ensureArray(existingArray);
      expect(arrayResult2).toBe(existingArray);
    });

    it('should handle edge cases and invalid data gracefully', () => {
      // Test 1: Invalid base64
      expect(() => {
        DataFormatConverter.base64ToBuffer('invalid!@#');
      }).toThrow(z.ZodError);

      // Test 2: Invalid JSON
      const invalidJson = DataFormatConverter.parseJSON('invalid json');
      expect(invalidJson).toBeNull();

      // Test 3: Invalid timestamp
      const invalidTimestamp = DataFormatConverter.parseTimestamp('invalid-date');
      expect(invalidTimestamp).toBeInstanceOf(Date);
      expect(invalidTimestamp.getTime()).toBeGreaterThan(Date.now() - 1000);

      // Test 4: Null/undefined stroke data
      const nullStrokeData = DataFormatConverter.parseStrokeData(null);
      expect(nullStrokeData).toEqual([]);

      const undefinedStrokeData = DataFormatConverter.parseStrokeData(undefined);
      expect(undefinedStrokeData).toEqual([]);
    });
  });

  describe('Complete System Boundary Validation', () => {
    it('should validate all system boundaries in a complete request flow', () => {
      // Simulate a complete API request flow with validation at every boundary

      // 1. Request validation at API boundary
      const requestData = {
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        metadata: { source: 'web' }
      };

      const validatedRequest = ApiValidator.validateRequest(
        RegisterUserRequestSchema,
        requestData,
        'user-registration-boundary'
      );

      expect(validatedRequest).toEqual(requestData);

      // 2. Internal processing (trusted)
      const processedData = {
        ...validatedRequest,
        id: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date().toISOString()
      };

      // 3. Response validation at API boundary
      const responseData = {
        success: true,
        data: {
          userId: processedData.id,
          message: 'User registered successfully'
        },
        timestamp: new Date().toISOString()
      };

      const responseSchema = ApiResponseSchema(z.object({
        userId: z.string().uuid(),
        message: z.string()
      }));

      const validatedResponse = ApiValidator.validateResponse(
        responseSchema,
        responseData,
        'user-registration-response-boundary'
      );

      expect(validatedResponse).toEqual(responseData);
      expect(validatedResponse.data.userId).toBe(processedData.id);
    });

    it('should handle validation failures at all boundaries', () => {
      // Test request boundary failure
      const invalidRequest = {
        email: 'invalid-email',
        username: 'a'
      };

      expect(() => {
        ApiValidator.validateRequest(
          RegisterUserRequestSchema,
          invalidRequest,
          'request-boundary'
        );
      }).toThrow(ErrorHandler.fromValidation('request-boundary', 'Invalid request data'));

      // Test response boundary failure (should be handled gracefully)
      const invalidResponse = {
        success: true,
        data: {
          userId: 'invalid-uuid',
          message: '123' // Should be string
        },
        timestamp: new Date().toISOString()
      };

      const responseSchema = ApiResponseSchema(z.object({
        userId: z.string().uuid(),
        message: z.string()
      }));

      // Should not throw, but log error and return original data
      const result = ApiValidator.validateResponse(
        responseSchema,
        invalidResponse,
        'response-boundary'
      );

      expect(result).toEqual(invalidResponse);
    });
  });
}); 