/**
 * Core biometric types for signature authentication
 * Matches existing runtime behavior with proper TypeScript definitions
 */

/**
 * Device capability detection results
 * Based on deviceCapability.js implementation
 */
export interface DeviceCapabilities {
  touch: boolean;
  pressure: boolean;
  tilt: boolean;
  precision: 'high' | 'medium' | 'low';
  pointerType: 'mouse' | 'pen' | 'touch' | 'unknown';
  maxPressure: number;
  timestamp: string;
}

/**
 * Individual point in a signature stroke
 * Includes all data captured during drawing
 */
export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
  tiltX?: number;
  tiltY?: number;
  width?: number;
  height?: number;
  radiusX?: number;
  radiusY?: number;
  rotationAngle?: number;
  tangentialPressure?: number;
  twist?: number;
}

/**
 * Complete stroke data for a signature
 * Represents one continuous drawing motion
 */
export interface StrokeData {
  id: string;
  points: StrokePoint[];
  startTime: number;
  endTime: number;
  duration: number;
  deviceType: 'mouse' | 'pen' | 'touch';
  color?: string;
  width?: number;
}

/**
 * Pressure dynamics calculated from stroke data
 */
export interface PressureDynamics {
  min: number;
  max: number;
  mean: number;
  variance: number;
  changes: number[];
  peaks: number;
  valleys: number;
}

/**
 * Timing patterns detected in signature
 */
export interface TimingPatterns {
  totalDuration: number;
  strokeDurations: number[];
  pauseDurations: number[];
  rhythm: number;
  consistency: number;
  averageSpeed: number;
  speedVariance: number;
}

/**
 * Geometric properties of the signature
 */
export interface GeometricProperties {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  centroid: {
    x: number;
    y: number;
  };
  aspectRatio: number;
  totalLength: number;
  angles: number[];
  curvature: number[];
  symmetry: {
    horizontal: number;
    vertical: number;
  };
}

/**
 * Security indicators for authentication
 */
export interface SecurityIndicators {
  anomalyScore: number;
  authenticityScore: number;
  confidenceLevel: number;
  riskFactors: string[];
  velocityConsistency: number;
  pressureConsistency: number;
}

/**
 * Enhanced biometric features combining all metrics
 * This matches the enhanced_features JSONB column structure
 */
export interface EnhancedFeatures {
  pressureDynamics: PressureDynamics;
  timingPatterns: TimingPatterns;
  geometricProperties: GeometricProperties;
  securityIndicators: SecurityIndicators;
  deviceCapabilities: DeviceCapabilities;
  metadata: {
    version: string;
    processingTime: number;
    algorithm: string;
  };
}

/**
 * Raw signature data as captured from canvas
 */
export interface RawSignatureData {
  strokes: StrokeData[];
  deviceCapabilities: DeviceCapabilities;
  canvasSize: {
    width: number;
    height: number;
  };
  timestamp: string;
  sessionId?: string;
}

/**
 * Processed signature ready for storage
 */
export interface ProcessedSignature {
  id: string;
  userId: string;
  rawData: RawSignatureData;
  enhancedFeatures: EnhancedFeatures;
  imageData: string; // base64 encoded PNG
  createdAt: string;
  updatedAt?: string;
}

/**
 * Legacy signature format for backward compatibility
 */
export interface LegacySignatureData {
  userId: string;
  signatureData: {
    strokes: Array<{
      points: Array<{
        x: number;
        y: number;
        pressure?: number;
        time?: number;
      }>;
    }>;
  };
  metrics?: {
    speed?: number;
    pressure?: number;
    area?: number;
  };
  timestamp: string;
}

/**
 * Biometric comparison result
 */
export interface BiometricComparisonResult {
  score: number;
  confidence: number;
  matchDetails: {
    pressure: number;
    timing: number;
    geometry: number;
    overall: number;
  };
  recommendation: 'accept' | 'reject' | 'review';
  reasons: string[];
}

/**
 * Enrollment data for new users
 */
export interface EnrollmentData {
  userId: string;
  signatures: ProcessedSignature[];
  deviceCapabilities: DeviceCapabilities;
  enrollmentDate: string;
  status: 'pending' | 'active' | 'suspended';
  minimumSamples: number;
  currentSamples: number;
}

/**
 * Authentication request
 */
export interface AuthenticationRequest {
  userId: string;
  signature: RawSignatureData;
  deviceCapabilities: DeviceCapabilities;
  challengeId?: string;
  timestamp: string;
}

/**
 * Authentication response
 */
export interface AuthenticationResponse {
  success: boolean;
  userId?: string;
  score?: number;
  confidence?: number;
  token?: string;
  expiresAt?: string;
  reasons?: string[];
  requiresAdditionalVerification?: boolean;
}

/**
 * Type guards for runtime validation
 */
export function isStrokePoint(point: any): point is StrokePoint {
  return (
    typeof point === 'object' &&
    point !== null &&
    typeof point.x === 'number' &&
    typeof point.y === 'number' &&
    typeof point.pressure === 'number' &&
    typeof point.timestamp === 'number'
  );
}

export function isDeviceCapabilities(caps: any): caps is DeviceCapabilities {
  return (
    typeof caps === 'object' &&
    caps !== null &&
    typeof caps.touch === 'boolean' &&
    typeof caps.pressure === 'boolean' &&
    typeof caps.tilt === 'boolean' &&
    ['high', 'medium', 'low'].includes(caps.precision) &&
    ['mouse', 'pen', 'touch', 'unknown'].includes(caps.pointerType) &&
    typeof caps.maxPressure === 'number' &&
    typeof caps.timestamp === 'string'
  );
}

export function isEnhancedFeatures(features: any): features is EnhancedFeatures {
  return (
    typeof features === 'object' &&
    features !== null &&
    features.pressureDynamics &&
    features.timingPatterns &&
    features.geometricProperties &&
    features.securityIndicators &&
    features.deviceCapabilities &&
    features.metadata
  );
}