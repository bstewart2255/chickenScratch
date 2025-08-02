"use strict";
/**
 * Zod schemas for runtime validation of API requests/responses
 * These schemas match the TypeScript interfaces and provide runtime safety
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidator = exports.validateRequest = exports.LegacySignatureDataSchema = exports.PaginatedResponseSchema = exports.ApiResponseSchema = exports.BiometricComparisonResultSchema = exports.GetAllUsersRequestSchema = exports.AnalyzeBiometricRequestSchema = exports.UpdateUserProfileRequestSchema = exports.DeleteSignatureRequestSchema = exports.GetUserSignaturesRequestSchema = exports.ValidateSessionRequestSchema = exports.RefreshTokenRequestSchema = exports.VerifySignatureRequestSchema = exports.AuthenticateRequestSchema = exports.EnrollBiometricRequestSchema = exports.RegisterUserRequestSchema = exports.EnhancedFeaturesSchema = exports.SecurityIndicatorsSchema = exports.GeometricPropertiesSchema = exports.TimingPatternsSchema = exports.PressureDynamicsSchema = exports.RawSignatureDataSchema = exports.StrokeDataSchema = exports.StrokePointSchema = exports.DeviceCapabilitiesSchema = void 0;
const zod_1 = require("zod");
// Device capabilities schema
exports.DeviceCapabilitiesSchema = zod_1.z.object({
    touch: zod_1.z.boolean(),
    pressure: zod_1.z.boolean(),
    tilt: zod_1.z.boolean(),
    precision: zod_1.z.enum(['high', 'medium', 'low']),
    pointerType: zod_1.z.enum(['mouse', 'pen', 'touch', 'unknown']),
    maxPressure: zod_1.z.number(),
    timestamp: zod_1.z.string()
});
// Stroke point schema
exports.StrokePointSchema = zod_1.z.object({
    x: zod_1.z.number(),
    y: zod_1.z.number(),
    pressure: zod_1.z.number(),
    timestamp: zod_1.z.number(),
    tiltX: zod_1.z.number().optional(),
    tiltY: zod_1.z.number().optional(),
    width: zod_1.z.number().optional(),
    height: zod_1.z.number().optional(),
    radiusX: zod_1.z.number().optional(),
    radiusY: zod_1.z.number().optional(),
    rotationAngle: zod_1.z.number().optional(),
    tangentialPressure: zod_1.z.number().optional(),
    twist: zod_1.z.number().optional()
});
// Stroke data schema
exports.StrokeDataSchema = zod_1.z.object({
    id: zod_1.z.string(),
    points: zod_1.z.array(exports.StrokePointSchema),
    startTime: zod_1.z.number(),
    endTime: zod_1.z.number(),
    duration: zod_1.z.number(),
    deviceType: zod_1.z.enum(['mouse', 'pen', 'touch']),
    color: zod_1.z.string().optional(),
    width: zod_1.z.number().optional()
});
// Raw signature data schema
exports.RawSignatureDataSchema = zod_1.z.object({
    strokes: zod_1.z.array(exports.StrokeDataSchema),
    deviceCapabilities: exports.DeviceCapabilitiesSchema,
    canvasSize: zod_1.z.object({
        width: zod_1.z.number(),
        height: zod_1.z.number()
    }),
    timestamp: zod_1.z.string(),
    sessionId: zod_1.z.string().optional()
});
// Pressure dynamics schema
exports.PressureDynamicsSchema = zod_1.z.object({
    min: zod_1.z.number(),
    max: zod_1.z.number(),
    mean: zod_1.z.number(),
    variance: zod_1.z.number(),
    changes: zod_1.z.array(zod_1.z.number()),
    peaks: zod_1.z.number(),
    valleys: zod_1.z.number()
});
// Timing patterns schema
exports.TimingPatternsSchema = zod_1.z.object({
    totalDuration: zod_1.z.number(),
    strokeDurations: zod_1.z.array(zod_1.z.number()),
    pauseDurations: zod_1.z.array(zod_1.z.number()),
    rhythm: zod_1.z.number(),
    consistency: zod_1.z.number(),
    averageSpeed: zod_1.z.number(),
    speedVariance: zod_1.z.number()
});
// Geometric properties schema
exports.GeometricPropertiesSchema = zod_1.z.object({
    boundingBox: zod_1.z.object({
        x: zod_1.z.number(),
        y: zod_1.z.number(),
        width: zod_1.z.number(),
        height: zod_1.z.number()
    }),
    centroid: zod_1.z.object({
        x: zod_1.z.number(),
        y: zod_1.z.number()
    }),
    aspectRatio: zod_1.z.number(),
    totalLength: zod_1.z.number(),
    angles: zod_1.z.array(zod_1.z.number()),
    curvature: zod_1.z.array(zod_1.z.number()),
    symmetry: zod_1.z.object({
        horizontal: zod_1.z.number(),
        vertical: zod_1.z.number()
    })
});
// Security indicators schema
exports.SecurityIndicatorsSchema = zod_1.z.object({
    anomalyScore: zod_1.z.number(),
    authenticityScore: zod_1.z.number(),
    confidenceLevel: zod_1.z.number(),
    riskFactors: zod_1.z.array(zod_1.z.string()),
    velocityConsistency: zod_1.z.number(),
    pressureConsistency: zod_1.z.number()
});
// Enhanced features schema
exports.EnhancedFeaturesSchema = zod_1.z.object({
    pressureDynamics: exports.PressureDynamicsSchema,
    timingPatterns: exports.TimingPatternsSchema,
    geometricProperties: exports.GeometricPropertiesSchema,
    securityIndicators: exports.SecurityIndicatorsSchema,
    deviceCapabilities: exports.DeviceCapabilitiesSchema,
    metadata: zod_1.z.object({
        version: zod_1.z.string(),
        processingTime: zod_1.z.number(),
        algorithm: zod_1.z.string()
    })
});
// User registration request schema
exports.RegisterUserRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3).max(50),
    fullName: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional()
});
// Enrollment request schema
exports.EnrollBiometricRequestSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    enrollmentToken: zod_1.z.string(),
    biometricType: zod_1.z.enum(['signature', 'shape', 'drawing']),
    biometricData: exports.RawSignatureDataSchema,
    deviceCapabilities: exports.DeviceCapabilitiesSchema,
    sessionId: zod_1.z.string().optional()
});
// Authentication request schema
exports.AuthenticateRequestSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    biometricType: zod_1.z.enum(['signature', 'shape', 'drawing']),
    biometricData: exports.RawSignatureDataSchema,
    deviceCapabilities: exports.DeviceCapabilitiesSchema,
    challengeId: zod_1.z.string().optional()
});
// Verification request schema
exports.VerifySignatureRequestSchema = zod_1.z.object({
    signatureId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    challengeData: exports.RawSignatureDataSchema.optional()
});
// Token refresh request schema
exports.RefreshTokenRequestSchema = zod_1.z.object({
    refreshToken: zod_1.z.string()
});
// Session validation request schema
exports.ValidateSessionRequestSchema = zod_1.z.object({
    authToken: zod_1.z.string(),
    checkPermissions: zod_1.z.array(zod_1.z.string()).optional()
});
// Get user signatures request schema
exports.GetUserSignaturesRequestSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    biometricType: zod_1.z.enum(['signature', 'shape', 'drawing']).optional(),
    limit: zod_1.z.number().min(1).max(100).default(10),
    offset: zod_1.z.number().min(0).default(0),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional()
});
// Delete signature request schema
exports.DeleteSignatureRequestSchema = zod_1.z.object({
    signatureId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    reason: zod_1.z.string().optional()
});
// Update user profile request schema
exports.UpdateUserProfileRequestSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    updates: zod_1.z.object({
        email: zod_1.z.string().email().optional(),
        fullName: zod_1.z.string().optional(),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
        settings: zod_1.z.object({
            requiredSamples: zod_1.z.number().min(1).max(10).optional(),
            strictMode: zod_1.z.boolean().optional(),
            mfaEnabled: zod_1.z.boolean().optional()
        }).optional()
    })
});
// Biometric analysis request schema
exports.AnalyzeBiometricRequestSchema = zod_1.z.object({
    biometricData: exports.RawSignatureDataSchema,
    analysisType: zod_1.z.enum(['quality', 'features', 'comparison']),
    referenceId: zod_1.z.string().uuid().optional()
});
// Admin get all users request schema
exports.GetAllUsersRequestSchema = zod_1.z.object({
    page: zod_1.z.number().min(1).default(1),
    limit: zod_1.z.number().min(1).max(100).default(20),
    sortBy: zod_1.z.enum(['createdAt', 'lastActive', 'username']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
    filter: zod_1.z.object({
        status: zod_1.z.enum(['active', 'inactive', 'suspended']).optional(),
        hasEnrollment: zod_1.z.boolean().optional()
    }).optional()
});
// Biometric comparison result schema
exports.BiometricComparisonResultSchema = zod_1.z.object({
    score: zod_1.z.number().min(0).max(1),
    confidence: zod_1.z.number().min(0).max(1),
    matchDetails: zod_1.z.object({
        pressure: zod_1.z.number().min(0).max(1),
        timing: zod_1.z.number().min(0).max(1),
        geometry: zod_1.z.number().min(0).max(1),
        overall: zod_1.z.number().min(0).max(1)
    }),
    recommendation: zod_1.z.enum(['accept', 'reject', 'review']),
    reasons: zod_1.z.array(zod_1.z.string())
});
// API response wrapper schemas
const ApiResponseSchema = (dataSchema) => zod_1.z.object({
    success: zod_1.z.boolean(),
    data: dataSchema.optional(),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        details: zod_1.z.any().optional()
    }).optional(),
    timestamp: zod_1.z.string()
});
exports.ApiResponseSchema = ApiResponseSchema;
const PaginatedResponseSchema = (dataSchema) => zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.array(dataSchema).optional(),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        details: zod_1.z.any().optional()
    }).optional(),
    pagination: zod_1.z.object({
        page: zod_1.z.number(),
        limit: zod_1.z.number(),
        total: zod_1.z.number(),
        totalPages: zod_1.z.number()
    }),
    timestamp: zod_1.z.string()
});
exports.PaginatedResponseSchema = PaginatedResponseSchema;
// Legacy signature data schema (for backward compatibility)
exports.LegacySignatureDataSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    signatureData: zod_1.z.object({
        strokes: zod_1.z.array(zod_1.z.object({
            points: zod_1.z.array(zod_1.z.object({
                x: zod_1.z.number(),
                y: zod_1.z.number(),
                pressure: zod_1.z.number().optional(),
                time: zod_1.z.number().optional()
            }))
        }))
    }),
    metrics: zod_1.z.object({
        speed: zod_1.z.number().optional(),
        pressure: zod_1.z.number().optional(),
        area: zod_1.z.number().optional()
    }).optional(),
    timestamp: zod_1.z.string()
});
// Validation helper functions
function validateRequest(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
}
exports.validateRequest = validateRequest;
function createValidator(schema) {
    return (data) => {
        return schema.parse(data);
    };
}
exports.createValidator = createValidator;
