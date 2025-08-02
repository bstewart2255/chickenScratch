/**
 * Integration test for enhanced features with server
 * Tests that the enhanced features are properly integrated into the server's feature calculation
 */

require('dotenv').config();

// Mock the enhanced feature extractor to verify it's being called
const originalModule = require('./enhanced-feature-extraction');
let extractAllFeaturesCalled = false;

// Override the module with our mock
require.cache[require.resolve('./enhanced-feature-extraction')].exports = {
  ...originalModule,
  extractAllFeatures: function(strokeData) {
    extractAllFeaturesCalled = true;
    return originalModule.extractAllFeatures(strokeData);
  }
};

// Now require server.js which will use our mocked module
const { calculateMLFeatures } = require('./server');

// Test data
const testSignatureData = {
  raw: [
    {
      points: [
        { x: 100, y: 100, time: 0, pressure: 0.3 },
        { x: 110, y: 105, time: 10, pressure: 0.5 },
        { x: 120, y: 110, time: 20, pressure: 0.7 },
        { x: 130, y: 115, time: 30, pressure: 0.4 }
      ]
    },
    {
      points: [
        { x: 150, y: 120, time: 100, pressure: 0.2 },
        { x: 160, y: 125, time: 110, pressure: 0.6 },
        { x: 170, y: 130, time: 120, pressure: 0.8 }
      ]
    }
  ],
  metrics: {
    basic: {
      stroke_count: 2,
      total_points: 7,
      duration_ms: 120,
      total_distance: 94.87,
      avg_speed: 0.79,
      bounding_box: {
        width: 70,
        height: 30,
        center_x: 135,
        center_y: 115
      }
    }
  }
};

async function runIntegrationTest() {
  console.log('=== Enhanced Features Integration Test ===\n');
  
  // Test 1: Check that enhanced features are extracted when enabled
  console.log('Test 1: Enhanced features extraction with ENABLE_ENHANCED_FEATURES=true');
  process.env.ENABLE_ENHANCED_FEATURES = 'true';
  extractAllFeaturesCalled = false;
  
  const featuresWithEnhanced = calculateMLFeatures(testSignatureData);
  
  console.assert(extractAllFeaturesCalled === true, 'Enhanced feature extractor should be called');
  console.assert(featuresWithEnhanced._enhanced_features_enabled === true, 'Enhanced features should be enabled');
  console.assert(featuresWithEnhanced.has_pressure_data === true, 'Should have pressure data');
  console.assert(featuresWithEnhanced.avg_pressure > 0, 'Should have calculated average pressure');
  console.assert(featuresWithEnhanced.pause_detection !== undefined, 'Should have timing features');
  console.assert(featuresWithEnhanced.stroke_complexity !== undefined, 'Should have geometric features');
  console.assert(featuresWithEnhanced.behavioral_authenticity_score !== undefined, 'Should have security features');
  
  // Count total features
  const totalFeatures = Object.keys(featuresWithEnhanced).filter(k => !k.startsWith('_')).length;
  console.log(`Total features extracted: ${totalFeatures}`);
  console.assert(totalFeatures >= 44, 'Should have at least 44 features (19 basic + 25+ enhanced)');
  console.log('✓ Passed\n');
  
  // Test 2: Check that enhanced features can be disabled
  console.log('Test 2: Enhanced features disabled with ENABLE_ENHANCED_FEATURES=false');
  process.env.ENABLE_ENHANCED_FEATURES = 'false';
  extractAllFeaturesCalled = false;
  
  // Need to clear the require cache and reload server.js to pick up the env change
  delete require.cache[require.resolve('./server')];
  const { calculateMLFeatures: calculateMLFeaturesDisabled } = require('./server');
  
  const featuresWithoutEnhanced = calculateMLFeaturesDisabled(testSignatureData);
  
  console.assert(extractAllFeaturesCalled === false, 'Enhanced feature extractor should not be called');
  console.assert(featuresWithoutEnhanced._enhanced_features_enabled === undefined, 'Enhanced features should not be enabled');
  console.assert(featuresWithoutEnhanced.has_pressure_data === undefined, 'Should not have pressure features');
  
  const basicFeatureCount = Object.keys(featuresWithoutEnhanced).filter(k => !k.startsWith('_')).length;
  console.log(`Total features without enhanced: ${basicFeatureCount}`);
  console.assert(basicFeatureCount < 25, 'Should only have basic features');
  console.log('✓ Passed\n');
  
  // Test 3: Test with missing stroke data
  console.log('Test 3: Graceful handling of missing stroke data');
  process.env.ENABLE_ENHANCED_FEATURES = 'true';
  delete require.cache[require.resolve('./server')];
  const { calculateMLFeatures: calculateMLFeaturesReloaded } = require('./server');
  
  const noStrokeData = {
    metrics: {
      stroke_count: 2,
      total_points: 50,
      // ... other pre-calculated metrics
    }
  };
  
  const featuresNoStroke = calculateMLFeaturesReloaded(noStrokeData);
  console.assert(featuresNoStroke._enhanced_features_enabled === false, 'Enhanced features should be disabled without stroke data');
  console.assert(featuresNoStroke._enhanced_features_reason === 'no_stroke_data', 'Should indicate no stroke data');
  console.log('✓ Passed\n');
  
  // Test 4: Performance test
  console.log('Test 4: Performance with enhanced features');
  const iterations = 100;
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    calculateMLFeaturesReloaded(testSignatureData);
  }
  
  const totalTime = Date.now() - startTime;
  const avgTime = totalTime / iterations;
  console.log(`Average time per extraction: ${avgTime.toFixed(2)}ms`);
  console.assert(avgTime < 10, 'Feature extraction should average under 10ms');
  console.log('✓ Passed\n');
  
  console.log('=== All integration tests passed! ===');
}

// Run the tests
runIntegrationTest().catch(error => {
  console.error('Integration test failed:', error);
  process.exit(1);
});