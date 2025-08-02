#!/usr/bin/env node

/**
 * Performance Monitoring Script
 * Tracks metrics vs baselines and alerts on threshold violations
 */

const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  // Performance thresholds
  thresholds: {
    apiResponseTime: 200,      // ms (baseline)
    apiResponseLimit: 220,     // ms (baseline + 10%)
    authProcessing: 500,       // ms
    featureExtraction: 100,    // ms
    memoryUsage: 512,         // MB (baseline)
    memoryLimit: 614,         // MB (baseline + 20%)
    buildTime: 60,            // seconds
    typeCoverage: 95,         // percentage
    errorRate: 1,             // percentage
    cpuUsage: 80              // percentage
  },
  
  // Monitoring settings
  monitoring: {
    interval: process.env.MONITORING_INTERVAL || 60000, // 1 minute
    historySize: 1440, // 24 hours of minute data
    alertCooldown: 300000, // 5 minutes between same alerts
    dashboardPort: process.env.DASHBOARD_PORT || 3002
  },
  
  // Alert configuration
  alerts: {
    email: process.env.ALERT_EMAIL,
    webhook: process.env.ALERT_WEBHOOK,
    slack: process.env.SLACK_WEBHOOK
  },
  
  // Target endpoints
  endpoints: {
    health: process.env.HEALTH_ENDPOINT || 'http://localhost:3000/health',
    api: process.env.API_ENDPOINT || 'http://localhost:3000/api',
    metrics: process.env.METRICS_ENDPOINT || 'http://localhost:3000/metrics'
  }
};

// Metrics storage
class MetricsStore {
  constructor() {
    this.metrics = {
      responseTime: [],
      memoryUsage: [],
      cpuUsage: [],
      errorCount: [],
      requestCount: [],
      timestamp: []
    };
    this.alerts = new Map();
  }
  
  add(metric, value) {
    const now = new Date();
    
    if (!this.metrics[metric]) {
      this.metrics[metric] = [];
    }
    
    this.metrics[metric].push(value);
    this.metrics.timestamp.push(now);
    
    // Maintain history size
    if (this.metrics[metric].length > CONFIG.monitoring.historySize) {
      this.metrics[metric].shift();
    }
    if (this.metrics.timestamp.length > CONFIG.monitoring.historySize) {
      this.metrics.timestamp.shift();
    }
  }
  
  getLatest(metric) {
    const values = this.metrics[metric] || [];
    return values[values.length - 1] || 0;
  }
  
  getAverage(metric, minutes = 5) {
    const values = this.metrics[metric] || [];
    const cutoff = Date.now() - (minutes * 60 * 1000);
    
    let sum = 0;
    let count = 0;
    
    for (let i = values.length - 1; i >= 0; i--) {
      if (this.metrics.timestamp[i] >= cutoff) {
        sum += values[i];
        count++;
      } else {
        break;
      }
    }
    
    return count > 0 ? sum / count : 0;
  }
  
  getHistory(metric, minutes = 60) {
    const values = this.metrics[metric] || [];
    const timestamps = this.metrics.timestamp || [];
    const cutoff = Date.now() - (minutes * 60 * 1000);
    
    const history = [];
    for (let i = 0; i < values.length; i++) {
      if (timestamps[i] >= cutoff) {
        history.push({
          value: values[i],
          timestamp: timestamps[i]
        });
      }
    }
    
    return history;
  }
  
  shouldAlert(alertKey) {
    const lastAlert = this.alerts.get(alertKey);
    const now = Date.now();
    
    if (!lastAlert || now - lastAlert > CONFIG.monitoring.alertCooldown) {
      this.alerts.set(alertKey, now);
      return true;
    }
    
    return false;
  }
}

const metricsStore = new MetricsStore();

// Alert functions
async function sendAlert(level, message, details = {}) {
  const alertData = {
    level,
    message,
    timestamp: new Date().toISOString(),
    details
  };
  
  console.log(`[${level}] ${message}`, details);
  
  // Email alert
  if (CONFIG.alerts.email) {
    try {
      await execAsync(`echo "${JSON.stringify(alertData)}" | mail -s "[${level}] Performance Alert" ${CONFIG.alerts.email}`);
    } catch (error) {
      console.error('Failed to send email alert:', error.message);
    }
  }
  
  // Webhook alert
  if (CONFIG.alerts.webhook) {
    try {
      const webhook = new URL(CONFIG.alerts.webhook);
      const options = {
        hostname: webhook.hostname,
        port: webhook.port,
        path: webhook.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const req = (webhook.protocol === 'https:' ? https : http).request(options);
      req.write(JSON.stringify(alertData));
      req.end();
    } catch (error) {
      console.error('Failed to send webhook alert:', error.message);
    }
  }
  
  // Slack alert
  if (CONFIG.alerts.slack) {
    try {
      const emoji = level === 'ERROR' ? '🚨' : level === 'WARNING' ? '⚠️' : '📊';
      const slackMessage = {
        text: `${emoji} *${level}*: ${message}`,
        attachments: [{
          color: level === 'ERROR' ? 'danger' : level === 'WARNING' ? 'warning' : 'good',
          fields: Object.entries(details).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true
          }))
        }]
      };
      
      const slackUrl = new URL(CONFIG.alerts.slack);
      const options = {
        hostname: slackUrl.hostname,
        port: slackUrl.port,
        path: slackUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const req = https.request(options);
      req.write(JSON.stringify(slackMessage));
      req.end();
    } catch (error) {
      console.error('Failed to send Slack alert:', error.message);
    }
  }
}

