import { EnhancedFeatures } from '../../src/types/core/biometric';

/**
 * Adapter to convert EnhancedFeatures to the flat structure expected by tests
 * This is a temporary solution during the TypeScript migration
 */
export function flattenEnhancedFeatures(features: EnhancedFeatures): any {
  return {
    // From timingPatterns
    strokeCount: features.timingPatterns?.strokeDurations?.length || 0,
    totalDuration: features.timingPatterns?.totalDuration || 0,
    pauseDurations: features.timingPatterns?.pauseDurations || [],
    
    // From pressureDynamics
    avgPressure: features.pressureDynamics?.average || 0,
    pressureVariance: features.pressureDynamics?.variance || 0,
    
    // From geometricProperties
    avgSpeed: features.geometricProperties?.averageVelocity || 0,
    strokeLengths: features.geometricProperties?.strokeLengths || [],
    directionChanges: features.geometricProperties?.directionChanges || 0,
    
    // From other properties
    accelerationPatterns: features.timingPatterns?.accelerationPatterns || [],
    
    // Keep the original structure for other uses
    _original: features
  };
}

/**
 * Create mock EnhancedFeatures for testing
 */
export function createMockEnhancedFeatures(overrides: any = {}): EnhancedFeatures {
  return {
    pressureDynamics: {
      average: overrides.avgPressure || 0.5,
      variance: overrides.pressureVariance || 0.1,
      min: 0.1,
      max: 0.9,
      distribution: [],
      patterns: []
    },
    timingPatterns: {
      totalDuration: overrides.totalDuration || 1000,
      strokeDurations: overrides.strokeDurations || [100, 200, 300],
      pauseDurations: overrides.pauseDurations || [50, 100],
      rhythm: 0.8,
      consistency: 0.9,
      accelerationPatterns: overrides.accelerationPatterns || [0.1, 0.2]
    },
    geometricProperties: {
      totalLength: 500,
      strokeLengths: overrides.strokeLengths || [100, 200, 200],
      boundingBox: { width: 300, height: 200 },
      centroid: { x: 150, y: 100 },
      aspectRatio: 1.5,
      angles: [45, 90, 135],
      curvature: [0.1, 0.2, 0.3],
      complexity: 0.7,
      directionChanges: overrides.directionChanges || 5,
      averageVelocity: overrides.avgSpeed || 50
    },
    securityIndicators: {
      anomalyScore: 0.1,
      authenticityScore: 0.9,
      confidenceLevel: 0.85,
      riskFactors: [],
      velocityConsistency: 0.9,
      pressureConsistency: 0.85
    },
    deviceCapabilities: {
      hasTouchSupport: true,
      hasPressureSupport: true,
      hasPointerSupport: true,
      maxTouchPoints: 10,
      pointerTypes: ['touch', 'pen', 'mouse'],
      pixelRatio: 2,
      screenSize: { width: 1920, height: 1080 },
      userAgent: 'test',
      platform: 'test'
    },
    metadata: {
      version: '1.0.0',
      processingTime: 10,
      algorithm: 'enhanced-v1'
    }
  };
}