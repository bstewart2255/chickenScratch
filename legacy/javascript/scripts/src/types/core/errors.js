"use strict";
/**
 * Custom error classes for the signature authentication system
 * All errors extend Error with proper typing and serialization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = exports.isOperationalError = exports.MigrationError = exports.RateLimitError = exports.NotFoundError = exports.ConfigurationError = exports.CanvasError = exports.BiometricError = exports.AuthorizationError = exports.AuthenticationError = exports.DatabaseError = exports.ValidationError = exports.BaseError = void 0;
/**
 * Base error class for all application errors
 */
class BaseError extends Error {
    constructor(message, statusCode, isOperational = true, context) {
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
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            timestamp: this.timestamp,
            context: this.context,
            ...(process.env['NODE_ENV'] === 'development' && { stack: this.stack })
        };
    }
}
exports.BaseError = BaseError;
/**
 * Validation errors for input data
 */
class ValidationError extends BaseError {
    constructor(message, validationErrors = [], context) {
        super(message, 400, true, context);
        this.validationErrors = validationErrors;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            validationErrors: this.validationErrors
        };
    }
}
exports.ValidationError = ValidationError;
/**
 * Database operation errors
 */
class DatabaseError extends BaseError {
    constructor(message, operation, query, context) {
        super(message, 500, false, context);
        this.operation = operation;
        this.query = query;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            operation: this.operation,
            ...(process.env['NODE_ENV'] === 'development' && { query: this.query })
        };
    }
}
exports.DatabaseError = DatabaseError;
/**
 * Authentication and authorization errors
 */
class AuthenticationError extends BaseError {
    constructor(message, authType, reason, context) {
        super(message, 401, true, context);
        this.authType = authType;
        this.reason = reason;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            authType: this.authType,
            reason: this.reason
        };
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Authorization errors (user authenticated but lacks permissions)
 */
class AuthorizationError extends BaseError {
    constructor(message, resource, action, context) {
        super(message, 403, true, context);
        this.resource = resource;
        this.action = action;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            resource: this.resource,
            action: this.action
        };
    }
}
exports.AuthorizationError = AuthorizationError;
/**
 * Biometric processing errors
 */
class BiometricError extends BaseError {
    constructor(message, processingStage, biometricType, context) {
        super(message, 422, true, context);
        this.processingStage = processingStage;
        this.biometricType = biometricType;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            processingStage: this.processingStage,
            biometricType: this.biometricType
        };
    }
}
exports.BiometricError = BiometricError;
/**
 * Canvas operation errors
 */
class CanvasError extends BaseError {
    constructor(message, canvasOperation, canvasId, context) {
        super(message, 400, true, context);
        this.canvasOperation = canvasOperation;
        this.canvasId = canvasId;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            canvasOperation: this.canvasOperation,
            canvasId: this.canvasId
        };
    }
}
exports.CanvasError = CanvasError;
/**
 * Configuration errors
 */
class ConfigurationError extends BaseError {
    constructor(message, configKey, requiredType, context) {
        super(message, 500, false, context);
        this.configKey = configKey;
        this.requiredType = requiredType;
    }
}
exports.ConfigurationError = ConfigurationError;
/**
 * Resource not found errors
 */
class NotFoundError extends BaseError {
    constructor(resourceType, resourceId, context) {
        super(`${resourceType} with id ${resourceId} not found`, 404, true, context);
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Rate limiting errors
 */
class RateLimitError extends BaseError {
    constructor(limit, windowMs, retryAfter, context) {
        super(`Rate limit exceeded. Try again in ${retryAfter}ms`, 429, true, context);
        this.limit = limit;
        this.windowMs = windowMs;
        this.retryAfter = retryAfter;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            limit: this.limit,
            windowMs: this.windowMs,
            retryAfter: this.retryAfter
        };
    }
}
exports.RateLimitError = RateLimitError;
/**
 * Migration-specific errors
 */
class MigrationError extends BaseError {
    constructor(message, migrationPhase, fileName, context) {
        super(message, 500, false, context);
        this.migrationPhase = migrationPhase;
        this.fileName = fileName;
    }
}
exports.MigrationError = MigrationError;
/**
 * Type guard to check if error is operational
 */
function isOperationalError(error) {
    if (error instanceof BaseError) {
        return error.isOperational;
    }
    return false;
}
exports.isOperationalError = isOperationalError;
/**
 * Error handler utility
 */
function handleError(error) {
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
        details: process.env['NODE_ENV'] === 'development' ? error.message : undefined
    };
}
exports.handleError = handleError;
