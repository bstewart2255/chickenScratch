-- Phase 3: Monitoring Infrastructure
-- Purpose: Create views, functions, and triggers for comprehensive system monitoring
-- Created: 2025-01-28

-- ============================================
-- SECTION 1: DATA CONSISTENCY MONITORING VIEWS
-- ============================================

-- 1.1 Real-time data consistency monitor
CREATE OR REPLACE VIEW data_consistency_monitor AS
SELECT 
    CURRENT_TIMESTAMP as check_time,
    -- Signatures table checks
    (SELECT COUNT(*) FROM signatures WHERE data_format IS NULL) as signatures_null_format,
    (SELECT COUNT(*) FROM signatures WHERE signature_data IS NULL) as signatures_null_data,
    (SELECT COUNT(*) FROM signatures WHERE data_format = 'stroke_data' AND NOT (signature_data ? 'raw')) as signatures_missing_raw,
    (SELECT COUNT(*) FROM signatures WHERE data_format = 'stroke_data' AND NOT (signature_data ? 'data')) as signatures_missing_display,
    -- Shapes table checks
    (SELECT COUNT(*) FROM shapes WHERE data_format IS NULL) as shapes_null_format,
    (SELECT COUNT(*) FROM shapes WHERE shape_data IS NULL) as shapes_null_data,
    (SELECT COUNT(*) FROM shapes WHERE data_format = 'stroke_data' AND stroke_data IS NULL) as shapes_missing_stroke_data,
    -- Overall health score (100 = perfect)
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
    END as data_health_score;

-- 1.2 Authentication success rate monitoring
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
    -- Alert flag if success rate drops below threshold
    CASE 
        WHEN total_attempts >= 10 AND 
             COALESCE(successful_attempts * 100.0 / NULLIF(total_attempts, 0), 0) < 95 
        THEN true 
        ELSE false 
    END as needs_attention
FROM daily_stats
ORDER BY auth_date DESC, data_format;

-- 1.3 ML processing performance monitor
CREATE OR REPLACE VIEW ml_performance_monitor AS
WITH processing_stats AS (
    SELECT 
        DATE(mp.created_at) as process_date,
        s.data_format,
        COUNT(*) as total_processings,
        COUNT(CASE WHEN mp.success = true THEN 1 END) as successful_processings,
        AVG(mp.processing_time_ms) as avg_processing_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mp.processing_time_ms) as median_processing_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY mp.processing_time_ms) as p95_processing_time,
        MAX(mp.processing_time_ms) as max_processing_time
    FROM ml_processings mp
    JOIN signatures s ON mp.signature_id = s.id
    WHERE mp.created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(mp.created_at), s.data_format
)
SELECT 
    process_date,
    data_format,
    total_processings,
    successful_processings,
    ROUND(avg_processing_time::numeric, 2) as avg_time_ms,
    ROUND(median_processing_time::numeric, 2) as median_time_ms,
    ROUND(p95_processing_time::numeric, 2) as p95_time_ms,
    max_processing_time as max_time_ms,
    -- Performance alert if p95 > 1000ms
    CASE 
        WHEN p95_processing_time > 1000 THEN true 
        ELSE false 
    END as performance_alert
FROM processing_stats
ORDER BY process_date DESC, data_format;

-- 1.4 Storage efficiency monitor
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
FROM shapes;

-- ============================================
-- SECTION 2: MONITORING FUNCTIONS
-- ============================================

