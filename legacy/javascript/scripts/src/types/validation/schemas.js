"use strict";
/**
 * Input validation schemas for form data and user inputs
 * These schemas ensure data integrity at the application boundary
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationMiddleware = exports.safeParse = exports.formatValidationErrors = exports.EnvironmentSchema = exports.BatchOperationSchema = exports.SearchQuerySchema = exports.ApiKeyCreationSchema = exports.FileUploadSchema = exports.ImageDataSchema = exports.AuthenticationSettingsSchema = exports.EnrollmentSettingsSchema = exports.UserSettingsSchema = exports.DrawingOperationSchema = exports.DeviceTypeSchema = exports.BiometricTypeSchema = exports.DateRangeSchema = exports.SortSchema = exports.PaginationSchema = exports.SessionIdSchema = exports.TimestampSchema = exports.PressureSchema = exports.CoordinatesSchema = exports.LineWidthSchema = exports.ColorSchema = exports.CanvasDimensionsSchema = exports.PasswordSchema = exports.UsernameSchema = exports.EmailSchema = exports.patterns = void 0;
const zod_1 = require("zod");
/**
 * Common validation patterns
 */
exports.patterns = {
    username: /^[a-zA-Z0-9_-]{3,50}$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    hexColor: /^#[0-9A-F]{6}$/i,
    base64: /^[A-Za-z0-9+/]*={0,2}$/,
    sessionId: /^[a-zA-Z0-9_-]{20,}$/
};
/**
 * Email validation with additional checks
 */
exports.EmailSchema = zod_1.z
    .string()
    .email('Invalid email format')
    .min(5, 'Email too short')
    .max(255, 'Email too long')
    .transform(email => email.toLowerCase());
/**
 * Username validation
 */
exports.UsernameSchema = zod_1.z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(exports.patterns.username, 'Username can only contain letters, numbers, underscores, and hyphens');
/**
 * Password validation with strength requirements
 */
exports.PasswordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(exports.patterns.password, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
/**
 * Canvas dimensions validation
 */
exports.CanvasDimensionsSchema = zod_1.z.object({
    width: zod_1.z.number().min(100).max(4000),
    height: zod_1.z.number().min(100).max(4000)
});
/**
 * Color validation
 */
exports.ColorSchema = zod_1.z.union([
    zod_1.z.string().regex(exports.patterns.hexColor, 'Invalid hex color'),
    zod_1.z.string().startsWith('rgb('),
    zod_1.z.string().startsWith('rgba('),
    zod_1.z.string().startsWith('hsl('),
    zod_1.z.string().startsWith('hsla(')
]);
/**
 * Line width validation
 */
exports.LineWidthSchema = zod_1.z.number().min(0.5).max(50);
/**
 * Coordinates validation
 */
exports.CoordinatesSchema = zod_1.z.object({
    x: zod_1.z.number().finite(),
    y: zod_1.z.number().finite()
});
/**
 * Pressure validation
 */
exports.PressureSchema = zod_1.z.number().min(0).max(1);
/**
 * Timestamp validation
 */
exports.TimestampSchema = zod_1.z.union([
    zod_1.z.string().datetime(),
    zod_1.z.number().positive(),
    zod_1.z.date()
]);
/**
 * Session ID validation
 */
exports.SessionIdSchema = zod_1.z.string().regex(exports.patterns.sessionId, 'Invalid session ID format');
/**
 * Pagination parameters
 */
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.number().int().min(1).default(1),
    limit: zod_1.z.number().int().min(1).max(100).default(20),
    offset: zod_1.z.number().int().min(0).optional()
});
/**
 * Sort parameters
 */
exports.SortSchema = zod_1.z.object({
    field: zod_1.z.string(),
    order: zod_1.z.enum(['asc', 'desc']).default('asc')
});
/**
 * Date range filter
 */
exports.DateRangeSchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional()
}).refine(data => {
    if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
}, { message: 'Start date must be before end date' });
/**
 * Biometric type validation
 */
exports.BiometricTypeSchema = zod_1.z.enum(['signature', 'shape', 'drawing']);
/**
 * Device type validation
 */
exports.DeviceTypeSchema = zod_1.z.enum(['mouse', 'pen', 'touch', 'unknown']);
/**
 * Canvas drawing operation
 */
