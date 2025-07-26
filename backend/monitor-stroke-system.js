require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const config = {
    // Monitoring thresholds
    thresholds: {
        apiResponseTime: 3000, // ms
        errorRatePercent: 5, // %
        storageGrowthPercent: 20, // % daily growth
        base64ConversionPercent: 80, // % should be converted
        recentSignatureHours: 24, // hours
        minStrokeDataPercent: 90 // % of recent signatures should use stroke format
    },
    
    // Alert configuration
    alerts: {
        enabled: process.env.MONITORING_ALERTS_ENABLED === 'true',
        email: {
            enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
            smtp: {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            },
            from: process.env.ALERT_EMAIL_FROM || 'monitoring@signature-auth.com',
            to: process.env.ALERT_EMAIL_TO || 'admin@signature-auth.com'
        },
        webhook: {
            enabled: process.env.WEBHOOK_ALERTS_ENABLED === 'true',
            url: process.env.WEBHOOK_URL,
            secret: process.env.WEBHOOK_SECRET
        },
        slack: {
            enabled: process.env.SLACK_ALERTS_ENABLED === 'true',
            webhookUrl: process.env.SLACK_WEBHOOK_URL
        }
    },
    
    // Monitoring state file
    stateFile: path.join(__dirname, 'monitoring-state.json')
};

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Monitoring results
const monitoringResults = {
    timestamp: new Date().toISOString(),
    checks: [],
    alerts: [],
    metrics: {},
    healthy: true
};

