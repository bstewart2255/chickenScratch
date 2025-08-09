# 9. Risk Mitigation & Rollback Strategy

## **9.1 Risk Assessment Matrix**

### **High-Risk Scenarios**

| Risk | Probability | Impact | Mitigation Strategy | Rollback Time |
|------|-------------|--------|-------------------|---------------|
| **Data corruption during migration** | Low (5%) | Critical | Pre-migration validation + backups | 30 minutes |
| **ML accuracy regression >10%** | Medium (15%) | High | A/B testing + gradual rollout | 1 hour |
| **Performance degradation >20%** | Medium (20%) | High | Performance monitoring + benchmarks | 1 hour |
| **Build pipeline breaks** | High (30%) | Medium | Gradual TypeScript adoption | 15 minutes |
| **Type errors prevent deployment** | High (40%) | Medium | Strict mode phased approach | 30 minutes |

### **Medium-Risk Scenarios**

| Risk | Probability | Impact | Mitigation Strategy | Rollback Time |
|------|-------------|--------|-------------------|---------------|
| **Frontend compatibility issues** | Medium (25%) | Medium | Progressive enhancement | 45 minutes |
| **Database schema conflicts** | Low (10%) | Medium | Schema validation scripts | 30 minutes |
| **Third-party library conflicts** | Medium (20%) | Low | Version pinning + testing | 15 minutes |
| **Team productivity drop** | Medium (30%) | Low | Training + documentation | N/A |

## **9.2 Pre-Migration Safety Measures**

### **Data Backup Strategy**
```bash
#!/bin/bash
# scripts/create-migration-backup.sh

set -e

BACKUP_DIR="backups/migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🔄 Creating comprehensive backup..."

# 1. Database backup
echo "Backing up database..."
pg_dump $DATABASE_URL > "$BACKUP_DIR/database.sql"
echo "✅ Database backup complete"

# 2. Codebase backup
echo "Backing up codebase..."
tar -czf "$BACKUP_DIR/codebase.tar.gz" \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  .
echo "✅ Codebase backup complete"

# 3. Configuration backup
echo "Backing up configuration..."
cp -r backend/config "$BACKUP_DIR/config/"
cp package*.json "$BACKUP_DIR/"
echo "✅ Configuration backup complete"

# 4. Create restore script
cat > "$BACKUP_DIR/restore.sh" << 'EOF'
#!/bin/bash
set -e

echo "🔄 Restoring from backup..."

# Stop services
sudo systemctl stop signature-auth || echo "Service not running"

# Restore database
psql $DATABASE_URL < database.sql

# Restore codebase
tar -xzf codebase.tar.gz -C /var/www/signature-auth/

# Restore configuration
cp -r config/* /var/www/signature-auth/backend/config/
cp package*.json /var/www/signature-auth/

# Reinstall dependencies
cd /var/www/signature-auth
npm ci

# Start services
sudo systemctl start signature-auth

echo "✅ Restore complete"
EOF

chmod +x "$BACKUP_DIR/restore.sh"

echo "✅ Backup created: $BACKUP_DIR"
echo "To restore: bash $BACKUP_DIR/restore.sh"
```

