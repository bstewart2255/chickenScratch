/**
 * Test script to verify the fix works with real-world stroke data formats
 */

const EnhancedFeatureExtractor = require('./enhanced-feature-extraction.js');

// Real-world stroke data formats that might be encountered
const realWorldTestCases = [
  {
    name: 'Signature Pad Format',
    data: {
      strokes: [
        {
          points: [
            { x: 100, y: 200, time: 1000, pressure: 0.5 },
            { x: 150, y: 250, time: 1100, pressure: 0.6 },
            { x: 200, y: 300, time: 1200, pressure: 0.7 }
          ]
        }
      ]
    }
  },
  {
    name: 'Canvas Drawing Format',
    data: [
      [
        [100, 200],
        [150, 250],
        [200, 300]
      ],
      [
        [300, 400],
        [350, 450]
      ]
    ]
  },
  {
    name: 'Mixed Component Format',
    data: {
      strokes: [
        {
          data: [
            { x: 100, y: 200, time: 1000 },
            { x: 150, y: 250, time: 1100 }
          ]
        },
        {
          points: [
            [300, 400],
            [350, 450]
          ]
        }
      ]
    }
  },
  {
    name: 'Raw Data Format',
    data: {
      raw: [
        { x: 100, y: 200 },
        { x: 150, y: 250 },
        { x: 200, y: 300 }
      ]
    }
  }
];

function testRealWorldData() {
  console.log('Testing Real-World Data Formats');
  console.log('================================');
  
  let successCount = 0;
  let totalCount = realWorldTestCases.length;
  
  for (const testCase of realWorldTestCases) {
    console.log(`\n--- Testing ${testCase.name} ---`);
    
    try {
      // Test validation
      const isValid = EnhancedFeatureExtractor.validateStrokeData(testCase.data);
      console.log(`Validation: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
      
      if (!isValid) {
        console.log('Skipping feature extraction due to validation failure');
        continue;
      }
      
      // Test extraction
      const strokes = EnhancedFeatureExtractor.extractStrokes(testCase.data);
      console.log(`Extracted ${strokes.length} strokes`);
      
      // Test feature extraction
      const features = EnhancedFeatureExtractor.extractAllFeatures(testCase.data);
      const featureCount = Object.keys(features).filter(k => !k.startsWith('_')).length;
      console.log(`Extracted ${featureCount} features`);
      
      if (features._extraction_error) {
        console.log('❌ Feature extraction failed');
      } else {
        console.log('✅ Feature extraction successful');
        successCount++;
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Successful: ${successCount}/${totalCount} test cases`);
  
  return successCount === totalCount;
}

// Run the test
if (require.main === module) {
  testRealWorldData();
}

module.exports = { testRealWorldData }; 