# 8. Monitoring & Success Metrics

## **8.1 Performance Metrics**

### **Build Performance Tracking**
```typescript
// scripts/performance-monitor.ts
interface BuildMetrics {
  typescript: {
    compileTime: number;
    memoryUsage: number;
    errorCount: number;
    warningCount: number;
  };
  tests: {
    totalTime: number;
    coverage: number;
    passRate: number;
    suiteCount: number;
  };
  bundle: {
    size: number;
    gzipSize: number;
    loadTime: number;
  };
}

export class PerformanceMonitor {
  private baseline: BuildMetrics | null = null;

  public recordBaseline(metrics: BuildMetrics): void {
    this.baseline = metrics;
    console.log('📊 Performance baseline recorded');
  }

  public compareMetrics(current: BuildMetrics): void {
    if (!this.baseline) {
      console.warn('⚠️ No baseline available for comparison');
      return;
    }

    const comparison = {
      compileTime: this.calculateChange(current.typescript.compileTime, this.baseline.typescript.compileTime),
      testTime: this.calculateChange(current.tests.totalTime, this.baseline.tests.totalTime),
      bundleSize: this.calculateChange(current.bundle.size, this.baseline.bundle.size),
      coverage: this.calculateChange(current.tests.coverage, this.baseline.tests.coverage)
    };

    console.log('📈 Performance Comparison:');
    console.log(`  Compile Time: ${comparison.compileTime > 0 ? '+' : ''}${comparison.compileTime.toFixed(1)}%`);
    console.log(`  Test Time: ${comparison.testTime > 0 ? '+' : ''}${comparison.testTime.toFixed(1)}%`);
    console.log(`  Bundle Size: ${comparison.bundleSize > 0 ? '+' : ''}${comparison.bundleSize.toFixed(1)}%`);
    console.log(`  Coverage: ${comparison.coverage > 0 ? '+' : ''}${comparison.coverage.toFixed(1)}%`);

    // Alert on significant regressions
    if (comparison.compileTime > 50) {
      console.error('🚨 ALERT: Compile time increased by >50%');
    }
    if (comparison.bundleSize > 20) {
      console.error('🚨 ALERT: Bundle size increased by >20%');
    }
  }

  private calculateChange(current: number, baseline: number): number {
    return ((current - baseline) / baseline) * 100;
  }
}
```