### **Environment Validation**
```typescript
// scripts/pre-migration-validation.ts
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Pool } from 'pg';

interface ValidationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
}

export class PreMigrationValidator {
  public async validateEnvironment(): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      checks: []
    };

    // Check Node.js version
    await this.checkNodeVersion(result);
    
    // Check npm dependencies
    await this.checkDependencies(result);
    
    // Check database connectivity
    await this.checkDatabase(result);
    
    // Check file permissions
    await this.checkFilePermissions(result);
    
    // Check disk space
    await this.checkDiskSpace(result);
    
    // Check git status
    await this.checkGitStatus(result);

    result.passed = result.checks.every(check => check.passed);
    
    return result;
  }

  private async checkNodeVersion(result: ValidationResult): Promise<void> {
    try {
      const version = process.version;
      const majorVersion = parseInt(version.substring(1).split('.')[0]);
      
      const passed = majorVersion >= 18;
      result.checks.push({
        name: 'Node.js Version',
        passed,
        message: passed 
          ? `✅ Node.js ${version} (>=18 required)`
          : `❌ Node.js ${version} (<18 not supported)`
      });
    } catch (error) {
      result.checks.push({
        name: 'Node.js Version',
        passed: false,
        message: `❌ Failed to check Node.js version: ${error.message}`
      });
    }
  }

  private async checkDependencies(result: ValidationResult): Promise<void> {
    try {
      execSync('npm list --depth=0', { stdio: 'pipe' });
      result.checks.push({
        name: 'NPM Dependencies',
        passed: true,
        message: '✅ All dependencies installed'
      });
    } catch (error) {
      result.checks.push({
        name: 'NPM Dependencies',
        passed: false,
        message: '❌ Missing dependencies - run npm install'
      });
    }
  }

  private async checkDatabase(result: ValidationResult): Promise<void> {
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query('SELECT 1');
      await pool.end();
      
      result.checks.push({
        name: 'Database Connection',
        passed: true,
        message: '✅ Database connection successful'
      });
    } catch (error) {
      result.checks.push({
        name: 'Database Connection',
        passed: false,
        message: `❌ Database connection failed: ${error.message}`
      });
    }
  }

  private async checkFilePermissions(result: ValidationResult): Promise<void> {
    try {
      const testFile = 'temp-permission-test';
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      result.checks.push({
        name: 'File Permissions',
        passed: true,
        message: '✅ Write permissions available'
      });
    } catch (error) {
      result.checks.push({
        name: 'File Permissions',
        passed: false,
        message: `❌ Insufficient file permissions: ${error.message}`
      });
    }
  }

  private async checkDiskSpace(result: ValidationResult): Promise<void> {
    try {
      const stats = fs.statSync('.');
      // This is a simplified check - in production you'd use a proper disk space utility
      
      result.checks.push({
        name: 'Disk Space',
        passed: true,
        message: '✅ Sufficient disk space available'
      });
    } catch (error) {
      result.checks.push({
        name: 'Disk Space',
        passed: false,
        message: `❌ Cannot check disk space: ${error.message}`
      });
    }
  }

  private async checkGitStatus(result: ValidationResult): Promise<void> {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      const hasUncommittedChanges = status.trim().length > 0;
      
      result.checks.push({
        name: 'Git Status',
        passed: !hasUncommittedChanges,
        message: hasUncommittedChanges
          ? '⚠️ Uncommitted changes detected - commit before migration'
          : '✅ Git working directory clean'
      });
    } catch (error) {
      result.checks.push({
        name: 'Git Status',
        passed: false,
        message: `❌ Git status check failed: ${error.message}`
      });
    }
  }
}
```

## **9.3 Rollback Procedures**

### **Immediate Rollback (0-15 minutes)**
```bash
#!/bin/bash
# scripts/emergency-rollback.sh

set -e

ROLLBACK_REASON=${1:-"Manual rollback"}
BACKUP_TIMESTAMP=${2:-"latest"}

echo "🚨 EMERGENCY ROLLBACK INITIATED"
echo "Reason: $ROLLBACK_REASON"
echo "Time: $(date)"

# 1. Stop current services immediately
echo "Stopping services..."
sudo systemctl stop signature-auth || echo "Service already stopped"

# 2. Find latest backup if not specified
if [ "$BACKUP_TIMESTAMP" = "latest" ]; then
  BACKUP_DIR=$(ls -1t backups/ | head -1)
  BACKUP_PATH="backups/$BACKUP_DIR"
else
  BACKUP_PATH="backups/migration-$BACKUP_TIMESTAMP"
fi

if [ ! -d "$BACKUP_PATH" ]; then
  echo "❌ Backup not found: $BACKUP_PATH"
  echo "Available backups:"
  ls -la backups/
  exit 1
fi

echo "Using backup: $BACKUP_PATH"

# 3. Restore from backup
echo "Restoring from backup..."
bash "$BACKUP_PATH/restore.sh"

# 4. Verify rollback
echo "Verifying rollback..."
sleep 5

# Health check
if curl -f http://localhost:3000/api/health 2>/dev/null; then
  echo "✅ Rollback successful - service is healthy"
else
  echo "❌ Rollback verification failed"
  exit 1
fi

# 5. Log rollback
echo "$(date): Emergency rollback completed. Reason: $ROLLBACK_REASON" >> rollback.log

echo "✅ Emergency rollback completed successfully"
```

