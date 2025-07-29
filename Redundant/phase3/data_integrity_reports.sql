-- Phase 3: Data Integrity Reporting Queries
-- Purpose: Automated daily/weekly reporting queries for data integrity monitoring
-- Created: 2025-01-28

-- ============================================
-- DAILY REPORTS
-- ============================================

-- Daily Data Integrity Report
CREATE OR REPLACE FUNCTION generate_daily_integrity_report(
    report_date date DEFAULT CURRENT_DATE
) RETURNS TABLE (
    report_section text,
    metric_name text,
    metric_value text,
    status text,
    details jsonb
) AS $$
BEGIN
    -- Section 1: Data Completeness
    RETURN QUERY
    SELECT 
        'Data Completeness'::text,
        'Signatures Missing Data'::text,
        COUNT(*)::text,
        CASE WHEN COUNT(*) = 0 THEN 'Good' ELSE 'Needs Attention' END,
        jsonb_build_object(
            'null_format', COUNT(CASE WHEN data_format IS NULL THEN 1 END),
            'null_data', COUNT(CASE WHEN signature_data IS NULL THEN 1 END),
            'missing_raw_key', COUNT(CASE WHEN data_format = 'stroke_data' AND NOT (signature_data ? 'raw') THEN 1 END)
        )
    FROM signatures
    WHERE data_format IS NULL OR signature_data IS NULL 
       OR (data_format = 'stroke_data' AND NOT (signature_data ? 'raw'));

    RETURN QUERY
    SELECT 
        'Data Completeness'::text,
        'Shapes Missing Data'::text,
        COUNT(*)::text,
        CASE WHEN COUNT(*) = 0 THEN 'Good' ELSE 'Needs Attention' END,
        jsonb_build_object(
            'null_format', COUNT(CASE WHEN data_format IS NULL THEN 1 END),
            'null_data', COUNT(CASE WHEN shape_data IS NULL THEN 1 END),
            'missing_metrics', COUNT(CASE WHEN metrics IS NULL THEN 1 END)
        )
    FROM shapes
    WHERE data_format IS NULL OR shape_data IS NULL;

    -- Section 2: Authentication Performance
    RETURN QUERY
    WITH auth_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN success = true THEN 1 END) as successful,
            COUNT(CASE WHEN success = false THEN 1 END) as failed
        FROM auth_attempts
        WHERE DATE(created_at) = report_date
    )
    SELECT 
        'Authentication Performance'::text,
        'Daily Auth Success Rate'::text,
        CASE 
            WHEN total = 0 THEN 'No attempts'
            ELSE ROUND(successful * 100.0 / total, 2)::text || '%'
        END,
        CASE 
            WHEN total = 0 THEN 'N/A'
            WHEN successful * 100.0 / total >= 95 THEN 'Excellent'
            WHEN successful * 100.0 / total >= 90 THEN 'Good'
            WHEN successful * 100.0 / total >= 80 THEN 'Fair'
            ELSE 'Poor'
        END,
        jsonb_build_object(
            'total_attempts', total,
            'successful', successful,
            'failed', failed
        )
    FROM auth_stats;

    -- Section 3: ML Processing Performance
    RETURN QUERY
    WITH ml_stats AS (
        SELECT 
            COUNT(*) as total,
            AVG(processing_time_ms) as avg_time,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms) as median_time,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_time,
            MAX(processing_time_ms) as max_time
        FROM ml_processings
        WHERE DATE(created_at) = report_date
    )
    SELECT 
        'ML Processing Performance'::text,
        'Processing Time Stats'::text,
        CASE 
            WHEN total = 0 THEN 'No processings'
            ELSE ROUND(avg_time::numeric, 2)::text || ' ms avg'
        END,
        CASE 
            WHEN total = 0 THEN 'N/A'
            WHEN avg_time <= 500 THEN 'Excellent'
            WHEN avg_time <= 1000 THEN 'Good'
            WHEN avg_time <= 2000 THEN 'Fair'
            ELSE 'Poor'
        END,
        jsonb_build_object(
            'total_processings', total,
            'avg_time_ms', ROUND(avg_time::numeric, 2),
            'median_time_ms', ROUND(median_time::numeric, 2),
            'p95_time_ms', ROUND(p95_time::numeric, 2),
            'max_time_ms', max_time
        )
    FROM ml_stats;

    -- Section 4: Data Growth
    RETURN QUERY
    WITH growth_stats AS (
        SELECT 
            (SELECT COUNT(*) FROM signatures WHERE DATE(created_at) = report_date) as new_signatures,
            (SELECT COUNT(*) FROM shapes WHERE DATE(created_at) = report_date) as new_shapes,
            (SELECT COUNT(*) FROM users WHERE DATE(created_at) = report_date) as new_users
    )
    SELECT 
        'Data Growth'::text,
        'Daily New Records'::text,
        (new_signatures + new_shapes + new_users)::text || ' total',
        'Info',
        jsonb_build_object(
            'new_signatures', new_signatures,
            'new_shapes', new_shapes,
            'new_users', new_users
        )
    FROM growth_stats;

    -- Section 5: Storage Metrics
    RETURN QUERY
    WITH storage_stats AS (
        SELECT 
            SUM(LENGTH(signature_data::text)) / 1024.0 / 1024.0 as sig_mb,
            SUM(LENGTH(shape_data::text)) / 1024.0 / 1024.0 as shape_mb
        FROM signatures, shapes
    )
    SELECT 
        'Storage Metrics'::text,
        'Total Data Size'::text,
        ROUND((sig_mb + shape_mb)::numeric, 2)::text || ' MB',
        CASE 
            WHEN sig_mb + shape_mb < 1000 THEN 'Good'
            WHEN sig_mb + shape_mb < 5000 THEN 'Warning'
            ELSE 'Critical'
        END,
        jsonb_build_object(
            'signatures_mb', ROUND(sig_mb::numeric, 2),
            'shapes_mb', ROUND(shape_mb::numeric, 2)
        )
    FROM storage_stats;

    -- Section 6: Alert Summary
    RETURN QUERY
    WITH alert_stats AS (
        SELECT 
            severity,
            COUNT(*) as count
        FROM monitoring_alerts
        WHERE DATE(created_at) = report_date
        GROUP BY severity
    )
    SELECT 
        'Alert Summary'::text,
        'Daily Alerts by Severity'::text,
        COALESCE(SUM(count), 0)::text || ' total',
        CASE 
            WHEN EXISTS(SELECT 1 FROM alert_stats WHERE severity = 'critical') THEN 'Critical'
            WHEN EXISTS(SELECT 1 FROM alert_stats WHERE severity = 'error') THEN 'Error'
            WHEN EXISTS(SELECT 1 FROM alert_stats WHERE severity = 'warning') THEN 'Warning'
            WHEN COALESCE(SUM(count), 0) > 0 THEN 'Info'
            ELSE 'Good'
        END,
        COALESCE(
            jsonb_object_agg(severity, count),
            '{}'::jsonb
        )
    FROM alert_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- WEEKLY REPORTS
