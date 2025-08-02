const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createViews() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Creating monitoring views...');
        
        // View 1: Data consistency monitor
        console.log('Creating data_consistency_monitor view...');
        await client.query(`
            CREATE OR REPLACE VIEW data_consistency_monitor AS
            SELECT 
                CURRENT_TIMESTAMP as check_time,
                (SELECT COUNT(*) FROM signatures WHERE data_format IS NULL) as signatures_null_format,
                (SELECT COUNT(*) FROM signatures WHERE signature_data IS NULL) as signatures_null_data,
                (SELECT COUNT(*) FROM shapes WHERE data_format IS NULL) as shapes_null_format,
                (SELECT COUNT(*) FROM shapes WHERE shape_data IS NULL) as shapes_null_data,
                CASE 
                    WHEN (SELECT COUNT(*) FROM signatures) = 0 THEN 100
                    ELSE ROUND(
                        100.0 * (
                            (SELECT COUNT(*) FROM signatures WHERE data_format IS NOT NULL AND signature_data IS NOT NULL) +
                            (SELECT COUNT(*) FROM shapes WHERE data_format IS NOT NULL AND shape_data IS NOT NULL)
                        ) / NULLIF(
                            (SELECT COUNT(*) FROM signatures) + (SELECT COUNT(*) FROM shapes), 0
                        ), 2
                    )
                END as data_health_score
        `);
        console.log('✅ data_consistency_monitor created');
        
        // View 2: Auth success monitor
        console.log('Creating auth_success_monitor view...');
        await client.query(`
            CREATE OR REPLACE VIEW auth_success_monitor AS
            WITH daily_stats AS (
                SELECT 
                    DATE(aa.created_at) as auth_date,
                    s.data_format,
                    COUNT(*) as total_attempts,
                    COUNT(CASE WHEN aa.success = true THEN 1 END) as successful_attempts,
                    COUNT(CASE WHEN aa.success = false THEN 1 END) as failed_attempts
                FROM auth_attempts aa
                JOIN signatures s ON aa.signature_id = s.id
                WHERE aa.created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE(aa.created_at), s.data_format
            )
            SELECT 
                auth_date,
                data_format,
                total_attempts,
                successful_attempts,
                failed_attempts,
                ROUND(
                    COALESCE(successful_attempts * 100.0 / NULLIF(total_attempts, 0), 0), 
                    2
                ) as success_rate_percent,
                CASE 
                    WHEN total_attempts >= 10 AND 
                         COALESCE(successful_attempts * 100.0 / NULLIF(total_attempts, 0), 0) < 95 
                    THEN true 
                    ELSE false 
                END as needs_attention
            FROM daily_stats
            ORDER BY auth_date DESC, data_format
        `);
        console.log('✅ auth_success_monitor created');
        
        // View 3: Storage efficiency monitor
        console.log('Creating storage_efficiency_monitor view...');
        await client.query(`
            CREATE OR REPLACE VIEW storage_efficiency_monitor AS
            SELECT 
                'signatures' as table_name,
                COUNT(*) as record_count,
                ROUND(SUM(LENGTH(signature_data::text)) / 1024.0 / 1024.0, 2) as total_data_mb,
                ROUND(AVG(LENGTH(signature_data::text)) / 1024.0, 2) as avg_data_kb,
                ROUND(MAX(LENGTH(signature_data::text)) / 1024.0, 2) as max_data_kb,
                COUNT(CASE WHEN data_format = 'stroke_data' THEN 1 END) as stroke_count,
                COUNT(CASE WHEN data_format = 'base64' THEN 1 END) as base64_count
            FROM signatures
            UNION ALL
            SELECT 
                'shapes' as table_name,
                COUNT(*) as record_count,
                ROUND(SUM(LENGTH(shape_data::text)) / 1024.0 / 1024.0, 2) as total_data_mb,
                ROUND(AVG(LENGTH(shape_data::text)) / 1024.0, 2) as avg_data_kb,
                ROUND(MAX(LENGTH(shape_data::text)) / 1024.0, 2) as max_data_kb,
                COUNT(CASE WHEN data_format = 'stroke_data' THEN 1 END) as stroke_count,
                COUNT(CASE WHEN data_format = 'base64' THEN 1 END) as base64_count
            FROM shapes
        `);
        console.log('✅ storage_efficiency_monitor created');
        
        // View 4: System status overview
        console.log('Creating system_status_overview view...');
        await client.query(`
            CREATE OR REPLACE VIEW system_status_overview AS
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM signatures) as total_signatures,
                (SELECT COUNT(*) FROM shapes) as total_shapes,
                (SELECT COUNT(*) FROM auth_attempts WHERE created_at >= CURRENT_DATE) as auth_attempts_today,
                (SELECT data_health_score FROM data_consistency_monitor) as data_health_score,
                (SELECT COUNT(*) FROM auth_attempts WHERE created_at >= NOW() - INTERVAL '1 hour') as auth_attempts_last_hour
        `);
        console.log('✅ system_status_overview created');
        
        // View 5: System health summary
        console.log('Creating system_health_summary view...');
        await client.query(`
            CREATE OR REPLACE VIEW system_health_summary AS
            SELECT 
                (SELECT data_health_score FROM data_consistency_monitor) as data_health_score,
                (SELECT COUNT(*) FROM signatures WHERE data_format IS NULL OR signature_data IS NULL) as data_issues,
                (SELECT COUNT(*) FROM shapes WHERE data_format IS NULL OR shape_data IS NULL) as shape_issues,
                (SELECT ROUND(AVG(success_rate_percent), 2) 
                 FROM auth_success_monitor 
                 WHERE auth_date >= CURRENT_DATE - INTERVAL '7 days') as auth_success,
                (SELECT COUNT(*) FROM auth_attempts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as total_auth_attempts_7d,
                (SELECT COUNT(*) FROM auth_attempts 
                 WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND success = true) as successful_auth_attempts_7d
        `);
        console.log('✅ system_health_summary created');
        
        console.log('\n🎉 All monitoring views created successfully!');
        
        // Test the views
        console.log('\n📊 Testing views...');
        
        const testQueries = [
            { name: 'data_consistency_monitor', query: 'SELECT * FROM data_consistency_monitor' },
            { name: 'auth_success_monitor', query: 'SELECT * FROM auth_success_monitor LIMIT 3' },
            { name: 'storage_efficiency_monitor', query: 'SELECT * FROM storage_efficiency_monitor' },
            { name: 'system_status_overview', query: 'SELECT * FROM system_status_overview' },
            { name: 'system_health_summary', query: 'SELECT * FROM system_health_summary' }
        ];
        
        for (const test of testQueries) {
            try {
                const result = await client.query(test.query);
                console.log(`✅ ${test.name} - ${result.rows.length} rows`);
                if (result.rows.length > 0) {
                    console.log(`   Sample:`, JSON.stringify(result.rows[0], null, 2));
                }
            } catch (error) {
                console.log(`❌ ${test.name} failed: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error creating views:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run if called directly
if (require.main === module) {
    createViews()
        .then(() => {
            console.log('\n🎯 Now you can run your original query:');
            console.log(`
SELECT 
    CASE WHEN data_issues = 0 AND auth_success >= 85
    THEN '🎉 SUCCESS: All phases complete!'
    ELSE '🔄 Still working...'
    END as overall_status
FROM system_health_summary;
            `);
        })
        .catch(error => {
            console.error('❌ Setup failed:', error);
            process.exit(1);
        })
        .finally(() => {
            pool.end();
        });
}

module.exports = { createViews }; 