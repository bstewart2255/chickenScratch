/**
 * Input validation schemas for form data and user inputs
 * These schemas ensure data integrity at the application boundary
 */

import { z } from 'zod';

/**
 * Common validation patterns
 */
export const patterns = {
  username: /^[a-zA-Z0-9_-]{3,50}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  hexColor: /^#[0-9A-F]{6}$/i,
  base64: /^[A-Za-z0-9+/]*={0,2}$/,
  sessionId: /^[a-zA-Z0-9_-]{20,}$/
} as const;

/**
 * Email validation with additional checks
 */
export const EmailSchema = z
  .string()
  .email('Invalid email format')
  .min(5, 'Email too short')
  .max(255, 'Email too long')
  .transform(email => email.toLowerCase());

/**
 * Username validation
 */
export const UsernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be at most 50 characters')
  .regex(patterns.username, 'Username can only contain letters, numbers, underscores, and hyphens');

/**
 * Password validation with strength requirements
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(
    patterns.password,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );

/**
 * Canvas dimensions validation
 */
export const CanvasDimensionsSchema = z.object({
  width: z.number().min(100).max(4000),
  height: z.number().min(100).max(4000)
});

/**
 * Color validation
 */
export const ColorSchema = z.union([
  z.string().regex(patterns.hexColor, 'Invalid hex color'),
  z.string().startsWith('rgb('),
  z.string().startsWith('rgba('),
  z.string().startsWith('hsl('),
  z.string().startsWith('hsla(')
]);

/**
 * Line width validation
 */
export const LineWidthSchema = z.number().min(0.5).max(50);

/**
 * Coordinates validation
 */
export const CoordinatesSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

/**
 * Pressure validation
 */
export const PressureSchema = z.number().min(0).max(1);

/**
 * Timestamp validation
 */
export const TimestampSchema = z.union([
  z.string().datetime(),
  z.number().positive(),
  z.date()
]);

/**
 * Session ID validation
 */
export const SessionIdSchema = z.string().regex(patterns.sessionId, 'Invalid session ID format');

/**
 * Pagination parameters
 */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).optional()
});

/**
 * Sort parameters
 */
export const SortSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).default('asc')
});

/**
 * Date range filter
 */
export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before end date' }
);

/**
 * Biometric type validation
 */
export const BiometricTypeSchema = z.enum(['signature', 'shape', 'drawing']);

/**
 * Device type validation
 */
export const DeviceTypeSchema = z.enum(['mouse', 'pen', 'touch', 'unknown']);

/**
 * Canvas drawing operation
 */
export const DrawingOperationSchema = z.object({
  type: z.enum(['start', 'move', 'end']),
  point: CoordinatesSchema,
  pressure: PressureSchema.optional(),
  timestamp: z.number(),
  deviceType: DeviceTypeSchema
});

/**
 * User settings validation
 */
export const UserSettingsSchema = z.object({
  requiredSamples: z.number().int().min(1).max(10).default(3),
  strictMode: z.boolean().default(false),
  mfaEnabled: z.boolean().default(false),
  notificationPreferences: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false)
  }).optional()
});

/**
 * Enrollment settings
 */
export const EnrollmentSettingsSchema = z.object({
  minSamples: z.number().int().min(1).max(10).default(3),
  maxSamples: z.number().int().min(3).max(20).default(10),
  expirationDays: z.number().int().min(1).max(365).default(30),
  qualityThreshold: z.number().min(0).max(1).default(0.7)
});

/**
 * Authentication settings
 */
export const AuthenticationSettingsSchema = z.object({
  matchThreshold: z.number().min(0).max(1).default(0.8),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  lockoutDuration: z.number().int().min(60).max(3600).default(300), // seconds
  requireDeviceMatch: z.boolean().default(false)
});

/**
 * Image data validation (base64 PNG)
 */
export const ImageDataSchema = z
  .string()
  .startsWith('data:image/png;base64,')
  .transform(data => data.replace('data:image/png;base64,', ''))
  .refine(
    data => patterns.base64.test(data),
    'Invalid base64 image data'
  );

/**
 * File upload validation
 */
export const FileUploadSchema = z.object({
  filename: z.string().max(255),
  mimetype: z.enum(['image/png', 'image/jpeg', 'application/json']),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
  data: z.string()
});

/**
 * API key creation
 */
export const ApiKeyCreationSchema = z.object({
  name: z.string().min(3).max(100),
  permissions: z.array(z.string()).min(1),
  expiresIn: z.number().int().min(3600).optional() // seconds
});

/**
 * Search query validation
 */
export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.record(z.string(), z.any()).optional(),
  pagination: PaginationSchema.optional(),
  sort: SortSchema.optional()
});

/**
 * Batch operation validation
 */
export const BatchOperationSchema = z.object({
  operations: z.array(z.object({
    id: z.string(),
    action: z.enum(['create', 'update', 'delete']),
    data: z.any()
  })).min(1).max(100),
  transactional: z.boolean().default(true)
});

/**
 * Environment variable validation
 */
export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.string().regex(/^\d+$/).transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info')
});

/**
 * Validation error formatter
 */
export function formatValidationErrors(error: z.ZodError): Array<{
  field: string;
  message: string;
  code: string;
}> {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
}

/**
 * Safe parse with custom error handling
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = formatValidationErrors((result as z.SafeParseError<T>).error);
    throw new Error(
      errorMessage || `Validation failed: ${errors.map(e => e.message).join(', ')}`
    );
  }
  return result.data;
}

/**
 * Middleware-ready validator
 */
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { valid: true; data: T } | { valid: false; errors: any[] } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { valid: true, data: result.data };
    }
    return { valid: false, errors: formatValidationErrors((result as z.SafeParseError<T>).error) };
  };
}