### **Runtime Performance Monitoring**
```typescript
// src/middleware/performanceMonitor.ts
import { Request, Response, NextFunction } from 'express';

interface RequestMetrics {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  memoryUsage: number;
  timestamp: number;
}

export class RuntimePerformanceMonitor {
  private metrics: RequestMetrics[] = [];
  private readonly maxMetrics = 10000;

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage().heapUsed;

      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const endMemory = process.memoryUsage().heapUsed;

        const metric: RequestMetrics = {
          endpoint: req.route?.path || req.path,
          method: req.method,
          duration,
          statusCode: res.statusCode,
          memoryUsage: endMemory - startMemory,
          timestamp: Date.now()
        };

        this.recordMetric(metric);
      });

      next();
    };
  }

  private recordMetric(metric: RequestMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Alert on slow requests
    if (metric.duration > 5000) { // 5 seconds
      console.warn(`🐌 Slow request detected: ${metric.method} ${metric.endpoint} took ${metric.duration.toFixed(0)}ms`);
    }

    // Alert on high memory usage
    if (metric.memoryUsage > 50 * 1024 * 1024) { // 50MB
      console.warn(`🧠 High memory usage: ${metric.method} ${metric.endpoint} used ${(metric.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  public getAverageResponseTime(endpoint?: string, hours: number = 1): number {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const relevantMetrics = this.metrics.filter(m => 
      m.timestamp > since && 
      (endpoint ? m.endpoint === endpoint : true)
    );

    if (relevantMetrics.length === 0) return 0;

    const totalTime = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalTime / relevantMetrics.length;
  }

  public getErrorRate(endpoint?: string, hours: number = 1): number {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const relevantMetrics = this.metrics.filter(m => 
      m.timestamp > since && 
      (endpoint ? m.endpoint === endpoint : true)
    );

    if (relevantMetrics.length === 0) return 0;

    const errorCount = relevantMetrics.filter(m => m.statusCode >= 400).length;
    return (errorCount / relevantMetrics.length) * 100;
  }
}
```

## **8.2 Type Safety Metrics**

### **TypeScript Compilation Monitoring**
```typescript
// scripts/type-safety-monitor.ts
import { execSync } from 'child_process';
import * as fs from 'fs';

interface TypeSafetyMetrics {
  totalFiles: number;
  typedFiles: number;
  errors: number;
  warnings: number;
  anyUsage: number;
  typesCoverage: number;
  strictModeFiles: number;
}

export class TypeSafetyMonitor {
  public generateReport(): TypeSafetyMetrics {
    const metrics: TypeSafetyMetrics = {
      totalFiles: 0,
      typedFiles: 0,
      errors: 0,
      warnings: 0,
      anyUsage: 0,
      typesCoverage: 0,
      strictModeFiles: 0
    };

    // Count files
    const allFiles = this.getAllFiles(['src', 'backend'], ['.ts', '.js']);
    metrics.totalFiles = allFiles.length;
    metrics.typedFiles = allFiles.filter(f => f.endsWith('.ts')).length;

    // Run TypeScript compiler
    try {
      execSync('npx tsc --noEmit --listFilesOnly', { stdio: 'pipe' });
    } catch (error) {
      const output = error.stdout?.toString() || '';
      metrics.errors = (output.match(/error TS\d+:/g) || []).length;
      metrics.warnings = (output.match(/warning TS\d+:/g) || []).length;
    }

    // Count 'any' usage
    metrics.anyUsage = this.countAnyUsage(allFiles.filter(f => f.endsWith('.ts')));

    // Calculate types coverage
    metrics.typesCoverage = (metrics.typedFiles / metrics.totalFiles) * 100;

    // Count strict mode files
    try {
      const strictOutput = execSync('npx tsc --noEmit -p tsconfig.strict.json --listFilesOnly', { stdio: 'pipe' });
      metrics.strictModeFiles = strictOutput.toString().split('\n').filter(line => line.endsWith('.ts')).length;
    } catch (error) {
      metrics.strictModeFiles = 0;
    }

    return metrics;
  }

  private getAllFiles(directories: string[], extensions: string[]): string[] {
    const files: string[] = [];
    
    for (const dir of directories) {
      if (fs.existsSync(dir)) {
        const dirFiles = this.getFilesRecursively(dir, extensions);
        files.push(...dirFiles);
      }
    }
    
    return files;
  }

  private getFilesRecursively(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = `${dir}/${item}`;
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...this.getFilesRecursively(fullPath, extensions));
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private countAnyUsage(files: string[]): number {
    let count = 0;
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      // Count explicit 'any' usage (excluding comments)
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          const anyMatches = line.match(/:\s*any\b|<any>|as any/g);
          if (anyMatches) {
            count += anyMatches.length;
          }
        }
      }
    }
    
    return count;
  }

  public printReport(metrics: TypeSafetyMetrics): void {
    console.log('\n📊 TypeScript Migration Progress Report\n');
    console.log(`📁 Files:`);
    console.log(`  Total Files: ${metrics.totalFiles}`);
    console.log(`  TypeScript Files: ${metrics.typedFiles} (${metrics.typesCoverage.toFixed(1)}%)`);
    console.log(`  Strict Mode Files: ${metrics.strictModeFiles}`);
    
    console.log(`\n🔍 Type Safety:`);
    console.log(`  Compilation Errors: ${metrics.errors}`);
    console.log(`  Compilation Warnings: ${metrics.warnings}`);
    console.log(`  'any' Usage Count: ${metrics.anyUsage}`);
    
    console.log(`\n🎯 Migration Goals:`);
    console.log(`  Files Migration: ${metrics.typesCoverage >= 95 ? '✅' : '❌'} (Target: 95%)`);
    console.log(`  Zero Errors: ${metrics.errors === 0 ? '✅' : '❌'}`);
    console.log(`  Minimal 'any' Usage: ${metrics.anyUsage < 10 ? '✅' : '❌'} (Target: <10)`);
  }
}
```

## **8.3 ML Accuracy Monitoring**

### **Biometric Authentication Accuracy Tracking**
```typescript
// src/monitoring/MLAccuracyMonitor.ts
interface AuthenticationResult {
  userId: number;
  timestamp: number;
  success: boolean;
  confidence: number;
  processingTime: number;
  featureExtractionTime: number;
  comparisonTime: number;
  algorithm: 'legacy' | 'typescript';
}

