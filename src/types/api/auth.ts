/**
 * API authentication types for request/response interfaces
 * Matches existing API endpoints with proper TypeScript definitions
 */

import { 
  RawSignatureData, 
  DeviceCapabilities, 
  ProcessedSignature,
  BiometricComparisonResult,
  EnhancedFeatures 
} from '../core/biometric';

/**
 * Base API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * User registration request
 */
export interface RegisterUserRequest {
  email: string;
  username: string;
  fullName?: string;
  metadata?: Record<string, any>;
}

/**
 * User registration response
 */
export interface RegisterUserResponse {
  userId: string;
  email: string;
  username: string;
  enrollmentToken: string;
  enrollmentExpiresAt: string;
}

/**
 * Enrollment request for biometric data
 */
export interface EnrollBiometricRequest {
  userId: string;
  enrollmentToken: string;
  biometricType: 'signature' | 'shape' | 'drawing';
  biometricData: RawSignatureData;
  deviceCapabilities: DeviceCapabilities;
  sessionId?: string;
}

/**
 * Enrollment response
 */
export interface EnrollBiometricResponse {
  enrollmentId: string;
  userId: string;
  samplesCollected: number;
  samplesRequired: number;
  isComplete: boolean;
  nextSteps?: string[];
}

/**
 * Authentication request
 */
export interface AuthenticateRequest {
  userId: string;
  biometricType: 'signature' | 'shape' | 'drawing';
  biometricData: RawSignatureData;
  deviceCapabilities: DeviceCapabilities;
  challengeId?: string;
}

/**
 * Authentication response
 */
export interface AuthenticateResponse {
  success: boolean;
  authToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  userId?: string;
  matchScore?: number;
  confidence?: number;
  requiresMFA?: boolean;
  mfaToken?: string;
}

/**
 * Verification request for existing signatures
 */
export interface VerifySignatureRequest {
  signatureId: string;
  userId: string;
  challengeData?: RawSignatureData;
}

/**
 * Verification response
 */
export interface VerifySignatureResponse {
  verified: boolean;
  signatureId: string;
  comparisonResult?: BiometricComparisonResult;
  timestamp: string;
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse {
  authToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Session validation request
 */
export interface ValidateSessionRequest {
  authToken: string;
  checkPermissions?: string[];
}

/**
 * Session validation response
 */
export interface ValidateSessionResponse {
  valid: boolean;
  userId?: string;
  permissions?: string[];
  expiresAt?: string;
}

/**
 * Get user signatures request
 */
export interface GetUserSignaturesRequest {
  userId: string;
  biometricType?: 'signature' | 'shape' | 'drawing';
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Get user signatures response
 */
export interface GetUserSignaturesResponse {
  signatures: ProcessedSignature[];
  total: number;
  hasMore: boolean;
}

/**
 * Delete signature request
 */
export interface DeleteSignatureRequest {
  signatureId: string;
  userId: string;
  reason?: string;
}

/**
 * Delete signature response
 */
export interface DeleteSignatureResponse {
  success: boolean;
  deletedId: string;
  remainingSignatures: number;
}

/**
 * Update user profile request
 */
export interface UpdateUserProfileRequest {
  userId: string;
  updates: {
    email?: string;
    fullName?: string;
    metadata?: Record<string, any>;
    settings?: {
      requiredSamples?: number;
      strictMode?: boolean;
      mfaEnabled?: boolean;
    };
  };
}

/**
 * Update user profile response
 */
export interface UpdateUserProfileResponse {
  userId: string;
  updated: boolean;
  changes: string[];
}

/**
 * Biometric analysis request
 */
export interface AnalyzeBiometricRequest {
  biometricData: RawSignatureData;
  analysisType: 'quality' | 'features' | 'comparison';
  referenceId?: string;
}

/**
 * Biometric analysis response
 */
export interface AnalyzeBiometricResponse {
  analysisId: string;
  quality?: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  features?: EnhancedFeatures;
  comparison?: BiometricComparisonResult;
}

/**
 * Admin get all users request
 */
export interface GetAllUsersRequest {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'lastActive' | 'username';
  sortOrder?: 'asc' | 'desc';
  filter?: {
    status?: 'active' | 'inactive' | 'suspended';
    hasEnrollment?: boolean;
  };
}

/**
 * Admin get all users response
 */
export interface GetAllUsersResponse {
  users: Array<{
    userId: string;
    username: string;
    email: string;
    status: string;
    enrollmentStatus: string;
    lastActive: string;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    database: boolean;
    biometricEngine: boolean;
    cache?: boolean;
  };
  timestamp: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: any;
    timestamp: string;
  };
}

/**
 * JWT token payload
 */
export interface JWTPayload {
  userId: string;
  username: string;
  permissions: string[];
  iat: number;
  exp: number;
  jti?: string;
}

/**
 * API key structure
 */
export interface ApiKey {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}