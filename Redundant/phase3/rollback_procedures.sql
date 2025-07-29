-- Phase 3: Rollback Procedures
-- Purpose: Complete rollback procedures for all Phase 3 monitoring changes
-- Created: 2025-01-28

-- ============================================
-- IMPORTANT: READ BEFORE EXECUTING
-- ============================================
-- This script provides rollback procedures for all Phase 3 changes.
-- Execute sections as needed based on what needs to be rolled back.
-- Always backup data before executing rollback procedures.

-- ============================================
-- SECTION 1: BACKUP CURRENT STATE
-- ============================================

-- Create backup schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS monitoring_backup;

-- Backup monitoring alerts before rollback
CREATE TABLE IF NOT EXISTS monitoring_backup.alerts_backup AS 
SELECT * FROM monitoring_alerts;

-- Backup integrity reports before rollback
CREATE TABLE IF NOT EXISTS monitoring_backup.reports_backup AS 
SELECT * FROM integrity_reports;

-- ============================================
-- SECTION 2: ROLLBACK TRIGGERS
-- ============================================

-- Remove authentication failure monitoring trigger
DROP TRIGGER IF EXISTS auth_failure_monitor_trigger ON auth_attempts;

-- Remove ML performance monitoring trigger
DROP TRIGGER IF EXISTS ml_performance_monitor_trigger ON ml_processings;

-- ============================================
-- SECTION 3: ROLLBACK FUNCTIONS
-- ============================================

-- Remove monitoring functions
DROP FUNCTION IF EXISTS check_auth_failure_rate() CASCADE;
DROP FUNCTION IF EXISTS check_ml_processing_performance() CASCADE;
DROP FUNCTION IF EXISTS create_monitoring_alert(VARCHAR(50), VARCHAR(20), VARCHAR(100), TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS check_system_health() CASCADE;
DROP FUNCTION IF EXISTS generate_daily_health_report(date) CASCADE;
DROP FUNCTION IF EXISTS run_hourly_health_check() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_monitoring_data(integer) CASCADE;

-- Remove reporting functions
DROP FUNCTION IF EXISTS generate_daily_integrity_report(date) CASCADE;
DROP FUNCTION IF EXISTS generate_weekly_trend_report(date) CASCADE;
DROP FUNCTION IF EXISTS save_daily_report(date) CASCADE;
DROP FUNCTION IF EXISTS save_weekly_report(date) CASCADE;
DROP FUNCTION IF EXISTS get_latest_reports(VARCHAR(50), INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_report_details(INTEGER) CASCADE;

-- ============================================
-- SECTION 4: ROLLBACK VIEWS
-- ============================================

-- Remove monitoring views
DROP VIEW IF EXISTS data_consistency_monitor CASCADE;
DROP VIEW IF EXISTS auth_success_monitor CASCADE;
DROP VIEW IF EXISTS ml_performance_monitor CASCADE;
DROP VIEW IF EXISTS storage_efficiency_monitor CASCADE;
DROP VIEW IF EXISTS system_status_overview CASCADE;
DROP VIEW IF EXISTS recent_monitoring_alerts CASCADE;

-- ============================================
-- SECTION 5: ROLLBACK TABLES
-- ============================================

-- Remove monitoring tables (after backing up data)
DROP TABLE IF EXISTS monitoring_alerts CASCADE;
DROP TABLE IF EXISTS integrity_reports CASCADE;

-- ============================================
-- SECTION 6: VERIFY ROLLBACK
-- ============================================

-- Function to verify rollback completion
CREATE OR REPLACE FUNCTION verify_monitoring_rollback()
RETURNS TABLE (
    object_type text,
    object_name text,
    still_exists boolean
) AS $$
BEGIN
    -- Check for remaining views
    RETURN QUERY
    SELECT 
        'VIEW'::text,
        viewname::text,
        true
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname IN (
        'data_consistency_monitor',
        'auth_success_monitor',
        'ml_performance_monitor',
        'storage_efficiency_monitor',
        'system_status_overview',
        'recent_monitoring_alerts'
    );
    
    -- Check for remaining functions
    RETURN QUERY
    SELECT 
        'FUNCTION'::text,
        proname::text,
        true
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND proname IN (
        'check_auth_failure_rate',
        'check_ml_processing_performance',
        'create_monitoring_alert',
        'check_system_health',
        'generate_daily_health_report',
        'run_hourly_health_check',
        'cleanup_old_monitoring_data',
        'generate_daily_integrity_report',
        'generate_weekly_trend_report',
        'save_daily_report',
        'save_weekly_report',
        'get_latest_reports',
        'get_report_details'
    );
    
    -- Check for remaining tables
    RETURN QUERY
    SELECT 
        'TABLE'::text,
        tablename::text,
        true
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
        'monitoring_alerts',
        'integrity_reports'
    );
    
    -- Check for remaining triggers
    RETURN QUERY
    SELECT 
        'TRIGGER'::text,
        tgname::text,
        true
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND tgname IN (
        'auth_failure_monitor_trigger',
        'ml_performance_monitor_trigger'
    );
END;
$$ LANGUAGE plpgsql;

-- Execute verification
SELECT * FROM verify_monitoring_rollback();

-- ============================================
-- SECTION 7: RESTORE BACKED UP DATA (OPTIONAL)
-- ============================================

-- If you need to restore monitoring data after re-implementing:
-- INSERT INTO monitoring_alerts SELECT * FROM monitoring_backup.alerts_backup;
-- INSERT INTO integrity_reports SELECT * FROM monitoring_backup.reports_backup;

-- ============================================
-- SECTION 8: CLEANUP
-- ============================================

-- Remove verification function
DROP FUNCTION IF EXISTS verify_monitoring_rollback();

-- Optional: Remove backup schema (only after confirming rollback success)
-- DROP SCHEMA monitoring_backup CASCADE;

-- ============================================
-- ROLLBACK SUMMARY
-- ============================================
-- This rollback procedure removes:
-- 1. All monitoring triggers (2 triggers)
-- 2. All monitoring functions (13 functions)
-- 3. All monitoring views (6 views)
-- 4. All monitoring tables (2 tables)
-- 
-- Data is backed up to monitoring_backup schema before removal.
-- Execute verify_monitoring_rollback() to confirm complete rollback.