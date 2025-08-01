/**
 * Enhanced Feature Extraction Module
 * Implements 4-phase approach for extracting 25+ advanced biometric features
 * Phase 1: Pressure & Touch Analysis (8 features)
 * Phase 2: Behavioral Timing (6 features) 
 * Phase 3: Advanced Geometric (7 features)
 * Phase 4: Security & Context (6 features)
 */

// Feature name constants for consistent exclusion handling
const PRESSURE_FEATURES = [
  'avg_pressure', 'max_pressure', 'min_pressure', 
  'pressure_std', 'pressure_range', 'contact_time_ratio',
  'pressure_buildup_rate', 'pressure_release_rate'
];

// Performance monitoring utility
const PerformanceMonitor = {
  startTime: null,
  
  startExtraction() {
    this.startTime = Date.now();
  },
  
  endExtraction(featureCount, category) {
    const duration = Date.now() - this.startTime;
    console.log(`${category} extraction: ${duration}ms for ${featureCount} features`);
    
    // Alert if extraction takes too long
    if (duration > 100) {
      console.warn(`Slow feature extraction detected: ${duration}ms for ${category}`);
    }
    
    return duration;
  }
};

// Main Enhanced Feature Extractor
const EnhancedFeatureExtractor = {
  // Core validation function
  validateStrokeData(strokeData) {
    // Check for null/undefined
    if (!strokeData) {
      console.warn('Invalid stroke data: null or undefined');
      return false;
    }
    
    // Get normalized strokes using extractStrokes
    const strokes = this.extractStrokes(strokeData);
    
    // Check for empty strokes
    if (!Array.isArray(strokes) || strokes.length === 0) {
      console.warn('Invalid stroke data: empty strokes array');
      return false;
    }
    
    // Validate each stroke has points
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      if (!stroke || !stroke.points || !Array.isArray(stroke.points) || stroke.points.length === 0) {
        console.warn(`Invalid stroke at index ${i}: missing or empty points array`);
        return false;
      }
      
      // Validate point structure (all points should now be in object format after normalization)
      for (let j = 0; j < stroke.points.length; j++) {
        const point = stroke.points[j];
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
          console.warn(`Invalid point at stroke ${i}, point ${j}: missing x/y coordinates`);
          return false;
        }
      }
    }
    
    return true;
  },

  // Helper function to validate if an array contains point objects or arrays
  isPointArray(arr) {
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
        if (typeof item.x !== 'number' || typeof item.y !== 'number') {
          return false;
        }
      } else {
        return false;
      }
    }
    
    return true;
  },

  // Helper function to normalize a point to object format
  normalizePoint(point) {
    // If already in object format, return as is
    if (point && typeof point === 'object' && !Array.isArray(point) && 
        typeof point.x === 'number' && typeof point.y === 'number') {
      return point;
    }
    
    // If in array format [x, y], convert to object
    if (Array.isArray(point) && point.length === 2 && 
        typeof point[0] === 'number' && typeof point[1] === 'number') {
      return { x: point[0], y: point[1] };
    }
    
    // Invalid point format
    console.warn('Invalid point format:', point);
    return null;
  },

  // Helper function to normalize an array of points
  normalizePoints(points) {
    if (!Array.isArray(points)) return [];
    
    return points.map(point => this.normalizePoint(point)).filter(point => point !== null);
  },

  // Helper function to validate and normalize points (returns null if any point is invalid)
  validateAndNormalizePoints(points) {
    if (!Array.isArray(points)) return null;
    
    const normalizedPoints = [];
    for (const point of points) {
      const normalized = this.normalizePoint(point);
      if (normalized === null) {
        return null; // Return null if any point is invalid
      }
      normalizedPoints.push(normalized);
    }
    
    return normalizedPoints;
  },

  // Utility function to extract strokes array from various data formats
  extractStrokes(strokeData) {
    if (!strokeData) return [];
    
    let rawStrokes = [];
    
    if (Array.isArray(strokeData)) {
      rawStrokes = strokeData;
    } else if (strokeData.strokes && Array.isArray(strokeData.strokes)) {
      rawStrokes = strokeData.strokes;
    } else if (strokeData.raw && Array.isArray(strokeData.raw)) {
      // Check if raw contains stroke objects or point objects
      if (strokeData.raw.length > 0 && this.isPointArray(strokeData.raw)) {
        // Raw contains point objects, wrap as single stroke
        rawStrokes = [{ points: strokeData.raw }];
      } else {
        // Raw contains stroke objects
        rawStrokes = strokeData.raw;
      }
    } else if (strokeData.data && Array.isArray(strokeData.data)) {
      // Check if data contains stroke objects or point objects
      if (strokeData.data.length > 0 && this.isPointArray(strokeData.data)) {
        // Data contains point objects, wrap as single stroke
        rawStrokes = [{ points: strokeData.data }];
      } else {
        // Data contains stroke objects
        rawStrokes = strokeData.data;
      }
    } else {
      return [];
    }
    
    // Normalize stroke format - ensure each stroke has a points property with normalized points
    return rawStrokes.map((stroke, index) => {
      // If stroke already has the expected format with points property
      if (stroke && typeof stroke === 'object' && stroke.points && Array.isArray(stroke.points)) {
        // Validate and normalize the points to ensure consistent format
        const normalizedPoints = this.validateAndNormalizePoints(stroke.points);
        if (normalizedPoints === null) {
          console.warn(`Invalid points in stroke at index ${index}`);
          return null;
        }
        return { ...stroke, points: normalizedPoints };
      }
      
      // If stroke is an array of points, wrap it and normalize
      if (Array.isArray(stroke)) {
        const normalizedPoints = this.validateAndNormalizePoints(stroke);
        if (normalizedPoints === null) {
          console.warn(`Invalid points in stroke array at index ${index}`);
          return null;
        }
        return { points: normalizedPoints };
      }
      
      // If stroke has other properties but no points array, try to extract
      if (stroke && typeof stroke === 'object') {
        // Check for alternative point array names - validate each is an array of points
        let points = null;
        
        // Try stroke.data first (most common for point arrays)
        if (stroke.data && Array.isArray(stroke.data) && this.isPointArray(stroke.data)) {
          points = stroke.data;
        }
        // Try stroke.raw (alternative point array name)
        else if (stroke.raw && Array.isArray(stroke.raw) && this.isPointArray(stroke.raw)) {
          points = stroke.raw;
        }
        // Try stroke.points (if it exists but wasn't caught above)
        else if (stroke.points && Array.isArray(stroke.points) && this.isPointArray(stroke.points)) {
          points = stroke.points;
        }
        // Don't use stroke.strokes as it likely contains other stroke objects, not points
        
        if (points) {
          const normalizedPoints = this.validateAndNormalizePoints(points);
          if (normalizedPoints === null) {
            console.warn(`Invalid points in stroke at index ${index}`);
            return null;
          }
          return { ...stroke, points: normalizedPoints };
        }
      }
      
      console.warn(`Invalid stroke format at index ${index}:`, stroke);
      return null;
    }).filter(stroke => stroke !== null && stroke.points.length > 0);
  },

  // Phase 1: Pressure Analysis Features
  extractPressureFeatures(strokeData, deviceCapabilities = null) {
    PerformanceMonitor.startExtraction();
    
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
      const pressureValues = [];
      let totalPoints = 0;
      let pointsWithPressure = 0;
      
      // Extract all pressure values
      for (const stroke of strokes) {
        for (const point of stroke.points) {
          totalPoints++;
          // Check if pressure data exists (some devices don't support it)
          if (typeof point.pressure === 'number' && point.pressure > 0) {
            pressureValues.push(point.pressure);
            pointsWithPressure++;
          }
        }
      }
      
      // Handle case where device doesn't support pressure
      if (pressureValues.length === 0) {
        console.log('No pressure data collected - excluding pressure features');
        const features = this.getDefaultPressureFeatures();
        features._excluded_features = [...PRESSURE_FEATURES];
        features._exclusion_reason = 'no_pressure_data_collected';
        features.has_pressure_data = false;
        PerformanceMonitor.endExtraction(Object.keys(features).length, 'Pressure (excluded)');
        return features;
      }
      
      // Calculate pressure statistics
      const avgPressure = pressureValues.reduce((a, b) => a + b, 0) / pressureValues.length;
      const maxPressure = Math.max(...pressureValues);
      const minPressure = Math.min(...pressureValues);
      const pressureRange = maxPressure - minPressure;
      
      // Calculate standard deviation
      const pressureVariance = pressureValues.reduce((acc, val) => {
        return acc + Math.pow(val - avgPressure, 2);
      }, 0) / pressureValues.length;
      const pressureStd = Math.sqrt(pressureVariance);
      
      // Calculate contact time ratio
      const contactTimeRatio = pointsWithPressure / totalPoints;
      
      // Calculate pressure buildup/release rates
      let buildupRates = [];
      let releaseRates = [];
      
      for (const stroke of strokes) {
        const strokePressures = stroke.points
          .filter(p => typeof p.pressure === 'number')
          .map(p => p.pressure);
        
        if (strokePressures.length > 1) {
          // Find buildup rate (first quarter of stroke)
          const quarterPoint = Math.floor(strokePressures.length / 4);
          if (quarterPoint > 0) {
            const buildupRate = (strokePressures[quarterPoint] - strokePressures[0]) / quarterPoint;
            buildupRates.push(buildupRate);
          }
          
          // Find release rate (last quarter of stroke)
          const threeQuarterPoint = Math.floor(strokePressures.length * 3 / 4);
          if (threeQuarterPoint < strokePressures.length - 1) {
            const releaseRate = (strokePressures[strokePressures.length - 1] - strokePressures[threeQuarterPoint]) / 
                               (strokePressures.length - 1 - threeQuarterPoint);
            releaseRates.push(Math.abs(releaseRate)); // Use absolute value for release
          }
        }
      }
      
      const avgBuildupRate = buildupRates.length > 0 ? 
        buildupRates.reduce((a, b) => a + b, 0) / buildupRates.length : 0;
      const avgReleaseRate = releaseRates.length > 0 ?
        releaseRates.reduce((a, b) => a + b, 0) / releaseRates.length : 0;
      
      const features = {
        avg_pressure: avgPressure,
        max_pressure: maxPressure,
        min_pressure: minPressure,
        pressure_std: pressureStd,
        pressure_range: pressureRange,
        contact_time_ratio: contactTimeRatio,
        pressure_buildup_rate: avgBuildupRate,
        pressure_release_rate: avgReleaseRate,
        has_pressure_data: true
      };
      
      PerformanceMonitor.endExtraction(Object.keys(features).length, 'Pressure');
      return features;
      
    } catch (error) {
      console.error('Pressure feature extraction failed:', error);
      return this.getDefaultPressureFeatures();
    }
  },

  // Phase 2: Behavioral Timing Features
  extractTimingFeatures(strokeData) {
    PerformanceMonitor.startExtraction();
    
    try {
      if (!this.validateStrokeData(strokeData)) {
        return this.getDefaultTimingFeatures();
      }
      
      const strokes = this.extractStrokes(strokeData);
      const pauseDurations = [];
      const strokeDurations = [];
      const interStrokeTimings = [];
      let totalDrawingTime = 0;
      let totalPauseTime = 0;
      
      // Calculate timing features
      for (let i = 0; i < strokes.length; i++) {
        const stroke = strokes[i];
        const points = stroke.points;
        
        if (points.length > 1) {
          // Calculate stroke duration
          const firstPoint = points[0];
          const lastPoint = points[points.length - 1];
          
          if (firstPoint.time && lastPoint.time) {
            const strokeDuration = lastPoint.time - firstPoint.time;
            strokeDurations.push(strokeDuration);
            
            // Calculate inter-stroke timing
            if (i > 0) {
              const prevStroke = strokes[i - 1];
              const prevLastPoint = prevStroke.points[prevStroke.points.length - 1];
              if (prevLastPoint.time) {
                const interStrokeTiming = firstPoint.time - prevLastPoint.time;
                interStrokeTimings.push(interStrokeTiming);
                
                // Detect pauses (inter-stroke time > 50ms considered a pause)
                if (interStrokeTiming > 50) {
                  pauseDurations.push(interStrokeTiming);
                  totalPauseTime += interStrokeTiming;
                }
              }
            }
          }
          
          // Calculate dwell times (slow movement within stroke)
          const dwellPoints = [];
          for (let j = 1; j < points.length; j++) {
            const p1 = points[j - 1];
            const p2 = points[j];
            
            if (p1.time && p2.time) {
              const timeDiff = p2.time - p1.time;
              const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
              
              // If moving very slowly (< 5 pixels in > 20ms), consider it a dwell
              if (timeDiff > 20 && distance < 5) {
                dwellPoints.push(timeDiff);
              }
            }
          }
          
          // Store dwell pattern info
          stroke.dwellCount = dwellPoints.length;
          stroke.avgDwellTime = dwellPoints.length > 0 ? 
            dwellPoints.reduce((a, b) => a + b, 0) / dwellPoints.length : 0;
        }
      }
      
      // Calculate total drawing duration
      if (strokes.length > 0) {
        const firstPoint = strokes[0].points[0];
        const lastStroke = strokes[strokes.length - 1];
        const lastPoint = lastStroke.points[lastStroke.points.length - 1];
        
        if (firstPoint.time && lastPoint.time) {
          totalDrawingTime = lastPoint.time - firstPoint.time;
        }
      }
      
      // Calculate rhythm consistency (standard deviation of stroke durations)
      const avgStrokeDuration = strokeDurations.length > 0 ?
        strokeDurations.reduce((a, b) => a + b, 0) / strokeDurations.length : 0;
      const rhythmVariance = strokeDurations.length > 0 ?
        strokeDurations.reduce((acc, val) => acc + Math.pow(val - avgStrokeDuration, 2), 0) / strokeDurations.length : 0;
      const rhythmConsistency = Math.sqrt(rhythmVariance);
      
      // Calculate tempo variation
      const tempoVariations = [];
      for (let i = 1; i < strokeDurations.length; i++) {
        tempoVariations.push(Math.abs(strokeDurations[i] - strokeDurations[i - 1]));
      }
      const tempoVariation = tempoVariations.length > 0 ?
        tempoVariations.reduce((a, b) => a + b, 0) / tempoVariations.length : 0;
      
      // Calculate dwell time patterns
      const totalDwellPoints = strokes.reduce((acc, stroke) => acc + (stroke.dwellCount || 0), 0);
      const avgDwellTime = strokes.reduce((acc, stroke) => acc + (stroke.avgDwellTime || 0), 0) / strokes.length;
      
      const features = {
        pause_detection: pauseDurations.length,
        rhythm_consistency: rhythmConsistency,
        tempo_variation: tempoVariation,
        dwell_time_patterns: avgDwellTime,
        inter_stroke_timing: interStrokeTimings.length > 0 ?
          interStrokeTimings.reduce((a, b) => a + b, 0) / interStrokeTimings.length : 0,
        drawing_duration_total: totalDrawingTime,
        pause_time_ratio: totalDrawingTime > 0 ? totalPauseTime / totalDrawingTime : 0,
        avg_stroke_duration: avgStrokeDuration
      };
      
      PerformanceMonitor.endExtraction(Object.keys(features).length, 'Timing');
      return features;
      
    } catch (error) {
      console.error('Timing feature extraction failed:', error);
      return this.getDefaultTimingFeatures();
    }
  },

  // Phase 3: Advanced Geometric Features
  extractGeometricFeatures(strokeData) {
    PerformanceMonitor.startExtraction();
    
    try {
      if (!this.validateStrokeData(strokeData)) {
        return this.getDefaultGeometricFeatures();
      }
      
      const strokes = this.extractStrokes(strokeData);
      
      // Calculate stroke complexity
      const complexityScores = [];
      const tremorIndices = [];
      const smoothnessScores = [];
      const directionChangeCounts = [];
      const curvatureValues = [];
      
      for (const stroke of strokes) {
        const points = stroke.points;
        
        if (points.length > 2) {
          // Stroke complexity (based on path length vs direct distance)
          const firstPoint = points[0];
          const lastPoint = points[points.length - 1];
          const directDistance = Math.sqrt(
            Math.pow(lastPoint.x - firstPoint.x, 2) + 
            Math.pow(lastPoint.y - firstPoint.y, 2)
          );
          
          let pathLength = 0;
          for (let i = 1; i < points.length; i++) {
            pathLength += Math.sqrt(
              Math.pow(points[i].x - points[i - 1].x, 2) + 
              Math.pow(points[i].y - points[i - 1].y, 2)
            );
          }
          
          const complexity = directDistance > 0 ? pathLength / directDistance : 1;
          complexityScores.push(complexity);
          
          // Tremor detection (jitter in movement)
          const jitters = [];
          for (let i = 2; i < points.length; i++) {
            const v1 = {
              x: points[i - 1].x - points[i - 2].x,
              y: points[i - 1].y - points[i - 2].y
            };
            const v2 = {
              x: points[i].x - points[i - 1].x,
              y: points[i].y - points[i - 1].y
            };
            
            // Calculate angle change
            const dot = v1.x * v2.x + v1.y * v2.y;
            const det = v1.x * v2.y - v1.y * v2.x;
            const angle = Math.atan2(det, dot);
            
            if (Math.abs(angle) > Math.PI / 6) { // More than 30 degrees
              jitters.push(Math.abs(angle));
            }
          }
          
          const tremorIndex = jitters.length / (points.length - 2);
          tremorIndices.push(tremorIndex);
          
          // Smoothness (inverse of average angular change)
          let totalAngleChange = 0;
          let angleChangeCount = 0;
          
          for (let i = 2; i < points.length; i++) {
            const v1 = {
              x: points[i - 1].x - points[i - 2].x,
              y: points[i - 1].y - points[i - 2].y
            };
            const v2 = {
              x: points[i].x - points[i - 1].x,
              y: points[i].y - points[i - 1].y
            };
            
            const angle = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
            totalAngleChange += Math.abs(angle);
            angleChangeCount++;
          }
          
          const avgAngleChange = angleChangeCount > 0 ? totalAngleChange / angleChangeCount : 0;
          const smoothness = 1 / (1 + avgAngleChange); // Normalized smoothness score
          smoothnessScores.push(smoothness);
          
          // Direction changes
          let directionChanges = 0;
          let lastDirection = 0;
          
          for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            const direction = Math.atan2(dy, dx);
            
            if (i > 1) {
              const angleDiff = Math.abs(direction - lastDirection);
              if (angleDiff > Math.PI / 4) { // More than 45 degrees
                directionChanges++;
              }
            }
            lastDirection = direction;
          }
          
          directionChangeCounts.push(directionChanges);
          
          // Curvature analysis
          const curvatures = [];
          for (let i = 1; i < points.length - 1; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const p3 = points[i + 1];
            
            // Calculate curvature using three-point method
            const area = Math.abs(
              (p2.x - p1.x) * (p3.y - p1.y) - 
              (p3.x - p1.x) * (p2.y - p1.y)
            ) / 2;
            
            const a = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const b = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));
            const c = Math.sqrt(Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2));
            
            const curvature = (a * b * c) > 0 ? (4 * area) / (a * b * c) : 0;
            curvatures.push(curvature);
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
        for (let i = 0; i < stroke.points.length; i++) {
          const point = stroke.points[i];
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
          
          if (i > 0) {
            totalInkLength += Math.sqrt(
              Math.pow(point.x - stroke.points[i - 1].x, 2) + 
              Math.pow(point.y - stroke.points[i - 1].y, 2)
            );
          }
        }
      }
      
      const boundingArea = (maxX - minX) * (maxY - minY);
      const spatialEfficiency = boundingArea > 0 ? totalInkLength / Math.sqrt(boundingArea) : 0;
      
      // Calculate stroke overlap ratio
      // Simplified: check how many points are very close to points from other strokes
      let overlapCount = 0;
      const overlapThreshold = 5; // pixels
      
      for (let i = 0; i < strokes.length; i++) {
        for (let j = i + 1; j < strokes.length; j++) {
          for (const p1 of strokes[i].points) {
            for (const p2 of strokes[j].points) {
              const distance = Math.sqrt(
                Math.pow(p1.x - p2.x, 2) + 
                Math.pow(p1.y - p2.y, 2)
              );
              if (distance < overlapThreshold) {
                overlapCount++;
              }
            }
          }
        }
      }
      
      const totalPoints = strokes.reduce((acc, s) => acc + s.points.length, 0);
      const overlapRatio = totalPoints > 0 ? overlapCount / totalPoints : 0;
      
      const features = {
        stroke_complexity: complexityScores.length > 0 ?
          complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length : 1,
        tremor_index: tremorIndices.length > 0 ?
          tremorIndices.reduce((a, b) => a + b, 0) / tremorIndices.length : 0,
        smoothness_index: smoothnessScores.length > 0 ?
          smoothnessScores.reduce((a, b) => a + b, 0) / smoothnessScores.length : 1,
        direction_changes: directionChangeCounts.length > 0 ?
          directionChangeCounts.reduce((a, b) => a + b, 0) / directionChangeCounts.length : 0,
        curvature_analysis: curvatureValues.length > 0 ?
          curvatureValues.reduce((a, b) => a + b, 0) / curvatureValues.length : 0,
        spatial_efficiency: spatialEfficiency,
        stroke_overlap_ratio: overlapRatio
      };
      
      PerformanceMonitor.endExtraction(Object.keys(features).length, 'Geometric');
      return features;
      
    } catch (error) {
      console.error('Geometric feature extraction failed:', error);
      return this.getDefaultGeometricFeatures();
    }
  },

  // Phase 4: Security & Context Features
  extractSecurityFeatures(strokeData) {
    PerformanceMonitor.startExtraction();
    
    try {
      if (!this.validateStrokeData(strokeData)) {
        return this.getDefaultSecurityFeatures();
      }
      
      const strokes = this.extractStrokes(strokeData);
      
      // Unnatural pause detection
      const unnaturalPauses = [];
      const speedAnomalies = [];
      const pressureAnomalies = [];
      
      for (let i = 0; i < strokes.length; i++) {
        const stroke = strokes[i];
        const points = stroke.points;
        
        if (points.length > 1) {
          // Check for unnatural pauses within strokes
          for (let j = 1; j < points.length; j++) {
            const p1 = points[j - 1];
            const p2 = points[j];
            
            if (p1.time && p2.time) {
              const timeDiff = p2.time - p1.time;
              const distance = Math.sqrt(
                Math.pow(p2.x - p1.x, 2) + 
                Math.pow(p2.y - p1.y, 2)
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
                const prevDistance = Math.sqrt(
                  Math.pow(p1.x - p0.x, 2) + 
                  Math.pow(p1.y - p0.y, 2)
                );
                const prevTimeDiff = p1.time - p0.time;
                const prevSpeed = prevTimeDiff > 0 ? prevDistance / prevTimeDiff : 0;
                
                // Speed too consistent (less than 5% variation)
                if (Math.abs(speed - prevSpeed) / prevSpeed < 0.05) {
                  speedAnomalies.push(1);
                } else {
                  speedAnomalies.push(0);
                }
              }
            }
            
            // Pressure anomalies
            if (typeof p1.pressure === 'number' && typeof p2.pressure === 'number') {
              // Detect sudden pressure changes
              const pressureChange = Math.abs(p2.pressure - p1.pressure);
              if (pressureChange > 0.5) { // More than 50% change
                pressureAnomalies.push(pressureChange);
              }
            }
          }
        }
      }
      
      // Calculate timing regularity (for bot detection)
      const strokeTimings = [];
      for (const stroke of strokes) {
        if (stroke.points.length > 1) {
          const firstPoint = stroke.points[0];
          const lastPoint = stroke.points[stroke.points.length - 1];
          if (firstPoint.time && lastPoint.time) {
            strokeTimings.push(lastPoint.time - firstPoint.time);
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
        stroke.points.some(p => typeof p.pressure === 'number' && p.pressure > 0)
      );
      
      if (!hasPressure) {
        deviceConsistencyScore = 0.5; // Device might not support pressure
      }
      
      // Overall behavioral authenticity score
      const authenticityFactors = [
        unnaturalPauses.length === 0 ? 1 : 0.5,
        speedAnomalies.filter(a => a === 1).length / Math.max(speedAnomalies.length, 1) < 0.3 ? 1 : 0.5,
        pressureAnomalies.length / strokes.reduce((acc, s) => acc + s.points.length, 0) < 0.1 ? 1 : 0.5,
        timingRegularityScore > 0.1 ? 1 : 0.5,
        deviceConsistencyScore
      ];
      
      const behavioralAuthenticityScore = 
        authenticityFactors.reduce((a, b) => a + b, 0) / authenticityFactors.length;
      
      const features = {
        unnatural_pause_detection: unnaturalPauses.length,
        speed_anomaly_score: speedAnomalies.filter(a => a === 1).length / Math.max(speedAnomalies.length, 1),
        pressure_anomaly_score: pressureAnomalies.length / 
          strokes.reduce((acc, s) => acc + s.points.length, 0),
        timing_regularity_score: timingRegularityScore,
        device_consistency_score: deviceConsistencyScore,
        behavioral_authenticity_score: behavioralAuthenticityScore
      };
      
      PerformanceMonitor.endExtraction(Object.keys(features).length, 'Security');
      return features;
      
    } catch (error) {
      console.error('Security feature extraction failed:', error);
      return this.getDefaultSecurityFeatures();
    }
  },

  // Extract all features from all phases
  extractAllFeatures(strokeData, deviceCapabilities = null) {
    PerformanceMonitor.startExtraction();
    
    try {
      // Extract features with device capability awareness
      const pressureFeatures = this.extractPressureFeatures(strokeData, deviceCapabilities);
      const timingFeatures = this.extractTimingFeatures(strokeData);
      const geometricFeatures = this.extractGeometricFeatures(strokeData);
      const securityFeatures = this.extractSecurityFeatures(strokeData);
      
      // Combine all features
      const allFeatures = {
        ...pressureFeatures,
        ...timingFeatures,
        ...geometricFeatures,
        ...securityFeatures
      };
      
      // Aggregate excluded features from all categories
      const excludedFeatures = [];
      const exclusionReasons = [];
      
      [pressureFeatures, timingFeatures, geometricFeatures, securityFeatures].forEach(category => {
        if (category._excluded_features) {
          excludedFeatures.push(...category._excluded_features);
        }
        if (category._exclusion_reason) {
          exclusionReasons.push(category._exclusion_reason);
        }
      });
      
      // Clean up temporary exclusion data from individual categories
      Object.keys(allFeatures).forEach(key => {
        if (key === '_excluded_features' || key === '_exclusion_reason') {
          delete allFeatures[key];
        }
      });
      
      const totalTime = PerformanceMonitor.endExtraction(Object.keys(allFeatures).length, 'All Features');
      
      // Add metadata
      allFeatures._extraction_time_ms = totalTime;
      allFeatures._feature_version = '1.0';
      
      // Add aggregated exclusion data if any features were excluded
      if (excludedFeatures.length > 0) {
        allFeatures._excluded_features = [...new Set(excludedFeatures)];
        allFeatures._exclusion_reasons = [...new Set(exclusionReasons)];
      }
      
      // Add list of actually supported features
      const supportedFeatures = Object.keys(allFeatures).filter(k => 
        !k.startsWith('_') && 
        !excludedFeatures.includes(k)
      );
      allFeatures._supported_features = supportedFeatures;
      
      // Add device capabilities if provided
      if (deviceCapabilities) {
        allFeatures._device_capabilities = deviceCapabilities;
      }
      
      return allFeatures;
      
    } catch (error) {
      console.error('Complete feature extraction failed:', error);
      return {
        ...this.getDefaultPressureFeatures(),
        ...this.getDefaultTimingFeatures(),
        ...this.getDefaultGeometricFeatures(),
        ...this.getDefaultSecurityFeatures(),
        _extraction_error: true
      };
    }
  },

  // Default feature values for fallback
  getDefaultPressureFeatures() {
    return {
      // Don't provide fallback values - these will be excluded
      // Only has_pressure_data is always included as metadata
      has_pressure_data: false
    };
  },

  getDefaultTimingFeatures() {
    return {
      pause_detection: 0,
      rhythm_consistency: 0,
      tempo_variation: 0,
      dwell_time_patterns: 0,
      inter_stroke_timing: 0,
      drawing_duration_total: 0,
      pause_time_ratio: 0,
      avg_stroke_duration: 0
    };
  },

  getDefaultGeometricFeatures() {
    return {
      stroke_complexity: 1,
      tremor_index: 0,
      smoothness_index: 1,
      direction_changes: 0,
      curvature_analysis: 0,
      spatial_efficiency: 0,
      stroke_overlap_ratio: 0
    };
  },

  getDefaultSecurityFeatures() {
    return {
      unnatural_pause_detection: 0,
      speed_anomaly_score: 0,
      pressure_anomaly_score: 0,
      timing_regularity_score: 0.5,
      device_consistency_score: 0.5,
      behavioral_authenticity_score: 0.5
    };
  }
};

// Export the module
module.exports = EnhancedFeatureExtractor;