-- ============================================

-- Weekly Trend Analysis Report
CREATE OR REPLACE FUNCTION generate_weekly_trend_report(
    end_date date DEFAULT CURRENT_DATE
) RETURNS TABLE (
    metric_category text,
    metric_name text,
    week_avg numeric,
    previous_week_avg numeric,
    change_percent numeric,
    trend text,
    details jsonb
) AS $$
BEGIN
    -- Authentication Success Trend
    RETURN QUERY
    WITH weekly_auth AS (
        SELECT 
            CASE 
                WHEN DATE(created_at) > end_date - INTERVAL '7 days' THEN 'current'
                ELSE 'previous'
            END as week,
            COUNT(*) as total,
            COUNT(CASE WHEN success = true THEN 1 END) as successful
        FROM auth_attempts
        WHERE DATE(created_at) > end_date - INTERVAL '14 days'
          AND DATE(created_at) <= end_date
        GROUP BY week
    )
    SELECT 
        'Authentication'::text,
        'Success Rate'::text,
        ROUND(
            COALESCE(
                (SELECT successful * 100.0 / NULLIF(total, 0) FROM weekly_auth WHERE week = 'current'),
                0
            ), 2
        ),
        ROUND(
            COALESCE(
                (SELECT successful * 100.0 / NULLIF(total, 0) FROM weekly_auth WHERE week = 'previous'),
                0
            ), 2
        ),
        ROUND(
            COALESCE(
                (SELECT successful * 100.0 / NULLIF(total, 0) FROM weekly_auth WHERE week = 'current'),
                0
            ) - 
            COALESCE(
                (SELECT successful * 100.0 / NULLIF(total, 0) FROM weekly_auth WHERE week = 'previous'),
                0
            ), 2
        ),
        CASE 
            WHEN (SELECT successful * 100.0 / NULLIF(total, 0) FROM weekly_auth WHERE week = 'current') >
                 (SELECT successful * 100.0 / NULLIF(total, 0) FROM weekly_auth WHERE week = 'previous') THEN 'Improving'
            WHEN (SELECT successful * 100.0 / NULLIF(total, 0) FROM weekly_auth WHERE week = 'current') <
                 (SELECT successful * 100.0 / NULLIF(total, 0) FROM weekly_auth WHERE week = 'previous') THEN 'Declining'
            ELSE 'Stable'
        END,
        jsonb_build_object(
            'current_week_attempts', (SELECT total FROM weekly_auth WHERE week = 'current'),
            'previous_week_attempts', (SELECT total FROM weekly_auth WHERE week = 'previous')
        );

    -- ML Processing Time Trend
    RETURN QUERY
    WITH weekly_ml AS (
        SELECT 
            CASE 
                WHEN DATE(created_at) > end_date - INTERVAL '7 days' THEN 'current'
                ELSE 'previous'
            END as week,
            AVG(processing_time_ms) as avg_time,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms) as median_time
        FROM ml_processings
        WHERE DATE(created_at) > end_date - INTERVAL '14 days'
          AND DATE(created_at) <= end_date
        GROUP BY week
    )
    SELECT 
        'ML Processing'::text,
        'Average Time (ms)'::text,
        ROUND(
            COALESCE((SELECT avg_time FROM weekly_ml WHERE week = 'current'), 0)::numeric, 
            2
        ),
        ROUND(
            COALESCE((SELECT avg_time FROM weekly_ml WHERE week = 'previous'), 0)::numeric, 
            2
        ),
        ROUND(
            (COALESCE((SELECT avg_time FROM weekly_ml WHERE week = 'current'), 0) -
             COALESCE((SELECT avg_time FROM weekly_ml WHERE week = 'previous'), 0))::numeric, 
            2
        ),
        CASE 
            WHEN (SELECT avg_time FROM weekly_ml WHERE week = 'current') <
                 (SELECT avg_time FROM weekly_ml WHERE week = 'previous') THEN 'Improving'
            WHEN (SELECT avg_time FROM weekly_ml WHERE week = 'current') >
                 (SELECT avg_time FROM weekly_ml WHERE week = 'previous') THEN 'Declining'
            ELSE 'Stable'
        END,
        jsonb_build_object(
            'current_median', ROUND(COALESCE((SELECT median_time FROM weekly_ml WHERE week = 'current'), 0)::numeric, 2),
            'previous_median', ROUND(COALESCE((SELECT median_time FROM weekly_ml WHERE week = 'previous'), 0)::numeric, 2)
        );

    -- Data Growth Trend
    RETURN QUERY
    WITH weekly_growth AS (
        SELECT 
            'current' as week,
            (SELECT COUNT(*) FROM signatures WHERE DATE(created_at) > end_date - INTERVAL '7 days' AND DATE(created_at) <= end_date) as sigs,
            (SELECT COUNT(*) FROM shapes WHERE DATE(created_at) > end_date - INTERVAL '7 days' AND DATE(created_at) <= end_date) as shapes,
            (SELECT COUNT(*) FROM users WHERE DATE(created_at) > end_date - INTERVAL '7 days' AND DATE(created_at) <= end_date) as users
        UNION ALL
        SELECT 
            'previous' as week,
            (SELECT COUNT(*) FROM signatures WHERE DATE(created_at) > end_date - INTERVAL '14 days' AND DATE(created_at) <= end_date - INTERVAL '7 days') as sigs,
            (SELECT COUNT(*) FROM shapes WHERE DATE(created_at) > end_date - INTERVAL '14 days' AND DATE(created_at) <= end_date - INTERVAL '7 days') as shapes,
            (SELECT COUNT(*) FROM users WHERE DATE(created_at) > end_date - INTERVAL '14 days' AND DATE(created_at) <= end_date - INTERVAL '7 days') as users
    )
    SELECT 
        'Data Growth'::text,
        'Total New Records'::text,
        (SELECT (sigs + shapes + users)::numeric FROM weekly_growth WHERE week = 'current'),
        (SELECT (sigs + shapes + users)::numeric FROM weekly_growth WHERE week = 'previous'),
        ROUND(
            CASE 
                WHEN (SELECT (sigs + shapes + users) FROM weekly_growth WHERE week = 'previous') = 0 THEN 0
                ELSE ((SELECT (sigs + shapes + users) FROM weekly_growth WHERE week = 'current')::numeric - 
                      (SELECT (sigs + shapes + users) FROM weekly_growth WHERE week = 'previous')::numeric) * 100.0 /
                      (SELECT (sigs + shapes + users) FROM weekly_growth WHERE week = 'previous')::numeric
            END, 2
        ),
        CASE 
            WHEN (SELECT (sigs + shapes + users) FROM weekly_growth WHERE week = 'current') >
                 (SELECT (sigs + shapes + users) FROM weekly_growth WHERE week = 'previous') THEN 'Growing'
            WHEN (SELECT (sigs + shapes + users) FROM weekly_growth WHERE week = 'current') <
                 (SELECT (sigs + shapes + users) FROM weekly_growth WHERE week = 'previous') THEN 'Declining'
            ELSE 'Stable'
        END,
        jsonb_build_object(
            'current_week', (SELECT jsonb_build_object('signatures', sigs, 'shapes', shapes, 'users', users) FROM weekly_growth WHERE week = 'current'),
            'previous_week', (SELECT jsonb_build_object('signatures', sigs, 'shapes', shapes, 'users', users) FROM weekly_growth WHERE week = 'previous')
        );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEDULED REPORT GENERATION
