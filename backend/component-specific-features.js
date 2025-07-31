/**
 * Component-Specific Feature Extraction Module
 * Extends enhanced biometric features for shapes and drawings
 * Provides component-specific analysis while leveraging existing feature extraction
 */

const ComponentSpecificFeatures = {
  /**
   * Utility function to calculate bounds from stroke points
   * Handles cases where stroke data doesn't have pre-calculated bounds
   */
  calculateStrokeBounds(stroke) {
    if (!stroke || !stroke.points || !Array.isArray(stroke.points) || stroke.points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    
    // If bounds already exist, return them
    if (stroke.bounds && typeof stroke.bounds === 'object') {
      return stroke.bounds;
    }
    
    // Calculate bounds from points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    stroke.points.forEach(point => {
      if (point && typeof point.x === 'number' && typeof point.y === 'number') {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    });
    
    // Handle edge case where no valid points were found
    if (minX === Infinity) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    
    return { minX, maxX, minY, maxY };
  },

  /**
   * Utility function to calculate bounds for multiple strokes
   */
  calculateStrokeDataBounds(strokeData) {
    if (!strokeData || !Array.isArray(strokeData) || strokeData.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    strokeData.forEach(stroke => {
      const bounds = this.calculateStrokeBounds(stroke);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    });
    
    // Handle edge case where no valid strokes were found
    if (minX === Infinity) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    
    return { minX, maxX, minY, maxY };
  },

  /**
   * Extract features specific to shapes (circle, square, triangle)
   */
  extractShapeSpecificFeatures(strokeData, shapeType) {
    const features = {};
    
    switch(shapeType) {
      case 'circle':
        features.start_position_analysis = this.analyzeCircleStartPosition(strokeData);
        features.closure_technique = this.analyzeCircleClosure(strokeData);
        features.curve_consistency = this.analyzeCurveSmoothnessPattern(strokeData);
        features.radial_deviation = this.analyzeRadialDeviation(strokeData);
        break;
        
      case 'square':
        features.corner_execution_pattern = this.analyzeCornerTechnique(strokeData);
        features.line_straightness_signature = this.analyzeLineConsistency(strokeData);
        features.corner_pressure_spikes = this.analyzeCornerPressurePattern(strokeData);
        features.edge_length_consistency = this.analyzeEdgeLengthRatios(strokeData);
        break;
        
      case 'triangle':
        features.angle_consistency = this.analyzeAngleExecution(strokeData);
        features.vertex_pressure_pattern = this.analyzeVertexPressure(strokeData);
        features.side_length_ratios = this.analyzeSideLengthRatios(strokeData);
        features.apex_sharpness = this.analyzeApexSharpness(strokeData);
        break;
    }
    
    return features;
  },

  /**
   * Extract features specific to drawings (face, star, house, connect_dots)
   */
  extractDrawingSpecificFeatures(strokeData, drawingType) {
    const features = {
      stroke_sequence_pattern: this.analyzeStrokeOrder(strokeData),
      spatial_relationship_consistency: this.analyzeSpatialRelationships(strokeData),
      component_detection_enhanced: this.enhancedComponentDetection(strokeData, drawingType),
      artistic_style_fingerprint: this.analyzeDrawingStylePatterns(strokeData)
    };
    
    // Add drawing-specific features
    switch(drawingType) {
      case 'face':
        features.facial_symmetry_index = this.analyzeFacialSymmetry(strokeData);
        features.feature_placement_pattern = this.analyzeFacialFeaturePlacement(strokeData);
        break;
        
      case 'star':
        features.point_symmetry = this.analyzeStarPointSymmetry(strokeData);
        features.angle_regularity = this.analyzeStarAngleRegularity(strokeData);
        break;
        
      case 'house':
        features.structural_hierarchy = this.analyzeHouseStructure(strokeData);
        features.component_proportion = this.analyzeHouseProportions(strokeData);
        break;
        
      case 'connect_dots':
        features.path_efficiency = this.analyzePathEfficiency(strokeData);
        features.connection_strategy = this.analyzeConnectionStrategy(strokeData);
        break;
    }
    
    return features;
  },

  // Circle-specific analysis functions
  analyzeCircleStartPosition(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    const firstStroke = strokeData[0];
    if (!firstStroke || !firstStroke.points || !Array.isArray(firstStroke.points) || firstStroke.points.length === 0) {
      return 0;
    }
    
    const firstPoint = firstStroke.points[0];
    if (!firstPoint || typeof firstPoint.x !== 'number' || typeof firstPoint.y !== 'number') {
      return 0;
    }
    
    const bounds = this.calculateStrokeBounds(firstStroke);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    // Calculate angle from center to start point (0-360 degrees)
    const angle = Math.atan2(firstPoint.y - centerY, firstPoint.x - centerX) * (180 / Math.PI);
    const normalizedAngle = (angle + 360) % 360;
    
    // Convert to 0-1 score representing consistency
    return normalizedAngle / 360;
  },
  
  analyzeCircleClosure(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    const firstStroke = strokeData[0];
    if (!firstStroke || !firstStroke.points || !Array.isArray(firstStroke.points) || firstStroke.points.length === 0) {
      return 0;
    }
    
    const points = firstStroke.points;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    
    // Validate that first and last points exist and have valid coordinates
    if (!firstPoint || !lastPoint || 
        typeof firstPoint.x !== 'number' || typeof firstPoint.y !== 'number' ||
        typeof lastPoint.x !== 'number' || typeof lastPoint.y !== 'number') {
      return 0;
    }
    
    // Calculate closure gap
    const gap = Math.sqrt(
      Math.pow(lastPoint.x - firstPoint.x, 2) + 
      Math.pow(lastPoint.y - firstPoint.y, 2)
    );
    
    // Normalize by shape size
    const bounds = this.calculateStrokeBounds(firstStroke);
    const size = Math.max(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY
    );
    
    // Prevent division by zero
    if (size === 0) return 0;
    
    // Return closure quality (1 = perfect closure, 0 = large gap)
    return Math.max(0, 1 - (gap / size));
  },
  
  analyzeCurveSmoothnessPattern(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    const firstStroke = strokeData[0];
    if (!firstStroke || !firstStroke.points || !Array.isArray(firstStroke.points)) return 0;
    
    const points = firstStroke.points;
    if (points.length < 3) return 0; // Need at least 3 points for angle analysis
    
    let totalVariation = 0;
    
    // Analyze angle changes between consecutive segments
    for (let i = 2; i < points.length; i++) {
      const angle1 = Math.atan2(
        points[i-1].y - points[i-2].y,
        points[i-1].x - points[i-2].x
      );
      const angle2 = Math.atan2(
        points[i].y - points[i-1].y,
        points[i].x - points[i-1].x
      );
      
      let angleDiff = Math.abs(angle2 - angle1);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      
      totalVariation += angleDiff;
    }
    
    // Normalize by number of segments
    const segmentCount = points.length - 2;
    return segmentCount > 0 ? totalVariation / segmentCount : 0;
  },
  
  analyzeRadialDeviation(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    const firstStroke = strokeData[0];
    if (!firstStroke || !firstStroke.points || !Array.isArray(firstStroke.points)) return 0;
    
    const points = firstStroke.points;
    if (points.length === 0) return 0;
    
    // Calculate center
    const bounds = this.calculateStrokeBounds(firstStroke);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    // Calculate average radius
    const radii = points.map(p => 
      Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2))
    );
    const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
    
    // Prevent division by zero if all points are co-located
    if (avgRadius === 0) return 0;
    
    // Calculate standard deviation
    const variance = radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / radii.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize by average radius
    return stdDev / avgRadius;
  },

  // Square-specific analysis functions
  analyzeCornerTechnique(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    const firstStroke = strokeData[0];
    if (!firstStroke || !firstStroke.points || !Array.isArray(firstStroke.points) || firstStroke.points.length === 0) {
      return 0;
    }
    
    const points = firstStroke.points;
    const corners = [];
    
    // Detect corners based on angle changes
    for (let i = 5; i < points.length - 5; i++) {
      const angle = this.calculateAngleChange(points, i, 5);
      if (angle > Math.PI / 3) { // 60 degrees threshold
        corners.push({
          index: i,
          angle: angle,
          pressure: points[i].pressure || 0.5
        });
      }
    }
    
    // Analyze corner execution patterns
    if (corners.length < 4) return 0;
    
    // Calculate consistency in corner angles
    const angleConsistency = this.calculateStandardDeviation(
      corners.map(c => c.angle)
    );
    
    return 1 / (1 + angleConsistency);
  },
  
  analyzeLineConsistency(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    const firstStroke = strokeData[0];
    if (!firstStroke || !firstStroke.points || !Array.isArray(firstStroke.points) || firstStroke.points.length === 0) {
      return 0;
    }
    
    const points = firstStroke.points;
    let totalDeviation = 0;
    let segmentCount = 0;
    
    // Analyze each potential line segment
    let segmentStart = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const angle = this.calculateAngleChange(points, i, 3);
      
      // Detected a corner or end of stroke
      if (angle > Math.PI / 4 || i === points.length - 2) {
        if (i - segmentStart > 5) {
          const deviation = this.calculateLineDeviation(
            points.slice(segmentStart, i + 1)
          );
          totalDeviation += deviation;
          segmentCount++;
        }
        segmentStart = i;
      }
    }
    
    return segmentCount > 0 ? totalDeviation / segmentCount : 0;
  },
  
  analyzeCornerPressurePattern(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    const points = strokeData[0].points;
    const pressureSpikes = [];
    
    // Find pressure changes at corners
    for (let i = 5; i < points.length - 5; i++) {
      const angle = this.calculateAngleChange(points, i, 5);
      if (angle > Math.PI / 3) {
        // Analyze pressure around corner
        const prePressure = points[i-3] ? points[i-3].pressure || 0.5 : 0.5;
        const cornerPressure = points[i].pressure || 0.5;
        const postPressure = points[i+3] ? points[i+3].pressure || 0.5 : 0.5;
        
        pressureSpikes.push({
          spike: cornerPressure - (prePressure + postPressure) / 2,
          ratio: cornerPressure / ((prePressure + postPressure) / 2)
        });
      }
    }
    
    if (pressureSpikes.length === 0) return 0;
    
    // Return average pressure spike ratio
    return pressureSpikes.reduce((sum, s) => sum + s.ratio, 0) / pressureSpikes.length;
  },
  
  analyzeEdgeLengthRatios(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Validate that strokeData[0] exists and has points
    if (!strokeData[0] || !strokeData[0].points || !Array.isArray(strokeData[0].points) || strokeData[0].points.length === 0) {
      return 0;
    }
    
    const corners = this.detectCorners(strokeData[0].points);
    if (corners.length < 4) return 0;
    
    const edgeLengths = [];
    for (let i = 0; i < 4; i++) {
      const start = corners[i];
      const end = corners[(i + 1) % 4];
      const length = this.calculatePathLength(strokeData[0].points, start.index, end.index);
      edgeLengths.push(length);
    }
    
    // Calculate ratio consistency
    const avgLength = edgeLengths.reduce((a, b) => a + b, 0) / 4;
    const variance = edgeLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / 4;
    
    return 1 / (1 + Math.sqrt(variance) / avgLength);
  },

  // Triangle-specific analysis functions
  analyzeAngleExecution(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    const corners = this.detectCorners(strokeData[0].points);
    if (corners.length < 3) return 0;
    
    // Analyze the three main angles
    const angles = [];
    for (let i = 0; i < 3; i++) {
      const prev = corners[(i + 2) % 3];
      const curr = corners[i];
      const next = corners[(i + 1) % 3];
      
      const angle = this.calculateAngleBetweenPoints(
        strokeData[0].points[prev.index],
        strokeData[0].points[curr.index],
        strokeData[0].points[next.index]
      );
      angles.push(angle);
    }
    
    // Check if sum is close to 180 degrees (π radians)
    const angleSum = angles.reduce((a, b) => a + b, 0);
    const deviation = Math.abs(angleSum - Math.PI);
    
    return 1 / (1 + deviation * 10);
  },
  
  analyzeVertexPressure(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Validate that strokeData[0] exists and has points
    if (!strokeData[0] || !strokeData[0].points || !Array.isArray(strokeData[0].points) || strokeData[0].points.length === 0) {
      return 0;
    }
    
    const corners = this.detectCorners(strokeData[0].points);
    const points = strokeData[0].points;
    
    if (corners.length === 0) return 0;
    
    const vertexPressures = corners.map(corner => {
      const pressure = points[corner.index].pressure || 0.5;
      // Get average pressure around vertex
      const surroundingPressures = [];
      for (let i = -3; i <= 3; i++) {
        const idx = corner.index + i;
        if (idx >= 0 && idx < points.length && i !== 0) {
          surroundingPressures.push(points[idx].pressure || 0.5);
        }
      }
      
      // Prevent division by zero
      if (surroundingPressures.length === 0) {
        return 1.0; // Default ratio when no surrounding pressures
      }
      
      const avgSurrounding = surroundingPressures.reduce((a, b) => a + b, 0) / surroundingPressures.length;
      
      // Prevent division by zero
      if (avgSurrounding === 0) {
        return 1.0; // Default ratio when average surrounding pressure is zero
      }
      
      return pressure / avgSurrounding;
    });
    
    // Return consistency of vertex pressure patterns
    const avgRatio = vertexPressures.reduce((a, b) => a + b, 0) / vertexPressures.length;
    const variance = vertexPressures.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / vertexPressures.length;
    
    return avgRatio * (1 / (1 + variance));
  },
  
  analyzeSideLengthRatios(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Validate that strokeData[0] exists and has points
    if (!strokeData[0] || !strokeData[0].points || !Array.isArray(strokeData[0].points) || strokeData[0].points.length === 0) {
      return 0;
    }
    
    const corners = this.detectCorners(strokeData[0].points);
    if (corners.length < 3) return 0;
    
    const sideLengths = [];
    for (let i = 0; i < 3; i++) {
      const start = corners[i];
      const end = corners[(i + 1) % 3];
      const length = this.calculatePathLength(strokeData[0].points, start.index, end.index);
      sideLengths.push(length);
    }
    
    // Check for zero lengths to prevent division by zero
    if (sideLengths.some(length => length === 0)) {
      return 0;
    }
    
    // Sort to get ratios
    sideLengths.sort((a, b) => a - b);
    
    // Prevent division by zero when calculating ratios
    if (sideLengths[0] === 0 || sideLengths[1] === 0) {
      return 0;
    }
    
    // Return ratio pattern as a feature
    return (sideLengths[1] / sideLengths[0]) * (sideLengths[2] / sideLengths[1]);
  },
  
  analyzeApexSharpness(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Validate that strokeData[0] exists and has points
    if (!strokeData[0] || !strokeData[0].points || !Array.isArray(strokeData[0].points) || strokeData[0].points.length === 0) {
      return 0;
    }
    
    const corners = this.detectCorners(strokeData[0].points);
    const points = strokeData[0].points;
    
    if (corners.length === 0) return 0;
    
    const sharpnessScores = corners.map(corner => {
      // Measure curvature at corner
      const idx = corner.index;
      if (idx < 5 || idx >= points.length - 5) return 0;
      
      const curvature = this.calculateCurvature(points, idx, 5);
      return curvature;
    });
    
    // Return average sharpness
    return sharpnessScores.reduce((a, b) => a + b, 0) / sharpnessScores.length;
  },

  // Drawing-specific analysis functions
  analyzeStrokeOrder(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Create a stroke order signature based on relative positions
    const strokeSignature = strokeData.map((stroke, index) => {
      const bounds = this.calculateStrokeBounds(stroke);
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      
      return {
        index: index,
        relativeX: centerX,
        relativeY: centerY,
        length: stroke.points.length,
        duration: stroke.duration || 0
      };
    });
    
    // Convert to normalized feature
    let orderHash = 0;
    strokeSignature.forEach((sig, i) => {
      orderHash += (sig.relativeX * (i + 1)) + (sig.relativeY * (i + 1) * 2);
    });
    
    return orderHash % 1;
  },
  
  analyzeSpatialRelationships(strokeData) {
    if (!strokeData || strokeData.length < 2) return 0;
    
    const relationships = [];
    
    // Analyze relationships between all stroke pairs
    for (let i = 0; i < strokeData.length - 1; i++) {
      for (let j = i + 1; j < strokeData.length; j++) {
        const stroke1 = strokeData[i];
        const stroke2 = strokeData[j];
        
        const bounds1 = this.calculateStrokeBounds(stroke1);
        const bounds2 = this.calculateStrokeBounds(stroke2);
        const center1X = (bounds1.minX + bounds1.maxX) / 2;
        const center1Y = (bounds1.minY + bounds1.maxY) / 2;
        const center2X = (bounds2.minX + bounds2.maxX) / 2;
        const center2Y = (bounds2.minY + bounds2.maxY) / 2;
        
        const distance = Math.sqrt(
          Math.pow(center2X - center1X, 2) + 
          Math.pow(center2Y - center1Y, 2)
        );
        
        const angle = Math.atan2(center2Y - center1Y, center2X - center1X);
        
        relationships.push({
          distance: distance,
          angle: angle,
          sizeRatio: stroke1.points.length / stroke2.points.length
        });
      }
    }
    
    // Calculate consistency score
    if (relationships.length === 0) return 0;
    
    const avgDistance = relationships.reduce((sum, r) => sum + r.distance, 0) / relationships.length;
    const distanceVariance = relationships.reduce((sum, r) => sum + Math.pow(r.distance - avgDistance, 2), 0) / relationships.length;
    
    return 1 / (1 + Math.sqrt(distanceVariance) / avgDistance);
  },
  
  enhancedComponentDetection(strokeData, drawingType) {
    // Component detection score based on expected patterns
    const expectedComponents = {
      'face': { minStrokes: 3, maxStrokes: 7, expectedStrokes: 5 },
      'star': { minStrokes: 1, maxStrokes: 2, expectedStrokes: 1 },
      'house': { minStrokes: 4, maxStrokes: 8, expectedStrokes: 6 },
      'connect_dots': { minStrokes: 1, maxStrokes: 10, expectedStrokes: 1 }
    };
    
    const expected = expectedComponents[drawingType];
    if (!expected) return 0;
    
    const strokeCount = strokeData.length;
    
    // Score based on proximity to expected stroke count
    let score = 1;
    if (strokeCount < expected.minStrokes || strokeCount > expected.maxStrokes) {
      score = 0.5;
    } else {
      const deviation = Math.abs(strokeCount - expected.expectedStrokes);
      score = 1 / (1 + deviation * 0.2);
    }
    
    return score;
  },
  
  analyzeDrawingStylePatterns(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Analyze artistic style through various metrics
    const styleMetrics = {
      strokeSpeedVariation: this.calculateStrokeSpeedVariation(strokeData),
      pressureConsistency: this.calculatePressureConsistency(strokeData),
      curveComplexity: this.calculateCurveComplexity(strokeData),
      spatialDistribution: this.calculateSpatialDistribution(strokeData)
    };
    
    // Combine into a single style fingerprint
    const fingerprint = 
      styleMetrics.strokeSpeedVariation * 0.3 +
      styleMetrics.pressureConsistency * 0.3 +
      styleMetrics.curveComplexity * 0.2 +
      styleMetrics.spatialDistribution * 0.2;
      
    return fingerprint;
  },

  // Face-specific features
  analyzeFacialSymmetry(strokeData) {
    if (!strokeData || strokeData.length < 2) return 0;
    
    // Find the overall bounds
    const overallBounds = this.calculateStrokeDataBounds(strokeData);
    const minX = overallBounds.minX;
    const maxX = overallBounds.maxX;
    const minY = overallBounds.minY;
    const maxY = overallBounds.maxY;
    
    const centerX = (minX + maxX) / 2;
    
    // Analyze left vs right distribution
    let leftPoints = 0, rightPoints = 0;
    strokeData.forEach(stroke => {
      // Add null/undefined checks for stroke and stroke.points
      if (!stroke || !stroke.points || !Array.isArray(stroke.points)) {
        console.warn('Invalid stroke data in analyzeFacialSymmetry:', stroke);
        return; // Skip this stroke
      }
      
      stroke.points.forEach(point => {
        if (point && typeof point.x === 'number') {
          if (point.x < centerX) leftPoints++;
          else rightPoints++;
        }
      });
    });
    
    // Calculate symmetry score
    const total = leftPoints + rightPoints;
    if (total === 0) return 0; // Prevent division by zero
    
    const symmetry = 1 - Math.abs(leftPoints - rightPoints) / total;
    
    return symmetry;
  },
  
  analyzeFacialFeaturePlacement(strokeData) {
    if (!strokeData || strokeData.length < 3) return 0;
    
    // Sort strokes by vertical position
    const strokePositions = strokeData.map((stroke, index) => {
      // Add null/undefined checks for stroke
      if (!stroke || !stroke.points || !Array.isArray(stroke.points) || stroke.points.length === 0) {
        console.warn(`Invalid stroke at index ${index} in analyzeFacialFeaturePlacement:`, stroke);
        return null;
      }
      
      const bounds = this.calculateStrokeBounds(stroke);
      return {
        index: index,
        centerY: (bounds.minY + bounds.maxY) / 2,
        centerX: (bounds.minX + bounds.maxX) / 2
      };
    }).filter(pos => pos !== null).sort((a, b) => a.centerY - b.centerY);
    
    // Check if we have enough valid strokes
    if (strokePositions.length < 3) return 0;
    
    // Calculate relative positions (expected: eyes at top, nose middle, mouth bottom)
    const positions = strokePositions.map(s => s.centerY);
    const range = positions[positions.length - 1] - positions[0];
    
    if (range === 0) return 0;
    
    // Normalize positions
    const normalizedPositions = positions.map(p => (p - positions[0]) / range);
    
    // Score based on expected facial proportions
    let score = 0;
    if (normalizedPositions.length >= 3) {
      // Eyes should be in upper third
      const eyeScore = normalizedPositions[0] < 0.4 ? 1 : 0.5;
      // Mouth should be in lower third
      const mouthScore = normalizedPositions[normalizedPositions.length - 1] > 0.6 ? 1 : 0.5;
      
      score = (eyeScore + mouthScore) / 2;
    }
    
    return score;
  },

  // Star-specific features
  analyzeStarPointSymmetry(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Add null/undefined checks for stroke and points
    const firstStroke = strokeData[0];
    if (!firstStroke || !firstStroke.points || !Array.isArray(firstStroke.points) || firstStroke.points.length === 0) {
      console.warn('Invalid stroke data in analyzeStarPointSymmetry:', firstStroke);
      return 0;
    }
    
    const points = firstStroke.points;
    const corners = this.detectCorners(points);
    
    if (corners.length < 5) return 0;
    
    // Calculate center
    const centerX = corners.reduce((sum, c) => sum + points[c.index].x, 0) / corners.length;
    const centerY = corners.reduce((sum, c) => sum + points[c.index].y, 0) / corners.length;
    
    // Calculate distances from center to each point
    const distances = corners.map(c => {
      const p = points[c.index];
      return Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
    });
    
    // Calculate symmetry based on distance consistency
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
    
    return 1 / (1 + Math.sqrt(variance) / avgDistance);
  },
  
  analyzeStarAngleRegularity(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Add null/undefined checks for stroke and points
    const firstStroke = strokeData[0];
    if (!firstStroke || !firstStroke.points || !Array.isArray(firstStroke.points) || firstStroke.points.length === 0) {
      console.warn('Invalid stroke data in analyzeStarAngleRegularity:', firstStroke);
      return 0;
    }
    
    const points = firstStroke.points;
    const corners = this.detectCorners(points);
    
    if (corners.length < 5) return 0;
    
    // Calculate center
    const centerX = corners.reduce((sum, c) => sum + points[c.index].x, 0) / corners.length;
    const centerY = corners.reduce((sum, c) => sum + points[c.index].y, 0) / corners.length;
    
    // Calculate angles between consecutive points
    const angles = [];
    for (let i = 0; i < corners.length; i++) {
      const p1 = points[corners[i].index];
      const p2 = points[corners[(i + 1) % corners.length].index];
      
      const angle1 = Math.atan2(p1.y - centerY, p1.x - centerX);
      const angle2 = Math.atan2(p2.y - centerY, p2.x - centerX);
      
      let angleDiff = angle2 - angle1;
      if (angleDiff < 0) angleDiff += 2 * Math.PI;
      
      angles.push(angleDiff);
    }
    
    // Expected angle for regular star
    const expectedAngle = 2 * Math.PI / corners.length;
    
    // Calculate regularity
    const deviations = angles.map(a => Math.abs(a - expectedAngle));
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    
    return 1 / (1 + avgDeviation * 10);
  },

  // House-specific features
  analyzeHouseStructure(strokeData) {
    if (!strokeData || strokeData.length < 2) return 0;
    
    // Sort strokes by vertical position
    const sortedStrokes = [...strokeData].sort((a, b) => {
      const boundsA = this.calculateStrokeBounds(a);
      const boundsB = this.calculateStrokeBounds(b);
      const centerYA = (boundsA.minY + boundsA.maxY) / 2;
      const centerYB = (boundsB.minY + boundsB.maxY) / 2;
      return centerYA - centerYB;
    });
    
    // Check for roof-like structure at top
    const topStroke = sortedStrokes[0];
    const roofScore = this.calculateRoofScore(topStroke);
    
    // Check for wall-like structures
    const wallScore = this.calculateWallScore(strokeData);
    
    return (roofScore + wallScore) / 2;
  },
  
  analyzeHouseProportions(strokeData) {
    if (!strokeData || strokeData.length < 2) return 0;
    
    // Calculate overall bounds
    const overallBounds = this.calculateStrokeDataBounds(strokeData);
    const minX = overallBounds.minX;
    const maxX = overallBounds.maxX;
    const minY = overallBounds.minY;
    const maxY = overallBounds.maxY;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Ideal house proportions (width slightly less than height)
    const idealRatio = 0.8;
    const actualRatio = width / height;
    
    const proportionScore = 1 - Math.abs(actualRatio - idealRatio);
    
    return proportionScore;
  },

  // Connect dots features
  analyzePathEfficiency(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Calculate total path length
    let totalLength = 0;
    strokeData.forEach(stroke => {
      for (let i = 1; i < stroke.points.length; i++) {
        const dist = Math.sqrt(
          Math.pow(stroke.points[i].x - stroke.points[i-1].x, 2) +
          Math.pow(stroke.points[i].y - stroke.points[i-1].y, 2)
        );
        totalLength += dist;
      }
    });
    
    // Calculate minimum possible path (straight lines between stroke endpoints)
    let minLength = 0;
    for (let i = 1; i < strokeData.length; i++) {
      const prevEnd = strokeData[i-1].points[strokeData[i-1].points.length - 1];
      const currStart = strokeData[i].points[0];
      const dist = Math.sqrt(
        Math.pow(currStart.x - prevEnd.x, 2) +
        Math.pow(currStart.y - prevEnd.y, 2)
      );
      minLength += dist;
    }
    
    // Add lengths of strokes themselves
    strokeData.forEach(stroke => {
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      const dist = Math.sqrt(
        Math.pow(end.x - start.x, 2) +
        Math.pow(end.y - start.y, 2)
      );
      minLength += dist;
    });
    
    // Efficiency score
    return minLength / totalLength;
  },
  
  analyzeConnectionStrategy(strokeData) {
    if (!strokeData || strokeData.length === 0) return 0;
    
    // Analyze if connections follow a logical pattern
    const strokeOrder = [];
    
    strokeData.forEach((stroke, index) => {
      const startX = stroke.points[0].x;
      const startY = stroke.points[0].y;
      
      strokeOrder.push({
        index: index,
        startX: startX,
        startY: startY,
        quadrant: this.getQuadrant(startX, startY, strokeData)
      });
    });
    
    // Check for systematic patterns (e.g., clockwise, left-to-right)
    let patternScore = 0;
    
    // Check for left-to-right pattern
    let leftToRight = true;
    for (let i = 1; i < strokeOrder.length; i++) {
      if (strokeOrder[i].startX < strokeOrder[i-1].startX) {
        leftToRight = false;
        break;
      }
    }
    if (leftToRight) patternScore += 0.5;
    
    // Check for top-to-bottom pattern
    let topToBottom = true;
    for (let i = 1; i < strokeOrder.length; i++) {
      if (strokeOrder[i].startY < strokeOrder[i-1].startY) {
        topToBottom = false;
        break;
      }
    }
    if (topToBottom) patternScore += 0.5;
    
    return patternScore;
  },

  // Utility functions
  calculateAngleChange(points, index, window) {
    if (index < window || index >= points.length - window) return 0;
    
    const p1 = points[index - window];
    const p2 = points[index];
    const p3 = points[index + window];
    
    const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
    
    let angleDiff = Math.abs(angle2 - angle1);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    
    return angleDiff;
  },
  
  calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  },
  
  calculateLineDeviation(points) {
    if (points.length < 2) return 0;
    
    // Fit a line to the points
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    
    let totalDeviation = 0;
    points.forEach(point => {
      // Calculate distance from point to line
      const deviation = this.pointToLineDistance(point, startPoint, endPoint);
      totalDeviation += deviation;
    });
    
    return totalDeviation / points.length;
  },
  
  pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  },
  
  detectCorners(points) {
    const corners = [];
    const windowSize = 5;
    
    for (let i = windowSize; i < points.length - windowSize; i++) {
      const angle = this.calculateAngleChange(points, i, windowSize);
      
      if (angle > Math.PI / 4) { // 45 degrees threshold
        // Check if this is a local maximum
        let isLocalMax = true;
        for (let j = -2; j <= 2; j++) {
          if (j !== 0 && i + j >= windowSize && i + j < points.length - windowSize) {
            const neighborAngle = this.calculateAngleChange(points, i + j, windowSize);
            if (neighborAngle > angle) {
              isLocalMax = false;
              break;
            }
          }
        }
        
        if (isLocalMax) {
          corners.push({
            index: i,
            angle: angle,
            x: points[i].x,
            y: points[i].y
          });
        }
      }
    }
    
    return corners;
  },
  
  calculatePathLength(points, startIdx, endIdx) {
    let length = 0;
    const start = Math.max(0, startIdx);
    const end = Math.min(points.length - 1, endIdx);
    
    for (let i = start + 1; i <= end; i++) {
      const dist = Math.sqrt(
        Math.pow(points[i].x - points[i-1].x, 2) +
        Math.pow(points[i].y - points[i-1].y, 2)
      );
      length += dist;
    }
    
    return length;
  },
  
  calculateAngleBetweenPoints(p1, p2, p3) {
    const v1x = p1.x - p2.x;
    const v1y = p1.y - p2.y;
    const v2x = p3.x - p2.x;
    const v2y = p3.y - p2.y;
    
    const dot = v1x * v2x + v1y * v2y;
    const det = v1x * v2y - v1y * v2x;
    
    return Math.atan2(det, dot);
  },
  
  calculateCurvature(points, index, window) {
    if (index < window || index >= points.length - window) return 0;
    
    const p1 = points[index - window];
    const p2 = points[index];
    const p3 = points[index + window];
    
    // Calculate curvature using three points
    const k = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
    const norm = Math.sqrt(
      Math.pow((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y), 3)
    );
    
    return norm === 0 ? 0 : Math.abs(k / norm);
  },
  
  calculateStrokeSpeedVariation(strokeData) {
    let allSpeeds = [];
    
    strokeData.forEach(stroke => {
      for (let i = 1; i < stroke.points.length; i++) {
        const dist = Math.sqrt(
          Math.pow(stroke.points[i].x - stroke.points[i-1].x, 2) +
          Math.pow(stroke.points[i].y - stroke.points[i-1].y, 2)
        );
        const time = (stroke.points[i].timestamp - stroke.points[i-1].timestamp) || 1;
        allSpeeds.push(dist / time);
      }
    });
    
    if (allSpeeds.length === 0) return 0;
    
    const avgSpeed = allSpeeds.reduce((a, b) => a + b, 0) / allSpeeds.length;
    const variance = allSpeeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) / allSpeeds.length;
    
    return Math.sqrt(variance) / (avgSpeed + 1);
  },
  
  calculatePressureConsistency(strokeData) {
    let allPressures = [];
    
    strokeData.forEach(stroke => {
      stroke.points.forEach(point => {
        if (point.pressure !== undefined) {
          allPressures.push(point.pressure);
        }
      });
    });
    
    if (allPressures.length === 0) return 0.5;
    
    const avgPressure = allPressures.reduce((a, b) => a + b, 0) / allPressures.length;
    const variance = allPressures.reduce((sum, p) => sum + Math.pow(p - avgPressure, 2), 0) / allPressures.length;
    
    return 1 / (1 + Math.sqrt(variance));
  },
  
  calculateCurveComplexity(strokeData) {
    let totalComplexity = 0;
    let pointCount = 0;
    
    strokeData.forEach(stroke => {
      for (let i = 2; i < stroke.points.length; i++) {
        const angle = this.calculateAngleChange(stroke.points, i, 1);
        totalComplexity += angle;
        pointCount++;
      }
    });
    
    return pointCount > 0 ? totalComplexity / pointCount : 0;
  },
  
  calculateSpatialDistribution(strokeData) {
    if (strokeData.length === 0) return 0;
    
    // Calculate overall bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    strokeData.forEach(stroke => {
      stroke.points.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    const area = width * height;
    
    // Calculate coverage
    let coveredArea = 0;
    strokeData.forEach(stroke => {
      const bounds = this.calculateStrokeBounds(stroke);
      const strokeWidth = bounds.maxX - bounds.minX;
      const strokeHeight = bounds.maxY - bounds.minY;
      coveredArea += strokeWidth * strokeHeight;
    });
    
    return area > 0 ? coveredArea / area : 0;
  },
  
  calculateRoofScore(stroke) {
    // Check if stroke resembles a triangular roof
    const points = stroke.points;
    const corners = this.detectCorners(points);
    
    // Roof should have 2-3 corners (peak and edges)
    if (corners.length < 2 || corners.length > 3) return 0;
    
    // Check if highest point is in the middle
    const bounds = this.calculateStrokeBounds(stroke);
    const midX = (bounds.minX + bounds.maxX) / 2;
    const highestPoint = points.reduce((prev, curr) => 
      prev.y < curr.y ? prev : curr
    );
    
    const centeredness = 1 - Math.abs(highestPoint.x - midX) / (bounds.maxX - bounds.minX);
    
    return centeredness;
  },
  
  calculateWallScore(strokeData) {
    // Look for vertical lines
    let verticalScore = 0;
    let verticalCount = 0;
    
    strokeData.forEach(stroke => {
      const bounds = this.calculateStrokeBounds(stroke);
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      
      // Check if stroke is more vertical than horizontal
      if (height > width * 1.5) {
        verticalScore += 1;
        verticalCount++;
      }
    });
    
    // Should have at least 2 vertical strokes for walls
    return verticalCount >= 2 ? verticalScore / strokeData.length : 0;
  },
  
  getQuadrant(x, y, strokeData) {
    // Calculate center of all strokes
    let centerX = 0, centerY = 0;
    let pointCount = 0;
    
    strokeData.forEach(stroke => {
      stroke.points.forEach(point => {
        centerX += point.x;
        centerY += point.y;
        pointCount++;
      });
    });
    
    centerX /= pointCount;
    centerY /= pointCount;
    
    // Determine quadrant
    if (x >= centerX && y < centerY) return 1; // Top-right
    if (x < centerX && y < centerY) return 2;  // Top-left
    if (x < centerX && y >= centerY) return 3; // Bottom-left
    return 4; // Bottom-right
  }
};

module.exports = ComponentSpecificFeatures;