### **Graduated Rollback Strategy**
```typescript
// scripts/graduated-rollback.ts
import { MigrationTracker } from './MigrationTracker';
import { execSync } from 'child_process';

export class GraduatedRollback {
  private tracker: MigrationTracker;

  constructor() {
    this.tracker = new MigrationTracker();
  }

  public async rollbackToPhase(targetPhase: string): Promise<void> {
    const currentPhase = this.tracker.getCurrentPhase();
    console.log(`🔄 Rolling back from ${currentPhase} to ${targetPhase}`);

    const rollbackActions = {
      'deployment': () => this.rollbackDeployment(),
      'testing': () => this.rollbackTesting(),
      'frontend': () => this.rollbackFrontend(),
      'backend': () => this.rollbackBackend(),
      'types': () => this.rollbackTypes(),
      'infrastructure': () => this.rollbackInfrastructure(),
      'preMigration': () => this.rollbackToStart()
    };

    const phases = Object.keys(rollbackActions);
    const currentIndex = phases.indexOf(currentPhase);
    const targetIndex = phases.indexOf(targetPhase);

    if (targetIndex >= currentIndex) {
      throw new Error('Cannot rollback to a later phase');
    }

    // Execute rollback actions in reverse order
    for (let i = currentIndex; i > targetIndex; i--) {
      const phase = phases[i];
      console.log(`Rolling back phase: ${phase}`);
      
      try {
        await rollbackActions[phase]();
        this.tracker.updatePhase(phase, { status: 'pending' });
      } catch (error) {
        console.error(`Failed to rollback phase ${phase}:`, error);
        throw error;
      }
    }

    this.tracker.updatePhase(targetPhase, { status: 'completed' });
    console.log(`✅ Rollback to ${targetPhase} completed`);
  }

  private async rollbackDeployment(): Promise<void> {
    console.log('Rolling back deployment...');
    
    // Stop production services
    execSync('sudo systemctl stop signature-auth');
    
    // Restore previous deployment
    execSync('mv /var/www/signature-auth /var/www/signature-auth-failed');
    execSync('mv /var/www/signature-auth-backup /var/www/signature-auth');
    
    // Start services
    execSync('sudo systemctl start signature-auth');
  }

  private async rollbackTesting(): Promise<void> {
    console.log('Rolling back testing configuration...');
    
    // Remove test files
    execSync('rm -rf src/**/*.test.ts src/**/*.spec.ts');
    
    // Restore original jest config
    execSync('git checkout HEAD -- jest.config.js');
  }

  private async rollbackFrontend(): Promise<void> {
    console.log('Rolling back frontend changes...');
    
    // Restore JavaScript files
    execSync('git checkout HEAD -- frontend/*.js');
    
    // Remove TypeScript files
    execSync('rm -rf frontend/*.ts');
  }

  private async rollbackBackend(): Promise<void> {
    console.log('Rolling back backend changes...');
    
    // Restore JavaScript files
    execSync('git checkout HEAD -- backend/*.js');
    
    // Remove TypeScript files
    execSync('rm -rf backend/*.ts src/');
  }

  private async rollbackTypes(): Promise<void> {
    console.log('Rolling back type definitions...');
    
    // Remove types directory
    execSync('rm -rf src/types/');
  }

  private async rollbackInfrastructure(): Promise<void> {
    console.log('Rolling back infrastructure changes...');
    
    // Restore original package.json
    execSync('git checkout HEAD -- package.json package-lock.json');
    
    // Remove TypeScript configuration
    execSync('rm -f tsconfig*.json');
    
    // Reinstall original dependencies
    execSync('npm ci');
  }

  private async rollbackToStart(): Promise<void> {
    console.log('Rolling back to pre-migration state...');
    
    // Full git reset to migration start point
    execSync('git reset --hard migration-v2-start');
    
    // Clean any untracked files
    execSync('git clean -fd');
    
    // Reinstall dependencies
    execSync('npm ci');
  }
}
```

