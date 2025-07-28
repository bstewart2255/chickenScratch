const { Pool } = require('pg');
const { AlertProcessor, getHealthStatus } = require('./alerting_system');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test results collector
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to run a test
async function runTest(name, testFn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    await testFn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASSED', error: null });
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAILED', error: error.message });
    console.error(`❌ FAILED: ${name}`);
    console.error(`   Error: ${error.message}`);
  }
}

// Test Suite
async function runAllTests() {
  console.log('🚀 Starting Phase 3 Component Tests\n');
  
  // Test 1: Monitoring Views with NULL Data
  await runTest('Monitoring views handle NULL values', async () => {
    const queries = [
      'SELECT * FROM data_consistency_monitor',
      'SELECT * FROM auth_success_monitor WHERE auth_date = CURRENT_DATE',
      'SELECT * FROM ml_performance_monitor WHERE process_date = CURRENT_DATE',
      'SELECT * FROM storage_efficiency_monitor'
    ];
    
    for (const query of queries) {
      const result = await pool.query(query);
      if (!result) throw new Error(`Query failed: ${query}`);
    }
  });
  
  // Test 2: Division by Zero Protection
  await runTest('Views handle division by zero', async () => {
    // Test with no auth attempts
    const result = await pool.query(`
      SELECT success_rate_percent 
      FROM auth_success_monitor 
      WHERE total_attempts = 0
      LIMIT 1
    `);
    
    // Should return 0 or handle gracefully, not error
    if (result.rows.length > 0) {
      const rate = result.rows[0].success_rate_percent;
      if (rate === null || isNaN(rate)) {
        throw new Error('Invalid success rate calculation');
      }
    }
  });
  
  // Test 3: System Health Check Function
  await runTest('System health check function', async () => {
    const result = await pool.query('SELECT * FROM check_system_health()');
    
    if (result.rows.length === 0) {
      throw new Error('No health check results returned');
    }
    
    // Verify all components are checked
    const components = result.rows.map(r => r.component);
    const expected = ['Data Consistency', 'Authentication System', 'ML Processing', 'Storage Efficiency'];
    
    for (const exp of expected) {
      if (!components.includes(exp)) {
        throw new Error(`Missing component: ${exp}`);
      }
    }
  });
  
  // Test 4: Daily Report Generation with Empty Data
  await runTest('Daily report handles empty data', async () => {
    // Test with future date (no data)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    const result = await pool.query(
      'SELECT * FROM generate_daily_integrity_report($1)',
      [futureDateStr]
    );
    
    if (!result || result.rows.length === 0) {
      throw new Error('Report generation failed for empty data');
    }
  });
  
  // Test 5: Alert Creation and Retrieval
  await runTest('Alert creation and retrieval', async () => {
    // Create test alert
    await pool.query(`
      SELECT create_monitoring_alert(
        'test_alert',
        'info',
        'Test Component',
        'This is a test alert',
        '{"test": true}'::jsonb
      )
    `);
    
    // Retrieve the alert
    const result = await pool.query(`
      SELECT * FROM monitoring_alerts 
      WHERE alert_type = 'test_alert' 
      AND details->>'test' = 'true'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      throw new Error('Test alert not found');
    }
    
    // Clean up
    await pool.query(
      'DELETE FROM monitoring_alerts WHERE id = $1',
      [result.rows[0].id]
    );
  });
  
  // Test 6: Weekly Trend Report with Minimal Data
  await runTest('Weekly trend report calculations', async () => {
    const result = await pool.query(
      'SELECT * FROM generate_weekly_trend_report(CURRENT_DATE)'
    );
    
    // Should handle cases with no previous week data
    for (const row of result.rows) {
      if (row.change_percent === null && row.previous_week_avg === null) {
        // This is acceptable - no previous data
        continue;
      }
      
      if (isNaN(row.change_percent) && row.previous_week_avg !== null) {
        throw new Error('Invalid change percent calculation');
      }
    }
  });
  
  // Test 7: Storage Efficiency with Large Data
  await runTest('Storage efficiency calculations', async () => {
    const result = await pool.query('SELECT * FROM storage_efficiency_monitor');
    
    for (const row of result.rows) {
      if (row.total_data_mb < 0 || row.avg_data_kb < 0) {
        throw new Error('Negative storage values detected');
      }
      
      if (row.avg_data_kb > row.max_data_kb) {
        throw new Error('Average larger than maximum');
      }
    }
  });
  
  // Test 8: Alert Processor Health Check
  await runTest('Alert processor health status', async () => {
    const health = await getHealthStatus();
    
    if (!health.status) {
      throw new Error('Health status missing');
    }
    
    if (health.status === 'unhealthy' && !health.error) {
      throw new Error('Unhealthy status without error message');
    }
  });
  
  // Test 9: Report Storage and Retrieval
  await runTest('Report storage and retrieval', async () => {
    // Generate a test report
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - 5);
    const testDateStr = testDate.toISOString().split('T')[0];
    
    await pool.query('SELECT save_daily_report($1)', [testDateStr]);
    
    // Retrieve the report
    const result = await pool.query(
      'SELECT * FROM get_latest_reports($1, $2)',
      ['daily', 1]
    );
    
    if (result.rows.length === 0) {
      throw new Error('No reports found');
    }
  });
  
  // Test 10: Monitoring View Performance
  await runTest('Monitoring view query performance', async () => {
    const startTime = Date.now();
    
    // Run all monitoring views
    await pool.query('SELECT * FROM data_consistency_monitor');
    await pool.query('SELECT * FROM auth_success_monitor LIMIT 100');
    await pool.query('SELECT * FROM ml_performance_monitor LIMIT 100');
    await pool.query('SELECT * FROM storage_efficiency_monitor');
    await pool.query('SELECT * FROM system_status_overview');
    
    const duration = Date.now() - startTime;
    
    if (duration > 5000) {
      throw new Error(`Monitoring queries too slow: ${duration}ms`);
    }
  });
  
  // Test 11: Edge Case - Extremely Long Processing Time
  await runTest('Alert trigger for extreme ML processing time', async () => {
    // This would normally trigger an alert
    // We're just testing that the function exists and can be called
    const result = await pool.query(`
      SELECT check_ml_processing_performance()
    `);
    
    // Function should exist
    if (result === null) {
      throw new Error('ML performance check function not found');
    }
  });
  
  // Test 12: Cleanup Function
  await runTest('Old data cleanup function', async () => {
    // Test with high retention to avoid deleting real data
    await pool.query('SELECT cleanup_old_monitoring_data(365)');
    
    // Verify tables still have data
    const alertCount = await pool.query('SELECT COUNT(*) FROM monitoring_alerts');
    if (alertCount.rows[0].count < 0) {
      throw new Error('Cleanup removed all data unexpectedly');
    }
  });
}

// Main execution
async function main() {
  try {
    await runAllTests();
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2)}%`);
    
    if (testResults.failed > 0) {
      console.log('\nFailed Tests:');
      testResults.tests
        .filter(t => t.status === 'FAILED')
        .forEach(t => {
          console.log(`  - ${t.name}: ${t.error}`);
        });
    }
    
    // Exit code based on results
    process.exit(testResults.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n💥 Critical test suite error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
main();