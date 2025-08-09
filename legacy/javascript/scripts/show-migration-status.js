#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const migrationStatusPath = path.join(process.cwd(), '.migration-status.json');

// Check if file exists
if (!fs.existsSync(migrationStatusPath)) {
  console.error('❌ Migration status file not found!');
  console.error('Run "node scripts/init-migration-status.js" first.');
  process.exit(1);
}

// Helper function to format date
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString();
};

// Helper function to get phase name
const getPhaseInfo = (phaseNum) => {
  const phaseNames = {
    1: 'Pre-Migration Validation',
    2: 'Migration Tracker Setup',
    3: 'TypeScript & ESLint Setup',
    4: 'Strict Compiler Profile',
    5: 'MigrationTracker Implementation',
    6: 'Type System Foundation',
    7: 'Configuration System',
    8: 'Shared Utilities',
    9: 'Backend Migration',
    10: 'Frontend Migration',
    11: 'Testing Suite',
    12: 'CI/CD Pipeline',
    13: 'Database Migrations',
    14: 'Build & Monitoring',
    15: 'Backup & Rollback',
    16: 'Enable Strict Mode',
    17: 'Final Validation'
  };
  return phaseNames[phaseNum] || `Phase ${phaseNum}`;
};

// Helper function to get status icon
const getStatusIcon = (status) => {
  switch (status) {
    case 'completed': return '✅';
    case 'in_progress': return '🔄';
    case 'failed': return '❌';
    case 'not_started': return '⏹️';
    default: return '❓';
  }
};

try {
  const status = JSON.parse(fs.readFileSync(migrationStatusPath, 'utf8'));
  
  console.log('\n🔄 TypeScript Migration Status v2.0');
  console.log('=' + '='.repeat(50));
  
  // Current Phase and Status
  console.log('\n📊 Current Status:');
  console.log(`   Phase: ${status.currentPhase} - ${getPhaseInfo(status.currentPhase)}`);
  console.log(`   Status: ${getStatusIcon(status.phaseStatus)} ${status.phaseStatus}`);
  console.log(`   Last Updated: ${formatDate(status.lastUpdated)}`);
  
  // Migration Metrics
  if (status.metrics) {
    console.log('\n📈 Migration Metrics:');
    console.log(`   Total Files: ${status.metrics.totalFiles || 0}`);
    console.log(`   JavaScript Files: ${status.metrics.jsFiles || 0}`);
    console.log(`   TypeScript Files: ${status.metrics.tsFiles || 0}`);
    console.log(`   Converted Files: ${status.metrics.convertedFiles || 0}`);
    console.log(`   Coverage: ${status.metrics.coverage || 0}%`);
    
    // Progress bar for coverage
    const coverage = status.metrics.coverage || 0;
    const progressBarLength = 30;
    const filledLength = Math.round(progressBarLength * (coverage / 100));
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
    console.log(`   Progress: [${progressBar}] ${coverage}%`);
  }
  
  // Error Tracking
  if (status.errors && status.errors.length > 0) {
    const unresolvedErrors = status.errors.filter(e => !e.resolved);
    const resolvedErrors = status.errors.filter(e => e.resolved);
    
    console.log('\n⚠️  Error Summary:');
    console.log(`   Total Errors: ${status.errors.length}`);
    console.log(`   Unresolved: ${unresolvedErrors.length}`);
    console.log(`   Resolved: ${resolvedErrors.length}`);
    
    // Error breakdown by phase
    const errorsByPhase = {};
    status.errors.forEach(error => {
      if (!errorsByPhase[error.phase]) {
        errorsByPhase[error.phase] = { total: 0, unresolved: 0 };
      }
      errorsByPhase[error.phase].total++;
      if (!error.resolved) {
        errorsByPhase[error.phase].unresolved++;
      }
    });
    
    console.log('\n   Errors by Phase:');
    Object.entries(errorsByPhase).forEach(([phase, counts]) => {
      console.log(`     Phase ${phase}: ${counts.total} total (${counts.unresolved} unresolved)`);
    });
    
    // Show recent unresolved errors
    if (unresolvedErrors.length > 0) {
      console.log('\n   Recent Unresolved Errors:');
      unresolvedErrors.slice(-5).forEach(error => {
        console.log(`     - [${error.errorType}] ${error.fileName}: ${error.message}`);
        console.log(`       ID: ${error.id} | Time: ${formatDate(error.timestamp)}`);
      });
      if (unresolvedErrors.length > 5) {
        console.log(`     ... and ${unresolvedErrors.length - 5} more`);
      }
    }
  } else {
    console.log('\n✅ No errors recorded');
  }
  
  // Phase History
  if (status.phaseHistory && status.phaseHistory.length > 0) {
    console.log('\n📋 Phase History:');
    const recentHistory = status.phaseHistory.slice(-5);
    recentHistory.forEach(entry => {
      const duration = entry.endTime 
        ? ` (${Math.round((new Date(entry.endTime) - new Date(entry.startTime)) / 60000)} min)`
        : ' (in progress)';
      console.log(`   ${getStatusIcon(entry.status)} Phase ${entry.phase}: ${entry.status}${duration}`);
    });
    if (status.phaseHistory.length > 5) {
      console.log(`   ... and ${status.phaseHistory.length - 5} more`);
    }
  }
  
  // Rollback Points
  if (status.rollbackPoints && status.rollbackPoints.length > 0) {
    console.log('\n🔄 Rollback Points:');
    const recentRollbacks = status.rollbackPoints.slice(-3);
    recentRollbacks.forEach(point => {
      console.log(`   - ${point.description}`);
      console.log(`     ID: ${point.id} | Phase: ${point.phase} | Commit: ${point.gitCommit.substring(0, 7)}`);
      console.log(`     Time: ${formatDate(point.timestamp)}`);
    });
    if (status.rollbackPoints.length > 3) {
      console.log(`   ... and ${status.rollbackPoints.length - 3} more`);
    }
  }
  
  // Check if can proceed to next phase
  const nextPhase = status.currentPhase + 1;
  if (nextPhase <= 17) {
    console.log(`\n🎯 Next Phase: ${nextPhase} - ${getPhaseInfo(nextPhase)}`);
    
    // Simple phase requirements check
    const unresolvedCount = status.errors ? status.errors.filter(e => !e.resolved).length : 0;
    const coverage = status.metrics ? status.metrics.coverage : 0;
    
    const requirements = [];
    if (nextPhase >= 6) requirements.push('Create type system foundation');
    if (nextPhase >= 9) requirements.push('30% coverage minimum');
    if (nextPhase >= 10) requirements.push('50% coverage minimum');
    if (nextPhase >= 16) requirements.push('All errors resolved');
    
    if (requirements.length > 0) {
      console.log('   Requirements:');
      requirements.forEach(req => console.log(`     - ${req}`));
    }
  }
  
  // Original status compatibility
  if (status.phases) {
    console.log('\n📊 Legacy Phase Status:');
    const completedPhases = Object.values(status.phases).filter(p => p.status === 'completed').length;
    console.log(`   Completed: ${completedPhases} of ${Object.keys(status.phases).length} phases`);
  }
  
  console.log('\n' + '='.repeat(52) + '\n');
  
} catch (error) {
  console.error('❌ Error reading migration status:', error.message);
  process.exit(1);
}