## **9.4 Automated Health Monitoring**

### **Continuous Health Checks During Migration**
```typescript
// scripts/migration-health-monitor.ts
import { PerformanceMonitor } from './performance-monitor';
import { MLAccuracyMonitor } from '../src/monitoring/MLAccuracyMonitor';
import { ErrorMonitor } from '../src/monitoring/ErrorMonitor';

interface HealthThresholds {
  errorRate: number;        // errors per hour
  responseTime: number;     // milliseconds
  mlAccuracy: number;       // 0-1
  memoryUsage: number;      // bytes
  cpuUsage: number;         // percentage
}

export class MigrationHealthMonitor {
  private thresholds: HealthThresholds = {
    errorRate: 10,
    responseTime: 2000,
    mlAccuracy: 0.85,
    memoryUsage: 512 * 1024 * 1024, // 512MB
    cpuUsage: 80 // 80%
  };

  private performanceMonitor: PerformanceMonitor;
  private mlMonitor: MLAccuracyMonitor;
  private errorMonitor: ErrorMonitor;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.mlMonitor = new MLAccuracyMonitor();
    this.errorMonitor = new ErrorMonitor();
  }

  public startMonitoring(intervalMs: number = 30000): void {
    console.log('🔍 Starting migration health monitoring...');
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
  }

  public stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('⏹️ Stopped migration health monitoring');
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.gatherHealthMetrics();
      const issues = this.analyzeHealth(health);

      if (issues.critical.length > 0) {
        console.error('🚨 CRITICAL HEALTH ISSUES DETECTED:');
        issues.critical.forEach(issue => console.error(`  ${issue}`));
        
        // Trigger automatic rollback for critical issues
        await this.triggerEmergencyRollback(issues.critical);
      } else if (issues.warnings.length > 0) {
        console.warn('⚠️ Health warnings detected:');
        issues.warnings.forEach(warning => console.warn(`  ${warning}`));
      } else {
        console.log('✅ Health check passed');
      }

    } catch (error) {
      console.error('❌ Health check failed:', error.message);
    }
  }

  private async gatherHealthMetrics(): Promise<any> {
    return {
      timestamp: Date.now(),
      errorRate: this.errorMonitor.getErrorRate(1), // Last hour
      responseTime: await this.getAverageResponseTime(),
      mlAccuracy: this.mlMonitor.getAccuracy(1), // Last hour
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: await this.getCpuUsage()
    };
  }

  private analyzeHealth(health: any): { critical: string[], warnings: string[] } {
    const critical: string[] = [];
    const warnings: string[] = [];

    // Critical issues that require immediate rollback
    if (health.errorRate > this.thresholds.errorRate * 2) {
      critical.push(`Error rate critically high: ${health.errorRate.toFixed(1)}/hour`);
    }
    
    if (health.mlAccuracy < this.thresholds.mlAccuracy - 0.1) {
      critical.push(`ML accuracy critically low: ${(health.mlAccuracy * 100).toFixed(1)}%`);
    }
    
    if (health.responseTime > this.thresholds.responseTime * 3) {
      critical.push(`Response time critically slow: ${health.responseTime.toFixed(0)}ms`);
    }

    // Warning issues that need attention
    if (health.errorRate > this.thresholds.errorRate) {
      warnings.push(`Error rate elevated: ${health.errorRate.toFixed(1)}/hour`);
    }
    
    if (health.responseTime > this.thresholds.responseTime) {
      warnings.push(`Response time slow: ${health.responseTime.toFixed(0)}ms`);
    }
    
    if (health.memoryUsage > this.thresholds.memoryUsage) {
      warnings.push(`Memory usage high: ${(health.memoryUsage / 1024 / 1024).toFixed(0)}MB`);
    }

    return { critical, warnings };
  }

  private async triggerEmergencyRollback(issues: string[]): Promise<void> {
    console.error('🚨 Triggering emergency rollback due to critical issues');
    
    const rollbackReason = `Automatic rollback: ${issues.join(', ')}`;
    
    try {
      const { execSync } = require('child_process');
      execSync(`bash scripts/emergency-rollback.sh "${rollbackReason}"`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.error('❌ Emergency rollback failed:', error.message);
      // Alert operations team
      this.alertOperationsTeam(`Emergency rollback failed: ${error.message}`);
    }
  }

  private async getAverageResponseTime(): Promise<number> {
    // This would integrate with your performance monitoring
    // For now, return a mock value
    return Math.random() * 1000 + 500;
  }

  private async getCpuUsage(): Promise<number> {
    // This would integrate with system monitoring
    // For now, return a mock value
    return Math.random() * 100;
  }

  private alertOperationsTeam(message: string): void {
    // Integration with alerting systems
    console.error(`🚨 OPERATIONS ALERT: ${message}`);
    
    // Could integrate with:
    // - PagerDuty
    // - Slack webhooks
    // - Email notifications
    // - SMS alerts
  }
}
```

