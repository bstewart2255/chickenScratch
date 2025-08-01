import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { 
  DataFormatConverter, 
  ErrorHandler, 
  Logger, 
  ApiValidator 
} from '../utils';
import {
  EnrollBiometricRequestSchema,
  AuthenticateRequestSchema,
  RegisterUserRequestSchema,
  GetUserSignaturesRequestSchema,
  DeleteSignatureRequestSchema,
  UpdateUserProfileRequestSchema,
  BiometricComparisonResultSchema,
  ApiResponseSchema
} from '../types/api/schemas';
import { z } from 'zod';

/**
 * Main server application with integrated TypeScript utilities
 * Implements runtime validation at all system boundaries
 */
export class ServerApp {
  private app: express.Application;
  private logger: Logger;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.logger = new Logger('ServerApp');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware with security and logging
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    this.app.use(Logger.httpLogger());

    // Request validation middleware
    this.app.use(this.validateRequestId);
  }

  /**
   * Setup API routes with runtime validation
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // User registration with validation
    this.app.post('/api/register', 
      ApiValidator.validateMiddleware(RegisterUserRequestSchema, 'user-registration'),
      this.handleUserRegistration
    );

    // Biometric enrollment with validation
    this.app.post('/api/enroll',
      ApiValidator.validateMiddleware(EnrollBiometricRequestSchema, 'biometric-enrollment'),
      this.handleBiometricEnrollment
    );

    // Authentication with validation
    this.app.post('/api/authenticate',
      ApiValidator.validateMiddleware(AuthenticateRequestSchema, 'biometric-authentication'),
      this.handleBiometricAuthentication
    );

    // Get user signatures with query validation
    this.app.get('/api/signatures/:userId',
      ApiValidator.validateParams(z.object({ userId: z.string().uuid() }), 'get-signatures-params'),
      ApiValidator.validateQuery(GetUserSignaturesRequestSchema, 'get-signatures-query'),
      this.handleGetUserSignatures
    );

    // Delete signature with validation
    this.app.delete('/api/signatures/:signatureId',
      ApiValidator.validateParams(z.object({ signatureId: z.string().uuid() }), 'delete-signature-params'),
      ApiValidator.validateMiddleware(DeleteSignatureRequestSchema, 'delete-signature'),
      this.handleDeleteSignature
    );

    // Update user profile with validation
    this.app.put('/api/users/:userId',
      ApiValidator.validateParams(z.object({ userId: z.string().uuid() }), 'update-profile-params'),
      ApiValidator.validateMiddleware(UpdateUserProfileRequestSchema, 'update-profile'),
      this.handleUpdateUserProfile
    );

    // Legacy signature endpoint with validation
    this.app.post('/api/signature',
      this.handleLegacySignature
    );
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(ErrorHandler.expressErrorHandler());

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      const error = ErrorHandler.notFound('Route', req.originalUrl);
      const errorResponse = ErrorHandler.createErrorResponse(error);
      res.status(404).json(errorResponse);
    });
  }

  /**
   * Validate request ID for tracking
   */
  private validateRequestId = (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || this.generateRequestId();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  };

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle user registration with validated data
   */
  private handleUserRegistration = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = req.validatedBody;
      this.logger.info('User registration request', {
        email: validatedData.email,
        username: validatedData.username
      });

      // Process registration logic here
      const result = await this.processUserRegistration(validatedData);

      // Validate response before sending
      const validatedResponse = ApiValidator.validateResponse(
        ApiResponseSchema(z.object({
          userId: z.string().uuid(),
          message: z.string()
        })),
        {
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        },
        'user-registration-response'
      );

      res.status(201).json(validatedResponse);
    } catch (error) {
      ErrorHandler.logError(error, { route: '/api/register' });
      const errorResponse = ErrorHandler.createErrorResponse(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };

  /**
   * Handle biometric enrollment with validated data
   */
  private handleBiometricEnrollment = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = req.validatedBody;
      this.logger.info('Biometric enrollment request', {
        userId: validatedData.userId,
        biometricType: validatedData.biometricType
      });

      // Convert and validate biometric data
      const strokeData = DataFormatConverter.parseStrokeData(validatedData.biometricData);
      if (strokeData.length === 0) {
        throw ErrorHandler.fromValidation('biometricData', 'Invalid stroke data');
      }

      // Process enrollment logic here
      const result = await this.processBiometricEnrollment(validatedData, strokeData);

      const validatedResponse = ApiValidator.validateResponse(
        ApiResponseSchema(z.object({
          enrollmentId: z.string().uuid(),
          confidence: z.number().min(0).max(1)
        })),
        {
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        },
        'biometric-enrollment-response'
      );

      res.status(201).json(validatedResponse);
    } catch (error) {
      ErrorHandler.logError(error, { route: '/api/enroll' });
      const errorResponse = ErrorHandler.createErrorResponse(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };

  /**
   * Handle biometric authentication with validated data
   */
  private handleBiometricAuthentication = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = req.validatedBody;
      this.logger.info('Biometric authentication request', {
        userId: validatedData.userId,
        biometricType: validatedData.biometricType
      });

      // Convert and validate biometric data
      const strokeData = DataFormatConverter.parseStrokeData(validatedData.biometricData);
      if (strokeData.length === 0) {
        throw ErrorHandler.fromValidation('biometricData', 'Invalid stroke data');
      }

      // Process authentication logic here
      const result = await this.processBiometricAuthentication(validatedData, strokeData);

      const validatedResponse = ApiValidator.validateResponse(
        ApiResponseSchema(BiometricComparisonResultSchema),
        {
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        },
        'biometric-authentication-response'
      );

      res.status(200).json(validatedResponse);
    } catch (error) {
      ErrorHandler.logError(error, { route: '/api/authenticate' });
      const errorResponse = ErrorHandler.createErrorResponse(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };

  /**
   * Handle get user signatures with validated parameters
   */
  private handleGetUserSignatures = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedParams = req.validatedParams;
      const validatedQuery = req.validatedQuery;
      
      this.logger.info('Get user signatures request', {
        userId: validatedParams.userId,
        limit: validatedQuery.limit
      });

      // Process get signatures logic here
      const result = await this.processGetUserSignatures(validatedParams, validatedQuery);

      const validatedResponse = ApiValidator.validateResponse(
        ApiResponseSchema(z.array(z.object({
          id: z.string().uuid(),
          biometricType: z.string(),
          createdAt: z.string()
        }))),
        {
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        },
        'get-signatures-response'
      );

      res.status(200).json(validatedResponse);
    } catch (error) {
      ErrorHandler.logError(error, { route: '/api/signatures/:userId' });
      const errorResponse = ErrorHandler.createErrorResponse(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };

  /**
   * Handle delete signature with validated data
   */
  private handleDeleteSignature = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedParams = req.validatedParams;
      const validatedBody = req.validatedBody;
      
      this.logger.info('Delete signature request', {
        signatureId: validatedParams.signatureId,
        userId: validatedBody.userId
      });

      // Process delete logic here
      await this.processDeleteSignature(validatedParams, validatedBody);

      const validatedResponse = ApiValidator.validateResponse(
        ApiResponseSchema(z.object({
          message: z.string()
        })),
        {
          success: true,
          data: { message: 'Signature deleted successfully' },
          timestamp: new Date().toISOString()
        },
        'delete-signature-response'
      );

      res.status(200).json(validatedResponse);
    } catch (error) {
      ErrorHandler.logError(error, { route: '/api/signatures/:signatureId' });
      const errorResponse = ErrorHandler.createErrorResponse(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };

  /**
   * Handle update user profile with validated data
   */
  private handleUpdateUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedParams = req.validatedParams;
      const validatedBody = req.validatedBody;
      
      this.logger.info('Update user profile request', {
        userId: validatedParams.userId
      });

      // Process update logic here
      const result = await this.processUpdateUserProfile(validatedParams, validatedBody);

      const validatedResponse = ApiValidator.validateResponse(
        ApiResponseSchema(z.object({
          userId: z.string().uuid(),
          updated: z.boolean()
        })),
        {
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        },
        'update-profile-response'
      );

      res.status(200).json(validatedResponse);
    } catch (error) {
      ErrorHandler.logError(error, { route: '/api/users/:userId' });
      const errorResponse = ErrorHandler.createErrorResponse(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };

  /**
   * Handle legacy signature endpoint with validation
   */
  private handleLegacySignature = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate legacy signature data
      const validatedData = ApiValidator.validateRequestSafe(
        z.object({
          userId: z.string(),
          signatureData: z.any(),
          metrics: z.any().optional(),
          timestamp: z.string().optional()
        }),
        req.body,
        'legacy-signature'
      );

      if (!validatedData) {
        throw ErrorHandler.fromValidation('legacy-signature', 'Invalid signature data');
      }

      this.logger.info('Legacy signature request', {
        userId: validatedData.userId
      });

      // Convert legacy format to new format
      const convertedData = DataFormatConverter.convertLegacySignature(validatedData);
      if (!convertedData) {
        throw ErrorHandler.fromValidation('legacy-signature', 'Failed to convert legacy signature format');
      }

      // Process legacy signature logic here
      const result = await this.processLegacySignature(convertedData);

      const validatedResponse = ApiValidator.validateResponse(
        ApiResponseSchema(z.object({
          signatureId: z.number(),
          message: z.string()
        })),
        {
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        },
        'legacy-signature-response'
      );

      res.status(200).json(validatedResponse);
    } catch (error) {
      ErrorHandler.logError(error, { route: '/api/signature' });
      const errorResponse = ErrorHandler.createErrorResponse(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };

  // Placeholder methods for business logic - these would be implemented with actual database operations
  private async processUserRegistration(data: any): Promise<any> {
    // TODO: Implement actual user registration logic
    return { userId: '123e4567-e89b-12d3-a456-426614174000', message: 'User registered successfully' };
  }

  private async processBiometricEnrollment(data: any, strokeData: any): Promise<any> {
    // TODO: Implement actual biometric enrollment logic
    return { enrollmentId: '123e4567-e89b-12d3-a456-426614174001', confidence: 0.95 };
  }

  private async processBiometricAuthentication(data: any, strokeData: any): Promise<any> {
    // TODO: Implement actual biometric authentication logic
    return {
      score: 0.85,
      confidence: 0.92,
      matchDetails: { pressure: 0.8, timing: 0.9, geometry: 0.85, overall: 0.85 },
      recommendation: 'accept' as const,
      reasons: ['High confidence match']
    };
  }

  private async processGetUserSignatures(params: any, query: any): Promise<any[]> {
    // TODO: Implement actual get signatures logic
    return [
      { id: '123e4567-e89b-12d3-a456-426614174002', biometricType: 'signature', createdAt: new Date().toISOString() }
    ];
  }

  private async processDeleteSignature(params: any, body: any): Promise<void> {
    // TODO: Implement actual delete signature logic
  }

  private async processUpdateUserProfile(params: any, body: any): Promise<any> {
    // TODO: Implement actual update profile logic
    return { userId: params.userId, updated: true };
  }

  private async processLegacySignature(data: any): Promise<any> {
    // TODO: Implement actual legacy signature processing logic
    return { signatureId: 123, message: 'Legacy signature processed successfully' };
  }

  /**
   * Start the server
   */
  public start(): void {
    this.app.listen(this.port, () => {
      this.logger.info(`Server started on port ${this.port}`, {
        port: this.port,
        environment: process.env.NODE_ENV || 'development'
      });
    });
  }

  /**
   * Get the Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
} 