exports.DrawingOperationSchema = zod_1.z.object({
    type: zod_1.z.enum(['start', 'move', 'end']),
    point: exports.CoordinatesSchema,
    pressure: exports.PressureSchema.optional(),
    timestamp: zod_1.z.number(),
    deviceType: exports.DeviceTypeSchema
});
/**
 * User settings validation
 */
exports.UserSettingsSchema = zod_1.z.object({
    requiredSamples: zod_1.z.number().int().min(1).max(10).default(3),
    strictMode: zod_1.z.boolean().default(false),
    mfaEnabled: zod_1.z.boolean().default(false),
    notificationPreferences: zod_1.z.object({
        email: zod_1.z.boolean().default(true),
        sms: zod_1.z.boolean().default(false)
    }).optional()
});
/**
 * Enrollment settings
 */
exports.EnrollmentSettingsSchema = zod_1.z.object({
    minSamples: zod_1.z.number().int().min(1).max(10).default(3),
    maxSamples: zod_1.z.number().int().min(3).max(20).default(10),
    expirationDays: zod_1.z.number().int().min(1).max(365).default(30),
    qualityThreshold: zod_1.z.number().min(0).max(1).default(0.7)
});
/**
 * Authentication settings
 */
exports.AuthenticationSettingsSchema = zod_1.z.object({
    matchThreshold: zod_1.z.number().min(0).max(1).default(0.8),
    maxAttempts: zod_1.z.number().int().min(1).max(10).default(3),
    lockoutDuration: zod_1.z.number().int().min(60).max(3600).default(300), // seconds
    requireDeviceMatch: zod_1.z.boolean().default(false)
});
/**
 * Image data validation (base64 PNG)
 */
exports.ImageDataSchema = zod_1.z
    .string()
    .startsWith('data:image/png;base64,')
    .transform(data => data.replace('data:image/png;base64,', ''))
    .refine(data => exports.patterns.base64.test(data), 'Invalid base64 image data');
/**
 * File upload validation
 */
exports.FileUploadSchema = zod_1.z.object({
    filename: zod_1.z.string().max(255),
    mimetype: zod_1.z.enum(['image/png', 'image/jpeg', 'application/json']),
    size: zod_1.z.number().max(10 * 1024 * 1024), // 10MB max
    data: zod_1.z.string()
});
/**
 * API key creation
 */
exports.ApiKeyCreationSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).max(100),
    permissions: zod_1.z.array(zod_1.z.string()).min(1),
    expiresIn: zod_1.z.number().int().min(3600).optional() // seconds
});
/**
 * Search query validation
 */
exports.SearchQuerySchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(500),
    filters: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    pagination: exports.PaginationSchema.optional(),
    sort: exports.SortSchema.optional()
});
/**
 * Batch operation validation
 */
exports.BatchOperationSchema = zod_1.z.object({
    operations: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        action: zod_1.z.enum(['create', 'update', 'delete']),
        data: zod_1.z.any()
    })).min(1).max(100),
    transactional: zod_1.z.boolean().default(true)
});
/**
 * Environment variable validation
 */
exports.EnvironmentSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']),
    PORT: zod_1.z.string().regex(/^\d+$/).transform(Number),
    DATABASE_URL: zod_1.z.string().url(),
    JWT_SECRET: zod_1.z.string().min(32),
    REDIS_URL: zod_1.z.string().url().optional(),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info')
});
/**
 * Validation error formatter
 */
function formatValidationErrors(error) {
    return error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
    }));
}
exports.formatValidationErrors = formatValidationErrors;
/**
 * Safe parse with custom error handling
 */
function safeParse(schema, data, errorMessage) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = formatValidationErrors(result.error);
        throw new Error(errorMessage || `Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }
    return result.data;
}
exports.safeParse = safeParse;
/**
 * Middleware-ready validator
 */
function createValidationMiddleware(schema) {
    return (data) => {
        const result = schema.safeParse(data);
        if (result.success) {
            return { valid: true, data: result.data };
        }
        return { valid: false, errors: formatValidationErrors(result.error) };
    };
}
exports.createValidationMiddleware = createValidationMiddleware;