## **9.5 A/B Testing Strategy**

### **Gradual Feature Rollout**
```typescript
// src/utils/FeatureToggle.ts
export class FeatureToggle {
  private static features: Map<string, boolean> = new Map();
  private static userGroups: Map<string, string> = new Map();

  public static initialize(): void {
    // Default feature states
    this.features.set('typescript_backend', false);
    this.features.set('typescript_frontend', false);
    this.features.set('enhanced_ml', false);
    this.features.set('new_api_client', false);
  }

  public static enableFeatureForPercentage(
    featureName: string, 
    percentage: number
  ): void {
    // Enable feature for a percentage of users
    const enabled = Math.random() * 100 < percentage;
    this.features.set(featureName, enabled);
    
    console.log(`🎛️ Feature '${featureName}' ${enabled ? 'enabled' : 'disabled'} for ${percentage}% rollout`);
  }

  public static enableFeatureForUser(
    featureName: string, 
    userId: string
  ): void {
    this.userGroups.set(userId, featureName);
    console.log(`🎛️ Feature '${featureName}' enabled for user ${userId}`);
  }

  public static isFeatureEnabled(
    featureName: string, 
    userId?: string
  ): boolean {
    // Check user-specific override first
    if (userId && this.userGroups.get(userId) === featureName) {
      return true;
    }

    // Check global feature state
    return this.features.get(featureName) || false;
  }

  public static getFeatureStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.features.forEach((enabled, feature) => {
      status[feature] = enabled;
    });
    return status;
  }
}

// Usage in migration
export class MigrationFeatureController {
  public static initializeMigrationFeatures(): void {
    FeatureToggle.initialize();
    
    // Start with TypeScript features disabled
    FeatureToggle.enableFeatureForPercentage('typescript_backend', 0);
    FeatureToggle.enableFeatureForPercentage('typescript_frontend', 0);
  }

  public static graduallEnableTypeScriptBackend(): void {
    // Week 1: Enable for 10% of traffic
    setTimeout(() => {
      FeatureToggle.enableFeatureForPercentage('typescript_backend', 10);
    }, 7 * 24 * 60 * 60 * 1000); // 1 week

    // Week 2: Enable for 50% of traffic
    setTimeout(() => {
      FeatureToggle.enableFeatureForPercentage('typescript_backend', 50);
    }, 14 * 24 * 60 * 60 * 1000); // 2 weeks

    // Week 3: Enable for 100% of traffic
    setTimeout(() => {
      FeatureToggle.enableFeatureForPercentage('typescript_backend', 100);
    }, 21 * 24 * 60 * 60 * 1000); // 3 weeks
  }
}
```

