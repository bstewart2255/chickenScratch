import { BiometricEngine } from '../../../../backend/BiometricEngine';
import { TestDataGenerator } from '../../../helpers/generators';
import { BiometricData, StrokeData, Point } from '../../../../src/types/index';

describe('BiometricEngine', () => {
  let engine: BiometricEngine;

  beforeEach(() => {
    engine = new BiometricEngine();
    TestDataGenerator.reset();
  });

  describe('extractFeatures', () => {
    it('should extract features from valid biometric data', () => {
      const biometricData = TestDataGenerator.generateBiometricData();
      const features = engine.extractFeatures(biometricData);

      expect(features).toBeDefined();
      expect(features.strokeCount).toBeGreaterThan(0);
      expect(features.totalDuration).toBeGreaterThan(0);
      expect(features.avgPressure).toBeGreaterThan(0);
      expect(features.avgSpeed).toBeGreaterThan(0);
      expect(features.strokeLengths).toBeInstanceOf(Array);
      expect(features.pauseDurations).toBeInstanceOf(Array);
      expect(features.directionChanges).toBeGreaterThanOrEqual(0);
      expect(features.pressureVariance).toBeGreaterThanOrEqual(0);
      expect(features.accelerationPatterns).toBeInstanceOf(Array);
    });

    it('should handle empty stroke data', () => {
      const biometricData = TestDataGenerator.generateBiometricData({
        strokes: []
      });
      
      const features = engine.extractFeatures(biometricData);
      
      expect(features.strokeCount).toBe(0);
      expect(features.totalDuration).toBe(0);
      expect(features.avgPressure).toBe(0);
      expect(features.avgSpeed).toBe(0);
      expect(features.strokeLengths).toEqual([]);
      expect(features.pauseDurations).toEqual([]);
    });

    it('should handle single-point strokes', () => {
      const singlePoint = TestDataGenerator.generatePoint();
      const biometricData = TestDataGenerator.generateBiometricData({
        strokes: [{
          points: [singlePoint],
          startTime: singlePoint.time,
          endTime: singlePoint.time,
          strokeType: 'signature'
        }]
      });

      const features = engine.extractFeatures(biometricData);
      
      expect(features.strokeCount).toBe(1);
      expect(features.avgPressure).toBe(singlePoint.pressure);
      expect(features.avgSpeed).toBe(0);
    });

    it('should calculate correct stroke lengths', () => {
      const points: Point[] = [
        { x: 0, y: 0, time: 0, pressure: 0.5 },
        { x: 3, y: 4, time: 100, pressure: 0.5 }, // Distance: 5
        { x: 3, y: 4, time: 200, pressure: 0.5 }  // Distance: 0
      ];

      const biometricData = TestDataGenerator.generateBiometricData({
        strokes: [{
          points,
          startTime: 0,
          endTime: 200,
          strokeType: 'signature'
        }]
      });

      const features = engine.extractFeatures(biometricData);
      expect(features.strokeLengths[0]).toBeCloseTo(5, 2);
    });

    it('should handle edge case pressures', () => {
      const biometricData = TestDataGenerator.generateBiometricData({
        strokes: TestDataGenerator.generateEdgeCaseStrokes()
      });

      const features = engine.extractFeatures(biometricData);
      
      expect(features.avgPressure).toBeGreaterThanOrEqual(0);
      expect(features.avgPressure).toBeLessThanOrEqual(1);
      expect(features.pressureVariance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('compareFeatures', () => {
    it('should return high similarity for identical features', () => {
      const features = TestDataGenerator.generateBiometricFeatures();
      const similarity = engine.compareFeatures(features, features);
      
      expect(similarity).toBe(1);
    });

    it('should return low similarity for very different features', () => {
      const features1 = TestDataGenerator.generateBiometricFeatures({
        strokeCount: 1,
        totalDuration: 100,
        avgPressure: 0.1,
        avgSpeed: 10
      });
      
      const features2 = TestDataGenerator.generateBiometricFeatures({
        strokeCount: 10,
        totalDuration: 10000,
        avgPressure: 0.9,
        avgSpeed: 500
      });

      const similarity = engine.compareFeatures(features1, features2);
      
      expect(similarity).toBeLessThan(0.5);
      expect(similarity).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing array properties gracefully', () => {
      const features1 = TestDataGenerator.generateBiometricFeatures({
        strokeLengths: [],
        pauseDurations: [],
        accelerationPatterns: []
      });
      
      const features2 = TestDataGenerator.generateBiometricFeatures();

      const similarity = engine.compareFeatures(features1, features2);
      
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should weight important features appropriately', () => {
      const baseFeatures = TestDataGenerator.generateBiometricFeatures();
      
      // Similar features with slightly different stroke count
      const similarFeatures = {
        ...baseFeatures,
        strokeCount: baseFeatures.strokeCount + 1
      };
      
      // Similar features with very different pressure
      const differentPressure = {
        ...baseFeatures,
        avgPressure: baseFeatures.avgPressure * 0.2
      };

      const similaritySimilar = engine.compareFeatures(baseFeatures, similarFeatures);
      const similarityDifferent = engine.compareFeatures(baseFeatures, differentPressure);
      
      expect(similaritySimilar).toBeGreaterThan(similarityDifferent);
    });
  });

  describe('validateBiometricData', () => {
    it('should validate correct biometric data', () => {
      const validData = TestDataGenerator.generateBiometricData();
      expect(engine.validateBiometricData(validData)).toBe(true);
    });

    it('should reject invalid biometric data', () => {
      const invalidData = TestDataGenerator.generateInvalidBiometricData();
      expect(engine.validateBiometricData(invalidData)).toBe(false);
    });

    it('should reject data with invalid strokes', () => {
      const invalidStrokeData = TestDataGenerator.generateBiometricData({
        strokes: [{ points: null } as any]
      });
      
      expect(engine.validateBiometricData(invalidStrokeData)).toBe(false);
    });

    it('should reject data with invalid points', () => {
      const invalidPointData = TestDataGenerator.generateBiometricData({
        strokes: [{
          points: [{ x: 'invalid', y: 100, time: 1000, pressure: 0.5 } as any],
          startTime: 1000,
          endTime: 2000,
          strokeType: 'signature'
        }]
      });
      
      expect(engine.validateBiometricData(invalidPointData)).toBe(false);
    });

    it('should validate edge case data', () => {
      const edgeCaseData = TestDataGenerator.generateBiometricData({
        strokes: TestDataGenerator.generateEdgeCaseStrokes()
      });
      
      expect(engine.validateBiometricData(edgeCaseData)).toBe(true);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics for a stroke', () => {
      const stroke = TestDataGenerator.generateStrokeData(5);
      const metrics = engine.calculateMetrics(stroke);

      expect(metrics).toBeDefined();
      expect(metrics.speed).toBeGreaterThanOrEqual(0);
      expect(metrics.acceleration).toBeDefined();
      expect(metrics.jerk).toBeDefined();
    });

    it('should handle single-point strokes', () => {
      const stroke: StrokeData = {
        points: [TestDataGenerator.generatePoint()],
        startTime: Date.now(),
        endTime: Date.now(),
        strokeType: 'signature'
      };

      const metrics = engine.calculateMetrics(stroke);
      
      expect(metrics.speed).toBe(0);
      expect(metrics.acceleration).toBe(0);
      expect(metrics.jerk).toBe(0);
    });

    it('should calculate speed correctly', () => {
      const points: Point[] = [
        { x: 0, y: 0, time: 0, pressure: 0.5 },
        { x: 100, y: 0, time: 1000, pressure: 0.5 }
      ];

      const stroke: StrokeData = {
        points,
        startTime: 0,
        endTime: 1000,
        strokeType: 'signature'
      };

      const metrics = engine.calculateMetrics(stroke);
      
      // Speed = distance / time = 100 / 1 = 100 pixels per second
      expect(metrics.speed).toBeCloseTo(100, 1);
    });
  });

  describe('performance', () => {
    it('should process large datasets efficiently', () => {
      const largeData = TestDataGenerator.generateBiometricData({
        strokes: Array(100).fill(null).map(() => 
          TestDataGenerator.generateStrokeData(100)
        )
      });

      const startTime = Date.now();
      const features = engine.extractFeatures(largeData);
      const duration = Date.now() - startTime;

      expect(features).toBeDefined();
      expect(duration).toBeLessThan(100); // Should process in under 100ms
    });

    it('should compare features quickly', () => {
      const features1 = TestDataGenerator.generateBiometricFeatures();
      const features2 = TestDataGenerator.generateBiometricFeatures();

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        engine.compareFeatures(features1, features2);
      }
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // 1000 comparisons in under 50ms
    });
  });

  describe('edge cases', () => {
    it('should handle NaN and Infinity values', () => {
      const problematicData = TestDataGenerator.generateBiometricData({
        strokes: [{
          points: [
            { x: NaN, y: 100, time: 1000, pressure: 0.5 },
            { x: 100, y: Infinity, time: 2000, pressure: 0.5 }
          ],
          startTime: 1000,
          endTime: 2000,
          strokeType: 'signature'
        }]
      });

      expect(engine.validateBiometricData(problematicData)).toBe(false);
    });

    it('should handle negative coordinates', () => {
      const negativeData = TestDataGenerator.generateBiometricData({
        strokes: [{
          points: [
            { x: -100, y: -50, time: 1000, pressure: 0.5 },
            { x: -50, y: -25, time: 2000, pressure: 0.5 }
          ],
          startTime: 1000,
          endTime: 2000,
          strokeType: 'signature'
        }]
      });

      const features = engine.extractFeatures(negativeData);
      expect(features).toBeDefined();
      expect(features.strokeCount).toBe(1);
    });

    it('should handle very small time differences', () => {
      const simultaneousPoints = TestDataGenerator.generateBiometricData({
        strokes: [{
          points: [
            { x: 0, y: 0, time: 1000, pressure: 0.5 },
            { x: 100, y: 100, time: 1000, pressure: 0.5 } // Same time
          ],
          startTime: 1000,
          endTime: 1000,
          strokeType: 'signature'
        }]
      });

      const features = engine.extractFeatures(simultaneousPoints);
      expect(features.avgSpeed).toBe(Infinity);
    });
  });
});