/**
 * Zod schemas for runtime validation of API requests/responses
 * These schemas match the TypeScript interfaces and provide runtime safety
 */

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

// Stroke point schema
export const StrokePointSchema = z.object({
  x: z.number(),
  y: z.number(),
  pressure: z.number(),
  timestamp: z.number(),
  tiltX: z.number().optional(),
  tiltY: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  radiusX: z.number().optional(),
  radiusY: z.number().optional(),
  rotationAngle: z.number().optional(),
  tangentialPressure: z.number().optional(),
  twist: z.number().optional()
});

// Stroke data schema
export const StrokeDataSchema = z.object({
  id: z.string(),
  points: z.array(StrokePointSchema),
  startTime: z.number(),
  endTime: z.number(),
  duration: z.number(),
  deviceType: z.enum(['mouse', 'pen', 'touch']),
  color: z.string().optional(),
  width: z.number().optional()
});

// Raw signature data schema
export const RawSignatureDataSchema = z.object({
  strokes: z.array(StrokeDataSchema),
  deviceCapabilities: DeviceCapabilitiesSchema,
  canvasSize: z.object({
    width: z.number(),
    height: z.number()
  }),
  timestamp: z.string(),
  sessionId: z.string().optional()
});

// Pressure dynamics schema
export const PressureDynamicsSchema = z.object({
  min: z.number(),
  max: z.number(),
  mean: z.number(),
  variance: z.number(),
  changes: z.array(z.number()),
  peaks: z.number(),
  valleys: z.number()
});

// Timing patterns schema
export const TimingPatternsSchema = z.object({
  totalDuration: z.number(),
  strokeDurations: z.array(z.number()),
  pauseDurations: z.array(z.number()),
  rhythm: z.number(),
  consistency: z.number(),
  averageSpeed: z.number(),
  speedVariance: z.number()
});

// Geometric properties schema
export const GeometricPropertiesSchema = z.object({
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }),
  centroid: z.object({
    x: z.number(),
    y: z.number()
  }),
  aspectRatio: z.number(),
  totalLength: z.number(),
  angles: z.array(z.number()),
  curvature: z.array(z.number()),
  symmetry: z.object({
    horizontal: z.number(),
    vertical: z.number()
  })
});

// Security indicators schema
export const SecurityIndicatorsSchema = z.object({
  anomalyScore: z.number(),
  authenticityScore: z.number(),
  confidenceLevel: z.number(),
  riskFactors: z.array(z.string()),
  velocityConsistency: z.number(),
  pressureConsistency: z.number()
});

// Enhanced features schema
export const EnhancedFeaturesSchema = z.object({
  pressureDynamics: PressureDynamicsSchema,
  timingPatterns: TimingPatternsSchema,
  geometricProperties: GeometricPropertiesSchema,
  securityIndicators: SecurityIndicatorsSchema,
  deviceCapabilities: DeviceCapabilitiesSchema,
  metadata: z.object({
    version: z.string(),
    processingTime: z.number(),
    algorithm: z.string()
  })
});

// User registration request schema
export const RegisterUserRequestSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  fullName: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Enrollment request schema
export const EnrollBiometricRequestSchema = z.object({
  userId: z.string().uuid(),
  enrollmentToken: z.string(),
  biometricType: z.enum(['signature', 'shape', 'drawing']),
  biometricData: RawSignatureDataSchema,
  deviceCapabilities: DeviceCapabilitiesSchema,
  sessionId: z.string().optional()
});

// Authentication request schema
export const AuthenticateRequestSchema = z.object({
  userId: z.string().uuid(),
  biometricType: z.enum(['signature', 'shape', 'drawing']),
  biometricData: RawSignatureDataSchema,
  deviceCapabilities: DeviceCapabilitiesSchema,
  challengeId: z.string().optional()
});

// Verification request schema
export const VerifySignatureRequestSchema = z.object({
  signatureId: z.string().uuid(),
  userId: z.string().uuid(),
  challengeData: RawSignatureDataSchema.optional()
});

// Token refresh request schema
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string()
});

// Session validation request schema
export const ValidateSessionRequestSchema = z.object({
  authToken: z.string(),
  checkPermissions: z.array(z.string()).optional()
});

// Get user signatures request schema
export const GetUserSignaturesRequestSchema = z.object({
  userId: z.string().uuid(),
  biometricType: z.enum(['signature', 'shape', 'drawing']).optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// Delete signature request schema
export const DeleteSignatureRequestSchema = z.object({
  signatureId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().optional()
});

// Update user profile request schema
export const UpdateUserProfileRequestSchema = z.object({
  userId: z.string().uuid(),
  updates: z.object({
    email: z.string().email().optional(),
    fullName: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    settings: z.object({
      requiredSamples: z.number().min(1).max(10).optional(),
      strictMode: z.boolean().optional(),
      mfaEnabled: z.boolean().optional()
    }).optional()
  })
});

// Biometric analysis request schema
export const AnalyzeBiometricRequestSchema = z.object({
  biometricData: RawSignatureDataSchema,
  analysisType: z.enum(['quality', 'features', 'comparison']),
  referenceId: z.string().uuid().optional()
});

// Admin get all users request schema
export const GetAllUsersRequestSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'lastActive', 'username']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  filter: z.object({
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
    hasEnrollment: z.boolean().optional()
  }).optional()
});

// Biometric comparison result schema
export const BiometricComparisonResultSchema = z.object({
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  matchDetails: z.object({
    pressure: z.number().min(0).max(1),
    timing: z.number().min(0).max(1),
    geometry: z.number().min(0).max(1),
    overall: z.number().min(0).max(1)
  }),
  recommendation: z.enum(['accept', 'reject', 'review']),
  reasons: z.array(z.string())
});

// API response wrapper schemas
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

export const PaginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.array(dataSchema).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional()
    }).optional(),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number()
    }),
    timestamp: z.string()
  });

// Legacy signature data schema (for backward compatibility)
export const LegacySignatureDataSchema = z.object({
  userId: z.string(),
  signatureData: z.object({
    strokes: z.array(z.object({
      points: z.array(z.object({
        x: z.number(),
        y: z.number(),
        pressure: z.number().optional(),
        time: z.number().optional()
      }))
    }))
  }),
  metrics: z.object({
    speed: z.number().optional(),
    pressure: z.number().optional(),
    area: z.number().optional()
  }).optional(),
  timestamp: z.string()
});

// Validation helper functions
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: (result as z.SafeParseError<T>).error };
}

export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    return schema.parse(data);
  };
}