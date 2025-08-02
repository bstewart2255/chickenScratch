import { DataFormatConverter } from '../../src/utils/DataFormatConverter';
import { z } from 'zod';

describe('DataFormatConverter', () => {
  describe('base64ToBuffer', () => {
    it('should convert valid base64 string to Buffer', () => {
      const base64 = 'SGVsbG8gV29ybGQ='; // "Hello World"
      const buffer = DataFormatConverter.base64ToBuffer(base64);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe('Hello World');
    });

    it('should handle data URL format', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANS';
      const buffer = DataFormatConverter.base64ToBuffer(dataUrl);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should throw on invalid base64', () => {
      expect(() => DataFormatConverter.base64ToBuffer('invalid!@#')).toThrow(z.ZodError);
    });

    it('should throw on non-string input', () => {
      expect(() => DataFormatConverter.base64ToBuffer(123)).toThrow(z.ZodError);
      expect(() => DataFormatConverter.base64ToBuffer(null)).toThrow(z.ZodError);
    });
  });

  describe('bufferToBase64', () => {
    it('should convert Buffer to base64 data URL', () => {
      const buffer = Buffer.from('Hello World');
      const base64 = DataFormatConverter.bufferToBase64(buffer);
      expect(base64).toMatch(/^data:image\/png;base64,/);
      expect(base64).toContain('SGVsbG8gV29ybGQ=');
    });

    it('should support custom MIME type', () => {
      const buffer = Buffer.from('test');
      const base64 = DataFormatConverter.bufferToBase64(buffer, 'image/jpeg');
      expect(base64).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  describe('parseStrokeData', () => {
    const validStroke = [[{ x: 10, y: 20, timestamp: 123, pressure: 0 }]];

    it('should parse valid stroke array', () => {
      const result = DataFormatConverter.parseStrokeData(validStroke);
      expect(result).toEqual(validStroke);
    });

    it('should parse JSON string', () => {
      const jsonString = JSON.stringify(validStroke);
      const result = DataFormatConverter.parseStrokeData(jsonString);
      expect(result).toEqual(validStroke);
    });

    it('should extract from legacy format', () => {
      const legacy = {
        data: 'data:image/png;base64,abc',
        raw: validStroke,
        metrics: {},
        timestamp: 123
      };
      const result = DataFormatConverter.parseStrokeData(legacy);
      expect(result).toEqual(validStroke);
    });

    it('should extract from stroke_data property', () => {
      const obj = { stroke_data: validStroke };
      const result = DataFormatConverter.parseStrokeData(obj);
      expect(result).toEqual(validStroke);
    });

    it('should extract from strokes property', () => {
      const obj = { strokes: validStroke };
      const result = DataFormatConverter.parseStrokeData(obj);
      expect(result).toEqual(validStroke);
    });

    it('should return empty array for invalid input', () => {
      expect(DataFormatConverter.parseStrokeData(null)).toEqual([]);
      expect(DataFormatConverter.parseStrokeData(undefined)).toEqual([]);
      expect(DataFormatConverter.parseStrokeData('invalid')).toEqual([]);
      expect(DataFormatConverter.parseStrokeData({})).toEqual([]);
    });

    it('should validate stroke point structure', () => {
      const invalidStroke = [[{ x: 'not a number', y: 20 }]];
      expect(() => DataFormatConverter.parseStrokeData(invalidStroke)).toThrow(z.ZodError);
    });

    it('should add default pressure and timestamp when missing', () => {
      const strokeWithOptionals = [[
        { x: 10, y: 20 },
        { x: 30, y: 40, pressure: 0.5, timestamp: 123 }
      ]];
      const result = DataFormatConverter.parseStrokeData(strokeWithOptionals);
      expect(result[0][0]).toMatchObject({ x: 10, y: 20, pressure: 0 });
      expect(result[0][0].timestamp).toBeGreaterThan(0);
      expect(result[0][1]).toMatchObject({ x: 30, y: 40, pressure: 0.5, timestamp: 123 });
    });
  });

  describe('convertLegacySignature', () => {
    it('should convert valid legacy format', () => {
      const legacy = {
        data: 'data:image/png;base64,abc',
        raw: [[{ x: 10, y: 20 }]],
        metrics: { speed: 100 },
        timestamp: 1234567890000
      };
      
      const result = DataFormatConverter.convertLegacySignature(legacy);
      expect(result).toBeTruthy();
      expect(result?.stroke_data).toEqual(legacy.raw.map(stroke => 
        stroke.map(point => ({ ...point, pressure: 0, timestamp: (point as any).timestamp || Date.now() }))
      ));
      expect(result?.metrics).toEqual(legacy.metrics);
      expect(result?.created_at).toEqual(new Date(legacy.timestamp));
    });

    it('should handle missing optional fields', () => {
      const minimal = {
        data: 'data:image/png;base64,abc'
      };
      
      const result = DataFormatConverter.convertLegacySignature(minimal);
      expect(result).toBeTruthy();
      expect(result?.stroke_data).toEqual([]);
      expect(result?.metrics).toEqual({});
    });

    it('should return null for invalid format', () => {
      expect(DataFormatConverter.convertLegacySignature(null)).toBeNull();
      expect(DataFormatConverter.convertLegacySignature('invalid')).toBeNull();
      expect(DataFormatConverter.convertLegacySignature({})).toBeNull();
    });
  });

  describe('parseJSON', () => {
    it('should parse valid JSON string', () => {
      const obj = { test: 'value' };
      const json = JSON.stringify(obj);
      const result = DataFormatConverter.parseJSON(json);
      expect(result).toEqual(obj);
    });

    it('should return null for invalid JSON', () => {
      expect(DataFormatConverter.parseJSON('invalid json')).toBeNull();
      expect(DataFormatConverter.parseJSON(123)).toBeNull();
      expect(DataFormatConverter.parseJSON(null)).toBeNull();
    });

    it('should handle complex objects', () => {
      const complex = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        null: null,
        bool: true
      };
      const json = JSON.stringify(complex);
      const result = DataFormatConverter.parseJSON<typeof complex>(json);
      expect(result).toEqual(complex);
    });
  });

  describe('stringifyJSON', () => {
    it('should stringify objects', () => {
      const obj = { test: 'value' };
      const result = DataFormatConverter.stringifyJSON(obj);
      expect(result).toBe('{"test":"value"}');
    });

    it('should support pretty printing', () => {
      const obj = { test: 'value' };
      const result = DataFormatConverter.stringifyJSON(obj, true);
      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });

    it('should handle various data types', () => {
      expect(DataFormatConverter.stringifyJSON(null)).toBe('null');
      expect(DataFormatConverter.stringifyJSON(123)).toBe('123');
      expect(DataFormatConverter.stringifyJSON('string')).toBe('"string"');
      expect(DataFormatConverter.stringifyJSON([1, 2, 3])).toBe('[1,2,3]');
    });
  });

  describe('parseTimestamp', () => {
    it('should return Date objects as-is', () => {
      const date = new Date();
      expect(DataFormatConverter.parseTimestamp(date)).toBe(date);
    });

    it('should parse ISO string', () => {
      const isoString = '2024-01-01T00:00:00.000Z';
      const result = DataFormatConverter.parseTimestamp(isoString);
      expect(result).toEqual(new Date(isoString));
    });

    it('should parse millisecond timestamp', () => {
      const timestamp = 1704067200000; // 2024-01-01
      const result = DataFormatConverter.parseTimestamp(timestamp);
      expect(result.getTime()).toBe(timestamp);
    });

    it('should parse second timestamp', () => {
      const timestamp = 1704067200; // 2024-01-01 in seconds
      const result = DataFormatConverter.parseTimestamp(timestamp);
      expect(result.getTime()).toBe(timestamp * 1000);
    });

    it('should return current date for invalid input', () => {
      const before = Date.now();
      const result = DataFormatConverter.parseTimestamp('invalid');
      const after = Date.now();
      
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('extractBase64Image', () => {
    const validBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANS';

    it('should extract direct base64 string', () => {
      const result = DataFormatConverter.extractBase64Image(validBase64);
      expect(result).toBe(validBase64);
    });

    it('should extract from data property', () => {
      const obj = { data: validBase64 };
      const result = DataFormatConverter.extractBase64Image(obj);
      expect(result).toBe(validBase64);
    });

    it('should extract from image property', () => {
      const obj = { image: validBase64 };
      const result = DataFormatConverter.extractBase64Image(obj);
      expect(result).toBe(validBase64);
    });

    it('should extract from base64 property', () => {
      const obj = { base64: validBase64 };
      const result = DataFormatConverter.extractBase64Image(obj);
      expect(result).toBe(validBase64);
    });

    it('should extract from JSON string', () => {
      const json = JSON.stringify({ data: validBase64 });
      const result = DataFormatConverter.extractBase64Image(json);
      expect(result).toBe(validBase64);
    });

    it('should return null for invalid input', () => {
      expect(DataFormatConverter.extractBase64Image(null)).toBeNull();
      expect(DataFormatConverter.extractBase64Image('not base64')).toBeNull();
      expect(DataFormatConverter.extractBase64Image({})).toBeNull();
      expect(DataFormatConverter.extractBase64Image(123)).toBeNull();
    });

    it('should handle nested extraction', () => {
      const nested = { wrapper: { data: validBase64 } };
      const result = DataFormatConverter.extractBase64Image(nested.wrapper);
      expect(result).toBe(validBase64);
    });
  });

  describe('ensureArray', () => {
    it('should return arrays as-is', () => {
      const arr = [1, 2, 3];
      expect(DataFormatConverter.ensureArray(arr)).toBe(arr);
    });

    it('should wrap non-arrays', () => {
      expect(DataFormatConverter.ensureArray('value')).toEqual(['value']);
      expect(DataFormatConverter.ensureArray(123)).toEqual([123]);
      expect(DataFormatConverter.ensureArray(null)).toEqual([null]);
      expect(DataFormatConverter.ensureArray(undefined)).toEqual([undefined]);
    });

    it('should preserve object references', () => {
      const obj = { test: 'value' };
      const result = DataFormatConverter.ensureArray(obj);
      expect(result).toEqual([obj]);
      expect(result[0]).toBe(obj);
    });
  });

  describe('deepClone', () => {
    it('should create deep copy of objects', () => {
      const original = { nested: { value: 123 } };
      const clone = DataFormatConverter.deepClone(original);
      
      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
      expect(clone.nested).not.toBe(original.nested);
    });

    it('should handle various data types', () => {
      const data = {
        string: 'test',
        number: 123,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { deep: { value: 'test' } }
      };
      
      const clone = DataFormatConverter.deepClone(data);
      expect(clone).toEqual(data);
      expect(clone.array).not.toBe(data.array);
      expect(clone.nested).not.toBe(data.nested);
    });

    it('should handle primitives', () => {
      expect(DataFormatConverter.deepClone('string')).toBe('string');
      expect(DataFormatConverter.deepClone(123)).toBe(123);
      expect(DataFormatConverter.deepClone(true)).toBe(true);
      expect(DataFormatConverter.deepClone(null)).toBe(null);
    });
  });
});