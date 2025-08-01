/**
 * Enhanced Feature Extraction Module - TypeScript Version
 * Implements 4-phase approach for extracting 25+ advanced biometric features
 * Phase 1: Pressure & Touch Analysis (8 features)
 * Phase 2: Behavioral Timing (6 features) 
 * Phase 3: Advanced Geometric (7 features)
 * Phase 4: Security & Context (6 features)
 */

import { logger } from '../src/utils/Logger';
import type { 
  EnhancedFeatures,
  Point,
  Stroke,
  StrokeData,
  DeviceCapabilities,
  PressureFeatures,
  TimingFeatures,
  GeometricFeatures,
  SecurityFeatures,
  PressureDynamics,
  TimingPatterns,
  GeometricProperties,
  SecurityIndicators
} from '../src/types/core/biometric';

// Feature name constants for consistent exclusion handling
const PRESSURE_FEATURES: readonly string[] = [
  'avg_pressure', 'max_pressure', 'min_pressure', 
  'pressure_std', 'pressure_range', 'contact_time_ratio',
  'pressure_buildup_rate', 'pressure_release_rate'
] as const;

// Performance monitoring thresholds
const PERFORMANCE_THRESHOLDS = {
  feature_extraction: 100, // ms
  pressure_extraction: 50,
  timing_extraction: 50,
  geometric_extraction: 100,
  security_extraction: 50
} as const;

// Performance monitoring utility with enhanced metrics
class PerformanceMonitor {
  private startTime: number | null = null;
  private categoryTimes: Map<string, number[]> = new Map();
  
  startExtraction(): void {
    this.startTime = performance.now();
  }
  
  endExtraction(featureCount: number, category: string): number {
    if (!this.startTime) {
      logger.warn('Performance monitoring not started properly');
      return 0;
    }
    
    const duration = performance.now() - this.startTime;
    
    // Track category performance
    if (!this.categoryTimes.has(category)) {
      this.categoryTimes.set(category, []);
    }
    this.categoryTimes.get(category)!.push(duration);
    
    // Log performance
    logger.info(`${category} extraction completed`, {
      duration_ms: duration,
      feature_count: featureCount,
      features_per_ms: featureCount / duration
    });
    
    // Check against thresholds
    const threshold = PERFORMANCE_THRESHOLDS[`${category.toLowerCase()}_extraction` as keyof typeof PERFORMANCE_THRESHOLDS] 
      || PERFORMANCE_THRESHOLDS.feature_extraction;
    
    if (duration > threshold) {
      logger.warn(`Slow feature extraction detected`, {
        category,
        duration_ms: duration,
        threshold_ms: threshold,
        exceeded_by_ms: duration - threshold
      });
    }
    
    this.startTime = null;
    return duration;
  }
  
  getPerformanceStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    this.categoryTimes.forEach((times, category) => {
      if (times.length > 0) {
        stats[category] = {
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length
        };
      }
    });
    
    return stats;
  }
}

// Main Enhanced Feature Extractor
export class BiometricEngine {
  private performanceMonitor = new PerformanceMonitor();

  // Core validation function
  private validateStrokeData(strokeData: unknown): strokeData is StrokeData {
    // Check for null/undefined
    if (!strokeData) {
      logger.warn('Invalid stroke data: null or undefined');
      return false;
    }
    
    // Get normalized strokes using extractStrokes
    const strokes = this.extractStrokes(strokeData);
    
    // Check for empty strokes
    if (!Array.isArray(strokes) || strokes.length === 0) {
      logger.warn('Invalid stroke data: empty strokes array');
      return false;
    }
    
    // Validate each stroke has points
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      if (!stroke || !stroke['points'] || !Array.isArray(stroke['points']) || stroke['points'].length === 0) {
        logger.warn(`Invalid stroke at index ${i}: missing or empty points array`);
        return false;
      }
      
      // Validate point structure (all points should now be in object format after normalization)
      for (let j = 0; j < stroke['points'].length; j++) {
        const point = stroke['points'][j];
        if (!point || typeof point['x'] !== 'number' || typeof point['y'] !== 'number') {
          logger.warn(`Invalid point at stroke ${i}, point ${j}: missing x/y coordinates`);
          return false;
        }
      }
    }
    