-- 2.1 Function to check system health
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE(
    component text,
    status text,
    details jsonb,
    alert_level text
) AS $$
BEGIN
    -- Check data consistency
    RETURN QUERY
    SELECT 
        'Data Consistency'::text,
        CASE 
            WHEN (SELECT data_health_score FROM data_consistency_monitor) >= 99 THEN 'Healthy'
            WHEN (SELECT data_health_score FROM data_consistency_monitor) >= 95 THEN 'Warning'
            ELSE 'Critical'
        END::text,
        jsonb_build_object(
            'health_score', (SELECT data_health_score FROM data_consistency_monitor),
            'null_formats', (SELECT signatures_null_format + shapes_null_format FROM data_consistency_monitor),
            'null_data', (SELECT signatures_null_data + shapes_null_data FROM data_consistency_monitor)
        ),
        CASE 
            WHEN (SELECT data_health_score FROM data_consistency_monitor) >= 99 THEN 'info'
            WHEN (SELECT data_health_score FROM data_consistency_monitor) >= 95 THEN 'warning'
            ELSE 'error'
        END::text;

    -- Check authentication performance
    RETURN QUERY
    WITH recent_auth AS (
        SELECT AVG(success_rate_percent) as avg_success_rate
        FROM auth_success_monitor
        WHERE auth_date >= CURRENT_DATE - INTERVAL '7 days'
    )
    SELECT 
        'Authentication System'::text,
        CASE 
            WHEN COALESCE((SELECT avg_success_rate FROM recent_auth), 0) >= 95 THEN 'Healthy'
            WHEN COALESCE((SELECT avg_success_rate FROM recent_auth), 0) >= 90 THEN 'Warning'
            ELSE 'Critical'
        END::text,
        jsonb_build_object(
            'avg_success_rate_7d', ROUND(COALESCE((SELECT avg_success_rate FROM recent_auth), 0)::numeric, 2),
            'failing_today', EXISTS(SELECT 1 FROM auth_success_monitor WHERE auth_date = CURRENT_DATE AND needs_attention = true)
        ),
        CASE 
            WHEN COALESCE((SELECT avg_success_rate FROM recent_auth), 0) >= 95 THEN 'info'
            WHEN COALESCE((SELECT avg_success_rate FROM recent_auth), 0) >= 90 THEN 'warning'
            ELSE 'error'
        END::text;

    -- Check ML processing performance
    RETURN QUERY
    WITH recent_ml AS (
        SELECT AVG(median_time_ms) as avg_median_time
        FROM ml_performance_monitor
        WHERE process_date >= CURRENT_DATE - INTERVAL '3 days'
    )
    SELECT 
        'ML Processing'::text,
        CASE 
            WHEN COALESCE((SELECT avg_median_time FROM recent_ml), 0) <= 500 THEN 'Healthy'
            WHEN COALESCE((SELECT avg_median_time FROM recent_ml), 0) <= 1000 THEN 'Warning'
            ELSE 'Critical'
        END::text,
        jsonb_build_object(
            'avg_median_time_3d', ROUND(COALESCE((SELECT avg_median_time FROM recent_ml), 0)::numeric, 2),
            'performance_alerts', (SELECT COUNT(*) FROM ml_performance_monitor WHERE process_date >= CURRENT_DATE - INTERVAL '3 days' AND performance_alert = true)
        ),
        CASE 
            WHEN COALESCE((SELECT avg_median_time FROM recent_ml), 0) <= 500 THEN 'info'
            WHEN COALESCE((SELECT avg_median_time FROM recent_ml), 0) <= 1000 THEN 'warning'
            ELSE 'error'
        END::text;

    -- Check storage efficiency
    RETURN QUERY
    WITH storage_stats AS (
        SELECT SUM(total_data_mb) as total_mb
        FROM storage_efficiency_monitor
    )
    SELECT 
        'Storage Efficiency'::text,
        CASE 
            WHEN (SELECT total_mb FROM storage_stats) < 1000 THEN 'Healthy'
            WHEN (SELECT total_mb FROM storage_stats) < 5000 THEN 'Warning'
            ELSE 'Critical'
        END::text,
        jsonb_build_object(
            'total_storage_mb', (SELECT total_mb FROM storage_stats),
            'signatures_mb', (SELECT total_data_mb FROM storage_efficiency_monitor WHERE table_name = 'signatures'),
            'shapes_mb', (SELECT total_data_mb FROM storage_efficiency_monitor WHERE table_name = 'shapes')
        ),
        CASE 
            WHEN (SELECT total_mb FROM storage_stats) < 1000 THEN 'info'
            WHEN (SELECT total_mb FROM storage_stats) < 5000 THEN 'warning'
            ELSE 'error'
        END::text;
