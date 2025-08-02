# Runtime Validation Guide

This guide explains how to use the TypeScript utilities with Zod runtime validation at system boundaries.

## Overview

The runtime validation system implements the principle: **"Validate at boundaries, trust internally"**. This means:

- All external inputs (API requests, file uploads, etc.) are validated at system boundaries
- Internal functions can trust that data has been validated
- Responses are validated before being sent to clients
- Comprehensive error handling and logging throughout

## Core Utilities

### 1. ApiValidator

The `ApiValidator` class provides runtime validation at system boundaries:

```typescript
import { ApiValidator } from '../utils';
import { z } from 'zod';

// Define your schema
const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(0)
});

// Validate request data
const validatedData = ApiValidator.validateRequest(UserSchema, requestBody, 'user-registration');

// Safe validation (returns null on failure)
const safeData = ApiValidator.validateRequestSafe(UserSchema, requestBody, 'user-registration');
if (safeData) {
  // Process valid data
}

// Validate response before sending
const validatedResponse = ApiValidator.validateResponse(ResponseSchema, responseData, 'user-response');
```

### 2. Express Middleware

Create validation middleware for Express routes:

```typescript
// Body validation middleware
app.post('/api/users', 
  ApiValidator.validateMiddleware(UserSchema, 'user-creation'),
  (req, res) => {
    // req.validatedBody contains validated data
    const userData = req.validatedBody;
    // Process user creation...
  }
);

// Query parameter validation
app.get('/api/users',
  ApiValidator.validateQuery(QuerySchema, 'user-list'),
  (req, res) => {
    // req.validatedQuery contains validated query params
    const query = req.validatedQuery;
    // Process query...
  }
);

// URL parameter validation
app.get('/api/users/:id',
  ApiValidator.validateParams(z.object({ id: z.string().uuid() }), 'user-detail'),
  (req, res) => {
    // req.validatedParams contains validated URL params
    const { id } = req.validatedParams;
    // Process user detail...
  }
);
```

### 3. DataFormatConverter

Convert and validate data formats:

```typescript
import { DataFormatConverter } from '../utils';

// Parse stroke data from various formats
const strokeData = DataFormatConverter.parseStrokeData(inputData);

// Convert legacy signature format
const convertedData = DataFormatConverter.convertLegacySignature(legacyData);

// Parse JSON safely
const parsedData = DataFormatConverter.parseJSON(jsonString);

// Extract base64 image
const base64Image = DataFormatConverter.extractBase64Image(data);
```

### 4. ErrorHandler

Handle errors with proper logging and responses:

```typescript
import { ErrorHandler } from '../utils';

// Create standardized error responses
const errorResponse = ErrorHandler.createErrorResponse(error);

// Log errors with context
ErrorHandler.logError(error, { route: '/api/users', userId: '123' });

// Convert database errors
const dbError = ErrorHandler.fromDatabaseError(postgresError);

// Create specific error types
const validationError = ErrorHandler.fromValidation('email', 'Invalid email format');
const notFoundError = ErrorHandler.notFound('User', '123');
const authError = ErrorHandler.unauthorized('Invalid token');
```

### 5. Logger

Structured logging with validation:

```typescript
import { Logger } from '../utils';

const logger = new Logger('UserService');

// Log with metadata
logger.info('User created', { userId: '123', email: 'user@example.com' });

// Measure operation timing
const result = await logger.time('Database query', async () => {
  return await database.query('SELECT * FROM users');
});

// Create child logger
const childLogger = logger.child('Authentication');
childLogger.warn('Login attempt failed', { userId: '123', reason: 'Invalid password' });
```

## Complete API Example

Here's a complete example of an API endpoint with full runtime validation:

```typescript
import express from 'express';
import { 
  ApiValidator, 
  DataFormatConverter, 
  ErrorHandler, 
  Logger 
} from '../utils';
import { 
  EnrollBiometricRequestSchema,
  ApiResponseSchema 
} from '../types/api/schemas';
import { z } from 'zod';

const app = express();
const logger = new Logger('BiometricAPI');

// Biometric enrollment endpoint with full validation
app.post('/api/enroll',
  ApiValidator.validateMiddleware(EnrollBiometricRequestSchema, 'biometric-enrollment'),
  async (req, res) => {
    try {
      const validatedData = req.validatedBody;
      
      logger.info('Biometric enrollment request', {
        userId: validatedData.userId,
        biometricType: validatedData.biometricType
      });

      // Convert and validate biometric data
      const strokeData = DataFormatConverter.parseStrokeData(validatedData.biometricData);
      if (strokeData.length === 0) {
        throw ErrorHandler.fromValidation('biometricData', 'Invalid stroke data');
      }

      // Process enrollment (trusted internal logic)
      const enrollmentResult = await processEnrollment(validatedData, strokeData);

      // Validate response before sending
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
        'enrollment-response'
      );

      res.status(201).json(validatedResponse);
      
    } catch (error) {
      ErrorHandler.logError(error, { route: '/api/enroll' });
      const errorResponse = ErrorHandler.createErrorResponse(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  }
);

// Global error handler
app.use(ErrorHandler.expressErrorHandler());

// HTTP logging middleware
app.use(Logger.httpLogger());
```

## Schema Definition Best Practices

### 1. Define Comprehensive Schemas

```typescript
import { z } from 'zod';

// Device capabilities schema
export const DeviceCapabilitiesSchema = z.object({
  touch: z.boolean(),
  pressure: z.boolean(),
  tilt: z.boolean(),
  precision: z.enum(['high', 'medium', 'low']),
  pointerType: z.enum(['mouse', 'pen', 'touch', 'unknown']),
  maxPressure: z.number(),
  timestamp: z.string()
});

// Stroke point schema with defaults
export const StrokePointSchema = z.object({
  x: z.number(),
  y: z.number(),
  pressure: z.number().min(0).max(1).default(0),
  timestamp: z.number().default(Date.now),
  tiltX: z.number().optional(),
  tiltY: z.number().optional()
});

// Complex nested schema
export const BiometricDataSchema = z.object({
  strokes: z.array(z.object({
    id: z.string(),
    points: z.array(StrokePointSchema),
    startTime: z.number(),
    endTime: z.number(),
    duration: z.number(),
    deviceType: z.enum(['mouse', 'pen', 'touch'])
  })),
  deviceCapabilities: DeviceCapabilitiesSchema,
  canvasSize: z.object({
    width: z.number().positive(),
    height: z.number().positive()
  }),
  timestamp: z.string(),
  sessionId: z.string().optional()
});
```

### 2. Use Generic Response Schemas

```typescript
// Generic API response wrapper
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional()
    }).optional(),
    timestamp: z.string()
  });

// Usage
const UserResponseSchema = ApiResponseSchema(z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email()
}));
```

## Testing Runtime Validation

### 1. Unit Tests

```typescript
import { ApiValidator } from '../utils/ApiValidator';
import { z } from 'zod';

describe('ApiValidator', () => {
  const testSchema = z.object({
    name: z.string().min(2),
    age: z.number().min(0)
  });

  it('should validate valid data', () => {
    const validData = { name: 'John Doe', age: 30 };
    const result = ApiValidator.validateRequest(testSchema, validData, 'test');
    expect(result).toEqual(validData);
  });

  it('should throw error for invalid data', () => {
    const invalidData = { name: 'J', age: -5 };
    expect(() => {
      ApiValidator.validateRequest(testSchema, invalidData, 'test');
    }).toThrow();
  });
});
```

### 2. Integration Tests

```typescript
describe('API Integration', () => {
  it('should handle complete request flow with validation', async () => {
    const request = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      biometricData: { /* valid biometric data */ }
    };

    // Validate request
    const validatedRequest = ApiValidator.validateRequest(
      EnrollBiometricRequestSchema,
      request,
      'test-enrollment'
    );

    // Process request
    const result = await processEnrollment(validatedRequest);

    // Validate response
    const validatedResponse = ApiValidator.validateResponse(
      ResponseSchema,
      result,
      'test-response'
    );

    expect(validatedResponse.success).toBe(true);
  });
});
```

## Error Handling Patterns

### 1. Validation Errors

```typescript
try {
  const data = ApiValidator.validateRequest(schema, input, 'context');
  // Process valid data
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle Zod validation errors
    const errorResponse = ErrorHandler.createErrorResponse(error);
    return res.status(400).json(errorResponse);
  }
  // Handle other errors
  throw error;
}
```

### 2. Database Errors

```typescript
try {
  const result = await database.query('INSERT INTO users...');
} catch (error) {
  const dbError = ErrorHandler.fromDatabaseError(error);
  ErrorHandler.logError(dbError, { operation: 'user-creation' });
  const errorResponse = ErrorHandler.createErrorResponse(dbError);
  return res.status(errorResponse.statusCode).json(errorResponse);
}
```