// Load previous state
function loadPreviousState() {
    try {
        if (fs.existsSync(config.stateFile)) {
            return JSON.parse(fs.readFileSync(config.stateFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading previous state:', error.message);
    }
    return null;
}

// Save current state
function saveCurrentState() {
    try {
        fs.writeFileSync(config.stateFile, JSON.stringify(monitoringResults, null, 2));
    } catch (error) {
        console.error('Error saving state:', error.message);
    }
}

// Alert functions
async function sendAlert(severity, title, message, details = {}) {
    const alert = {
        severity,
        title,
        message,
        details,
        timestamp: new Date().toISOString()
    };
    
    monitoringResults.alerts.push(alert);
    
    if (!config.alerts.enabled) {
        console.log(`[${severity}] ${title}: ${message}`);
        return;
    }
    
    // Send email alert
    if (config.alerts.email.enabled) {
        await sendEmailAlert(alert);
    }
    
    // Send webhook alert
    if (config.alerts.webhook.enabled) {
        await sendWebhookAlert(alert);
    }
    
    // Send Slack alert
    if (config.alerts.slack.enabled) {
        await sendSlackAlert(alert);
    }
}

async function sendEmailAlert(alert) {
    // Email implementation would go here
    // Using nodemailer or similar
    console.log(`Email alert: ${alert.title}`);
}

async function sendWebhookAlert(alert) {
    try {
        const payload = {
            ...alert,
            source: 'stroke-system-monitor',
            hostname: require('os').hostname()
        };
        
        const headers = {};
        if (config.alerts.webhook.secret) {
            const crypto = require('crypto');
            const signature = crypto
                .createHmac('sha256', config.alerts.webhook.secret)
                .update(JSON.stringify(payload))
                .digest('hex');
            headers['X-Webhook-Signature'] = signature;
        }
        
        await axios.post(config.alerts.webhook.url, payload, { headers });
    } catch (error) {
        console.error('Webhook alert failed:', error.message);
    }
}

async function sendSlackAlert(alert) {
    try {
        const color = alert.severity === 'critical' ? 'danger' : 
                     alert.severity === 'warning' ? 'warning' : 'good';
        
        const payload = {
            attachments: [{
                color,
                title: alert.title,
                text: alert.message,
                fields: Object.entries(alert.details).map(([key, value]) => ({
                    title: key,
                    value: String(value),
                    short: true
                })),
                footer: 'Stroke System Monitor',
                ts: Math.floor(Date.now() / 1000)
            }]
        };
        
        await axios.post(config.alerts.slack.webhookUrl, payload);
    } catch (error) {
        console.error('Slack alert failed:', error.message);
    }
}

// Monitoring functions
async function checkDataFormatDistribution() {
    const checkName = 'Data Format Distribution';
    console.log(`\nChecking ${checkName}...`);
    
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                data_format,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
            FROM signatures
            GROUP BY data_format
            ORDER BY count DESC;
        `);
        
        const formats = {};
        result.rows.forEach(row => {
            formats[row.data_format || 'null'] = {
                count: parseInt(row.count),
                percentage: parseFloat(row.percentage)
            };
        });
        
        monitoringResults.metrics.dataFormats = formats;
        
        // Check if stroke_data adoption is sufficient
        const strokeDataPercent = formats.stroke_data?.percentage || 0;
        const base64Percent = (formats.base64?.percentage || 0) + (formats.null?.percentage || 0);
        
        if (strokeDataPercent < config.thresholds.base64ConversionPercent) {
            await sendAlert('warning', 
                'Low Stroke Data Adoption',
                `Only ${strokeDataPercent}% of signatures use stroke format`,
                { strokeDataPercent, base64Percent }
            );
        }
        
        monitoringResults.checks.push({
            name: checkName,
            status: 'passed',
            details: formats
        });
        
        console.log(`✓ ${checkName}: Stroke ${strokeDataPercent}%, Base64 ${base64Percent}%`);
        
    } catch (error) {
        monitoringResults.checks.push({
            name: checkName,
            status: 'failed',
            error: error.message
        });
        monitoringResults.healthy = false;
        console.error(`✗ ${checkName}: ${error.message}`);
    } finally {
        client.release();
    }
}

async function checkAPIEndpointHealth() {
    const checkName = 'API Endpoint Health';
    console.log(`\nChecking ${checkName}...`);
    
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001';
    const endpoints = [
        { name: 'Health Check', path: '/', critical: true },
        { name: 'Dashboard Stats', path: '/api/dashboard-stats', critical: true },
        { name: 'Recent Activity', path: '/api/recent-activity', critical: false }
    ];
    
    const endpointResults = [];
    let allHealthy = true;
    
    for (const endpoint of endpoints) {
        const start = performance.now();
        try {
            const response = await axios.get(`${baseURL}${endpoint.path}`, {
                timeout: config.thresholds.apiResponseTime
            });
            const responseTime = performance.now() - start;
            
            const result = {
                endpoint: endpoint.name,
                status: response.status,
                responseTime: Math.round(responseTime),
                healthy: response.status === 200 && responseTime < config.thresholds.apiResponseTime
            };
            
            endpointResults.push(result);
            
            if (!result.healthy && endpoint.critical) {
                allHealthy = false;
                await sendAlert('critical',
                    'API Endpoint Unhealthy',
                    `${endpoint.name} is not responding properly`,
                    result
                );
            } else if (responseTime > config.thresholds.apiResponseTime * 0.8) {
                await sendAlert('warning',
                    'Slow API Response',
                    `${endpoint.name} response time is ${responseTime}ms`,
                    result
                );
            }
            
            console.log(`✓ ${endpoint.name}: ${responseTime}ms`);
            
        } catch (error) {
            const result = {
                endpoint: endpoint.name,
                error: error.message,
                healthy: false
            };
            
            endpointResults.push(result);
            
            if (endpoint.critical) {
                allHealthy = false;
                await sendAlert('critical',
                    'API Endpoint Down',
                    `${endpoint.name} is not accessible`,
                    result
                );
            }
            
            console.error(`✗ ${endpoint.name}: ${error.message}`);
        }
    }
    
    monitoringResults.metrics.apiEndpoints = endpointResults;
    monitoringResults.checks.push({
        name: checkName,
        status: allHealthy ? 'passed' : 'failed',
        details: endpointResults
    });
    
    if (!allHealthy) {
        monitoringResults.healthy = false;
    }
}

async function checkRecentSignatures() {
    const checkName = 'Recent Signatures Format';
    console.log(`\nChecking ${checkName}...`);
    
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                data_format,
                COUNT(*) as count
            FROM signatures
            WHERE created_at >= NOW() - INTERVAL '${config.thresholds.recentSignatureHours} hours'
            GROUP BY data_format;
        `);
        
        let totalRecent = 0;
        let strokeDataRecent = 0;
        
        result.rows.forEach(row => {
            totalRecent += parseInt(row.count);
            if (row.data_format === 'stroke_data') {
                strokeDataRecent += parseInt(row.count);
            }
        });
        
        const recentStrokePercent = totalRecent > 0 ? 
            (strokeDataRecent / totalRecent * 100).toFixed(1) : 0;
        
        monitoringResults.metrics.recentSignatures = {
            total: totalRecent,
            strokeData: strokeDataRecent,
            strokeDataPercent: parseFloat(recentStrokePercent)
        };
        
        if (totalRecent > 0 && recentStrokePercent < config.thresholds.minStrokeDataPercent) {
            await sendAlert('warning',
                'Low Stroke Format Adoption in Recent Signatures',
                `Only ${recentStrokePercent}% of recent signatures use stroke format`,
                monitoringResults.metrics.recentSignatures
            );
        }
        
        monitoringResults.checks.push({
            name: checkName,
            status: 'passed',
            details: monitoringResults.metrics.recentSignatures
        });
        
        console.log(`✓ ${checkName}: ${recentStrokePercent}% using stroke format`);
        
    } catch (error) {
        monitoringResults.checks.push({
            name: checkName,
            status: 'failed',
            error: error.message
        });
        console.error(`✗ ${checkName}: ${error.message}`);
    } finally {
        client.release();
    }
}

async function checkDataCorruption() {
    const checkName = 'Data Integrity Check';
    console.log(`\nChecking ${checkName}...`);
    
    const client = await pool.connect();
    try {
        // Check for invalid stroke data
        const corruptionCheck = await client.query(`
            SELECT 
                id,
                user_id,
                data_format,
                CASE 
                    WHEN data_format = 'stroke_data' AND stroke_data IS NULL THEN 'missing_stroke_data'
                    WHEN data_format = 'stroke_data' AND jsonb_typeof(stroke_data) != 'array' THEN 'invalid_stroke_format'
                    WHEN data_format = 'base64' AND signature_data IS NULL THEN 'missing_base64_data'
                    ELSE 'valid'
                END as validation_status
            FROM signatures
            WHERE data_format IS NOT NULL
            LIMIT 1000;
        `);
        
        const issues = {
            missing_stroke_data: 0,
            invalid_stroke_format: 0,
            missing_base64_data: 0,
            valid: 0
        };
        
        corruptionCheck.rows.forEach(row => {
            issues[row.validation_status]++;
        });
        
        const totalIssues = issues.missing_stroke_data + 
                          issues.invalid_stroke_format + 
                          issues.missing_base64_data;
        
        monitoringResults.metrics.dataIntegrity = issues;
        
        if (totalIssues > 0) {
            await sendAlert('critical',
                'Data Corruption Detected',
                `Found ${totalIssues} signatures with data integrity issues`,
                issues
            );
            monitoringResults.healthy = false;
        }
        
        // Check for extremely large stroke data
        const sizeCheck = await client.query(`
            SELECT 
                id,
                pg_column_size(stroke_data) as size_bytes
            FROM signatures
            WHERE stroke_data IS NOT NULL
            ORDER BY pg_column_size(stroke_data) DESC
            LIMIT 10;
        `);
        
        const largeSignatures = sizeCheck.rows.filter(row => row.size_bytes > 100000);
        if (largeSignatures.length > 0) {
            await sendAlert('warning',
                'Large Stroke Data Detected',
                `Found ${largeSignatures.length} signatures over 100KB`,
                { signatures: largeSignatures }
            );
        }
        
        monitoringResults.checks.push({
            name: checkName,
            status: totalIssues === 0 ? 'passed' : 'failed',
            details: { issues, largeSignatures: largeSignatures.length }
        });
        
        console.log(`✓ ${checkName}: ${totalIssues} issues found`);
        
    } catch (error) {
        monitoringResults.checks.push({
            name: checkName,
            status: 'failed',
            error: error.message
        });
        console.error(`✗ ${checkName}: ${error.message}`);
    } finally {
        client.release();
    }
}

async function checkStorageUsageTrends() {
    const checkName = 'Storage Usage Trends';
    console.log(`\nChecking ${checkName}...`);
    
    const client = await pool.connect();
    try {
        // Get current storage stats
        const storageStats = await client.query(`
            SELECT 
                COUNT(*) as total_signatures,
                SUM(pg_column_size(stroke_data)) as stroke_data_bytes,
                SUM(pg_column_size(signature_data)) as base64_data_bytes,
                SUM(pg_column_size(stroke_data) + COALESCE(pg_column_size(signature_data), 0)) as total_bytes
            FROM signatures;
        `);
        
        const current = storageStats.rows[0];
        const currentStats = {
            totalSignatures: parseInt(current.total_signatures),
            strokeDataMB: (parseInt(current.stroke_data_bytes || 0) / 1024 / 1024).toFixed(2),
            base64DataMB: (parseInt(current.base64_data_bytes || 0) / 1024 / 1024).toFixed(2),
            totalMB: (parseInt(current.total_bytes || 0) / 1024 / 1024).toFixed(2)
        };
        
        monitoringResults.metrics.storage = currentStats;
        
        // Compare with previous state
        const previousState = loadPreviousState();
        if (previousState && previousState.metrics.storage) {
            const prev = previousState.metrics.storage;
            const growthPercent = prev.totalMB > 0 ? 
                ((currentStats.totalMB - prev.totalMB) / prev.totalMB * 100).toFixed(1) : 0;
            
            currentStats.growthPercent = parseFloat(growthPercent);
            currentStats.growthMB = (currentStats.totalMB - prev.totalMB).toFixed(2);
            
            // Check for unusual growth
            const hoursSinceLastCheck = (new Date() - new Date(previousState.timestamp)) / 1000 / 60 / 60;
            const dailyGrowthRate = (growthPercent / hoursSinceLastCheck * 24);
            
            if (dailyGrowthRate > config.thresholds.storageGrowthPercent) {
                await sendAlert('warning',
                    'High Storage Growth Rate',
                    `Storage growing at ${dailyGrowthRate.toFixed(1)}% per day`,
                    currentStats
                );
            }
        }
        
        // Check table sizes
        const tableSizes = await client.query(`
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
            FROM pg_tables
            WHERE tablename IN ('signatures', 'auth_attempts', 'users')
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
        `);
        
        currentStats.tableSizes = tableSizes.rows;
        
        monitoringResults.checks.push({
            name: checkName,
            status: 'passed',
            details: currentStats
        });
        
        console.log(`✓ ${checkName}: Total ${currentStats.totalMB}MB`);
        
    } catch (error) {
        monitoringResults.checks.push({
            name: checkName,
            status: 'failed',
            error: error.message
        });
        console.error(`✗ ${checkName}: ${error.message}`);
    } finally {
        client.release();
    }
}

async function checkErrorRates() {
    const checkName = 'Error Rate Monitoring';
    console.log(`\nChecking ${checkName}...`);
    
    const client = await pool.connect();
    try {
        // Check authentication error rates
        const errorRates = await client.query(`
            SELECT 
                COUNT(*) FILTER (WHERE success = false) as failures,
                COUNT(*) as total,
                ROUND(COUNT(*) FILTER (WHERE success = false) * 100.0 / NULLIF(COUNT(*), 0), 2) as error_rate
            FROM auth_attempts
            WHERE created_at >= NOW() - INTERVAL '1 hour';
        `);
        
        const hourlyStats = errorRates.rows[0];
        const errorRate = parseFloat(hourlyStats.error_rate || 0);
        
        monitoringResults.metrics.errorRates = {
            hourly: {
                failures: parseInt(hourlyStats.failures),
                total: parseInt(hourlyStats.total),
                errorRate
            }
        };
        
        // Check for error patterns
        const errorPatterns = await client.query(`
            SELECT 
                DATE_TRUNC('hour', created_at) as hour,
                COUNT(*) FILTER (WHERE success = false) as failures,
                COUNT(*) as total
            FROM auth_attempts
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour DESC;
        `);
        
        // Detect spike in errors
        let errorSpike = false;
        if (errorPatterns.rows.length > 2) {
            const recentHour = errorPatterns.rows[0];
            const avgFailures = errorPatterns.rows.slice(1, 5)
                .reduce((sum, row) => sum + parseInt(row.failures), 0) / 4;
            
            if (recentHour.failures > avgFailures * 2 && recentHour.failures > 10) {
                errorSpike = true;
                await sendAlert('critical',
                    'Error Rate Spike Detected',
                    `Error rate increased to ${errorRate}% in the last hour`,
                    {
                        recentFailures: recentHour.failures,
                        averageFailures: avgFailures.toFixed(0),
                        errorRate
                    }
                );
            }
        }
        
        if (errorRate > config.thresholds.errorRatePercent && !errorSpike) {
            await sendAlert('warning',
                'High Error Rate',
                `Authentication error rate is ${errorRate}%`,
                monitoringResults.metrics.errorRates.hourly
            );
        }
        
        monitoringResults.checks.push({
            name: checkName,
            status: errorRate <= config.thresholds.errorRatePercent ? 'passed' : 'failed',
            details: monitoringResults.metrics.errorRates
        });
        
        console.log(`✓ ${checkName}: ${errorRate}% error rate`);
        
    } catch (error) {
        monitoringResults.checks.push({
            name: checkName,
            status: 'failed',
            error: error.message
        });
        console.error(`✗ ${checkName}: ${error.message}`);
    } finally {
        client.release();
    }
}

// Generate summary report
function generateSummaryReport() {
    console.log('\n' + '='.repeat(60));
    console.log('MONITORING SUMMARY');
    console.log('='.repeat(60));
    
    const passed = monitoringResults.checks.filter(c => c.status === 'passed').length;
    const failed = monitoringResults.checks.filter(c => c.status === 'failed').length;
    
    console.log(`\nTotal Checks: ${monitoringResults.checks.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Alerts: ${monitoringResults.alerts.length}`);
    
    if (monitoringResults.alerts.length > 0) {
        console.log('\nAlerts Generated:');
        monitoringResults.alerts.forEach(alert => {
            console.log(`  [${alert.severity.toUpperCase()}] ${alert.title}`);
        });
    }
    
    console.log(`\nSystem Status: ${monitoringResults.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    console.log('='.repeat(60));
    
    // Save monitoring report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
    const reportPath = path.join(__dirname, 'monitoring-reports', `report-${timestamp}.json`);
    
    // Create reports directory if it doesn't exist
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(monitoringResults, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);
}

// Main monitoring function
async function runMonitoring() {
    console.log('Stroke Data System Monitoring');
    console.log('Starting at:', new Date().toISOString());
    console.log('='.repeat(60));
    
    try {
        // Run all checks
        await checkDataFormatDistribution();
        await checkAPIEndpointHealth();
        await checkRecentSignatures();
        await checkDataCorruption();
        await checkStorageUsageTrends();
        await checkErrorRates();
        
        // Generate report
        generateSummaryReport();
        
        // Save state for next run
        saveCurrentState();
        
        // Send summary alert if unhealthy
        if (!monitoringResults.healthy) {
            await sendAlert('critical',
                'Stroke System Health Check Failed',
                `${monitoringResults.alerts.length} issues detected during monitoring`,
                {
                    checks: monitoringResults.checks.length,
                    failed: monitoringResults.checks.filter(c => c.status === 'failed').length,
                    alerts: monitoringResults.alerts.length
                }
            );
        }
        
        // Exit with appropriate code
        process.exit(monitoringResults.healthy ? 0 : 1);
        
    } catch (error) {
        console.error('\nFatal monitoring error:', error);
        await sendAlert('critical',
            'Monitoring Script Failed',
            error.message,
            { stack: error.stack }
        );
        process.exit(2);
    } finally {
        await pool.end();
    }
}

// Run monitoring
runMonitoring();