END;
$$ LANGUAGE plpgsql;

-- 2.2 Function to generate daily health report
CREATE OR REPLACE FUNCTION generate_daily_health_report(report_date date DEFAULT CURRENT_DATE)
RETURNS jsonb AS $$
DECLARE
    report jsonb;
BEGIN
    report := jsonb_build_object(
        'report_date', report_date,
        'generated_at', CURRENT_TIMESTAMP,
        'summary', (
            SELECT jsonb_object_agg(component, jsonb_build_object(
                'status', status,
                'details', details,
                'alert_level', alert_level
            ))
            FROM check_system_health()
        ),
        'authentication_metrics', (
            SELECT jsonb_build_object(
                'total_attempts', SUM(total_attempts),
                'success_rate', ROUND(AVG(success_rate_percent)::numeric, 2),
                'by_format', jsonb_object_agg(
                    data_format, 
                    jsonb_build_object(
                        'attempts', total_attempts,
                        'success_rate', success_rate_percent
                    )
                )
            )
            FROM auth_success_monitor
            WHERE auth_date = report_date
        ),
        'ml_processing_metrics', (
            SELECT jsonb_build_object(
                'total_processings', SUM(total_processings),
                'avg_time_ms', ROUND(AVG(avg_time_ms)::numeric, 2),
                'p95_time_ms', ROUND(AVG(p95_time_ms)::numeric, 2)
            )
            FROM ml_performance_monitor
            WHERE process_date = report_date
        ),
        'data_quality_metrics', (
            SELECT row_to_json(data_consistency_monitor)
            FROM data_consistency_monitor
        ),
        'storage_metrics', (
            SELECT jsonb_object_agg(
                table_name,
                jsonb_build_object(
                    'records', record_count,
                    'size_mb', total_data_mb,
                    'avg_kb', avg_data_kb
                )
            )
            FROM storage_efficiency_monitor
        )
    );
    
    RETURN report;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECTION 3: ALERT TRIGGERS
-- ============================================

-- 3.1 Create alerts table for storing monitoring alerts
CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    component VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR(100)
);

