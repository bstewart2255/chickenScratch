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

try {
  const status = JSON.parse(fs.readFileSync(migrationStatusPath, 'utf8'));
  
  console.log('\n🔄 TypeScript Migration Status v' + status.version);
  console.log('=' + '='.repeat(50));
  
  // Overview
  console.log('\n📊 Overview:');
  console.log(`   Start Date: ${new Date(status.startDate).toLocaleString()}`);
  console.log(`   Current Phase: ${status.currentPhase} of ${Object.keys(status.phases).length}`);
  
  // Progress bar
  const totalPhases = Object.keys(status.phases).length;
  const completedPhases = Object.values(status.phases).filter(p => p.status === 'completed').length;
  const progressPercentage = Math.round((completedPhases / totalPhases) * 100);
  const progressBarLength = 30;
  const filledLength = Math.round(progressBarLength * (completedPhases / totalPhases));
  const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
  
  console.log(`   Progress: [${progressBar}] ${progressPercentage}%`);
  
  // Metrics
  console.log('\n📈 Metrics:');
  console.log(`   Total Files: ${status.metrics.totalFiles}`);
  console.log(`   Migrated Files: ${status.metrics.migratedFiles}`);
  console.log(`   Errors: ${status.metrics.errorCount}`);
  console.log(`   Tests Passing: ${status.metrics.testsPassing ? '✅' : '❌'}`);
  
  // Phase details
  console.log('\n📋 Phase Details:');
  Object.entries(status.phases).forEach(([phaseNum, phase]) => {
    let statusIcon = '⏹️';
    if (phase.status === 'completed') statusIcon = '✅';
    else if (phase.status === 'in-progress') statusIcon = '🔄';
    else if (phase.status === 'failed') statusIcon = '❌';
    
    console.log(`\n   ${statusIcon} Phase ${phaseNum}: ${phase.name}`);
    console.log(`      Status: ${phase.status}`);
    
    if (phase.startDate) {
      console.log(`      Started: ${new Date(phase.startDate).toLocaleString()}`);
    }
    
    if (phase.endDate) {
      console.log(`      Completed: ${new Date(phase.endDate).toLocaleString()}`);
      const duration = new Date(phase.endDate) - new Date(phase.startDate);
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
      console.log(`      Duration: ${hours}h ${minutes}m`);
    }
    
    if (phase.files && phase.files.length > 0) {
      console.log(`      Files: ${phase.files.length} migrated`);
    }
    
    if (phase.errors && phase.errors.length > 0) {
      console.log(`      ⚠️  Errors: ${phase.errors.length}`);
      phase.errors.forEach(error => {
        console.log(`         - ${error}`);
      });
    }
  });
  
  // Performance comparison
  if (status.metrics.currentPerformance.apiResponseTime !== null) {
    console.log('\n🚀 Performance Comparison:');
    const perf = status.metrics.currentPerformance;
    const baseline = status.metrics.performanceBaseline;
    
    const formatPerf = (current, base, unit) => {
      if (current === null) return 'N/A';
      const diff = ((current - base) / base * 100).toFixed(1);
      const icon = current > base * 1.1 ? '⚠️' : '✅';
      return `${current}${unit} (${diff > 0 ? '+' : ''}${diff}%) ${icon}`;
    };
    
    console.log(`   API Response: ${formatPerf(perf.apiResponseTime, baseline.apiResponseTime, 'ms')}`);
    console.log(`   Auth Processing: ${formatPerf(perf.authProcessingTime, baseline.authProcessingTime, 'ms')}`);
    console.log(`   Feature Extraction: ${formatPerf(perf.featureExtractionTime, baseline.featureExtractionTime, 'ms')}`);
    console.log(`   Memory Usage: ${formatPerf(perf.memoryUsage, baseline.memoryUsage, 'MB')}`);
  }
  
  // Git tags
  if (Object.keys(status.gitTags).length > 0) {
    console.log('\n🏷️  Git Tags:');
    Object.entries(status.gitTags).forEach(([tag, date]) => {
      if (date) {
        console.log(`   ${tag}: ${new Date(date).toLocaleString()}`);
      } else {
        console.log(`   ${tag}: pending`);
      }
    });
  }
  
  // Rollback points
  if (status.rollbackPoints && status.rollbackPoints.length > 0) {
    console.log('\n🔄 Rollback Points:');
    status.rollbackPoints.forEach(point => {
      console.log(`   - ${point.tag} (Phase ${point.phase}): ${new Date(point.date).toLocaleString()}`);
    });
  }
  
  console.log('\n' + '='.repeat(52) + '\n');
  
} catch (error) {
  console.error('❌ Error reading migration status:', error.message);
  process.exit(1);
}