export class MLAccuracyMonitor {
  private results: AuthenticationResult[] = [];
  private readonly maxResults = 50000;

  public recordAuthentication(result: AuthenticationResult): void {
    this.results.push(result);
    
    // Keep only recent results
    if (this.results.length > this.maxResults) {
      this.results = this.results.slice(-this.maxResults);
    }

    // Alert on accuracy drops
    const recentAccuracy = this.getAccuracy(24); // Last 24 hours
    if (recentAccuracy < 0.85) { // 85% threshold
      console.error(`🚨 ML ACCURACY ALERT: Accuracy dropped to ${(recentAccuracy * 100).toFixed(1)}%`);
    }

    // Alert on performance degradation
    if (result.processingTime > 2000) { // 2 seconds
      console.warn(`⏱️ PERFORMANCE ALERT: Authentication took ${result.processingTime}ms`);
    }
  }

  public getAccuracy(hours: number = 24): number {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const recentResults = this.results.filter(r => r.timestamp > since);
    
    if (recentResults.length === 0) return 0;
    
    const successCount = recentResults.filter(r => r.success).length;
    return successCount / recentResults.length;
  }

  public getAverageProcessingTime(algorithm?: 'legacy' | 'typescript', hours: number = 24): number {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const relevantResults = this.results.filter(r => 
      r.timestamp > since && 
      (algorithm ? r.algorithm === algorithm : true)
    );
    
    if (relevantResults.length === 0) return 0;
    
    const totalTime = relevantResults.reduce((sum, r) => sum + r.processingTime, 0);
    return totalTime / relevantResults.length;
  }

  public compareAlgorithmPerformance(hours: number = 24): void {
    const legacyAccuracy = this.getAccuracyByAlgorithm('legacy', hours);
    const typescriptAccuracy = this.getAccuracyByAlgorithm('typescript', hours);
    
    const legacySpeed = this.getAverageProcessingTime('legacy', hours);
    const typescriptSpeed = this.getAverageProcessingTime('typescript', hours);

    console.log('\n🔬 Algorithm Performance Comparison:');
    console.log(`Legacy     - Accuracy: ${(legacyAccuracy * 100).toFixed(1)}%, Speed: ${legacySpeed.toFixed(0)}ms`);
    console.log(`TypeScript - Accuracy: ${(typescriptAccuracy * 100).toFixed(1)}%, Speed: ${typescriptSpeed.toFixed(0)}ms`);
    
    const accuracyDiff = typescriptAccuracy - legacyAccuracy;
    const speedDiff = legacySpeed - typescriptSpeed; // Positive means TypeScript is faster
    
    console.log(`Difference - Accuracy: ${accuracyDiff > 0 ? '+' : ''}${(accuracyDiff * 100).toFixed(1)}%, Speed: ${speedDiff > 0 ? '+' : ''}${speedDiff.toFixed(0)}ms`);
  }

  private getAccuracyByAlgorithm(algorithm: 'legacy' | 'typescript', hours: number): number {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const algorithmResults = this.results.filter(r => 
      r.timestamp > since && r.algorithm === algorithm
    );
    
    if (algorithmResults.length === 0) return 0;
    
    const successCount = algorithmResults.filter(r => r.success).length;
    return successCount / algorithmResults.length;
  }
}
```

## **8.4 Error Rate Monitoring**

### **Error Classification and Tracking**
```typescript
// src/monitoring/ErrorMonitor.ts
interface ErrorMetric {
  type: 'type_error' | 'runtime_error' | 'validation_error' | 'database_error';
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  endpoint?: string;
  userId?: number;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorMonitor {
  private errors: ErrorMetric[] = [];
  private readonly maxErrors = 10000;

  public recordError(error: ErrorMetric): void {
    this.errors.push(error);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Alert on critical errors
    if (error.severity === 'critical') {
      console.error(`🚨 CRITICAL ERROR: ${error.message}`);
      // Could integrate with alerting system here
    }

    // Alert on error rate spikes
    const recentErrorRate = this.getErrorRate(1); // Last hour
    if (recentErrorRate > 10) { // 10% error rate
      console.error(`🚨 ERROR RATE SPIKE: ${recentErrorRate.toFixed(1)}% error rate in last hour`);
    }
  }

  public getErrorRate(hours: number = 24): number {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp > since);
    
    // This would need to be calculated against total requests
    // For now, return count per hour as a proxy
    return recentErrors.length / hours;
  }

