/**
 * Test script to verify ComponentSpecificFeatures fix
 * Tests that the module works with stroke data without pre-calculated bounds
 */

const ComponentSpecificFeatures = require('../../backend/component-specific-features');

// Test data - stroke data without bounds property
const testStrokeData = [
  {
    points: [
      { x: 100, y: 100, pressure: 0.5, timestamp: 0 },
      { x: 150, y: 120, pressure: 0.6, timestamp: 50 },
      { x: 200, y: 130, pressure: 0.7, timestamp: 100 },
      { x: 180, y: 110, pressure: 0.6, timestamp: 150 },
      { x: 120, y: 90, pressure: 0.5, timestamp: 200 }
    ],
    duration: 200
  },
  {
    points: [
      { x: 120, y: 90, pressure: 0.5, timestamp: 200 },
      { x: 140, y: 80, pressure: 0.6, timestamp: 250 },
      { x: 160, y: 85, pressure: 0.7, timestamp: 300 }
    ],
    duration: 100
  }
];

// Test data with bounds property (for comparison)
const testStrokeDataWithBounds = [
  {
    points: [
      { x: 100, y: 100, pressure: 0.5, timestamp: 0 },
      { x: 150, y: 120, pressure: 0.6, timestamp: 50 },
      { x: 200, y: 130, pressure: 0.7, timestamp: 100 },
      { x: 180, y: 110, pressure: 0.6, timestamp: 150 },
      { x: 120, y: 90, pressure: 0.5, timestamp: 200 }
    ],
    bounds: { minX: 100, maxX: 200, minY: 90, maxY: 130 },
    duration: 200
  }
];

function runTests() {
  console.log('Testing ComponentSpecificFeatures bounds fix...\n');
  
  let testCount = 0;
  let passCount = 0;
  
  // Test 1: calculateStrokeBounds with stroke data without bounds
  testCount++;
  try {
    const bounds = ComponentSpecificFeatures.calculateStrokeBounds(testStrokeData[0]);
    console.log('Test 1: calculateStrokeBounds without bounds property');
    console.log('Expected bounds: { minX: 100, maxX: 200, minY: 90, maxY: 130 }');
    console.log('Actual bounds:', bounds);
    
    if (bounds.minX === 100 && bounds.maxX === 200 && bounds.minY === 90 && bounds.maxY === 130) {
      console.log('✅ PASS\n');
      passCount++;
    } else {
      console.log('❌ FAIL\n');
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error.message, '\n');
  }
  
  // Test 2: calculateStrokeBounds with stroke data that has bounds
  testCount++;
  try {
    const bounds = ComponentSpecificFeatures.calculateStrokeBounds(testStrokeDataWithBounds[0]);
    console.log('Test 2: calculateStrokeBounds with existing bounds property');
    console.log('Expected bounds: { minX: 100, maxX: 200, minY: 90, maxY: 130 }');
    console.log('Actual bounds:', bounds);
    
    if (bounds.minX === 100 && bounds.maxX === 200 && bounds.minY === 90 && bounds.maxY === 130) {
      console.log('✅ PASS\n');
      passCount++;
    } else {
      console.log('❌ FAIL\n');
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error.message, '\n');
  }
  
  // Test 3: calculateStrokeDataBounds with multiple strokes
  testCount++;
  try {
    const bounds = ComponentSpecificFeatures.calculateStrokeDataBounds(testStrokeData);
    console.log('Test 3: calculateStrokeDataBounds with multiple strokes');
    console.log('Expected bounds: { minX: 100, maxX: 200, minY: 80, maxY: 130 }');
    console.log('Actual bounds:', bounds);
    
    if (bounds.minX === 100 && bounds.maxX === 200 && bounds.minY === 80 && bounds.maxY === 130) {
      console.log('✅ PASS\n');
      passCount++;
    } else {
      console.log('❌ FAIL\n');
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error.message, '\n');
  }
  
  // Test 4: analyzeCircleStartPosition (should not throw error)
  testCount++;
  try {
    const result = ComponentSpecificFeatures.analyzeCircleStartPosition(testStrokeData);
    console.log('Test 4: analyzeCircleStartPosition without bounds');
    console.log('Result:', result);
    console.log('✅ PASS - No error thrown\n');
    passCount++;
  } catch (error) {
    console.log('❌ FAIL - Error:', error.message, '\n');
  }
  
  // Test 5: analyzeStrokeOrder (should not throw error)
  testCount++;
  try {
    const result = ComponentSpecificFeatures.analyzeStrokeOrder(testStrokeData);
    console.log('Test 5: analyzeStrokeOrder without bounds');
    console.log('Result:', result);
    console.log('✅ PASS - No error thrown\n');
    passCount++;
  } catch (error) {
    console.log('❌ FAIL - Error:', error.message, '\n');
  }
  
  // Test 6: analyzeFacialSymmetry (should not throw error)
  testCount++;
  try {
    const result = ComponentSpecificFeatures.analyzeFacialSymmetry(testStrokeData);
    console.log('Test 6: analyzeFacialSymmetry without bounds');
    console.log('Result:', result);
    console.log('✅ PASS - No error thrown\n');
    passCount++;
  } catch (error) {
    console.log('❌ FAIL - Error:', error.message, '\n');
  }
  
  // Test 7: Edge case - empty stroke data
  testCount++;
  try {
    const bounds = ComponentSpecificFeatures.calculateStrokeBounds({});
    console.log('Test 7: calculateStrokeBounds with empty stroke');
    console.log('Expected bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }');
    console.log('Actual bounds:', bounds);
    
    if (bounds.minX === 0 && bounds.maxX === 0 && bounds.minY === 0 && bounds.maxY === 0) {
      console.log('✅ PASS\n');
      passCount++;
    } else {
      console.log('❌ FAIL\n');
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error.message, '\n');
  }
  
  // Test 8: Edge case - stroke with no points
  testCount++;
  try {
    const bounds = ComponentSpecificFeatures.calculateStrokeBounds({ points: [] });
    console.log('Test 8: calculateStrokeBounds with no points');
    console.log('Expected bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }');
    console.log('Actual bounds:', bounds);
    
    if (bounds.minX === 0 && bounds.maxX === 0 && bounds.minY === 0 && bounds.maxY === 0) {
      console.log('✅ PASS\n');
      passCount++;
    } else {
      console.log('❌ FAIL\n');
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error.message, '\n');
  }
  
  // Summary
  console.log('='.repeat(50));
  console.log(`Test Summary: ${passCount}/${testCount} tests passed`);
  
  if (passCount === testCount) {
    console.log('🎉 All tests passed! The bounds fix is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
  }
  
  return passCount === testCount;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests }; # AI Reorganization Complete