// Monitoring functions
async function checkResponseTime() {
  const endpoints = [
    { name: 'health', url: CONFIG.endpoints.health },
    { name: 'api_status', url: `${CONFIG.endpoints.api}/status` },
    { name: 'api_auth', url: `${CONFIG.endpoints.api}/auth/status` }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const start = Date.now();
    
    try {
      await new Promise((resolve, reject) => {
        const url = new URL(endpoint.url);
        const req = (url.protocol === 'https:' ? https : http).get(endpoint.url, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      
      const duration = Date.now() - start;
      results.push(duration);
      
      if (duration > CONFIG.thresholds.apiResponseLimit) {
        if (metricsStore.shouldAlert(`response_time_${endpoint.name}`)) {
          await sendAlert('WARNING', `High response time on ${endpoint.name}`, {
            endpoint: endpoint.name,
            responseTime: `${duration}ms`,
            threshold: `${CONFIG.thresholds.apiResponseLimit}ms`
          });
        }
      }
    } catch (error) {
      results.push(-1);
      
      if (metricsStore.shouldAlert(`endpoint_down_${endpoint.name}`)) {
        await sendAlert('ERROR', `Endpoint ${endpoint.name} is down`, {
          endpoint: endpoint.name,
          error: error.message
        });
      }
    }
  }
  
  const avgResponseTime = results.filter(r => r > 0).reduce((a, b) => a + b, 0) / results.filter(r => r > 0).length || 0;
  metricsStore.add('responseTime', avgResponseTime);
  
  return avgResponseTime;
}

async function checkMemoryUsage() {
  try {
    const { stdout } = await execAsync('ps aux | grep "node.*server.js" | grep -v grep | awk \'{sum+=$4} END {print sum}\'');
    const memoryPercent = parseFloat(stdout.trim()) || 0;
    
    // Get total system memory
    const { stdout: totalMem } = await execAsync('sysctl -n hw.memsize 2>/dev/null || grep MemTotal /proc/meminfo | awk \'{print $2*1024}\' 2>/dev/null');
    const totalMemMB = parseInt(totalMem) / 1024 / 1024;
    const memoryUsageMB = (memoryPercent / 100) * totalMemMB;
    
    metricsStore.add('memoryUsage', memoryUsageMB);
    
    if (memoryUsageMB > CONFIG.thresholds.memoryLimit) {
      if (metricsStore.shouldAlert('memory_usage_high')) {
        await sendAlert('WARNING', 'High memory usage detected', {
          current: `${Math.round(memoryUsageMB)}MB`,
          threshold: `${CONFIG.thresholds.memoryLimit}MB`,
          percentage: `${memoryPercent.toFixed(1)}%`
        });
      }
    }
    
    return memoryUsageMB;
  } catch (error) {
    console.error('Failed to check memory usage:', error.message);
    return 0;
  }
}

async function checkCPUUsage() {
  try {
    const { stdout } = await execAsync('ps aux | grep "node.*server.js" | grep -v grep | awk \'{sum+=$3} END {print sum}\'');
    const cpuUsage = parseFloat(stdout.trim()) || 0;
    
    metricsStore.add('cpuUsage', cpuUsage);
    
    if (cpuUsage > CONFIG.thresholds.cpuUsage) {
      if (metricsStore.shouldAlert('cpu_usage_high')) {
        await sendAlert('WARNING', 'High CPU usage detected', {
          current: `${cpuUsage.toFixed(1)}%`,
          threshold: `${CONFIG.thresholds.cpuUsage}%`
        });
      }
    }
    
    return cpuUsage;
  } catch (error) {
    console.error('Failed to check CPU usage:', error.message);
    return 0;
  }
}

async function checkErrorLogs() {
  try {
    // Check PM2 logs for errors in the last minute
    const { stdout } = await execAsync('pm2 logs --nostream --lines 100 | grep -c ERROR || echo 0');
    const errorCount = parseInt(stdout.trim()) || 0;
    
    metricsStore.add('errorCount', errorCount);
    
    // Calculate error rate
    const requestCount = metricsStore.getLatest('requestCount') || 100;
    const errorRate = (errorCount / requestCount) * 100;
    
    if (errorRate > CONFIG.thresholds.errorRate) {
      if (metricsStore.shouldAlert('error_rate_high')) {
        await sendAlert('ERROR', 'High error rate detected', {
          errorCount,
          errorRate: `${errorRate.toFixed(2)}%`,
          threshold: `${CONFIG.thresholds.errorRate}%`
        });
      }
    }
    
    return errorCount;
  } catch (error) {
    console.error('Failed to check error logs:', error.message);
    return 0;
  }
}

async function checkTypeCoverage() {
  try {
    const { stdout } = await execAsync('npx type-coverage --ignore-catch --detail | grep "^Coverage" | awk \'{print $2}\' | sed \'s/%//\'');
    const coverage = parseFloat(stdout.trim()) || 0;
    
    if (coverage < CONFIG.thresholds.typeCoverage) {
      if (metricsStore.shouldAlert('type_coverage_low')) {
        await sendAlert('WARNING', 'Type coverage below threshold', {
          current: `${coverage}%`,
          threshold: `${CONFIG.thresholds.typeCoverage}%`
        });
      }
    }
    
    return coverage;
  } catch (error) {
    console.error('Failed to check type coverage:', error.message);
    return 0;
  }
}

async function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    current: {
      responseTime: metricsStore.getLatest('responseTime'),
      memoryUsage: metricsStore.getLatest('memoryUsage'),
      cpuUsage: metricsStore.getLatest('cpuUsage'),
      errorCount: metricsStore.getLatest('errorCount')
    },
    averages: {
      responseTime_5min: metricsStore.getAverage('responseTime', 5),
      responseTime_1hour: metricsStore.getAverage('responseTime', 60),
      memoryUsage_5min: metricsStore.getAverage('memoryUsage', 5),
      memoryUsage_1hour: metricsStore.getAverage('memoryUsage', 60)
    },
    thresholds: CONFIG.thresholds,
    alerts: Array.from(metricsStore.alerts.entries()).map(([key, timestamp]) => ({
      alert: key,
      lastTriggered: new Date(timestamp).toISOString()
    }))
  };
  
  await fs.writeFile(
    path.join(__dirname, '..', 'monitoring-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  return report;
}

// Dashboard server
function startDashboard() {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        current: {
          responseTime: metricsStore.getLatest('responseTime'),
          memoryUsage: metricsStore.getLatest('memoryUsage'),
          cpuUsage: metricsStore.getLatest('cpuUsage'),
          errorCount: metricsStore.getLatest('errorCount')
        },
        history: {
          responseTime: metricsStore.getHistory('responseTime', 60),
          memoryUsage: metricsStore.getHistory('memoryUsage', 60),
          cpuUsage: metricsStore.getHistory('cpuUsage', 60)
        },
        thresholds: CONFIG.thresholds
      }));
    } else if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      const dashboardPath = path.join(__dirname, '..', 'monitoring-dashboard.html');
      try {
        const html = await fs.readFile(dashboardPath, 'utf8');
        res.end(html);
      } catch (error) {
        res.end('<h1>Monitoring Dashboard</h1><p>Dashboard HTML not found. Please create monitoring-dashboard.html</p>');
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  server.listen(CONFIG.monitoring.dashboardPort, () => {
    console.log(`📊 Monitoring dashboard running at http://localhost:${CONFIG.monitoring.dashboardPort}`);
  });
}

