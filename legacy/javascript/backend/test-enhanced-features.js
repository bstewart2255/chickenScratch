/**
 * Test suite for enhanced biometric feature extraction
 * Tests all 4 phases of feature extraction with various edge cases
 */

require('dotenv').config();
const EnhancedFeatureExtractor = require('./enhanced-feature-extraction');

// Test data generators
function createTestStrokeWithPressure() {
  return {
    strokes: [
      {
        points: [
          { x: 100, y: 100, time: 0, pressure: 0.1 },
          { x: 110, y: 105, time: 10, pressure: 0.3 },
          { x: 120, y: 110, time: 20, pressure: 0.5 },
          { x: 130, y: 115, time: 30, pressure: 0.7 },
          { x: 140, y: 120, time: 40, pressure: 0.4 },
          { x: 150, y: 125, time: 50, pressure: 0.2 }
        ]
      },
      {
        points: [
          { x: 160, y: 130, time: 100, pressure: 0.2 },
          { x: 170, y: 135, time: 110, pressure: 0.6 },
          { x: 180, y: 140, time: 120, pressure: 0.8 },
          { x: 190, y: 145, time: 130, pressure: 0.3 }
        ]
      }
    ]
  };
}

function createTestStrokeWithoutPressure() {
  return {
    strokes: [
      {
        points: [
          { x: 100, y: 100, time: 0 },
          { x: 110, y: 105, time: 10 },
          { x: 120, y: 110, time: 20 },
          { x: 130, y: 115, time: 30 }
        ]
      }
    ]
  };
}

function createTestStrokeWithPauses() {
  return {
    strokes: [
      {
        points: [
          { x: 100, y: 100, time: 0 },
          { x: 110, y: 105, time: 10 },
          { x: 120, y: 110, time: 20 },
          { x: 130, y: 115, time: 30 }
        ]
      },
      {
        points: [
          { x: 200, y: 200, time: 200 }, // 170ms pause
          { x: 210, y: 205, time: 210 },
          { x: 220, y: 210, time: 220 }
        ]
      },
      {
        points: [
          { x: 300, y: 300, time: 500 }, // 280ms pause
          { x: 310, y: 305, time: 510 }
        ]
      }
    ]
  };
}

function createComplexTestStroke() {
  // Create a more complex signature with curves, direction changes, etc.
  const points = [];
  for (let i = 0; i < 50; i++) {
    points.push({
      x: 100 + i * 5 + Math.sin(i * 0.2) * 20,
      y: 100 + i * 3 + Math.cos(i * 0.3) * 15,
      time: i * 10,
      pressure: 0.3 + Math.sin(i * 0.1) * 0.2
    });
  }
  
  return {
    strokes: [
      { points: points.slice(0, 20) },
      { points: points.slice(20, 35) },
      { points: points.slice(35, 50) }
    ]
  };
}

function createBotLikeStroke() {
  // Create stroke data that looks bot-generated (too regular)
  return {
    strokes: [
      {
        points: Array.from({ length: 10 }, (_, i) => ({
          x: 100 + i * 10,
          y: 100,
          time: i * 100, // Perfectly regular timing
          pressure: 0.5 // Constant pressure
        }))
      },
      {
        points: Array.from({ length: 10 }, (_, i) => ({
          x: 100,
          y: 100 + i * 10,
          time: 1000 + i * 100, // Perfectly regular timing
          pressure: 0.5 // Constant pressure
        }))
      }
    ]
  };
}