-- 3.2 Function to create monitoring alerts
CREATE OR REPLACE FUNCTION create_monitoring_alert(
    p_alert_type VARCHAR(50),
    p_severity VARCHAR(20),
    p_component VARCHAR(100),
    p_message TEXT,
    p_details JSONB DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO monitoring_alerts (alert_type, severity, component, message, details)
    VALUES (p_alert_type, p_severity, p_component, p_message, p_details);
END;
$$ LANGUAGE plpgsql;

-- 3.3 Trigger function for authentication failures
CREATE OR REPLACE FUNCTION check_auth_failure_rate()
RETURNS trigger AS $$
DECLARE
    recent_failure_rate numeric;
BEGIN
    -- Calculate failure rate for last hour
    SELECT 
        COALESCE(
            COUNT(CASE WHEN success = false THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 
            0
        )
    INTO recent_failure_rate
    FROM auth_attempts
    WHERE created_at >= NOW() - INTERVAL '1 hour';
    
    -- Alert if failure rate > 20%
    IF recent_failure_rate > 20 THEN
        PERFORM create_monitoring_alert(
            'auth_failure_rate',
            CASE 
                WHEN recent_failure_rate > 50 THEN 'critical'
                WHEN recent_failure_rate > 30 THEN 'error'
                ELSE 'warning'
            END,
            'Authentication System',
            format('High authentication failure rate: %.2f%% in the last hour', recent_failure_rate),
            jsonb_build_object(
                'failure_rate', recent_failure_rate,
                'time_window', '1 hour',
                'trigger_record_id', NEW.id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS auth_failure_monitor_trigger ON auth_attempts;
CREATE TRIGGER auth_failure_monitor_trigger
    AFTER INSERT ON auth_attempts
    FOR EACH ROW
    WHEN (NEW.success = false)
    EXECUTE FUNCTION check_auth_failure_rate();

-- 3.4 Trigger function for slow ML processing
CREATE OR REPLACE FUNCTION check_ml_processing_performance()
RETURNS trigger AS $$
BEGIN
    -- Alert if processing time exceeds threshold
    IF NEW.processing_time_ms > 2000 THEN
        PERFORM create_monitoring_alert(
            'ml_slow_processing',
            CASE 
                WHEN NEW.processing_time_ms > 5000 THEN 'error'
                ELSE 'warning'
            END,
            'ML Processing',
            format('Slow ML processing detected: %s ms', NEW.processing_time_ms),
            jsonb_build_object(
                'processing_time_ms', NEW.processing_time_ms,
                'signature_id', NEW.signature_id,
                'processing_id', NEW.id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS ml_performance_monitor_trigger ON ml_processings;
CREATE TRIGGER ml_performance_monitor_trigger
    AFTER INSERT ON ml_processings
    FOR EACH ROW
    EXECUTE FUNCTION check_ml_processing_performance();

-- ============================================
-- SECTION 4: SCHEDULED MONITORING TASKS
-- ============================================

-- 4.1 Function to run hourly health checks
CREATE OR REPLACE FUNCTION run_hourly_health_check()
RETURNS void AS $$
DECLARE
    health_record record;
BEGIN
    -- Check each component
    FOR health_record IN SELECT * FROM check_system_health() LOOP
        -- Create alert if status is not healthy
        IF health_record.status != 'Healthy' THEN
            PERFORM create_monitoring_alert(
                'system_health_check',
                health_record.alert_level,
                health_record.component,
                format('%s status: %s', health_record.component, health_record.status),
                health_record.details
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Function to clean old monitoring data
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data(days_to_keep integer DEFAULT 90)
RETURNS void AS $$
BEGIN
    -- Delete old alerts
    DELETE FROM monitoring_alerts 
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep
    AND acknowledged = true;
    
    -- Delete old auth attempts (keep summary stats)
    DELETE FROM auth_attempts
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
    
    -- Delete old ML processing records (keep summary stats)
    DELETE FROM ml_processings
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECTION 5: UTILITY VIEWS FOR DASHBOARD
-- ============================================

-- 5.1 Current system status overview
CREATE OR REPLACE VIEW system_status_overview AS
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM signatures) as total_signatures,
    (SELECT COUNT(*) FROM shapes) as total_shapes,
    (SELECT COUNT(*) FROM auth_attempts WHERE created_at >= CURRENT_DATE) as auth_attempts_today,
    (SELECT COUNT(*) FROM monitoring_alerts WHERE acknowledged = false) as unacknowledged_alerts,
    (SELECT data_health_score FROM data_consistency_monitor) as data_health_score,
    (SELECT COUNT(*) FROM auth_attempts WHERE created_at >= NOW() - INTERVAL '1 hour') as auth_attempts_last_hour,
    (SELECT AVG(processing_time_ms) FROM ml_processings WHERE created_at >= NOW() - INTERVAL '1 hour') as avg_ml_time_last_hour;

-- 5.2 Recent alerts view
CREATE OR REPLACE VIEW recent_monitoring_alerts AS
SELECT 
    id,
    alert_type,
    severity,
    component,
    message,
    details,
    created_at,
    acknowledged,
    acknowledged_at,
    acknowledged_by,
    CASE 
        WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 'Last Hour'
        WHEN created_at >= NOW() - INTERVAL '1 day' THEN 'Last 24 Hours'
        WHEN created_at >= NOW() - INTERVAL '7 days' THEN 'Last Week'
        ELSE 'Older'
    END as age_category
FROM monitoring_alerts
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- ============================================
-- SECTION 6: GRANT PERMISSIONS
-- ============================================

-- Grant read access to monitoring views (adjust role as needed)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring_role;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO monitoring_role;