## **9.6 Database Migration Safety**

### **Safe Database Schema Changes**
```typescript
// scripts/safe-database-migration.ts
import { Pool } from 'pg';

export class SafeDatabaseMigration {
  private pool: Pool;
  private backupTable: string;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  public async safeAddColumn(
    tableName: string, 
    columnName: string, 
    columnType: string,
    defaultValue?: any
  ): Promise<void> {
    console.log(`🔄 Safely adding column ${columnName} to ${tableName}`);

    const client = await this.pool.connect();
    
    try {
      // 1. Check if column already exists
      const existsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `;
      
      const exists = await client.query(existsQuery, [tableName, columnName]);
      
      if (exists.rows.length > 0) {
        console.log(`✅ Column ${columnName} already exists in ${tableName}`);
        return;
      }

      // 2. Create backup table
      this.backupTable = `${tableName}_backup_${Date.now()}`;
      await client.query(`CREATE TABLE ${this.backupTable} AS SELECT * FROM ${tableName}`);
      console.log(`✅ Backup table created: ${this.backupTable}`);

      // 3. Add column with default value
      let addColumnQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
      if (defaultValue !== undefined) {
        addColumnQuery += ` DEFAULT $1`;
      }

      if (defaultValue !== undefined) {
        await client.query(addColumnQuery, [defaultValue]);
      } else {
        await client.query(addColumnQuery);
      }

      console.log(`✅ Column ${columnName} added successfully`);

      // 4. Verify the migration
      const verifyQuery = `SELECT COUNT(*) FROM ${tableName}`;
      const originalCount = await client.query(`SELECT COUNT(*) FROM ${this.backupTable}`);
      const newCount = await client.query(verifyQuery);

      if (originalCount.rows[0].count !== newCount.rows[0].count) {
        throw new Error('Row count mismatch after migration');
      }

      console.log(`✅ Migration verified: ${newCount.rows[0].count} rows preserved`);

    } catch (error) {
      console.error(`❌ Migration failed: ${error.message}`);
      await this.rollbackColumnAddition(tableName, columnName);
      throw error;
    } finally {
      client.release();
    }
  }

  private async rollbackColumnAddition(
    tableName: string, 
    columnName: string
  ): Promise<void> {
    console.log(`🔄 Rolling back column addition...`);
    
    const client = await this.pool.connect();
    
    try {
      // Drop the added column
      await client.query(`ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${columnName}`);
      
      console.log(`✅ Column ${columnName} removed`);
      
      // Optionally restore from backup if needed
      if (this.backupTable) {
        console.log(`Backup table ${this.backupTable} preserved for manual recovery`);
      }
      
    } catch (rollbackError) {
      console.error(`❌ Rollback failed: ${rollbackError.message}`);
      
      if (this.backupTable) {
        console.log(`🆘 Manual recovery required using backup table: ${this.backupTable}`);
      }
    } finally {
      client.release();
    }
  }

  public async cleanupBackups(olderThanDays: number = 7): Promise<void> {
    console.log(`🧹 Cleaning up backup tables older than ${olderThanDays} days`);
    
    const client = await this.pool.connect();
    
    try {
      // Find old backup tables
      const tablesQuery = `
        SELECT tablename 
        FROM pg_tables 
        WHERE tablename LIKE '%_backup_%'
        AND schemaname = 'public'
      `;
      
      const result = await client.query(tablesQuery);
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      
      for (const row of result.rows) {
        const tableName = row.tablename;
        const timestampMatch = tableName.match(/_backup_(\d+)$/);
        
        if (timestampMatch) {
          const timestamp = parseInt(timestampMatch[1]);
          
          if (timestamp < cutoffTime) {
            await client.query(`DROP TABLE ${tableName}`);
            console.log(`🗑️ Dropped old backup table: ${tableName}`);
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Backup cleanup failed: ${error.message}`);
    } finally {
      client.release();
    }
  }
}
```

## **9.7 Recovery Procedures**

### **Data Recovery Scripts**
```bash
#!/bin/bash
# scripts/data-recovery.sh

set -e

RECOVERY_TYPE=${1:-"full"}
BACKUP_TIMESTAMP=${2:-"latest"}

echo "🔄 Starting data recovery: $RECOVERY_TYPE"

case $RECOVERY_TYPE in
  "database")
    echo "Recovering database only..."
    
    # Find backup
    if [ "$BACKUP_TIMESTAMP" = "latest" ]; then
      BACKUP_DIR=$(ls -1t backups/ | head -1)
    else
      BACKUP_DIR="migration-$BACKUP_TIMESTAMP"
    fi
    
    BACKUP_PATH="backups/$BACKUP_DIR"
    
    if [ ! -f "$BACKUP_PATH/database.sql" ]; then
      echo "❌ Database backup not found: $BACKUP_PATH/database.sql"
      exit 1
    fi
    
    # Create recovery point
    echo "Creating recovery point..."
    pg_dump $DATABASE_URL > "recovery-point-$(date +%Y%m%d-%H%M%S).sql"
    
    # Restore database
    echo "Restoring database..."
    psql $DATABASE_URL < "$BACKUP_PATH/database.sql"
    
    echo "✅ Database recovery completed"
    ;;
    
  "codebase")
    echo "Recovering codebase only..."
    
    # Stop services
    sudo systemctl stop signature-auth
    
    # Backup current state
    mv /var/www/signature-auth "/var/www/signature-auth-recovery-$(date +%Y%m%d-%H%M%S)"
    
    # Restore from backup
    BACKUP_PATH="backups/$BACKUP_DIR"
    tar -xzf "$BACKUP_PATH/codebase.tar.gz" -C /var/www/
    
    # Restore configuration
    cp -r "$BACKUP_PATH/config"/* /var/www/signature-auth/backend/config/
    
    # Reinstall dependencies
    cd /var/www/signature-auth
    npm ci
    
    # Start services  
    sudo systemctl start signature-auth
    
    echo "✅ Codebase recovery completed"
    ;;
    
  "full")
    echo "Performing full recovery..."
    
    # Execute both database and codebase recovery
    $0 database $BACKUP_TIMESTAMP
    $0 codebase $BACKUP_TIMESTAMP
    
    echo "✅ Full recovery completed"
    ;;
    
  *)
    echo "❌ Unknown recovery type: $RECOVERY_TYPE"
    echo "Usage: $0 [database|codebase|full] [backup_timestamp]"
    exit 1
    ;;
esac

# Verify recovery
echo "Verifying recovery..."
sleep 5

if curl -f http://localhost:3000/api/health 2>/dev/null; then
  echo "✅ Recovery verification successful"
else
  echo "❌ Recovery verification failed"
  exit 1
fi

# Log recovery
echo "$(date): Recovery completed - Type: $RECOVERY_TYPE, Backup: $BACKUP_TIMESTAMP" >> recovery.log
```

### **Disaster Recovery Checklist**
```markdown
# Disaster Recovery Checklist

## Immediate Response (0-15 minutes)
- [ ] Assess the severity of the issue
- [ ] Stop all affected services
- [ ] Notify stakeholders
- [ ] Activate incident response team
- [ ] Create incident log

## Short-term Recovery (15-60 minutes)
- [ ] Identify the root cause
- [ ] Determine rollback strategy
- [ ] Execute emergency rollback if needed
- [ ] Restore from latest backup
- [ ] Verify system functionality

## Long-term Recovery (1-24 hours)
- [ ] Investigate root cause thoroughly
- [ ] Fix underlying issues
- [ ] Test fixes in staging environment
- [ ] Plan re-deployment strategy
- [ ] Update documentation

## Post-Incident (24+ hours)
- [ ] Conduct post-mortem meeting
- [ ] Document lessons learned
- [ ] Update procedures and safeguards
- [ ] Implement preventive measures
- [ ] Review and test disaster recovery plan
```