// Test runner
async function runTests() {
  console.log('=== Enhanced Feature Extraction Test Suite ===\n');
  
  // Test 1: Pressure features with pressure data
  console.log('Test 1: Pressure features with pressure data');
  const strokeWithPressure = createTestStrokeWithPressure();
  const pressureFeatures = EnhancedFeatureExtractor.extractPressureFeatures(strokeWithPressure);
  console.log('Pressure features:', JSON.stringify(pressureFeatures, null, 2));
  console.assert(pressureFeatures.has_pressure_data === true, 'Should have pressure data');
  console.assert(pressureFeatures.avg_pressure > 0, 'Average pressure should be positive');
  console.assert(pressureFeatures.pressure_range > 0, 'Pressure range should be positive');
  console.log('✓ Passed\n');
  
  // Test 2: Pressure features without pressure data
  console.log('Test 2: Pressure features without pressure data (fallback)');
  const strokeWithoutPressure = createTestStrokeWithoutPressure();
  const noPressureFeatures = EnhancedFeatureExtractor.extractPressureFeatures(strokeWithoutPressure);
  console.log('Fallback pressure features:', JSON.stringify(noPressureFeatures, null, 2));
  console.assert(noPressureFeatures.has_pressure_data === false, 'Should not have pressure data');
  console.assert(noPressureFeatures.avg_pressure === 0.5, 'Should use default pressure');
  console.log('✓ Passed\n');
  
  // Test 3: Timing features with pauses
  console.log('Test 3: Timing features with pauses');
  const strokeWithPauses = createTestStrokeWithPauses();
  const timingFeatures = EnhancedFeatureExtractor.extractTimingFeatures(strokeWithPauses);
  console.log('Timing features:', JSON.stringify(timingFeatures, null, 2));
  console.assert(timingFeatures.pause_detection > 0, 'Should detect pauses');
  console.assert(timingFeatures.drawing_duration_total > 0, 'Should have total duration');
  console.log('✓ Passed\n');
  
  // Test 4: Geometric features
  console.log('Test 4: Geometric features');
  const complexStroke = createComplexTestStroke();
  const geometricFeatures = EnhancedFeatureExtractor.extractGeometricFeatures(complexStroke);
  console.log('Geometric features:', JSON.stringify(geometricFeatures, null, 2));
  console.assert(geometricFeatures.stroke_complexity > 1, 'Complex stroke should have complexity > 1');
  console.assert(geometricFeatures.direction_changes > 0, 'Should detect direction changes');
  console.log('✓ Passed\n');
  
  // Test 5: Security features - bot detection
  console.log('Test 5: Security features - bot detection');
  const botLikeStroke = createBotLikeStroke();
  const securityFeatures = EnhancedFeatureExtractor.extractSecurityFeatures(botLikeStroke);
  console.log('Security features:', JSON.stringify(securityFeatures, null, 2));
  console.assert(securityFeatures.timing_regularity_score < 0.1, 'Bot-like stroke should have low timing variation');
  console.assert(securityFeatures.behavioral_authenticity_score < 1, 'Bot-like stroke should have lower authenticity');
  console.log('✓ Passed\n');
  
  // Test 6: Complete feature extraction
  console.log('Test 6: Complete feature extraction (all phases)');
  const allFeatures = EnhancedFeatureExtractor.extractAllFeatures(complexStroke);
  console.log(`Total features extracted: ${Object.keys(allFeatures).length}`);
  console.log('Feature categories:');
  console.log('- Pressure features:', Object.keys(allFeatures).filter(k => k.includes('pressure')).length);
  console.log('- Timing features:', Object.keys(allFeatures).filter(k => 
    k.includes('timing') || k.includes('pause') || k.includes('duration') || k.includes('rhythm') || k.includes('tempo')).length);
  console.log('- Geometric features:', Object.keys(allFeatures).filter(k => 
    k.includes('complexity') || k.includes('tremor') || k.includes('smooth') || k.includes('direction') || 
    k.includes('curvature') || k.includes('spatial') || k.includes('overlap')).length);
  console.log('- Security features:', Object.keys(allFeatures).filter(k => 
    k.includes('anomaly') || k.includes('regularity') || k.includes('consistency') || k.includes('authenticity')).length);
  console.assert(Object.keys(allFeatures).length >= 25, 'Should extract at least 25 features');
  console.log('✓ Passed\n');
  
  // Test 7: Edge cases
  console.log('Test 7: Edge case handling');
  
  // Empty data
  console.log('- Testing empty data...');
  const emptyFeatures = EnhancedFeatureExtractor.extractAllFeatures([]);
  console.assert(emptyFeatures._extraction_error !== true, 'Should handle empty data gracefully');
  
  // Invalid data
  console.log('- Testing invalid data...');
  const invalidFeatures = EnhancedFeatureExtractor.extractAllFeatures(null);
  console.assert(invalidFeatures._extraction_error !== true, 'Should handle null data gracefully');
  
  // Malformed stroke
  console.log('- Testing malformed stroke...');
  const malformedStroke = { strokes: [{ points: null }] };
  const malformedFeatures = EnhancedFeatureExtractor.extractAllFeatures(malformedStroke);
  console.assert(malformedFeatures._extraction_error !== true, 'Should handle malformed data gracefully');
  
  console.log('✓ All edge cases handled\n');
  
  // Test 8: Performance test
  console.log('Test 8: Performance test');
  const startTime = Date.now();
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    EnhancedFeatureExtractor.extractAllFeatures(complexStroke);
  }
  
  const totalTime = Date.now() - startTime;
  const avgTime = totalTime / iterations;
  console.log(`Average extraction time: ${avgTime.toFixed(2)}ms`);
  console.assert(avgTime < 100, 'Average extraction should be under 100ms');
  console.log('✓ Performance acceptable\n');
  
  // Test 9: Data format variations
  console.log('Test 9: Data format variations');
  
  // Format 1: Direct array
  const format1 = [
    { points: [{ x: 100, y: 100, time: 0 }, { x: 110, y: 110, time: 10 }] }
  ];
  const features1 = EnhancedFeatureExtractor.extractPressureFeatures(format1);
  console.assert(features1.has_pressure_data === false, 'Should handle direct array format');
  
  // Format 2: Wrapped in data property
  const format2 = {
    data: [
      { points: [{ x: 100, y: 100, time: 0 }, { x: 110, y: 110, time: 10 }] }
    ]
  };
  const features2 = EnhancedFeatureExtractor.extractPressureFeatures(format2);
  console.assert(features2.has_pressure_data === false, 'Should handle data property format');
  
  // Format 3: Wrapped in raw property
  const format3 = {
    raw: [
      { points: [{ x: 100, y: 100, time: 0 }, { x: 110, y: 110, time: 10 }] }
    ]
  };
  const features3 = EnhancedFeatureExtractor.extractPressureFeatures(format3);
  console.assert(features3.has_pressure_data === false, 'Should handle raw property format');
  
  console.log('✓ All data formats handled\n');
  
  console.log('=== All tests passed! ===');
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});