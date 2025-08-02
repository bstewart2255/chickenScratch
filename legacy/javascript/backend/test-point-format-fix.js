/**
 * Test script to verify the point format fix
 * Tests both array format [x, y] and object format {x: number, y: number}
 */

const EnhancedFeatureExtractor = require('./enhanced-feature-extraction.js');

// Test data with array format points
const strokeDataWithArrays = {
  strokes: [
    {
      points: [
        [100, 200],
        [150, 250],
        [200, 300],
        [250, 350]
      ]
    },
    {
      points: [
        [300, 400],
        [350, 450],
        [400, 500]
      ]
    }
  ]
};

// Test data with object format points
const strokeDataWithObjects = {
  strokes: [
    {
      points: [
        { x: 100, y: 200, time: 1000, pressure: 0.5 },
        { x: 150, y: 250, time: 1100, pressure: 0.6 },
        { x: 200, y: 300, time: 1200, pressure: 0.7 },
        { x: 250, y: 350, time: 1300, pressure: 0.8 }
      ]
    },
    {
      points: [
        { x: 300, y: 400, time: 1400, pressure: 0.9 },
        { x: 350, y: 450, time: 1500, pressure: 1.0 },
        { x: 400, y: 500, time: 1600, pressure: 0.8 }
      ]
    }
  ]
};

// Test data with mixed format points
const strokeDataWithMixed = {
  strokes: [
    {
      points: [
        [100, 200],
        { x: 150, y: 250 },
        [200, 300],
        { x: 250, y: 350 }
      ]
    }
  ]
};

// Test data with invalid points
const strokeDataWithInvalid = {
  strokes: [
    {
      points: [
        [100, 200],
        { x: 150, y: 250 },
        [300], // Invalid: missing y coordinate
        { x: 250 }, // Invalid: missing y coordinate
        "invalid", // Invalid: not a point
        null // Invalid: null point
      ]
    }
  ]
};

function runTest(testName, strokeData, expectedValid) {
  console.log(`\n=== Testing ${testName} ===`);
  
  try {
    // Test validation
    const isValid = EnhancedFeatureExtractor.validateStrokeData(strokeData);
    console.log(`Validation result: ${isValid} (expected: ${expectedValid})`);
    
    if (isValid !== expectedValid) {
      console.error(`❌ FAIL: Validation mismatch for ${testName}`);
      return false;
    }
    
    // Test extraction
    const strokes = EnhancedFeatureExtractor.extractStrokes(strokeData);
    console.log(`Extracted ${strokes.length} strokes`);
    
    // Check that all points are normalized to object format
    let allPointsNormalized = true;
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      console.log(`Stroke ${i}: ${stroke.points.length} points`);
      
      for (let j = 0; j < stroke.points.length; j++) {
        const point = stroke.points[j];
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
          console.error(`❌ Point ${j} in stroke ${i} not normalized:`, point);
          allPointsNormalized = false;
        } else {
          console.log(`  Point ${j}: x=${point.x}, y=${point.y}`);
        }
      }
    }
    
    if (expectedValid && !allPointsNormalized) {
      console.error(`❌ FAIL: Points not properly normalized for ${testName}`);
      return false;
    }
    
    // Test feature extraction if data is valid
    if (expectedValid) {
      const features = EnhancedFeatureExtractor.extractAllFeatures(strokeData);
      console.log(`Feature extraction successful: ${Object.keys(features).length} features`);
      
      // Check that no features were excluded due to validation errors
      if (features._extraction_error) {
        console.error(`❌ FAIL: Feature extraction failed for ${testName}`);
        return false;
      }
    }
    
    console.log(`✅ PASS: ${testName}`);
    return true;
    
  } catch (error) {
    console.error(`❌ FAIL: ${testName} threw error:`, error.message);
    return false;
  }
}

function runAllTests() {
  console.log('Testing Point Format Fix');
  console.log('========================');
  
  const tests = [
    { name: 'Array Format Points', data: strokeDataWithArrays, expected: true },
    { name: 'Object Format Points', data: strokeDataWithObjects, expected: true },
    { name: 'Mixed Format Points', data: strokeDataWithMixed, expected: true },
    { name: 'Invalid Points', data: strokeDataWithInvalid, expected: false }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    if (runTest(test.name, test.data, test.expected)) {
      passedTests++;
    }
  }
  
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Point format fix is working correctly.');
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
  }
  
  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests }; 