// Main monitoring loop
async function monitoringLoop() {
  console.log('🚀 Starting performance monitoring...');
  console.log(`Monitoring interval: ${CONFIG.monitoring.interval}ms`);
  console.log(`Dashboard: http://localhost:${CONFIG.monitoring.dashboardPort}`);
  
  // Initial check
  await runChecks();
  
  // Schedule regular checks
  setInterval(runChecks, CONFIG.monitoring.interval);
  
  // Daily type coverage check
  setInterval(checkTypeCoverage, 24 * 60 * 60 * 1000);
}

async function runChecks() {
  try {
    console.log(`\n[${new Date().toISOString()}] Running performance checks...`);
    
    const [responseTime, memoryUsage, cpuUsage, errorCount] = await Promise.all([
      checkResponseTime(),
      checkMemoryUsage(),
      checkCPUUsage(),
      checkErrorLogs()
    ]);
    
    console.log(`Response Time: ${responseTime.toFixed(0)}ms (limit: ${CONFIG.thresholds.apiResponseLimit}ms)`);
    console.log(`Memory Usage: ${memoryUsage.toFixed(0)}MB (limit: ${CONFIG.thresholds.memoryLimit}MB)`);
    console.log(`CPU Usage: ${cpuUsage.toFixed(1)}% (limit: ${CONFIG.thresholds.cpuUsage}%)`);
    console.log(`Error Count: ${errorCount}`);
    
    // Generate report every hour
    if (new Date().getMinutes() === 0) {
      await generateReport();
      console.log('📄 Generated hourly report');
    }
  } catch (error) {
    console.error('Error in monitoring loop:', error);
  }
}

// Signal handlers
process.on('SIGINT', () => {
  console.log('\n👋 Stopping performance monitoring...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Stopping performance monitoring...');
  process.exit(0);
});

// Start monitoring
if (require.main === module) {
  startDashboard();
  monitoringLoop();
}