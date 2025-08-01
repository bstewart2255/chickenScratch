import { z } from 'zod';
import { ErrorHandler } from './ErrorHandler';
import { Logger } from './Logger';

/**
 * ApiValidator - Provides runtime validation at system boundaries
 * Implements the "validate at boundaries, trust internally" principle
 */
export class ApiValidator {
  private static logger = new Logger('ApiValidator');

  /**
   * Validate request data against a Zod schema
   */
  static validateRequest<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context: string
  ): T {
    try {
      return schema.parse(data);
    } catch (error) {
      this.logger.error(`Validation failed for ${context}`, { 
        data: this.sanitizeData(data), 
        error: error instanceof z.ZodError ? error.errors : error 
      });
      throw ErrorHandler.fromValidation(context, 'Invalid request data');
    }
  }

  /**
   * Validate request data with safe parsing (returns null on failure)
   */
  static validateRequestSafe<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context: string
  ): T | null {
    const result = schema.safeParse(data);
    if (!result.success) {
      this.logger.warn(`Validation failed for ${context}`, { 
        data: this.sanitizeData(data), 
        errors: (result as z.SafeParseError<T>).error.errors 
      });
      return null;
    }
    return result.data;
  }

  /**
   * Validate response data before sending to client
   */
  static validateResponse<T>(
    schema: z.ZodSchema<T>,
    data: T,
    context: string
  ): T {
    try {
      return schema.parse(data);
    } catch (error) {
      this.logger.error(`Response validation failed for ${context}`, { 
        error: error instanceof z.ZodError ? error.errors : error 
      });
      // For responses, we might want to sanitize rather than fail
      return this.sanitizeResponse(data, schema);
    }
  }

  /**
   * Create Express middleware for request validation
   */
  static validateMiddleware<T>(schema: z.ZodSchema<T>, context: string) {
    return (req: any, res: any, next: any) => {
      try {
        const validatedData = this.validateRequest(schema, req.body, context);
        req.validatedBody = validatedData;
        next();
      } catch (error) {
        const errorResponse = ErrorHandler.createErrorResponse(error);
        res.status(errorResponse.statusCode).json(errorResponse);
      }
    };
  }

  /**
   * Create Express middleware for query parameter validation
   */
  static validateQuery<T>(schema: z.ZodSchema<T>, context: string) {
    return (req: any, res: any, next: any) => {
      try {
        const validatedData = this.validateRequest(schema, req.query, context);
        req.validatedQuery = validatedData;
        next();
      } catch (error) {
        const errorResponse = ErrorHandler.createErrorResponse(error);
        res.status(errorResponse.statusCode).json(errorResponse);
      }
    };
  }

  /**
   * Create Express middleware for URL parameter validation
   */
  static validateParams<T>(schema: z.ZodSchema<T>, context: string) {
    return (req: any, res: any, next: any) => {
      try {
        const validatedData = this.validateRequest(schema, req.params, context);
        req.validatedParams = validatedData;
        next();
      } catch (error) {
        const errorResponse = ErrorHandler.createErrorResponse(error);
        res.status(errorResponse.statusCode).json(errorResponse);
      }
    };
  }

  /**
   * Sanitize sensitive data for logging
   */
  private static sanitizeData(data: unknown): unknown {
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data as any };
      // Remove sensitive fields
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.authToken;
      delete sanitized.refreshToken;
      return sanitized;
    }
    return data;
  }

  /**
   * Sanitize response data when validation fails
   */
  private static sanitizeResponse<T>(data: T, _schema: z.ZodSchema<T>): T {
    // For now, return the original data
    // In production, you might want to implement more sophisticated sanitization
    return data;
  }
} 