-- ============================================

-- Function to format and save daily report
CREATE OR REPLACE FUNCTION save_daily_report(report_date date DEFAULT CURRENT_DATE)
RETURNS jsonb AS $$
DECLARE
    report_data jsonb;
    report_text text;
BEGIN
    -- Generate the report data
    WITH report_rows AS (
        SELECT * FROM generate_daily_integrity_report(report_date)
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'section', report_section,
            'metric', metric_name,
            'value', metric_value,
            'status', status,
            'details', details
        )
    ) INTO report_data
    FROM report_rows;
    
    -- Create formatted text report
    report_text := E'DAILY DATA INTEGRITY REPORT\n';
    report_text := report_text || E'Date: ' || report_date || E'\n';
    report_text := report_text || E'Generated: ' || NOW() || E'\n';
    report_text := report_text || E'=' || repeat('=', 70) || E'\n\n';
    
    -- Add each section
    FOR r IN SELECT * FROM generate_daily_integrity_report(report_date) LOOP
        report_text := report_text || r.report_section || ': ' || r.metric_name || E'\n';
        report_text := report_text || '  Value: ' || r.metric_value || E'\n';
        report_text := report_text || '  Status: ' || r.status || E'\n';
        IF r.details IS NOT NULL THEN
            report_text := report_text || '  Details: ' || r.details::text || E'\n';
        END IF;
        report_text := report_text || E'\n';
    END LOOP;
    
    -- Save to reports table (create if not exists)
    CREATE TABLE IF NOT EXISTS integrity_reports (
        id SERIAL PRIMARY KEY,
        report_type VARCHAR(50),
        report_date date,
        report_data jsonb,
        report_text text,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    INSERT INTO integrity_reports (report_type, report_date, report_data, report_text)
    VALUES ('daily', report_date, report_data, report_text);
    
    RETURN jsonb_build_object(
        'report_date', report_date,
        'status', 'saved',
        'data', report_data
    );
END;
$$ LANGUAGE plpgsql;

-- Function to format and save weekly report
CREATE OR REPLACE FUNCTION save_weekly_report(end_date date DEFAULT CURRENT_DATE)
RETURNS jsonb AS $$
DECLARE
    report_data jsonb;
    report_text text;
BEGIN
    -- Generate the report data
    WITH report_rows AS (
        SELECT * FROM generate_weekly_trend_report(end_date)
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'category', metric_category,
            'metric', metric_name,
            'current_week', week_avg,
            'previous_week', previous_week_avg,
            'change_percent', change_percent,
            'trend', trend,
            'details', details
        )
    ) INTO report_data
    FROM report_rows;
    
    -- Create formatted text report
    report_text := E'WEEKLY TREND ANALYSIS REPORT\n';
    report_text := report_text || E'Week Ending: ' || end_date || E'\n';
    report_text := report_text || E'Generated: ' || NOW() || E'\n';
    report_text := report_text || E'=' || repeat('=', 70) || E'\n\n';
    
    -- Add each metric
    FOR r IN SELECT * FROM generate_weekly_trend_report(end_date) LOOP
        report_text := report_text || r.metric_category || ' - ' || r.metric_name || E'\n';
        report_text := report_text || '  Current Week: ' || COALESCE(r.week_avg::text, 'N/A') || E'\n';
        report_text := report_text || '  Previous Week: ' || COALESCE(r.previous_week_avg::text, 'N/A') || E'\n';
        report_text := report_text || '  Change: ' || COALESCE(r.change_percent::text || '%', 'N/A') || E'\n';
        report_text := report_text || '  Trend: ' || r.trend || E'\n';
        report_text := report_text || E'\n';
    END LOOP;
    
    -- Save to reports table
    INSERT INTO integrity_reports (report_type, report_date, report_data, report_text)
    VALUES ('weekly', end_date, report_data, report_text);
    
    RETURN jsonb_build_object(
        'week_ending', end_date,
        'status', 'saved',
        'data', report_data
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UTILITY FUNCTIONS FOR REPORT ACCESS
-- ============================================

-- Get latest reports
CREATE OR REPLACE FUNCTION get_latest_reports(
    report_type_filter VARCHAR(50) DEFAULT NULL,
    limit_count INTEGER DEFAULT 10
) RETURNS TABLE (
    id INTEGER,
    report_type VARCHAR(50),
    report_date date,
    summary jsonb,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.report_type,
        r.report_date,
        jsonb_build_object(
            'total_sections', jsonb_array_length(r.report_data),
            'has_issues', EXISTS(
                SELECT 1 
                FROM jsonb_array_elements(r.report_data) elem 
                WHERE elem->>'status' NOT IN ('Good', 'Info', 'N/A')
            ),
            'preview', r.report_data->0
        ) as summary,
        r.created_at
    FROM integrity_reports r
    WHERE (report_type_filter IS NULL OR r.report_type = report_type_filter)
    ORDER BY r.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Get report by ID with full details
CREATE OR REPLACE FUNCTION get_report_details(report_id INTEGER)
RETURNS TABLE (
    report_type VARCHAR(50),
    report_date date,
    report_data jsonb,
    report_text text,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.report_type,
        r.report_date,
        r.report_data,
        r.report_text,
        r.created_at
    FROM integrity_reports r
    WHERE r.id = report_id;
END;
$$ LANGUAGE plpgsql;