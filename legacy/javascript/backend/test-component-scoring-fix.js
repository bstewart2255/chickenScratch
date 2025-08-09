/**
 * Test script to verify fixes for component-specific features
 * Tests the bug fixes in analyzeCurveSmoothnessPattern and analyzeRadialDeviation functions
 */

const ComponentSpecificFeatures = require('./component-specific-features.js');

console.log('Testing Component-Specific Features Bug Fixes...\n');

// Test 1: analyzeCurveSmoothnessPattern with insufficient points
console.log('Test 1: analyzeCurveSmoothnessPattern with insufficient points');
try {
  const result1 = ComponentSpecificFeatures.analyzeCurveSmoothnessPattern([
    { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } // Only 2 points
  ]);
  console.log('✓ Result:', result1, '(should be 0)');
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 2: analyzeCurveSmoothnessPattern with null stroke data
console.log('\nTest 2: analyzeCurveSmoothnessPattern with null stroke data');
try {
  const result2 = ComponentSpecificFeatures.analyzeCurveSmoothnessPattern(null);
  console.log('✓ Result:', result2, '(should be 0)');
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 3: analyzeCurveSmoothnessPattern with stroke without points
console.log('\nTest 3: analyzeCurveSmoothnessPattern with stroke without points');
try {
  const result3 = ComponentSpecificFeatures.analyzeCurveSmoothnessPattern([
    { points: null }
  ]);
  console.log('✓ Result:', result3, '(should be 0)');
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 4: analyzeRadialDeviation with co-located points
console.log('\nTest 4: analyzeRadialDeviation with co-located points');
try {
  const result4 = ComponentSpecificFeatures.analyzeRadialDeviation([
    { 
      points: [
        { x: 10, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 10 }
      ]
    }
  ]);
  console.log('✓ Result:', result4, '(should be 0)');
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 5: analyzeRadialDeviation with null stroke data
console.log('\nTest 5: analyzeRadialDeviation with null stroke data');
try {
  const result5 = ComponentSpecificFeatures.analyzeRadialDeviation(null);
  console.log('✓ Result:', result5, '(should be 0)');
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 6: analyzeRadialDeviation with stroke without points
console.log('\nTest 6: analyzeRadialDeviation with stroke without points');
try {
  const result6 = ComponentSpecificFeatures.analyzeRadialDeviation([
    { points: [] }
  ]);
  console.log('✓ Result:', result6, '(should be 0)');
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 7: Valid curve smoothness pattern
console.log('\nTest 7: Valid curve smoothness pattern');
try {
  const result7 = ComponentSpecificFeatures.analyzeCurveSmoothnessPattern([
    { 
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
        { x: 3, y: 1 }
      ]
    }
  ]);
  console.log('✓ Result:', result7, '(should be a valid number)');
  console.log('  Type:', typeof result7, 'Is NaN:', isNaN(result7), 'Is Finite:', isFinite(result7));
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 8: Valid radial deviation
console.log('\nTest 8: Valid radial deviation');
try {
  const result8 = ComponentSpecificFeatures.analyzeRadialDeviation([
    { 
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
        { x: 1, y: -1 }
      ]
    }
  ]);
  console.log('✓ Result:', result8, '(should be a valid number)');
  console.log('  Type:', typeof result8, 'Is NaN:', isNaN(result8), 'Is Finite:', isFinite(result8));
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 9: Edge case - single point
console.log('\nTest 9: Edge case - single point');
try {
  const result9 = ComponentSpecificFeatures.analyzeRadialDeviation([
    { points: [{ x: 5, y: 5 }] }
  ]);
  console.log('✓ Result:', result9, '(should be 0)');
} catch (error) {
  console.log('✗ Error:', error.message);
}

console.log('\n=== Test Summary ===');
console.log('All tests completed. Check for any errors above.');
console.log('The fixes should prevent:');
console.log('- Division by zero errors');
console.log('- NaN or Infinity results');
console.log('- Crashes from null/undefined data'); 