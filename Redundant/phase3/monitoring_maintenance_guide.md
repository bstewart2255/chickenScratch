# Phase 3: Monitoring System Maintenance Guide

## Overview

This guide provides comprehensive instructions for maintaining the Signature Authentication monitoring system implemented in Phase 3. It covers routine maintenance tasks, troubleshooting procedures, and best practices for ensuring optimal system performance.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Daily Maintenance Tasks](#daily-maintenance-tasks)
3. [Weekly Maintenance Tasks](#weekly-maintenance-tasks)
4. [Monthly Maintenance Tasks](#monthly-maintenance-tasks)
5. [Alert Management](#alert-management)
6. [Performance Tuning](#performance-tuning)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Emergency Procedures](#emergency-procedures)

## System Architecture

### Components Overview

1. **Monitoring Views**
   - `data_consistency_monitor`: Real-time data quality metrics
   - `auth_success_monitor`: Authentication performance tracking
   - `ml_performance_monitor`: ML processing performance metrics
   - `storage_efficiency_monitor`: Storage usage and efficiency

2. **Alert System**
   - Database triggers for real-time alerts
   - Node.js alert processor (`alerting_system.js`)
   - Email and webhook notifications

3. **Reporting System**
   - Daily integrity reports
   - Weekly trend analysis
   - Automated report generation and storage

4. **Dashboard**
   - Web-based health dashboard (`system_health_dashboard.html`)
   - Real-time metrics visualization
   - Alert status overview

## Daily Maintenance Tasks

### 1. Review System Health (5 minutes)

```sql
-- Check overall system health
SELECT * FROM check_system_health();

-- Review today's alerts
SELECT * FROM recent_monitoring_alerts 
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY severity DESC, created_at DESC;
```

### 2. Verify Alert Processing (2 minutes)

```bash
# Check alert processor status
curl http://localhost:3000/api/monitoring/health

# Review alert processor logs
tail -n 100 /var/log/alert-processor.log
```

### 3. Generate Daily Report (Automated)

The daily report runs automatically at 2 AM. To manually generate:

```sql
-- Generate today's report
SELECT save_daily_report(CURRENT_DATE);

-- View the report
SELECT report_text FROM integrity_reports 
WHERE report_type = 'daily' 
AND report_date = CURRENT_DATE;
```

### 4. Acknowledge Critical Alerts (As needed)

```sql
-- View unacknowledged critical alerts
SELECT * FROM monitoring_alerts 
WHERE acknowledged = false 
AND severity IN ('critical', 'error')
ORDER BY created_at DESC;

-- Acknowledge an alert
UPDATE monitoring_alerts 
SET acknowledged = true,
    acknowledged_at = NOW(),
    acknowledged_by = 'your_username'
WHERE id = <alert_id>;
```

## Weekly Maintenance Tasks

### 1. Review Weekly Trends (15 minutes)

```sql
-- Generate weekly trend report
SELECT save_weekly_report(CURRENT_DATE);

-- Review authentication trends
SELECT * FROM generate_weekly_trend_report(CURRENT_DATE)
WHERE metric_category = 'Authentication';
```

### 2. Performance Analysis (10 minutes)

```sql
-- Check for performance degradation
WITH performance_comparison AS (
    SELECT 
        DATE_TRUNC('week', process_date) as week,
        AVG(avg_time_ms) as weekly_avg,
        MAX(p95_time_ms) as weekly_p95
    FROM ml_performance_monitor
    WHERE process_date >= CURRENT_DATE - INTERVAL '4 weeks'
    GROUP BY DATE_TRUNC('week', process_date)
)
SELECT 
    week,
    weekly_avg,
    weekly_p95,
    LAG(weekly_avg) OVER (ORDER BY week) as previous_avg,
    ROUND(((weekly_avg - LAG(weekly_avg) OVER (ORDER BY week)) / 
           NULLIF(LAG(weekly_avg) OVER (ORDER BY week), 0)) * 100, 2) as avg_change_percent
FROM performance_comparison
ORDER BY week DESC;
```

### 3. Storage Optimization Check (5 minutes)

```sql
-- Review storage growth
SELECT * FROM storage_efficiency_monitor;

-- Identify large records
SELECT 
    id,
    user_id,
    LENGTH(signature_data::text) / 1024.0 as size_kb,
    created_at
FROM signatures
WHERE LENGTH(signature_data::text) > 100000  -- Records larger than 100KB
ORDER BY LENGTH(signature_data::text) DESC
LIMIT 10;
```

### 4. Alert Pattern Analysis (10 minutes)

```sql
-- Analyze alert patterns
SELECT 
    alert_type,
    severity,
    component,
    COUNT(*) as alert_count,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence
FROM monitoring_alerts
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY alert_type, severity, component
ORDER BY alert_count DESC;
```

## Monthly Maintenance Tasks

### 1. Clean Up Old Data (30 minutes)

```sql
-- Run cleanup procedure
SELECT cleanup_old_monitoring_data(90);  -- Keep 90 days of data

-- Verify cleanup
SELECT 
    'monitoring_alerts' as table_name,
    COUNT(*) as record_count,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM monitoring_alerts
UNION ALL
SELECT 
    'integrity_reports',
    COUNT(*),
    MIN(created_at),
    MAX(created_at)
FROM integrity_reports;
```

### 2. Review and Update Alert Thresholds (20 minutes)

```sql
-- Analyze authentication failure rates
WITH monthly_auth_stats AS (
    SELECT 
        DATE_TRUNC('day', created_at) as day,
        COUNT(CASE WHEN success = false THEN 1 END) * 100.0 / COUNT(*) as failure_rate
    FROM auth_attempts
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE_TRUNC('day', created_at)
)
SELECT 
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY failure_rate) as median_failure_rate,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY failure_rate) as p75_failure_rate,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY failure_rate) as p95_failure_rate,
    MAX(failure_rate) as max_failure_rate
FROM monthly_auth_stats;
```

### 3. Performance Baseline Update (15 minutes)

```sql
-- Calculate new performance baselines
WITH baseline_data AS (
    SELECT 
        data_format,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms) as median_time,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY processing_time_ms) as p75_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_time
    FROM ml_processings mp
    JOIN signatures s ON mp.signature_id = s.id
    WHERE mp.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY data_format
)
SELECT * FROM baseline_data;
```

### 4. Dashboard Performance Review (10 minutes)

- Test dashboard load time
- Verify all charts render correctly
- Check for JavaScript errors in browser console
- Review dashboard query performance

## Alert Management

### Alert Severity Levels

1. **Info**: Informational alerts, auto-acknowledged
2. **Warning**: Potential issues, auto-acknowledged after review
3. **Error**: Requires investigation within 24 hours
4. **Critical**: Requires immediate attention

### Alert Response Procedures

#### Critical Alerts

```sql
-- 1. Identify the alert
SELECT * FROM monitoring_alerts 
WHERE id = <alert_id>;

-- 2. Investigate root cause
-- For auth failures:
SELECT * FROM auth_attempts 
WHERE created_at >= NOW() - INTERVAL '1 hour'
AND success = false
ORDER BY created_at DESC
LIMIT 20;

-- 3. Take corrective action (varies by alert type)

-- 4. Document resolution
UPDATE monitoring_alerts 
SET 
    acknowledged = true,
    acknowledged_at = NOW(),
    acknowledged_by = 'your_username',
    details = jsonb_set(
        COALESCE(details, '{}'::jsonb),
        '{resolution}',
        '"Description of resolution"'::jsonb
    )
WHERE id = <alert_id>;
```

### Alert Configuration

Environment variables for `alerting_system.js`:

```bash
# Email configuration
ALERT_EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@yourdomain.com
SMTP_PASS=your_app_password
ALERT_RECIPIENTS=admin@yourdomain.com,ops@yourdomain.com
ALERT_FROM=monitoring@yourdomain.com

# Webhook configuration
ALERT_WEBHOOK_ENABLED=true
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_WEBHOOK_AUTH=Bearer your_token

# Processing interval (milliseconds)
ALERT_CHECK_INTERVAL=60000
```

## Performance Tuning

### 1. Optimize Monitoring Queries

```sql
-- Add indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_auth_attempts_created_success 
ON auth_attempts(created_at DESC, success);

CREATE INDEX IF NOT EXISTS idx_ml_processings_created 
ON ml_processings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_acknowledged 
ON monitoring_alerts(acknowledged, created_at DESC);
```

### 2. Vacuum and Analyze Tables

```sql
-- Run weekly
VACUUM ANALYZE auth_attempts;
VACUUM ANALYZE ml_processings;
VACUUM ANALYZE monitoring_alerts;
VACUUM ANALYZE integrity_reports;
```

### 3. Monitor Query Performance

```sql
-- Find slow monitoring queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_user_functions
WHERE schemaname = 'public'
AND funcname LIKE '%monitor%'
ORDER BY mean_time DESC;
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Alert Processor Not Running

**Symptoms**: No new alerts being processed, alerts piling up

**Solution**:
```bash
# Check process status
ps aux | grep alerting_system

# Restart if needed
npm run start-alert-processor

# Check logs
tail -f /var/log/alert-processor.log
```

#### 2. Dashboard Not Loading Data

**Symptoms**: Dashboard shows "Loading..." indefinitely

**Solution**:
```javascript
// Open browser developer console
// Check for errors
// Verify API endpoints are accessible

// Test API endpoint
fetch('/api/monitoring/status')
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
```

#### 3. High False Positive Alert Rate

**Symptoms**: Too many unnecessary alerts

**Solution**:
```sql
-- Review alert patterns
SELECT 
    alert_type,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at))/60) as avg_ack_time_minutes
FROM monitoring_alerts
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY alert_type
HAVING COUNT(*) > 10
ORDER BY count DESC;

-- Adjust trigger thresholds in check_auth_failure_rate() function
```

#### 4. Reports Not Generating

**Symptoms**: Missing daily/weekly reports

**Solution**:
```sql
-- Check for errors in report generation
BEGIN;
SELECT save_daily_report(CURRENT_DATE);
ROLLBACK;  -- Or COMMIT if successful

-- Check cron job status (if automated)
crontab -l | grep daily_report
```

## Emergency Procedures

### 1. Disable All Monitoring (Emergency Only)

```sql
-- Disable triggers
ALTER TABLE auth_attempts DISABLE TRIGGER auth_failure_monitor_trigger;
ALTER TABLE ml_processings DISABLE TRIGGER ml_performance_monitor_trigger;

-- Stop alert processor
systemctl stop alert-processor  # Or appropriate command
```

### 2. Clear Alert Backlog

```sql
-- Acknowledge all non-critical alerts older than 24 hours
UPDATE monitoring_alerts
SET 
    acknowledged = true,
    acknowledged_at = NOW(),
    acknowledged_by = 'auto-emergency-clear'
WHERE 
    acknowledged = false
    AND severity NOT IN ('critical', 'error')
    AND created_at < NOW() - INTERVAL '24 hours';
```

### 3. Full System Reset

```sql
-- Use with extreme caution!
-- Backup first
CREATE TABLE monitoring_alerts_backup AS SELECT * FROM monitoring_alerts;
CREATE TABLE integrity_reports_backup AS SELECT * FROM integrity_reports;

-- Clear tables
TRUNCATE monitoring_alerts RESTART IDENTITY;
TRUNCATE integrity_reports RESTART IDENTITY;

-- Re-enable monitoring
ALTER TABLE auth_attempts ENABLE TRIGGER auth_failure_monitor_trigger;
ALTER TABLE ml_processings ENABLE TRIGGER ml_performance_monitor_trigger;
```

## Best Practices

1. **Regular Reviews**: Check monitoring dashboards at least twice daily
2. **Alert Hygiene**: Acknowledge alerts promptly to maintain signal-to-noise ratio
3. **Threshold Tuning**: Review and adjust alert thresholds monthly
4. **Documentation**: Document all threshold changes and major incidents
5. **Testing**: Test alert delivery monthly
6. **Backup**: Backup monitoring data before any major changes

## Support and Escalation

For issues that cannot be resolved using this guide:

1. Check system logs in `/var/log/`
2. Review recent changes in git history
3. Consult Phase 3 implementation documentation
4. Escalate to senior engineering team if needed

Remember: The monitoring system is critical infrastructure. Always test changes in a staging environment first.