  public getErrorsByType(hours: number = 24): Record<string, number> {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp > since);
    
    const errorCounts: Record<string, number> = {};
    
    for (const error of recentErrors) {
      errorCounts[error.type] = (errorCounts[error.type] || 0) + 1;
    }
    
    return errorCounts;
  }

  public getMostCommonErrors(hours: number = 24, limit: number = 10): Array<{message: string, count: number}> {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp > since);
    
    const errorCounts = new Map<string, number>();
    
    for (const error of recentErrors) {
      const count = errorCounts.get(error.message) || 0;
      errorCounts.set(error.message, count + 1);
    }
    
    return Array.from(errorCounts.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  public generateErrorReport(hours: number = 24): void {
    const errorsByType = this.getErrorsByType(hours);
    const commonErrors = this.getMostCommonErrors(hours, 5);
    const totalErrors = Object.values(errorsByType).reduce((sum, count) => sum + count, 0);

    console.log(`\n🚨 Error Report (Last ${hours} hours)\n`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log(`Error Rate: ${this.getErrorRate(hours).toFixed(1)} errors/hour\n`);
    
    console.log(`Errors by Type:`);
    for (const [type, count] of Object.entries(errorsByType)) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log(`\nMost Common Errors:`);
    for (const { message, count } of commonErrors) {
      console.log(`  ${count}x: ${message.substring(0, 80)}${message.length > 80 ? '...' : ''}`);
    }
  }
}
```

## **8.5 Migration Progress Dashboard**

### **Real-time Migration Status**
```typescript
// scripts/migration-dashboard.ts
import { TypeSafetyMonitor } from './type-safety-monitor';
import { PerformanceMonitor } from './performance-monitor';
import { MigrationTracker } from './MigrationTracker';

export class MigrationDashboard {
  private typeSafetyMonitor: TypeSafetyMonitor;
  private performanceMonitor: PerformanceMonitor;
  private migrationTracker: MigrationTracker;

  constructor() {
    this.typeSafetyMonitor = new TypeSafetyMonitor();
    this.performanceMonitor = new PerformanceMonitor();
    this.migrationTracker = new MigrationTracker();
  }

  public generateFullReport(): void {
    console.log('🎯 TypeScript Migration Dashboard');
    console.log('═'.repeat(50));
    
    // Migration progress
    this.showMigrationProgress();
    
    // Type safety metrics
    const typeSafetyMetrics = this.typeSafetyMonitor.generateReport();
    this.typeSafetyMonitor.printReport(typeSafetyMetrics);
    
    // Performance comparison
    this.showPerformanceMetrics();
    
    // Success criteria check
    this.checkSuccessCriteria(typeSafetyMetrics);
  }

  private showMigrationProgress(): void {
    const currentPhase = this.migrationTracker.getCurrentPhase();
    const allPhases = ['preMigration', 'infrastructure', 'types', 'backend', 'frontend', 'testing', 'deployment'];
    
    console.log('\n📈 Migration Progress:');
    
    for (const phase of allPhases) {
      const isComplete = this.migrationTracker.isPhaseComplete(phase);
      const isCurrent = phase === currentPhase;
      
      const status = isComplete ? '✅' : isCurrent ? '🔄' : '⏳';
      const label = phase.charAt(0).toUpperCase() + phase.slice(1);
      
      console.log(`  ${status} ${label}${isCurrent ? ' (Current)' : ''}`);
    }
  }

  private showPerformanceMetrics(): void {
    console.log('\n⚡ Performance Metrics:');
    
    try {
      const buildTime = this.measureBuildTime();
      const testTime = this.measureTestTime();
      
      console.log(`  Build Time: ${buildTime.toFixed(1)}s`);
      console.log(`  Test Time: ${testTime.toFixed(1)}s`);
      
      // Compare against baseline if available
      // This would be implemented based on stored baseline metrics
      
    } catch (error) {
      console.log(`  ⚠️ Performance metrics unavailable: ${error.message}`);
    }
  }

  private measureBuildTime(): number {
    const start = Date.now();
    try {
      require('child_process').execSync('npm run build', { stdio: 'pipe' });
      return (Date.now() - start) / 1000;
    } catch (error) {
      throw new Error('Build failed');
    }
  }

  private measureTestTime(): number {
    const start = Date.now();
    try {
      require('child_process').execSync('npm test', { stdio: 'pipe' });
      return (Date.now() - start) / 1000;
    } catch (error) {
      throw new Error('Tests failed');
    }
  }

  private checkSuccessCriteria(metrics: any): void {
    console.log('\n🎯 Success Criteria:');
    
    const criteria = [
      { name: 'Files Migrated', target: 95, actual: metrics.typesCoverage, unit: '%' },
      { name: 'Zero Type Errors', target: 0, actual: metrics.errors, unit: '' },
      { name: 'Minimal Any Usage', target: 10, actual: metrics.anyUsage, unit: '', lessThan: true }
    ];
    
    for (const criterion of criteria) {
      const passed = criterion.lessThan 
        ? criterion.actual < criterion.target
        : criterion.actual >= criterion.target;
      
      const status = passed ? '✅' : '❌';
      console.log(`  ${status} ${criterion.name}: ${criterion.actual}${criterion.unit} (Target: ${criterion.lessThan ? '<' : '≥'}${criterion.target}${criterion.unit})`);
    }
  }
}

// CLI usage
if (require.main === module) {
  const dashboard = new MigrationDashboard();
  dashboard.generateFullReport();
}
```

## **8.6 Automated Alerts**

### **Alert Configuration**
```typescript
// src/monitoring/AlertManager.ts
interface Alert {
  id: string;
  type: 'performance' | 'error' | 'type_safety' | 'ml_accuracy';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export class AlertManager {
  private alerts: Alert[] = [];
  private thresholds = {
    errorRate: 5, // per hour
    responseTime: 5000, // ms
    mlAccuracy: 0.85, // 85%
    buildTime: 120, // seconds
    typeErrors: 0
  };

  public checkThresholds(metrics: any): void {
    // Error rate check
    if (metrics.errorRate > this.thresholds.errorRate) {
      this.createAlert('error', 'critical', 
        `Error rate exceeded threshold: ${metrics.errorRate}/hour`);
    }

    // Response time check
    if (metrics.averageResponseTime > this.thresholds.responseTime) {
      this.createAlert('performance', 'warning',
        `Average response time exceeded threshold: ${metrics.averageResponseTime}ms`);
    }

    // ML accuracy check
    if (metrics.mlAccuracy < this.thresholds.mlAccuracy) {
      this.createAlert('ml_accuracy', 'critical',
        `ML accuracy below threshold: ${(metrics.mlAccuracy * 100).toFixed(1)}%`);
    }

    // Type safety check
    if (metrics.typeErrors > this.thresholds.typeErrors) {
      this.createAlert('type_safety', 'warning',
        `TypeScript compilation errors: ${metrics.typeErrors}`);
    }
  }

  private createAlert(type: Alert['type'], severity: Alert['severity'], message: string): void {
    const alert: Alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      acknowledged: false
    };

    this.alerts.push(alert);
    this.sendAlert(alert);
  }

  private sendAlert(alert: Alert): void {
    const severityIcon = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨'
    };

    console.log(`${severityIcon[alert.severity]} ALERT [${alert.type.toUpperCase()}]: ${alert.message}`);
    
    // Here you could integrate with external alerting systems:
    // - Slack notifications
    // - Email alerts
    // - PagerDuty
    // - Discord webhooks
  }

  public getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  public acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }
}
```