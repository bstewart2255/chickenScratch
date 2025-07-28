const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    'postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth',
  ssl: {
    rejectUnauthorized: false
  }
});

// Alert configuration
const alertConfig = {
  email: {
    enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    recipients: (process.env.ALERT_RECIPIENTS || '').split(',').filter(e => e),
    from: process.env.ALERT_FROM || 'monitoring@signatureauth.com'
  },
  webhook: {
    enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
    url: process.env.ALERT_WEBHOOK_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.ALERT_WEBHOOK_AUTH
    }
  },
  console: {
    enabled: true // Always log to console
  }
};

// Email transporter (initialize only if email alerts are enabled)
let emailTransporter = null;
if (alertConfig.email.enabled) {
  emailTransporter = nodemailer.createTransport(alertConfig.email.smtp);
}

// Alert severity levels
const SEVERITY_LEVELS = {
  info: { priority: 0, emoji: 'ℹ️', color: '#2196F3' },
  warning: { priority: 1, emoji: '⚠️', color: '#FF9800' },
  error: { priority: 2, emoji: '❌', color: '#F44336' },
  critical: { priority: 3, emoji: '🚨', color: '#D32F2F' }
};

// Alert processor class
class AlertProcessor {
  constructor() {
    this.processingInterval = null;
    this.checkInterval = parseInt(process.env.ALERT_CHECK_INTERVAL || '60000'); // 1 minute default
  }

