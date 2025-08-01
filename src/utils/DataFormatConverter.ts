import { z } from 'zod';
import { StrokePoint } from '../types/core/biometric';

// Zod schemas for validation
const Base64Schema = z.string().refine(
  (value) => {
    // Check for data URL format
    if (value.startsWith('data:')) {
      const matches = value.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+)(?:;[a-zA-Z0-9-]+=[a-zA-Z0-9-]+)*;base64,(.*)$/);
      return matches !== null;
    }
    // Check for raw base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(value);
  },
  { message: 'Invalid base64 format' }
);

const StrokePointSchema = z.object({
  x: z.number(),
  y: z.number(),
  pressure: z.number().min(0).max(1).default(0),
  timestamp: z.number().default(Date.now),
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

const StrokeSchema = z.array(StrokePointSchema).min(1);
const StrokesArraySchema = z.array(StrokeSchema);

const LegacySignatureFormatSchema = z.object({
  data: Base64Schema,
  raw: StrokesArraySchema.optional(),
  metrics: z.record(z.any()).optional(),
  timestamp: z.number().optional()
});

const JSONStringSchema = z.string().refine(
  (value) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid JSON string' }
);

// Type definitions for data conversion
export type SimpleStrokeData = StrokePoint[][];

export interface LegacySignatureFormat {
  data: string;
  raw?: SimpleStrokeData;
  metrics?: Record<string, any>;
  timestamp?: number;
}

export interface ConvertedSignatureData {
  id: number;
  user_id: number;
  stroke_data: SimpleStrokeData;
  metrics: Record<string, any>;
  created_at: Date;
  is_baseline: boolean;
}

export class DataFormatConverter {
  /**
   * Convert base64 string to Buffer
   */
  static base64ToBuffer(base64: unknown): Buffer {
    const validated = Base64Schema.parse(base64);
    
    // Remove data URL prefix if present
    const base64Data = validated.replace(/^data:.*?;base64,/, '');
    
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Convert Buffer to base64 string
   */
  static bufferToBase64(buffer: Buffer, mimeType: string = 'image/png'): string {
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Parse stroke data from various formats
   */
  static parseStrokeData(input: unknown): SimpleStrokeData {
    // Handle null/undefined
    if (input === null || input === undefined) {
      return [];
    }

    // If it's already an array, validate it
    if (Array.isArray(input)) {
      const parsed = StrokesArraySchema.parse(input);
      return parsed as SimpleStrokeData;
    }

    // If it's a string, try to parse as JSON
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return this.parseStrokeData(parsed);
      } catch {
        // Not valid JSON, return empty array
        return [];
      }
    }

    // If it's an object with stroke data properties
    if (typeof input === 'object' && input !== null) {
      // Check for legacy format {data: base64, raw: strokes}
      const legacyValidation = LegacySignatureFormatSchema.safeParse(input);
      if (legacyValidation.success && legacyValidation.data.raw) {
        return legacyValidation.data.raw as SimpleStrokeData;
      }

      // Check for direct stroke_data property
      if ('stroke_data' in input) {
        return this.parseStrokeData((input as any).stroke_data);
      }

      // Check for strokes property
      if ('strokes' in input) {
        return this.parseStrokeData((input as any).strokes);
      }
    }

    return [];
  }

  /**
   * Convert legacy signature format to new format
   */
  static convertLegacySignature(legacy: unknown): ConvertedSignatureData | null {
    const validation = LegacySignatureFormatSchema.safeParse(legacy);
    if (!validation.success) {
      return null;
    }

    const legacyData = validation.data;
    
    return {
      id: 0, // Will be set by database
      user_id: 0, // Will be set by caller
      stroke_data: (legacyData.raw || []) as SimpleStrokeData,
      metrics: legacyData.metrics || {},
      created_at: new Date(legacyData.timestamp || Date.now()),
      is_baseline: false // Will be set by caller
    };
  }

  /**
   * Parse JSON string safely
   */
  static parseJSON<T = any>(jsonString: unknown): T | null {
    const validation = JSONStringSchema.safeParse(jsonString);
    if (!validation.success) {
      return null;
    }

    try {
      return JSON.parse(validation.data) as T;
    } catch {
      return null;
    }
  }

  /**
   * Stringify data with proper formatting
   */
  static stringifyJSON(data: unknown, pretty: boolean = false): string {
    if (pretty) {
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
  }

  /**
   * Validate and parse timestamp
   */
  static parseTimestamp(timestamp: unknown): Date {
    if (timestamp instanceof Date) {
      return timestamp;
    }

    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    if (typeof timestamp === 'number') {
      // Handle both seconds and milliseconds
      const date = timestamp > 1e10 ? new Date(timestamp) : new Date(timestamp * 1000);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Default to current time if invalid
    return new Date();
  }

  /**
   * Extract base64 image from various data formats
   */
  static extractBase64Image(data: unknown): string | null {
    // Direct base64 string
    const base64Validation = Base64Schema.safeParse(data);
    if (base64Validation.success) {
      return base64Validation.data;
    }

    // Object with data property
    if (typeof data === 'object' && data !== null) {
      if ('data' in data) {
        return this.extractBase64Image((data as any).data);
      }
      if ('image' in data) {
        return this.extractBase64Image((data as any).image);
      }
      if ('base64' in data) {
        return this.extractBase64Image((data as any).base64);
      }
    }

    // JSON string
    if (typeof data === 'string') {
      const parsed = this.parseJSON(data);
      if (parsed) {
        return this.extractBase64Image(parsed);
      }
    }

    return null;
  }

  /**
   * Ensure data is in array format
   */
  static ensureArray<T>(data: T | T[]): T[] {
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Deep clone an object
   */
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}