### 3. Custom Error Types

```typescript
// Create specific error types
const validationError = ErrorHandler.fromValidation('email', 'Invalid format');
const notFoundError = ErrorHandler.notFound('User', userId);
const authError = ErrorHandler.unauthorized('Invalid credentials');
const rateLimitError = ErrorHandler.rateLimited(100, 3600000);
```

## Performance Considerations

### 1. Schema Caching

Zod schemas are compiled once and reused:

```typescript
// Define schemas once at module level
const UserSchema = z.object({ /* ... */ });
const ResponseSchema = ApiResponseSchema(UserSchema);

// Reuse in multiple endpoints
app.post('/api/users', ApiValidator.validateMiddleware(UserSchema, 'user-creation'));
app.get('/api/users/:id', ApiValidator.validateMiddleware(UserSchema, 'user-detail'));
```

### 2. Selective Validation

Only validate at system boundaries, not internally:

```typescript
// ✅ Good: Validate at API boundary
app.post('/api/users', 
  ApiValidator.validateMiddleware(UserSchema, 'user-creation'),
  async (req, res) => {
    const userData = req.validatedBody; // Trusted data
    const result = await createUser(userData); // No internal validation needed
    res.json(result);
  }
);

// ❌ Bad: Validate internally
async function createUser(data: any) {
  const validated = ApiValidator.validateRequest(UserSchema, data, 'internal'); // Unnecessary
  // Process user...
}
```

## Migration Guide

### 1. From JavaScript to TypeScript

1. **Add TypeScript utilities to existing endpoints:**
```javascript
// Before
app.post('/api/signature', (req, res) => {
  const { userId, signatureData } = req.body;
  // Process without validation...
});

// After
app.post('/api/signature',
  ApiValidator.validateMiddleware(SignatureSchema, 'signature-upload'),
  (req, res) => {
    const { userId, signatureData } = req.validatedBody; // Validated data
    // Process with confidence...
  }
);
```

2. **Replace manual validation:**
```javascript
// Before
if (!req.body.email || !req.body.email.includes('@')) {
  return res.status(400).json({ error: 'Invalid email' });
}

// After
// Validation handled by middleware, data is guaranteed valid
```

3. **Add error handling:**
```javascript
// Before
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
}

// After
} catch (error) {
  ErrorHandler.logError(error, { route: '/api/users' });
  const errorResponse = ErrorHandler.createErrorResponse(error);
  res.status(errorResponse.statusCode).json(errorResponse);
}
```

### 2. Gradual Migration

1. Start with new endpoints using TypeScript utilities
2. Gradually migrate existing endpoints
3. Use the JavaScript wrapper for backward compatibility
4. Set `USE_TYPESCRIPT_SERVER=true` to enable the new server

## Running the TypeScript Server

### 1. Development

```bash
# Build and run TypeScript server
npm run dev:typescript

# Or build and run manually
npm run build
USE_TYPESCRIPT_SERVER=true npm start
```

### 2. Production

```bash
# Build for production
npm run build:strict

# Run with TypeScript server
USE_TYPESCRIPT_SERVER=true npm start
```

### 3. Testing

```bash
# Run all tests
npm test

# Run utility tests only
npm run test:utils

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### Common Issues

1. **Schema validation errors:**
   - Check that your schema matches the expected data structure
   - Use `z.safeParse()` for debugging validation issues
   - Review Zod error messages for specific field issues

2. **TypeScript compilation errors:**
   - Ensure all dependencies are installed
   - Check that schemas are properly exported
   - Verify TypeScript configuration

3. **Runtime errors:**
   - Check that the TypeScript server is built (`npm run build`)
   - Verify environment variables are set correctly
   - Review logs for detailed error information

### Debug Mode

Enable debug logging to see validation details:

```typescript
Logger.setGlobalLogLevel(LogLevel.DEBUG);
```

This will show detailed validation logs and help identify issues.

## Conclusion

The runtime validation system provides:

- **Type Safety**: Compile-time and runtime type checking
- **Security**: Validation of all external inputs
- **Reliability**: Consistent error handling and logging
- **Maintainability**: Clear separation of concerns
- **Performance**: Efficient validation at boundaries only

By following this guide, you can ensure that your application has robust runtime validation at all system boundaries while maintaining clean, maintainable code. 