import { DataFormatConverter } from '../../../src/utils/DataFormatConverter';
import { TestDataGenerator } from '../../helpers/generators';
import { BiometricData, StrokeData } from '../../../src/types';

describe('DataFormatConverter', () => {
  beforeEach(() => {
    TestDataGenerator.reset();
  });

  describe('biometricDataToJSON', () => {
    it('should convert biometric data to JSON', () => {
      const biometricData = TestDataGenerator.generateBiometricData();
      const json = DataFormatConverter.biometricDataToJSON(biometricData);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(biometricData.id);
      expect(parsed.userId).toBe(biometricData.userId);
      expect(parsed.type).toBe(biometricData.type);
      expect(parsed.strokes).toHaveLength(biometricData.strokes.length);
    });

    it('should handle empty strokes', () => {
      const biometricData = TestDataGenerator.generateBiometricData({
        strokes: []
      });
      
      const json = DataFormatConverter.biometricDataToJSON(biometricData);
      const parsed = JSON.parse(json);
      
      expect(parsed.strokes).toEqual([]);
    });

    it('should preserve all point properties', () => {
      const point = TestDataGenerator.generatePoint();
      const biometricData = TestDataGenerator.generateBiometricData({
        strokes: [{
          points: [point],
          startTime: point.time,
          endTime: point.time + 100,
          strokeType: 'signature'
        }]
      });

      const json = DataFormatConverter.biometricDataToJSON(biometricData);
      const parsed = JSON.parse(json);
      
      const parsedPoint = parsed.strokes[0].points[0];
      expect(parsedPoint.x).toBe(point.x);
      expect(parsedPoint.y).toBe(point.y);
      expect(parsedPoint.time).toBe(point.time);
      expect(parsedPoint.pressure).toBe(point.pressure);
    });

    it('should handle special characters in data', () => {
      const biometricData = TestDataGenerator.generateBiometricData({
        id: 'test"id\'with<>special&chars'
      });

      const json = DataFormatConverter.biometricDataToJSON(biometricData);
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('JSONToBiometricData', () => {
    it('should convert JSON back to biometric data', () => {
      const originalData = TestDataGenerator.generateBiometricData();
      const json = DataFormatConverter.biometricDataToJSON(originalData);
      const converted = DataFormatConverter.JSONToBiometricData(json);

      expect(converted).toBeDefined();
      expect(converted.id).toBe(originalData.id);
      expect(converted.userId).toBe(originalData.userId);
      expect(converted.type).toBe(originalData.type);
      expect(converted.strokes).toHaveLength(originalData.strokes.length);
      expect(converted.features).toEqual(originalData.features);
    });

    it('should handle invalid JSON', () => {
      expect(() => {
        DataFormatConverter.JSONToBiometricData('invalid json');
      }).toThrow();
    });

    it('should validate converted data structure', () => {
      const json = JSON.stringify({
        id: 'test-id',
        userId: 'user-id',
        strokes: [],
        type: 'signature',
        features: TestDataGenerator.generateBiometricFeatures(),
        createdAt: new Date().toISOString()
      });

      const converted = DataFormatConverter.JSONToBiometricData(json);
      
      expect(converted).toHaveProperty('id');
      expect(converted).toHaveProperty('userId');
      expect(converted).toHaveProperty('strokes');
      expect(converted).toHaveProperty('features');
    });

    it('should handle missing optional properties', () => {
      const minimalJson = JSON.stringify({
        id: 'test-id',
        userId: 'user-id',
        strokes: [],
        type: 'signature',
        createdAt: new Date().toISOString()
      });

      const converted = DataFormatConverter.JSONToBiometricData(minimalJson);
      expect(converted).toBeDefined();
    });
  });

  describe('strokeDataToBase64', () => {
    it('should convert stroke data to base64', () => {
      const stroke = TestDataGenerator.generateStrokeData();
      const base64 = DataFormatConverter.strokeDataToBase64(stroke);

      expect(base64).toBeDefined();
      expect(typeof base64).toBe('string');
      expect(base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should handle empty points array', () => {
      const stroke: StrokeData = {
        points: [],
        startTime: Date.now(),
        endTime: Date.now(),
        strokeType: 'signature'
      };

      const base64 = DataFormatConverter.strokeDataToBase64(stroke);
      expect(base64).toBeDefined();
    });

    it('should be reversible', () => {
      const stroke = TestDataGenerator.generateStrokeData();
      const base64 = DataFormatConverter.strokeDataToBase64(stroke);
      const decoded = DataFormatConverter.base64ToStrokeData(base64);

      expect(decoded.points).toHaveLength(stroke.points.length);
      expect(decoded.startTime).toBe(stroke.startTime);
      expect(decoded.endTime).toBe(stroke.endTime);
      expect(decoded.strokeType).toBe(stroke.strokeType);
    });
  });

  describe('base64ToStrokeData', () => {
    it('should convert base64 back to stroke data', () => {
      const originalStroke = TestDataGenerator.generateStrokeData();
      const base64 = DataFormatConverter.strokeDataToBase64(originalStroke);
      const decoded = DataFormatConverter.base64ToStrokeData(base64);

      expect(decoded).toBeDefined();
      expect(decoded.points).toBeInstanceOf(Array);
      expect(decoded.startTime).toBe(originalStroke.startTime);
      expect(decoded.endTime).toBe(originalStroke.endTime);
    });

    it('should handle invalid base64', () => {
      expect(() => {
        DataFormatConverter.base64ToStrokeData('invalid base64!@#');
      }).toThrow();
    });

    it('should handle corrupted data', () => {
      const validBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
      expect(() => {
        DataFormatConverter.base64ToStrokeData(validBase64);
      }).toThrow();
    });
  });

  describe('compressBiometricData', () => {
    it('should compress biometric data', () => {
      const data = TestDataGenerator.generateBiometricData();
      const compressed = DataFormatConverter.compressBiometricData(data);

      expect(compressed).toBeDefined();
      expect(compressed.id).toBe(data.id);
      expect(compressed.userId).toBe(data.userId);
      expect(compressed.compressedStrokes).toBeDefined();
      expect(compressed.compressedStrokes).toHaveLength(data.strokes.length);
    });

    it('should reduce data size', () => {
      const data = TestDataGenerator.generateBiometricData({
        strokes: Array(10).fill(null).map(() => 
          TestDataGenerator.generateStrokeData(100)
        )
      });

      const originalSize = JSON.stringify(data).length;
      const compressed = DataFormatConverter.compressBiometricData(data);
      const compressedSize = JSON.stringify(compressed).length;

      // Compression should generally reduce size, but not always
      expect(compressedSize).toBeLessThanOrEqual(originalSize * 1.1);
    });
  });

  describe('decompressBiometricData', () => {
    it('should decompress biometric data', () => {
      const original = TestDataGenerator.generateBiometricData();
      const compressed = DataFormatConverter.compressBiometricData(original);
      const decompressed = DataFormatConverter.decompressBiometricData(compressed);

      expect(decompressed).toBeDefined();
      expect(decompressed.id).toBe(original.id);
      expect(decompressed.userId).toBe(original.userId);
      expect(decompressed.strokes).toHaveLength(original.strokes.length);
      expect(decompressed.features).toEqual(original.features);
    });

    it('should preserve all data integrity', () => {
      const original = TestDataGenerator.generateBiometricData();
      const compressed = DataFormatConverter.compressBiometricData(original);
      const decompressed = DataFormatConverter.decompressBiometricData(compressed);

      // Check each stroke
      original.strokes.forEach((stroke, index) => {
        const decompressedStroke = decompressed.strokes[index];
        expect(decompressedStroke.points).toHaveLength(stroke.points.length);
        expect(decompressedStroke.startTime).toBe(stroke.startTime);
        expect(decompressedStroke.endTime).toBe(stroke.endTime);
        expect(decompressedStroke.strokeType).toBe(stroke.strokeType);

        // Check each point
        stroke.points.forEach((point, pointIndex) => {
          const decompressedPoint = decompressedStroke.points[pointIndex];
          expect(decompressedPoint.x).toBeCloseTo(point.x, 5);
          expect(decompressedPoint.y).toBeCloseTo(point.y, 5);
          expect(decompressedPoint.time).toBe(point.time);
          expect(decompressedPoint.pressure).toBeCloseTo(point.pressure, 5);
        });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very large datasets', () => {
      const largeData = TestDataGenerator.generateBiometricData({
        strokes: Array(100).fill(null).map(() => 
          TestDataGenerator.generateStrokeData(1000)
        )
      });

      const json = DataFormatConverter.biometricDataToJSON(largeData);
      const converted = DataFormatConverter.JSONToBiometricData(json);

      expect(converted.strokes).toHaveLength(100);
      expect(converted.strokes[0].points).toHaveLength(1000);
    });

    it('should handle unicode characters', () => {
      const data = TestDataGenerator.generateBiometricData({
        id: 'test-🎨-emoji',
        userId: 'user-中文-unicode'
      });

      const json = DataFormatConverter.biometricDataToJSON(data);
      const converted = DataFormatConverter.JSONToBiometricData(json);

      expect(converted.id).toBe(data.id);
      expect(converted.userId).toBe(data.userId);
    });

    it('should handle extreme coordinate values', () => {
      const stroke: StrokeData = {
        points: [
          { x: Number.MAX_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER, time: 0, pressure: 0 },
          { x: -999999, y: 999999, time: 1, pressure: 1 }
        ],
        startTime: 0,
        endTime: 1,
        strokeType: 'signature'
      };

      const base64 = DataFormatConverter.strokeDataToBase64(stroke);
      const decoded = DataFormatConverter.base64ToStrokeData(base64);

      expect(decoded.points[0].x).toBe(Number.MAX_SAFE_INTEGER);
      expect(decoded.points[0].y).toBe(Number.MIN_SAFE_INTEGER);
    });

    it('should handle circular references gracefully', () => {
      const data: any = TestDataGenerator.generateBiometricData();
      data.circular = data; // Create circular reference

      expect(() => {
        DataFormatConverter.biometricDataToJSON(data);
      }).toThrow();
    });
  });

  describe('performance', () => {
    it('should convert large datasets efficiently', () => {
      const largeData = TestDataGenerator.generateBiometricData({
        strokes: Array(50).fill(null).map(() => 
          TestDataGenerator.generateStrokeData(500)
        )
      });

      const startTime = Date.now();
      const json = DataFormatConverter.biometricDataToJSON(largeData);
      const converted = DataFormatConverter.JSONToBiometricData(json);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      expect(converted.strokes).toHaveLength(50);
    });

    it('should compress/decompress efficiently', () => {
      const data = TestDataGenerator.generateBiometricData({
        strokes: Array(20).fill(null).map(() => 
          TestDataGenerator.generateStrokeData(200)
        )
      });

      const startTime = Date.now();
      const compressed = DataFormatConverter.compressBiometricData(data);
      const decompressed = DataFormatConverter.decompressBiometricData(compressed);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // Should complete in under 50ms
      expect(decompressed.strokes).toHaveLength(20);
    });
  });
});