const { Pool } = require('pg');

// Use the working database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth',
  ssl: {
    rejectUnauthorized: false
  }
});
const fs = require('fs');

async function executeEmpiricalAnalysis() {
  try {
    console.log('Starting empirical data analysis...\n');
    
    const results = [];
    
    // Query 1: Signatures Data Format Distribution
    console.log('1. Analyzing signatures data format distribution...');
    const sigFormatQuery = `
      SELECT 
        data_format, 
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record
      FROM signatures 
      GROUP BY data_format
      ORDER BY count DESC
    `;
    
    const sigFormatResult = await pool.query(sigFormatQuery);
    results.push({
      title: 'Signatures Data Format Distribution',
      data: sigFormatResult.rows
    });
    console.table(sigFormatResult.rows);
    
    // Query 2: Signatures Content Type Analysis
    console.log('\n2. Analyzing signatures content types...');
    const sigContentQuery = `
      SELECT 
        data_format,
        CASE 
          WHEN signature_data IS NULL THEN 'NULL data'
          WHEN signature_data::text LIKE 'data:image/png;base64,%' THEN 'Base64 PNG'
          WHEN signature_data::text LIKE 'data:image/jpeg;base64,%' THEN 'Base64 JPEG'
          WHEN signature_data::text LIKE 'data:image%;base64,%' THEN 'Base64 Other'
          WHEN signature_data::text LIKE '%"strokes":%' THEN 'Stroke data JSON'
          WHEN signature_data::text LIKE '%stroke%' THEN 'Other stroke format'
          ELSE 'Unknown format'
        END as content_type,
        COUNT(*) as count,
        MIN(LENGTH(signature_data::text)) as min_data_length,
        MAX(LENGTH(signature_data::text)) as max_data_length,
        AVG(LENGTH(signature_data::text))::INTEGER as avg_data_length
      FROM signatures
      GROUP BY data_format, content_type
      ORDER BY data_format, count DESC
    `;
    
    const sigContentResult = await pool.query(sigContentQuery);
    results.push({
      title: 'Signatures Content Type Analysis',
      data: sigContentResult.rows
    });
    console.table(sigContentResult.rows);
    
    // Query 3: Potential Legacy Data
    console.log('\n3. Identifying potential legacy or problematic data...');
    const legacyQuery = `
      SELECT 
        id,
        user_id,
        data_format,
        CASE 
          WHEN signature_data IS NULL THEN 'NULL data'
          WHEN data_format = 'base64' AND signature_data::text NOT LIKE 'data:image%' THEN 'Invalid base64 format'
          WHEN data_format = 'stroke_data' AND signature_data::text NOT LIKE '%strokes%' THEN 'Invalid stroke format'
          WHEN data_format IS NULL THEN 'NULL format'
          ELSE 'Format OK'
        END as issue_type,
        created_at,
        LEFT(signature_data::text, 100) as data_preview
      FROM signatures
      WHERE 
        signature_data IS NULL OR
        data_format IS NULL OR
        (data_format = 'base64' AND signature_data::text NOT LIKE 'data:image%') OR
        (data_format = 'stroke_data' AND signature_data::text NOT LIKE '%strokes%')
      LIMIT 20
    `;
    
    const legacyResult = await pool.query(legacyQuery);
    results.push({
      title: 'Potential Legacy Data in Signatures',
      data: legacyResult.rows
    });
    console.table(legacyResult.rows);
    
    // Query 4: Shapes Data Format Distribution
    console.log('\n4. Analyzing shapes data format distribution...');
    const shapeFormatQuery = `
      SELECT 
        data_format, 
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record
      FROM shapes 
      GROUP BY data_format
      ORDER BY count DESC
    `;
    
    const shapeFormatResult = await pool.query(shapeFormatQuery);
    results.push({
      title: 'Shapes Data Format Distribution',
      data: shapeFormatResult.rows
    });
    console.table(shapeFormatResult.rows);
    
    // Query 5: Metrics Calculation Success Rate
    console.log('\n5. Analyzing metrics calculation success rate...');
    const metricsQuery = `
      SELECT 
        data_format,
        COUNT(*) as total_shapes,
        COUNT(CASE WHEN metrics IS NOT NULL THEN 1 END) as shapes_with_metrics,
        COUNT(CASE WHEN metrics IS NULL THEN 1 END) as shapes_without_metrics,
        ROUND(
          COALESCE(COUNT(CASE WHEN metrics IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 0), 
          2
        ) as metrics_success_rate
      FROM shapes
      GROUP BY data_format
      ORDER BY total_shapes DESC
    `;
    
    const metricsResult = await pool.query(metricsQuery);
    results.push({
      title: 'Metrics Calculation Success Rate',
      data: metricsResult.rows
    });
    console.table(metricsResult.rows);
    
    // Query 6: Cross-Table Format Summary
    console.log('\n6. Analyzing cross-table data format consistency...');
    const crossTableQuery = `
      SELECT 
        'signatures' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN data_format = 'base64' THEN 1 END) as base64_count,
        COUNT(CASE WHEN data_format = 'stroke_data' THEN 1 END) as stroke_count,
        COUNT(CASE WHEN data_format IS NULL THEN 1 END) as null_format_count
      FROM signatures
      UNION ALL
      SELECT 
        'shapes' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN data_format = 'base64' THEN 1 END) as base64_count,
        COUNT(CASE WHEN data_format = 'stroke_data' THEN 1 END) as stroke_count,
        COUNT(CASE WHEN data_format IS NULL THEN 1 END) as null_format_count
      FROM shapes
    `;
    
    const crossTableResult = await pool.query(crossTableQuery);
    results.push({
      title: 'Cross-Table Format Summary',
      data: crossTableResult.rows
    });
    console.table(crossTableResult.rows);
    
    // Query 7: Authentication Success by Format
    console.log('\n7. Analyzing authentication success rates by data format...');
    const authSuccessQuery = `
      SELECT 
        s.data_format,
        COUNT(aa.id) as total_attempts,
        COUNT(CASE WHEN aa.success = true THEN 1 END) as successful_attempts,
        COUNT(CASE WHEN aa.success = false THEN 1 END) as failed_attempts,
        ROUND(
          COALESCE(COUNT(CASE WHEN aa.success = true THEN 1 END) * 100.0 / NULLIF(COUNT(aa.id), 0), 0), 
          2
        ) as success_rate
      FROM auth_attempts aa
      JOIN signatures s ON aa.signature_id = s.id
      WHERE aa.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY s.data_format
      ORDER BY total_attempts DESC
    `;
    
    const authSuccessResult = await pool.query(authSuccessQuery);
    results.push({
      title: 'Authentication Success by Data Format',
      data: authSuccessResult.rows
    });
    console.table(authSuccessResult.rows);
    
    // Query 8: Data Quality Summary
    console.log('\n8. Generating data quality summary...');
    const summaryQuery = `
      WITH summary_stats AS (
        SELECT 
          (SELECT COUNT(*) FROM signatures WHERE data_format IS NULL) as signatures_null_format,
          (SELECT COUNT(*) FROM signatures WHERE signature_data IS NULL) as signatures_null_data,
          (SELECT COUNT(*) FROM shapes WHERE data_format IS NULL) as shapes_null_format,
          (SELECT COUNT(*) FROM shapes WHERE shape_data IS NULL) as shapes_null_data,
          (SELECT COUNT(*) FROM signatures WHERE data_format = 'base64' AND signature_data::text NOT LIKE 'data:image%') as invalid_base64,
          (SELECT COUNT(*) FROM signatures WHERE data_format = 'stroke_data' AND signature_data::text NOT LIKE '%strokes%') as invalid_stroke
      )
      SELECT 
        signatures_null_format,
        signatures_null_data,
        shapes_null_format,
        shapes_null_data,
        invalid_base64,
        invalid_stroke,
        (signatures_null_format + signatures_null_data + shapes_null_format + shapes_null_data + invalid_base64 + invalid_stroke) as total_issues
      FROM summary_stats
    `;
    
    const summaryResult = await pool.query(summaryQuery);
    results.push({
      title: 'Data Quality Summary',
      data: summaryResult.rows
    });
    console.table(summaryResult.rows);
    
    // Save results to file
    const outputPath = './empirical_analysis_results.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Analysis complete! Results saved to ${outputPath}`);
    
    // Generate summary report
    const report = generateReport(results);
    fs.writeFileSync('./empirical_analysis_report.md', report);
    console.log('✅ Report saved to empirical_analysis_report.md');
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await pool.end();
  }
}

function generateReport(results) {
  let report = '# Phase 3 Empirical Data Analysis Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  results.forEach(result => {
    report += `## ${result.title}\n\n`;
    
    if (result.data.length === 0) {
      report += 'No data found.\n\n';
    } else {
      // Create markdown table
      const headers = Object.keys(result.data[0]);
      report += '| ' + headers.join(' | ') + ' |\n';
      report += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
      
      result.data.forEach(row => {
        const values = headers.map(h => row[h] !== null ? row[h] : 'NULL');
        report += '| ' + values.join(' | ') + ' |\n';
      });
      
      report += '\n';
    }
  });
  
  return report;
}

// Execute the analysis
executeEmpiricalAnalysis();