  async start() {
    console.log('🚀 Starting alert processor...');
    
    // Initial check
    await this.processAlerts();
    
    // Set up interval
    this.processingInterval = setInterval(() => {
      this.processAlerts().catch(err => {
        console.error('Error processing alerts:', err);
      });
    }, this.checkInterval);
    
    console.log(`✅ Alert processor started (checking every ${this.checkInterval / 1000} seconds)`);
  }

  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('🛑 Alert processor stopped');
    }
  }

  async processAlerts() {
    const client = await pool.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      
      // Get unprocessed alerts
      const alertsResult = await client.query(`
        SELECT 
          id,
          alert_type,
          severity,
          component,
          message,
          details,
          created_at
        FROM monitoring_alerts
        WHERE acknowledged = false
        AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY 
          CASE severity
            WHEN 'critical' THEN 4
            WHEN 'error' THEN 3
            WHEN 'warning' THEN 2
            WHEN 'info' THEN 1
            ELSE 0
          END DESC,
          created_at DESC
        LIMIT 50
      `);
      
      if (alertsResult.rows.length === 0) {
        return; // No alerts to process
      }
      
      console.log(`Processing ${alertsResult.rows.length} alerts...`);
      
      // Group alerts by severity
      const alertsBySeverity = alertsResult.rows.reduce((acc, alert) => {
        if (!acc[alert.severity]) acc[alert.severity] = [];
        acc[alert.severity].push(alert);
        return acc;
      }, {});
      
      // Send notifications
      const notificationPromises = [];
      
      for (const [severity, alerts] of Object.entries(alertsBySeverity)) {
        // Only send immediate notifications for error and critical
        if (['error', 'critical'].includes(severity)) {
          notificationPromises.push(this.sendNotifications(severity, alerts));
        }
      }
      
      await Promise.all(notificationPromises);
      
      // Mark alerts as acknowledged (in real system, this would be done after human review)
      // For now, we'll auto-acknowledge info and warning alerts
      const autoAckIds = alertsResult.rows
        .filter(a => ['info', 'warning'].includes(a.severity))
        .map(a => a.id);
      
      if (autoAckIds.length > 0) {
        await client.query(`
          UPDATE monitoring_alerts
          SET 
            acknowledged = true,
            acknowledged_at = NOW(),
            acknowledged_by = 'auto-processor'
          WHERE id = ANY($1)
        `, [autoAckIds]);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in processAlerts:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async sendNotifications(severity, alerts) {
    const severityInfo = SEVERITY_LEVELS[severity];
    const summary = this.createAlertSummary(severity, alerts);
    
    // Console notification (always enabled)
    if (alertConfig.console.enabled) {
      console.log(`\n${severityInfo.emoji} ${severity.toUpperCase()} ALERTS ${severityInfo.emoji}`);
      console.log('='.repeat(50));
      console.log(summary.text);
      console.log('='.repeat(50));
    }
    
    // Email notification
    if (alertConfig.email.enabled && alertConfig.email.recipients.length > 0) {
      try {
        await this.sendEmailAlert(severity, summary);
      } catch (error) {
        console.error('Failed to send email alert:', error);
      }
    }
    
    // Webhook notification
    if (alertConfig.webhook.enabled && alertConfig.webhook.url) {
      try {
        await this.sendWebhookAlert(severity, alerts, summary);
      } catch (error) {
        console.error('Failed to send webhook alert:', error);
      }
    }
  }

  createAlertSummary(severity, alerts) {
    const severityInfo = SEVERITY_LEVELS[severity];
    const components = [...new Set(alerts.map(a => a.component))];
    
    const text = `
${alerts.length} ${severity} alert(s) detected

Components affected: ${components.join(', ')}

Recent alerts:
${alerts.slice(0, 5).map(a => 
  `- [${a.component}] ${a.message} (${new Date(a.created_at).toLocaleString()})`
).join('\n')}
${alerts.length > 5 ? `\n... and ${alerts.length - 5} more alerts` : ''}
    `.trim();
    
    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <h2 style="color: ${severityInfo.color};">
    ${severityInfo.emoji} ${alerts.length} ${severity.toUpperCase()} Alert(s) Detected
  </h2>
  
  <p><strong>Components affected:</strong> ${components.join(', ')}</p>
  
  <h3>Recent Alerts:</h3>
  <ul>
    ${alerts.slice(0, 10).map(a => `
      <li>
        <strong>[${a.component}]</strong> ${a.message}
        <br>
        <small style="color: #666;">
          ${new Date(a.created_at).toLocaleString()}
          ${a.details ? `<br>Details: ${JSON.stringify(a.details)}` : ''}
        </small>
      </li>
    `).join('')}
  </ul>
  ${alerts.length > 10 ? `<p><em>... and ${alerts.length - 10} more alerts</em></p>` : ''}
  
  <hr>
  <p style="color: #666; font-size: 12px;">
    This is an automated alert from the Signature Auth monitoring system.
  </p>
</div>
    `.trim();
    
    return { text, html };
  }

  async sendEmailAlert(severity, summary) {
    if (!emailTransporter) return;
    
    const severityInfo = SEVERITY_LEVELS[severity];
    
    const mailOptions = {
      from: alertConfig.email.from,
      to: alertConfig.email.recipients.join(', '),
      subject: `${severityInfo.emoji} [${severity.toUpperCase()}] Signature Auth Monitoring Alert`,
      text: summary.text,
      html: summary.html
    };
    
    await emailTransporter.sendMail(mailOptions);
    console.log(`📧 Email alert sent to ${alertConfig.email.recipients.length} recipient(s)`);
  }

  async sendWebhookAlert(severity, alerts, summary) {
    const severityInfo = SEVERITY_LEVELS[severity];
    
    const payload = {
      severity,
      severityInfo,
      alertCount: alerts.length,
      summary: summary.text,
      alerts: alerts.map(a => ({
        id: a.id,
        type: a.alert_type,
        component: a.component,
        message: a.message,
        details: a.details,
        created_at: a.created_at
      })),
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(alertConfig.webhook.url, {
      method: 'POST',
      headers: alertConfig.webhook.headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }
    
    console.log(`🪝 Webhook alert sent to ${alertConfig.webhook.url}`);
  }

  // Method to manually trigger an alert check
  async checkNow() {
    console.log('⚡ Manual alert check triggered');
    await this.processAlerts();
  }

  // Method to get current alert statistics
  async getAlertStats() {
    const result = await pool.query(`
      SELECT 
        severity,
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM monitoring_alerts
      WHERE acknowledged = false
      GROUP BY severity
      ORDER BY 
        CASE severity
          WHEN 'critical' THEN 4
          WHEN 'error' THEN 3
          WHEN 'warning' THEN 2
          WHEN 'info' THEN 1
          ELSE 0
        END DESC
    `);
    
    return result.rows;
  }
}

// Health check endpoint for the alert processor
async function getHealthStatus() {
  try {
    // Check database connection
    const dbCheck = await pool.query('SELECT 1');
    
    // Check alert processor status
    const stats = await processor.getAlertStats();
    
    return {
      status: 'healthy',
      database: 'connected',
      alertStats: stats,
      config: {
        emailEnabled: alertConfig.email.enabled,
        webhookEnabled: alertConfig.webhook.enabled,
        checkInterval: processor.checkInterval
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

// Create and export the alert processor instance
const processor = new AlertProcessor();

// Start the processor if this is the main module
if (require.main === module) {
  processor.start();
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    processor.stop();
    pool.end();
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    processor.stop();
    pool.end();
    process.exit(0);
  });
}

module.exports = {
  AlertProcessor,
  processor,
  getHealthStatus,
  alertConfig,
  SEVERITY_LEVELS
};