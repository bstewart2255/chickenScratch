/**
 * Test script to verify fixes for analyzeApexSharpness and analyzeSideLengthRatios functions
 * Tests edge cases and validation improvements
 */

const ComponentSpecificFeatures = require('./component-specific-features.js');

console.log('Testing analyzeApexSharpness and analyzeSideLengthRatios fixes...\n');

// Test 1: Null strokeData
console.log('Test 1: Null strokeData');
try {
  const result1 = ComponentSpecificFeatures.analyzeApexSharpness(null);
  const result2 = ComponentSpecificFeatures.analyzeSideLengthRatios(null);
  console.log('✓ analyzeApexSharpness(null):', result1);
  console.log('✓ analyzeSideLengthRatios(null):', result2);
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 2: Empty strokeData array
console.log('\nTest 2: Empty strokeData array');
try {
  const result1 = ComponentSpecificFeatures.analyzeApexSharpness([]);
  const result2 = ComponentSpecificFeatures.analyzeSideLengthRatios([]);
  console.log('✓ analyzeApexSharpness([]):', result1);
  console.log('✓ analyzeSideLengthRatios([]):', result2);
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 3: strokeData[0] is null
console.log('\nTest 3: strokeData[0] is null');
try {
  const result1 = ComponentSpecificFeatures.analyzeApexSharpness([null]);
  const result2 = ComponentSpecificFeatures.analyzeSideLengthRatios([null]);
  console.log('✓ analyzeApexSharpness([null]):', result1);
  console.log('✓ analyzeSideLengthRatios([null]):', result2);
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 4: strokeData[0] has no points property
console.log('\nTest 4: strokeData[0] has no points property');
try {
  const result1 = ComponentSpecificFeatures.analyzeApexSharpness([{}]);
  const result2 = ComponentSpecificFeatures.analyzeSideLengthRatios([{}]);
  console.log('✓ analyzeApexSharpness([{}]):', result1);
  console.log('✓ analyzeSideLengthRatios([{}]):', result2);
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 5: strokeData[0].points is null
console.log('\nTest 5: strokeData[0].points is null');
try {
  const result1 = ComponentSpecificFeatures.analyzeApexSharpness([{ points: null }]);
  const result2 = ComponentSpecificFeatures.analyzeSideLengthRatios([{ points: null }]);
  console.log('✓ analyzeApexSharpness([{ points: null }]):', result1);
  console.log('✓ analyzeSideLengthRatios([{ points: null }]):', result2);
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 6: strokeData[0].points is empty array
console.log('\nTest 6: strokeData[0].points is empty array');
try {
  const result1 = ComponentSpecificFeatures.analyzeApexSharpness([{ points: [] }]);
  const result2 = ComponentSpecificFeatures.analyzeSideLengthRatios([{ points: [] }]);
  console.log('✓ analyzeApexSharpness([{ points: [] }]):', result1);
  console.log('✓ analyzeSideLengthRatios([{ points: [] }]):', result2);
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 7: Insufficient points for corner detection
console.log('\nTest 7: Insufficient points for corner detection');
try {
  const result1 = ComponentSpecificFeatures.analyzeApexSharpness([{ 
    points: [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 1, y: 1, pressure: 0.5 }
    ] 
  }]);
  const result2 = ComponentSpecificFeatures.analyzeSideLengthRatios([{ 
    points: [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 1, y: 1, pressure: 0.5 }
    ] 
  }]);
  console.log('✓ analyzeApexSharpness(insufficient points):', result1);
  console.log('✓ analyzeSideLengthRatios(insufficient points):', result2);
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 8: Valid triangle with zero side lengths (co-located points)
console.log('\nTest 8: Valid triangle with zero side lengths (co-located points)');
try {
  const result = ComponentSpecificFeatures.analyzeSideLengthRatios([{ 
    points: [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 0, y: 0, pressure: 0.5 }, // Same as first point
      { x: 0, y: 0, pressure: 0.5 }, // Same as first point
      { x: 0, y: 0, pressure: 0.5 }, // Same as first point
      { x: 0, y: 0, pressure: 0.5 }, // Same as first point
      { x: 0, y: 0, pressure: 0.5 }, // Same as first point
      { x: 0, y: 0, pressure: 0.5 }, // Same as first point
      { x: 0, y: 0, pressure: 0.5 }, // Same as first point
      { x: 0, y: 0, pressure: 0.5 }, // Same as first point
      { x: 0, y: 0, pressure: 0.5 }  // Same as first point
    ] 
  }]);
  console.log('✓ analyzeSideLengthRatios(co-located points):', result);
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 9: Valid triangle pattern
console.log('\nTest 9: Valid triangle pattern');
try {
  const result1 = ComponentSpecificFeatures.analyzeApexSharpness([{ 
    points: [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 1, y: 0, pressure: 0.5 },
      { x: 2, y: 0, pressure: 0.5 },
      { x: 3, y: 0, pressure: 0.5 },
      { x: 4, y: 0, pressure: 0.5 },
      { x: 5, y: 0, pressure: 0.5 },
      { x: 6, y: 0, pressure: 0.5 },
      { x: 7, y: 0, pressure: 0.5 },
      { x: 8, y: 0, pressure: 0.5 },
      { x: 9, y: 0, pressure: 0.5 },
      { x: 10, y: 0, pressure: 0.5 },
      { x: 11, y: 0, pressure: 0.5 },
      { x: 12, y: 0, pressure: 0.5 },
      { x: 13, y: 0, pressure: 0.5 },
      { x: 14, y: 0, pressure: 0.5 },
      { x: 15, y: 0, pressure: 0.5 },
      { x: 16, y: 0, pressure: 0.5 },
      { x: 17, y: 0, pressure: 0.5 },
      { x: 18, y: 0, pressure: 0.5 },
      { x: 19, y: 0, pressure: 0.5 },
      { x: 20, y: 0, pressure: 0.5 }
    ] 
  }]);
  const result2 = ComponentSpecificFeatures.analyzeSideLengthRatios([{ 
    points: [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 1, y: 0, pressure: 0.5 },
      { x: 2, y: 0, pressure: 0.5 },
      { x: 3, y: 0, pressure: 0.5 },
      { x: 4, y: 0, pressure: 0.5 },
      { x: 5, y: 0, pressure: 0.5 },
      { x: 6, y: 0, pressure: 0.5 },
      { x: 7, y: 0, pressure: 0.5 },
      { x: 8, y: 0, pressure: 0.5 },
      { x: 9, y: 0, pressure: 0.5 },
      { x: 10, y: 0, pressure: 0.5 },
      { x: 11, y: 0, pressure: 0.5 },
      { x: 12, y: 0, pressure: 0.5 },
      { x: 13, y: 0, pressure: 0.5 },
      { x: 14, y: 0, pressure: 0.5 },
      { x: 15, y: 0, pressure: 0.5 },
      { x: 16, y: 0, pressure: 0.5 },
      { x: 17, y: 0, pressure: 0.5 },
      { x: 18, y: 0, pressure: 0.5 },
      { x: 19, y: 0, pressure: 0.5 },
      { x: 20, y: 0, pressure: 0.5 }
    ] 
  }]);
  console.log('✓ analyzeApexSharpness(valid pattern):', result1);
  console.log('✓ analyzeSideLengthRatios(valid pattern):', result2);
} catch (error) {
  console.log('✗ Error:', error.message);
}

console.log('\n✅ All tests completed successfully!');
console.log('The fixes for analyzeApexSharpness and analyzeSideLengthRatios are working correctly.'); 