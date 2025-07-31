/**
 * Test script to verify the drawing format fix
 * Tests that the enhanced features extraction works correctly for face and star drawings
 */

const ComponentSpecificFeatures = require('./component-specific-features');

console.log('Testing drawing format fix...\n');

// Test data that simulates the format returned by extractStrokeDataFromSignaturePad
const testFaceData = [
  [{ x: 100, y: 100 }, { x: 120, y: 110 }, { x: 140, y: 100 }], // eyes
  [{ x: 130, y: 130 }, { x: 135, y: 140 }, { x: 140, y: 130 }], // nose
  [{ x: 110, y: 160 }, { x: 130, y: 170 }, { x: 150, y: 160 }]  // mouth
];

const testStarData = [
  [{ x: 100, y: 50 }, { x: 120, y: 80 }, { x: 150, y: 50 }, { x: 120, y: 120 }, { x: 90, y: 50 }]
];

// Transform to the format expected by ComponentSpecificFeatures
const transformedFaceData = testFaceData.map(points => ({ points }));
const transformedStarData = testStarData.map(points => ({ points }));

console.log('1. Testing face drawing analysis...');
try {
  const faceSymmetry = ComponentSpecificFeatures.analyzeFacialSymmetry(transformedFaceData);
  const facePlacement = ComponentSpecificFeatures.analyzeFacialFeaturePlacement(transformedFaceData);
  
  console.log('✅ Face symmetry score:', faceSymmetry);
  console.log('✅ Face placement score:', facePlacement);
  console.log('✅ Face analysis completed successfully\n');
} catch (error) {
  console.error('❌ Face analysis failed:', error.message);
  console.error('Stack:', error.stack);
}

console.log('2. Testing star drawing analysis...');
try {
  const starSymmetry = ComponentSpecificFeatures.analyzeStarPointSymmetry(transformedStarData);
  const starAngles = ComponentSpecificFeatures.analyzeStarAngleRegularity(transformedStarData);
  
  console.log('✅ Star symmetry score:', starSymmetry);
  console.log('✅ Star angle regularity score:', starAngles);
  console.log('✅ Star analysis completed successfully\n');
} catch (error) {
  console.error('❌ Star analysis failed:', error.message);
  console.error('Stack:', error.stack);
}

console.log('3. Testing with null/undefined data...');
try {
  const nullResult = ComponentSpecificFeatures.analyzeFacialSymmetry(null);
  const undefinedResult = ComponentSpecificFeatures.analyzeFacialSymmetry(undefined);
  const emptyResult = ComponentSpecificFeatures.analyzeFacialSymmetry([]);
  
  console.log('✅ Null data handling:', nullResult);
  console.log('✅ Undefined data handling:', undefinedResult);
  console.log('✅ Empty array handling:', emptyResult);
  console.log('✅ Null/undefined handling completed successfully\n');
} catch (error) {
  console.error('❌ Null/undefined handling failed:', error.message);
}

console.log('4. Testing with malformed data...');
try {
  const malformedData = [
    { points: null },
    { points: [] },
    { points: [{ x: 'invalid', y: 'invalid' }] },
    { invalidProperty: 'test' }
  ];
  
  const malformedResult = ComponentSpecificFeatures.analyzeFacialSymmetry(malformedData);
  console.log('✅ Malformed data handling:', malformedResult);
  console.log('✅ Malformed data handling completed successfully\n');
} catch (error) {
  console.error('❌ Malformed data handling failed:', error.message);
}

console.log('🎉 All tests completed! The drawing format fix should resolve the "Cannot read properties of undefined (reading \'length\')" error.'); 