    return true;
  }

  // Helper function to validate if an array contains point objects or arrays
  private isPointArray(arr: unknown[]): boolean {
    if (!Array.isArray(arr) || arr.length === 0) {
      return false;
    }
    
    // Check first few elements to validate they are point objects or arrays
    const sampleSize = Math.min(3, arr.length);
    for (let i = 0; i < sampleSize; i++) {
      const item = arr[i];
      
      // Handle array format [x, y]
      if (Array.isArray(item)) {
        if (item.length !== 2 || typeof item[0] !== 'number' || typeof item[1] !== 'number') {
          return false;
        }
      }
      // Handle object format {x: number, y: number}
      else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (typeof obj['x'] !== 'number' || typeof obj['y'] !== 'number') {
          return false;
        }
      } else {
        return false;
      }
    }
    
    return true;
  }

  // Helper function to normalize a point to object format
  private normalizePoint(point: unknown): Point | null {
    // If already in object format, return as is
    if (point && typeof point === 'object' && !Array.isArray(point)) {
      const obj = point as Record<string, unknown>;
      if (typeof obj['x'] === 'number' && typeof obj['y'] === 'number') {
        return point as Point;
      }
    }
    
    // If in array format [x, y], convert to object
    if (Array.isArray(point) && point.length === 2 && 
        typeof point[0] === 'number' && typeof point[1] === 'number') {
      return { x: point[0], y: point[1], pressure: 1, timestamp: Date.now() } as Point;
    }
    
    // Invalid point format
    logger.warn('Invalid point format:', point as Record<string, any>);
    return null;
  }


  // Helper function to validate and normalize points (returns null if any point is invalid)
  private validateAndNormalizePoints(points: unknown[]): Point[] | null {
    if (!Array.isArray(points)) return null;
    
    const normalizedPoints: Point[] = [];
    for (const point of points) {
      const normalized = this.normalizePoint(point);
      if (normalized === null) {
        return null; // Return null if any point is invalid
      }
      normalizedPoints.push(normalized);
    }
    
    return normalizedPoints;
  }

  // Utility function to extract strokes array from various data formats
  private extractStrokes(strokeData: unknown): Stroke[] {
    if (!strokeData) return [];
    
    let rawStrokes: unknown[] = [];
    
    if (Array.isArray(strokeData)) {
      rawStrokes = strokeData;
    } else if (typeof strokeData === 'object') {
      const data = strokeData as Record<string, unknown>;
      
      if (data['strokes'] && Array.isArray(data['strokes'])) {
        rawStrokes = data['strokes'];
      } else if (data['raw'] && Array.isArray(data['raw'])) {
        // Check if raw contains stroke objects or point objects
        if (data['raw'].length > 0 && this.isPointArray(data['raw'])) {
          // Raw contains point objects, wrap as single stroke
          rawStrokes = [{ points: data['raw'] }];
        } else {
          // Raw contains stroke objects
          rawStrokes = data['raw'];
        }
      } else if (data['data'] && Array.isArray(data['data'])) {
        // Check if data contains stroke objects or point objects
        if (data['data'].length > 0 && this.isPointArray(data['data'])) {
          // Data contains point objects, wrap as single stroke
          rawStrokes = [{ points: data['data'] }];
        } else {
          // Data contains stroke objects
          rawStrokes = data['data'];
        }
      }
    }
    
    if (rawStrokes.length === 0) {
      return [];
    }
    
    // Normalize stroke format - ensure each stroke has a points property with normalized points
    return rawStrokes.map((stroke, index) => {
      // If stroke already has the expected format with points property
      if (stroke && typeof stroke === 'object' && !Array.isArray(stroke)) {
        const strokeObj = stroke as Record<string, unknown>;
        
        if (strokeObj['points'] && Array.isArray(strokeObj['points'])) {
          // Validate and normalize the points to ensure consistent format
          const normalizedPoints = this.validateAndNormalizePoints(strokeObj['points']);
          if (normalizedPoints === null) {
            logger.warn(`Invalid points in stroke at index ${index}`);
            return null;
          }
          return { ...strokeObj, points: normalizedPoints } as Stroke;
        }
      }
      
      // If stroke is an array of points, wrap it and normalize
      if (Array.isArray(stroke)) {
        const normalizedPoints = this.validateAndNormalizePoints(stroke);
        if (normalizedPoints === null) {
          logger.warn(`Invalid points in stroke array at index ${index}`);
          return null;
        }
        return { points: normalizedPoints } as Stroke;
      }
      
      // If stroke has other properties but no points array, try to extract
      if (stroke && typeof stroke === 'object') {
        const strokeObj = stroke as Record<string, unknown>;
        // Check for alternative point array names - validate each is an array of points
        let points: unknown[] | null = null;
        
        // Try stroke.data first (most common for point arrays)
        if (strokeObj['data'] && Array.isArray(strokeObj['data']) && this.isPointArray(strokeObj['data'])) {
          points = strokeObj['data'];
        }
        // Try stroke.raw (alternative point array name)
        else if (strokeObj['raw'] && Array.isArray(strokeObj['raw']) && this.isPointArray(strokeObj['raw'])) {
          points = strokeObj['raw'];
        }
        // Try stroke.points (if it exists but wasn't caught above)
        else if (strokeObj['points'] && Array.isArray(strokeObj['points']) && this.isPointArray(strokeObj['points'])) {
          points = strokeObj['points'];
        }
        // Don't use stroke.strokes as it likely contains other stroke objects, not points
        
        if (points) {
          const normalizedPoints = this.validateAndNormalizePoints(points);
          if (normalizedPoints === null) {
            logger.warn(`Invalid points in stroke at index ${index}`);
            return null;
          }
          return { ...strokeObj, points: normalizedPoints } as Stroke;
        }
      }
      
      logger.warn(`Invalid stroke format at index ${index}:`, stroke as Record<string, any>);
      return null;
    }).filter((stroke): stroke is Stroke => stroke !== null && stroke['points'].length > 0);
  }

  // Phase 1: Pressure Analysis Features
  extractPressureFeatures(strokeData: unknown, deviceCapabilities?: DeviceCapabilities | null): PressureFeatures {
    this.performanceMonitor.startExtraction();
    
    try {
      // Validate input data first
      if (!this.validateStrokeData(strokeData)) {
        return this.getDefaultPressureFeatures();
      }
      
      // Check if device supports pressure
      if (deviceCapabilities && !deviceCapabilities.supportsPressure) {
        const features = this.getDefaultPressureFeatures();
        features._excluded_features = [...PRESSURE_FEATURES];
        features._exclusion_reason = 'device_does_not_support_pressure';
        return features;
      }
      
      const strokes = this.extractStrokes(strokeData);
      const pressureValues: number[] = [];
      // let _totalPoints = 0;
      // let _pointsWithPressure = 0;
      
      // Extract all pressure values
      for (const stroke of strokes) {
        for (const point of stroke['points']) {
          // _totalPoints++;
          // Check if pressure data exists (some devices don't support it)
          if (typeof point['pressure'] === 'number' && point['pressure'] > 0) {
            pressureValues.push(point['pressure']);
            // _pointsWithPressure++;
          }
        }
      }
      
      // Handle case where device doesn't support pressure
      if (pressureValues.length === 0) {
        logger.info('No pressure data collected - excluding pressure features');
        const features = this.getDefaultPressureFeatures();
        features._excluded_features = [...PRESSURE_FEATURES];
        features._exclusion_reason = 'no_pressure_data_collected';
        features.has_pressure_data = false;
        this.performanceMonitor.endExtraction(Object.keys(features).length, 'Pressure (excluded)');
        return features;
      }
      
      // Calculate pressure statistics with performance tracking
      const startCalc = performance.now();
      
      const avgPressure = pressureValues.reduce((a, b) => a + b, 0) / pressureValues.length;
      const maxPressure = Math.max(...pressureValues);
      const minPressure = Math.min(...pressureValues);
      
      // Calculate standard deviation
      const pressureVariance = pressureValues.reduce((acc, val) => {
        return acc + Math.pow(val - avgPressure, 2);
      }, 0) / pressureValues.length;
      const pressureStd = Math.sqrt(pressureVariance);
      
      
      // Calculate pressure buildup/release rates
      const buildupRates: number[] = [];
      const releaseRates: number[] = [];
      
      for (const stroke of strokes) {
        const strokePressures = stroke['points']
          .filter(p => typeof p['pressure'] === 'number')
          .map(p => p['pressure']!);
        
        if (strokePressures.length > 1) {
          // Find buildup rate (first quarter of stroke)
          const quarterPoint = Math.floor(strokePressures.length / 4);
          const quarterPointPressure = strokePressures[quarterPoint];
          const firstPressure = strokePressures[0];
          if (quarterPoint > 0 && quarterPointPressure !== undefined && firstPressure !== undefined) {
            const buildupRate = (quarterPointPressure - firstPressure) / quarterPoint;
            buildupRates.push(buildupRate);
          }
          
          // Find release rate (last quarter of stroke)
          const threeQuarterPoint = Math.floor(strokePressures.length * 3 / 4);
          const lastPressure = strokePressures[strokePressures.length - 1];
          const threeQuarterPressure = strokePressures[threeQuarterPoint];
          if (threeQuarterPoint < strokePressures.length - 1 && 
              lastPressure !== undefined && 
              threeQuarterPressure !== undefined) {
            const releaseRate = (lastPressure - threeQuarterPressure) / 
                               (strokePressures.length - 1 - threeQuarterPoint);
            releaseRates.push(Math.abs(releaseRate)); // Use absolute value for release
          }
        }
      }
      
      
      const calcDuration = performance.now() - startCalc;
      if (calcDuration > 20) {
        logger.warn('Slow pressure calculation', { duration_ms: calcDuration });
      }
      
      const features: PressureFeatures = {
        min: minPressure,
        max: maxPressure,
        mean: avgPressure,
        variance: pressureStd * pressureStd,
        changes: [], // Will be populated if needed
        peaks: 0, // Will be calculated if needed
        valleys: 0, // Will be calculated if needed
        avg_pressure: avgPressure,
        max_pressure: maxPressure,
        has_pressure_data: true
      };
      
      this.performanceMonitor.endExtraction(Object.keys(features).length, 'Pressure');
      return features;
      
    } catch (error) {
      logger.error('Pressure feature extraction failed:', { error: String(error) });
      return this.getDefaultPressureFeatures();
    }
  }

  // Phase 2: Behavioral Timing Features
  extractTimingFeatures(strokeData: unknown): TimingFeatures {
    this.performanceMonitor.startExtraction();
    
    try {
      if (!this.validateStrokeData(strokeData)) {
        return this.getDefaultTimingFeatures();
      }
      
      const strokes = this.extractStrokes(strokeData);
      const pauseDurations: number[] = [];
      const strokeDurations: number[] = [];
      const interStrokeTimings: number[] = [];
      let totalDrawingTime = 0;
      // const _totalPauseTime = 0;
      
      // Calculate timing features with performance tracking
      const startCalc = performance.now();
      
      for (let i = 0; i < strokes.length; i++) {
        const stroke = strokes[i];
        const points = stroke?.['points'] || [];
        
        if (points.length > 1) {
          // Calculate stroke duration
          const firstPoint = points[0];
          const lastPoint = points[points.length - 1];
          
          if (firstPoint?.time && lastPoint?.time) {
            const strokeDuration = lastPoint['time'] - firstPoint['time'];
            strokeDurations.push(strokeDuration);
            
            // Calculate inter-stroke timing
            if (i > 0) {
              const prevStroke = strokes[i - 1];
              if (prevStroke && prevStroke['points'].length > 0) {
                const prevLastPoint = prevStroke['points'][prevStroke['points'].length - 1];
                if (prevLastPoint?.time && firstPoint?.time) {
                  const interStrokeTiming = firstPoint['time'] - prevLastPoint['time'];
                  interStrokeTimings.push(interStrokeTiming);
                  
                  // Detect pauses (inter-stroke time > 50ms considered a pause)
                  if (interStrokeTiming > 50) {
                    pauseDurations.push(interStrokeTiming);
                    // _totalPauseTime += interStrokeTiming;
                  }
                }
              }
            }
          }
          
          // Calculate dwell times (slow movement within stroke)
          const dwellPoints: number[] = [];
          for (let j = 1; j < points.length; j++) {
            const p1 = points[j - 1];
            const p2 = points[j];
            
            if (p1 && p2 && p1['time'] && p2['time']) {
              const timeDiff = p2['time'] - p1['time'];
              const distance = Math.sqrt(Math.pow(p2['x'] - p1['x'], 2) + Math.pow(p2['y'] - p1['y'], 2));
              
              // If moving very slowly (< 5 pixels in > 20ms), consider it a dwell
              if (timeDiff > 20 && distance < 5) {
                dwellPoints.push(timeDiff);
              }
            }
          }
          
          // Store dwell pattern info
          (stroke as any).dwellCount = dwellPoints.length;
          (stroke as any).avgDwellTime = dwellPoints.length > 0 ? 
            dwellPoints.reduce((a, b) => a + b, 0) / dwellPoints.length : 0;
        }
      }
      
      // Calculate total drawing duration
      if (strokes.length > 0) {
        const firstStroke = strokes[0];
        const lastStroke = strokes[strokes.length - 1];
        
        if (firstStroke && firstStroke['points'].length > 0 && 
            lastStroke && lastStroke['points'].length > 0) {
          const firstPoint = firstStroke['points'][0];
          const lastPoint = lastStroke['points'][lastStroke['points'].length - 1];
          
          if (firstPoint?.time && lastPoint?.time) {
            totalDrawingTime = lastPoint['time'] - firstPoint['time'];
          }
        }
      }
      
      // Calculate rhythm consistency (standard deviation of stroke durations)
      const avgStrokeDuration = strokeDurations.length > 0 ?
        strokeDurations.reduce((a, b) => a + b, 0) / strokeDurations.length : 0;
      const rhythmVariance = strokeDurations.length > 0 ?
        strokeDurations.reduce((acc, val) => acc + Math.pow(val - avgStrokeDuration, 2), 0) / strokeDurations.length : 0;
      const rhythmConsistency = Math.sqrt(rhythmVariance);
      
      // Calculate tempo variation
      const tempoVariations: number[] = [];
      for (let i = 1; i < strokeDurations.length; i++) {
        const current = strokeDurations[i];
        const previous = strokeDurations[i - 1];
        if (current !== undefined && previous !== undefined) {
          tempoVariations.push(Math.abs(current - previous));
        }
      }
      const tempoVariation = tempoVariations.length > 0 ?
        tempoVariations.reduce((a, b) => a + b, 0) / tempoVariations.length : 0;
      
      
      const calcDuration = performance.now() - startCalc;
      if (calcDuration > 30) {
        logger.warn('Slow timing calculation', { duration_ms: calcDuration });
      }
      
      const features: TimingFeatures = {
        totalDuration: totalDrawingTime,
        strokeDurations,
        pauseDurations,
        rhythm: rhythmConsistency,
        consistency: 1 - (rhythmVariance / (avgStrokeDuration * avgStrokeDuration)), // Normalized consistency
        averageSpeed: totalDrawingTime > 0 ? 1000 / totalDrawingTime : 0, // strokes per second
        speedVariance: tempoVariation,
        pause_detection: pauseDurations.length
      };
      
      this.performanceMonitor.endExtraction(Object.keys(features).length, 'Timing');
      return features;
      
    } catch (error) {
      logger.error('Timing feature extraction failed:', { error: String(error) });
      return this.getDefaultTimingFeatures();
    }
  }

  // Phase 3: Advanced Geometric Features
  extractGeometricFeatures(strokeData: unknown): GeometricFeatures {
    this.performanceMonitor.startExtraction();
    
    try {
      if (!this.validateStrokeData(strokeData)) {
        return this.getDefaultGeometricFeatures();
      }
      
      const strokes = this.extractStrokes(strokeData);
      
      // Calculate stroke complexity with performance tracking
      const startCalc = performance.now();
      
      const complexityScores: number[] = [];
      const tremorIndices: number[] = [];
      const smoothnessScores: number[] = [];
      const directionChangeCounts: number[] = [];
      const curvatureValues: number[] = [];
      
      for (const stroke of strokes) {
        const points = stroke['points'];
        
        if (points.length > 2) {
          // Stroke complexity (based on path length vs direct distance)
          const firstPoint = points[0];
          const lastPoint = points[points.length - 1];
          
          let directDistance = 0;
          let pathLength = 0;
          
          if (firstPoint && lastPoint) {
            directDistance = Math.sqrt(
              Math.pow(lastPoint['x'] - firstPoint['x'], 2) + 
              Math.pow(lastPoint['y'] - firstPoint['y'], 2)
            );
            
            for (let i = 1; i < points.length; i++) {
              const current = points[i];
              const previous = points[i - 1];
              if (current && previous) {
                pathLength += Math.sqrt(
                  Math.pow(current['x'] - previous['x'], 2) + 
                  Math.pow(current['y'] - previous['y'], 2)
                );
              }
            }
            
            const complexity = directDistance > 0 ? pathLength / directDistance : 1;
            complexityScores.push(complexity);
          }
          
          // Tremor detection (jitter in movement)
          const jitters: number[] = [];
          for (let i = 2; i < points.length; i++) {
            const p1 = points[i - 2];
            const p2 = points[i - 1];
            const p3 = points[i];
            
            if (p1 && p2 && p3) {
              const v1 = {
                x: p2['x'] - p1['x'],
                y: p2['y'] - p1['y']
              };
              const v2 = {
                x: p3['x'] - p2['x'],
                y: p3['y'] - p2['y']
              };
              
              // Calculate angle change
              const dot = v1['x'] * v2['x'] + v1['y'] * v2['y'];
              const det = v1['x'] * v2['y'] - v1['y'] * v2['x'];
              const angle = Math.atan2(det, dot);
              
              if (Math.abs(angle) > Math.PI / 6) { // More than 30 degrees
                jitters.push(Math.abs(angle));
              }
            }
          }
          
          const tremorIndex = jitters.length / (points.length - 2);
          tremorIndices.push(tremorIndex);
          
          // Smoothness (inverse of average angular change)
          let totalAngleChange = 0;
          let angleChangeCount = 0;
          
          for (let i = 2; i < points.length; i++) {
            const p1 = points[i - 2];
            const p2 = points[i - 1];
            const p3 = points[i];
            
            if (p1 && p2 && p3) {
              const v1 = {
                x: p2['x'] - p1['x'],
                y: p2['y'] - p1['y']
              };
              const v2 = {
                x: p3['x'] - p2['x'],
                y: p3['y'] - p2['y']
              };
              
              const angle = Math.atan2(v2['y'], v2['x']) - Math.atan2(v1['y'], v1['x']);
              totalAngleChange += Math.abs(angle);
              angleChangeCount++;
            }
          }
          
          const avgAngleChange = angleChangeCount > 0 ? totalAngleChange / angleChangeCount : 0;
          const smoothness = 1 / (1 + avgAngleChange); // Normalized smoothness score
          smoothnessScores.push(smoothness);
          
          // Direction changes
          let directionChanges = 0;
          let lastDirection = 0;
          
          for (let i = 1; i < points.length; i++) {
            const current = points[i];
            const previous = points[i - 1];
            
            if (current && previous) {
              const dx = current['x'] - previous['x'];
              const dy = current['y'] - previous['y'];
              const direction = Math.atan2(dy, dx);
              
              if (i > 1) {
                const angleDiff = Math.abs(direction - lastDirection);
                if (angleDiff > Math.PI / 4) { // More than 45 degrees
                  directionChanges++;
                }
              }
              lastDirection = direction;
            }
          }
          
          directionChangeCounts.push(directionChanges);
          
          // Curvature analysis
          const curvatures: number[] = [];
          for (let i = 1; i < points.length - 1; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const p3 = points[i + 1];
            
            if (p1 && p2 && p3) {
              // Calculate curvature using three-point method
              const area = Math.abs(
                (p2['x'] - p1['x']) * (p3['y'] - p1['y']) - 
                (p3['x'] - p1['x']) * (p2['y'] - p1['y'])
              ) / 2;
              
              const a = Math.sqrt(Math.pow(p2['x'] - p1['x'], 2) + Math.pow(p2['y'] - p1['y'], 2));
              const b = Math.sqrt(Math.pow(p3['x'] - p2['x'], 2) + Math.pow(p3['y'] - p2['y'], 2));
              const c = Math.sqrt(Math.pow(p3['x'] - p1['x'], 2) + Math.pow(p3['y'] - p1['y'], 2));
              
              const curvature = (a * b * c) > 0 ? (4 * area) / (a * b * c) : 0;
              curvatures.push(curvature);
            }
          }
          
          const avgCurvature = curvatures.length > 0 ?
            curvatures.reduce((a, b) => a + b, 0) / curvatures.length : 0;
          curvatureValues.push(avgCurvature);
        }
      }
      
      // Calculate spatial efficiency
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let totalInkLength = 0;
      
      for (const stroke of strokes) {
        for (let i = 0; i < stroke['points'].length; i++) {
          const point = stroke['points'][i];
          if (point) {
            minX = Math.min(minX, point['x']);
            maxX = Math.max(maxX, point['x']);
            minY = Math.min(minY, point['y']);
            maxY = Math.max(maxY, point['y']);
            
            if (i > 0) {
              const previous = stroke['points'][i - 1];
              if (previous) {
                totalInkLength += Math.sqrt(
                  Math.pow(point['x'] - previous['x'], 2) + 
                  Math.pow(point['y'] - previous['y'], 2)
                );
              }
            }
          }
        }
      }
      
      // const boundingArea = (maxX - minX) * (maxY - minY); // Unused variable
      
      // Calculate stroke overlap ratio
      // Simplified: check how many points are very close to points from other strokes
      // let _overlapCount = 0;
      const overlapThreshold = 5; // pixels
      
      // Performance optimization: sample points for large datasets
      const sampleRate = strokes.reduce((acc, s) => acc + s['points'].length, 0) > 1000 ? 0.1 : 1;
      
      for (let i = 0; i < strokes.length; i++) {
        const strokeI = strokes[i];
        const pointsI = strokeI?.['points'] || [];
        for (let j = i + 1; j < strokes.length; j++) {
          const strokeJ = strokes[j];
          const pointsJ = strokeJ?.['points'] || [];
          for (const p1 of pointsI) {
            if (Math.random() > sampleRate) continue; // Skip based on sample rate
            
            for (const p2 of pointsJ) {
              if (Math.random() > sampleRate) continue; // Skip based on sample rate
              
              const distance = Math.sqrt(
                Math.pow(p1['x'] - p2['x'], 2) + 
                Math.pow(p1['y'] - p2['y'], 2)
              );
              if (distance < overlapThreshold) {
                // _overlapCount++;
              }
            }
          }
        }
      }
      
      // const totalPoints = strokes.reduce((acc, s) => acc + s['points'].length, 0); // Unused variable
      
      const calcDuration = performance.now() - startCalc;
      if (calcDuration > 80) {
        logger.warn('Slow geometric calculation', { duration_ms: calcDuration });
      }
      
      const features: GeometricFeatures = {
        boundingBox: {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        },
        centroid: {
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2
        },
        aspectRatio: (maxX - minX) / (maxY - minY),
        totalLength: totalInkLength,
        angles: [], // Will be populated if needed
        curvature: curvatureValues,
        symmetry: {
          horizontal: 0.5, // Placeholder
          vertical: 0.5 // Placeholder
        },
        stroke_complexity: complexityScores.length > 0 ?
          complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length : 1
      };
      
      this.performanceMonitor.endExtraction(Object.keys(features).length, 'Geometric');
      return features;
      
    } catch (error) {
      logger.error('Geometric feature extraction failed:', { error: String(error) });
      return this.getDefaultGeometricFeatures();
    }
  }

  // Phase 4: Security & Context Features
  extractSecurityFeatures(strokeData: unknown): SecurityFeatures {
    this.performanceMonitor.startExtraction();
    
    try {
      if (!this.validateStrokeData(strokeData)) {
        return this.getDefaultSecurityFeatures();
      }
      
      const strokes = this.extractStrokes(strokeData);
      
      // Performance tracking
      const startCalc = performance.now();
      
      // Unnatural pause detection
      const unnaturalPauses: number[] = [];
      const speedAnomalies: number[] = [];
      const pressureAnomalies: number[] = [];
      
      for (let i = 0; i < strokes.length; i++) {
        const stroke = strokes[i];
        const points = stroke?.['points'] || [];
        
        if (points.length > 1) {
          // Check for unnatural pauses within strokes
          for (let j = 1; j < points.length; j++) {
            const p1 = points[j - 1];
            const p2 = points[j];
            
            if (p1 && p2 && p1['time'] && p2['time']) {
              const timeDiff = p2['time'] - p1['time'];
              const distance = Math.sqrt(
                Math.pow(p2['x'] - p1['x'], 2) + 
                Math.pow(p2['y'] - p1['y'], 2)
              );
              
              // Very long pause with minimal movement (possible tracing)
              if (timeDiff > 100 && distance < 2) {
                unnaturalPauses.push(timeDiff);
              }
              
              // Calculate speed
              const speed = distance / timeDiff;
              
              // Detect unusually consistent speed (bot-like)
              if (j > 1) {
                const p0 = points[j - 2];
                if (p0 && p1 && p0['time'] && p1['time']) {
                  const prevDistance = Math.sqrt(
                    Math.pow(p1['x'] - p0['x'], 2) + 
                    Math.pow(p1['y'] - p0['y'], 2)
                  );
                  const prevTimeDiff = p1['time'] - p0['time'];
                  const prevSpeed = prevTimeDiff > 0 ? prevDistance / prevTimeDiff : 0;
                  
                  // Speed too consistent (less than 5% variation)
                  if (prevSpeed > 0 && Math.abs(speed - prevSpeed) / prevSpeed < 0.05) {
                    speedAnomalies.push(1);
                  } else {
                    speedAnomalies.push(0);
                  }
                }
              }
            }
            
            // Pressure anomalies
            if (p1 && p2 && typeof p1['pressure'] === 'number' && typeof p2['pressure'] === 'number') {
              // Detect sudden pressure changes
              const pressureChange = Math.abs(p2['pressure'] - p1['pressure']);
              if (pressureChange > 0.5) { // More than 50% change
                pressureAnomalies.push(pressureChange);
              }
            }
          }
        }
      }
      
      // Calculate timing regularity (for bot detection)
      const strokeTimings: number[] = [];
      for (const stroke of strokes) {
        if (stroke['points'].length > 1) {
          const firstPoint = stroke['points'][0];
          const lastPoint = stroke['points'][stroke['points'].length - 1];
          if (firstPoint?.time && lastPoint?.time) {
            strokeTimings.push(lastPoint['time'] - firstPoint['time']);
          }
        }
      }
      
      // Check for too-regular timing patterns
      let timingRegularityScore = 0;
      if (strokeTimings.length > 2) {
        const avgTiming = strokeTimings.reduce((a, b) => a + b, 0) / strokeTimings.length;
        const timingVariance = strokeTimings.reduce((acc, val) => 
          acc + Math.pow(val - avgTiming, 2), 0) / strokeTimings.length;
        const timingStd = Math.sqrt(timingVariance);
        
        // Lower std means more regular (potentially bot-like)
        timingRegularityScore = avgTiming > 0 ? timingStd / avgTiming : 1;
      }
      
      // Device consistency score (simplified - would need device info in real implementation)
      // For now, check pressure consistency as proxy
      let deviceConsistencyScore = 1;
      const hasPressure = strokes.some(stroke => 
        stroke['points'].some(p => typeof p['pressure'] === 'number' && p['pressure'] > 0)
      );
      
      if (!hasPressure) {
        deviceConsistencyScore = 0.5; // Device might not support pressure
      }
      
      // Overall behavioral authenticity score
      const authenticityFactors = [
        unnaturalPauses.length === 0 ? 1 : 0.5,
        speedAnomalies.filter(a => a === 1).length / Math.max(speedAnomalies.length, 1) < 0.3 ? 1 : 0.5,
        pressureAnomalies.length / strokes.reduce((acc, s) => acc + s['points'].length, 0) < 0.1 ? 1 : 0.5,
        timingRegularityScore > 0.1 ? 1 : 0.5,
        deviceConsistencyScore
      ];
      
      const behavioralAuthenticityScore = 
        authenticityFactors.reduce((a, b) => a + b, 0) / authenticityFactors.length;
      
      const calcDuration = performance.now() - startCalc;
      if (calcDuration > 40) {
        logger.warn('Slow security calculation', { duration_ms: calcDuration });
      }
      
      const features: SecurityFeatures = {
        anomalyScore: speedAnomalies.filter(a => a === 1).length / Math.max(speedAnomalies.length, 1),
        authenticityScore: behavioralAuthenticityScore,
        confidenceLevel: 1 - (unnaturalPauses.length / Math.max(strokes.length, 1)),
        riskFactors: [
          unnaturalPauses.length > 0 ? 'unnatural_pauses' : '',
          speedAnomalies.filter(a => a === 1).length > 0 ? 'speed_anomalies' : '',
          pressureAnomalies.length > 0 ? 'pressure_anomalies' : ''
        ].filter(f => f !== ''),
        velocityConsistency: 1 - timingRegularityScore,
        pressureConsistency: 1 - (pressureAnomalies.length / Math.max(strokes.reduce((acc, s) => acc + s['points'].length, 0), 1)),
        unnatural_pause_detection: unnaturalPauses.length
      };
      
      this.performanceMonitor.endExtraction(Object.keys(features).length, 'Security');
      return features;
      
    } catch (error) {
      logger.error('Security feature extraction failed:', { error: String(error) });
      return this.getDefaultSecurityFeatures();
    }
  }

  // Extract all features from all phases
  extractAllFeatures(strokeData: unknown, deviceCapabilities?: DeviceCapabilities | null): EnhancedFeatures {
    this.performanceMonitor.startExtraction();
    
    try {
      // Extract features with device capability awareness
      const pressureFeatures = this.extractPressureFeatures(strokeData, deviceCapabilities);
      const timingFeatures = this.extractTimingFeatures(strokeData);
      const geometricFeatures = this.extractGeometricFeatures(strokeData);
      const securityFeatures = this.extractSecurityFeatures(strokeData);
      
      // Create PressureDynamics from PressureFeatures
      const pressureDynamics: PressureDynamics = {
        min: pressureFeatures.min,
        max: pressureFeatures.max,
        mean: pressureFeatures.mean,
        variance: pressureFeatures.variance,
        changes: pressureFeatures.changes,
        peaks: pressureFeatures.peaks,
        valleys: pressureFeatures.valleys
      };
      
      // Create TimingPatterns from TimingFeatures
      const timingPatterns: TimingPatterns = {
        totalDuration: timingFeatures.totalDuration,
        strokeDurations: timingFeatures.strokeDurations,
        pauseDurations: timingFeatures.pauseDurations,
        rhythm: timingFeatures.rhythm,
        consistency: timingFeatures.consistency,
        averageSpeed: timingFeatures.averageSpeed,
        speedVariance: timingFeatures.speedVariance
      };
      
      // Create GeometricProperties from GeometricFeatures
      const geometricProperties: GeometricProperties = {
        boundingBox: geometricFeatures.boundingBox,
        centroid: geometricFeatures.centroid,
        aspectRatio: geometricFeatures.aspectRatio,
        totalLength: geometricFeatures.totalLength,
        angles: geometricFeatures.angles,
        curvature: geometricFeatures.curvature,
        symmetry: geometricFeatures.symmetry
      };
      
      // Create SecurityIndicators from SecurityFeatures
      const securityIndicators: SecurityIndicators = {
        anomalyScore: securityFeatures.anomalyScore,
        authenticityScore: securityFeatures.authenticityScore,
        confidenceLevel: securityFeatures.confidenceLevel,
        riskFactors: securityFeatures.riskFactors,
        velocityConsistency: securityFeatures.velocityConsistency,
        pressureConsistency: securityFeatures.pressureConsistency
      };
      
      // Build the properly nested EnhancedFeatures structure
      const allFeatures: EnhancedFeatures = {
        pressureDynamics,
        timingPatterns,
        geometricProperties,
        securityIndicators,
        deviceCapabilities: deviceCapabilities || {
          supportsPressure: false,
          supportsTouch: true,
          inputMethod: 'mouse',
          pointerTypes: ['mouse'],
          browser: 'unknown',
          os: 'unknown',
          devicePixelRatio: 1,
          canvasSupport: {
            basic: true,
            webgl: false,
            webgl2: false,
            offscreenCanvas: false
          }
        },
        metadata: {
          version: '1.0',
          processingTime: 0, // Will be set below
          algorithm: 'enhanced-biometric-v1'
        }
      };
      
      // Aggregate excluded features from all categories
      const excludedFeatures: string[] = [];
      const exclusionReasons: string[] = [];
      
      const featureCategories = [pressureFeatures, timingFeatures, geometricFeatures, securityFeatures];
      
      featureCategories.forEach(category => {
        if (category._excluded_features) {
          excludedFeatures.push(...category._excluded_features);
        }
        if (category._exclusion_reason) {
          exclusionReasons.push(category._exclusion_reason);
        }
      });
      
      const totalTime = this.performanceMonitor.endExtraction(
        Object.keys(pressureDynamics).length + 
        Object.keys(timingPatterns).length + 
        Object.keys(geometricProperties).length + 
        Object.keys(securityIndicators).length, 
        'All Features'
      );
      
      // Update metadata with processing time
      allFeatures.metadata.processingTime = totalTime;
      
      // Add optional metadata fields
      allFeatures._extraction_time_ms = totalTime;
      allFeatures._feature_version = '1.0';
      
      // Add aggregated exclusion data if any features were excluded
      if (excludedFeatures.length > 0) {
        allFeatures._excluded_features = [...new Set(excludedFeatures)];
        allFeatures._exclusion_reasons = [...new Set(exclusionReasons)];
      }
      
      // Add list of actually supported features
      const supportedFeatures = [
        ...Object.keys(pressureDynamics).filter(k => !excludedFeatures.includes(k)),
        ...Object.keys(timingPatterns).filter(k => !excludedFeatures.includes(k)),
        ...Object.keys(geometricProperties).filter(k => !excludedFeatures.includes(k)),
        ...Object.keys(securityIndicators).filter(k => !excludedFeatures.includes(k))
      ];
      allFeatures._supported_features = supportedFeatures;
      
      // Add device capabilities if provided
      if (deviceCapabilities) {
        allFeatures._device_capabilities = deviceCapabilities;
      }
      
      // Log performance stats
      const perfStats = this.performanceMonitor.getPerformanceStats();
      logger.info('Feature extraction complete', {
        total_features: supportedFeatures.length,
        excluded_features: excludedFeatures.length,
        performance_stats: perfStats
      });
      
      return allFeatures;
      
    } catch (error) {
      logger.error('Complete feature extraction failed:', { error: String(error) });
      
      // Return default EnhancedFeatures structure with nested properties
      return {
        pressureDynamics: {
          min: 0,
          max: 0,
          mean: 0,
          variance: 0,
          changes: [],
          peaks: 0,
          valleys: 0
        },
        timingPatterns: {
          totalDuration: 0,
          strokeDurations: [],
          pauseDurations: [],
          rhythm: 0,
          consistency: 0,
          averageSpeed: 0,
          speedVariance: 0
        },
        geometricProperties: {
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
          centroid: { x: 0, y: 0 },
          aspectRatio: 1,
          totalLength: 0,
          angles: [],
          curvature: [],
          symmetry: { horizontal: 0.5, vertical: 0.5 }
        },
        securityIndicators: {
          anomalyScore: 0,
          authenticityScore: 0.5,
          confidenceLevel: 0.5,
          riskFactors: [],
          velocityConsistency: 0.5,
          pressureConsistency: 0.5
        },
        deviceCapabilities: deviceCapabilities || {
          supportsPressure: false,
          supportsTouch: true,
          supportsTilt: false,
          maxPressure: 1.0,
          deviceType: 'unknown'
        },
        metadata: {
          version: '1.0',
          processingTime: 0,
          algorithm: 'enhanced-biometric-v1'
        },
        _extraction_error: true
      } as EnhancedFeatures;
    }
  }

  // Default feature values for fallback
  private getDefaultPressureFeatures(): PressureFeatures {
    return {
      min: 0,
      max: 0,
      mean: 0,
      variance: 0,
      changes: [],
      peaks: 0,
      valleys: 0,
      has_pressure_data: false
    };
  }

  private getDefaultTimingFeatures(): TimingFeatures {
    return {
      totalDuration: 0,
      strokeDurations: [],
      pauseDurations: [],
      rhythm: 0,
      consistency: 0,
      averageSpeed: 0,
      speedVariance: 0,
      pause_detection: 0
    };
  }

  private getDefaultGeometricFeatures(): GeometricFeatures {
    return {
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      centroid: { x: 0, y: 0 },
      aspectRatio: 1,
      totalLength: 0,
      angles: [],
      curvature: [],
      symmetry: { horizontal: 0.5, vertical: 0.5 },
      stroke_complexity: 1
    };
  }

  private getDefaultSecurityFeatures(): SecurityFeatures {
    return {
      anomalyScore: 0,
      authenticityScore: 0.5,
      confidenceLevel: 0.5,
      riskFactors: [],
      velocityConsistency: 0.5,
      pressureConsistency: 0.5,
      unnatural_pause_detection: 0
    };
  }
  
  // Get performance statistics
  getPerformanceStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    return this.performanceMonitor.getPerformanceStats();
  }
}

// Export singleton instance for backward compatibility
export const EnhancedFeatureExtractor = new BiometricEngine();

// Export module for CommonJS compatibility
module.exports = EnhancedFeatureExtractor;
module.exports.BiometricEngine = BiometricEngine;