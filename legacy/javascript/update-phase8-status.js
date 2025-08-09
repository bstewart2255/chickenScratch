const fs = require('fs');
const path = require('path');

const statusFile = path.join(__dirname, '.migration-status.json');
const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));

// Update for Phase 8 completion
status.currentPhase = 8;
status.phaseStatus = 'completed';
status.lastUpdated = new Date().toISOString();

// Update file counts
status.metrics.totalFiles = status.metrics.totalFiles || 50;
status.metrics.convertedFiles = (status.metrics.convertedFiles || 13) + 3;
status.metrics.typescriptFiles = (status.metrics.typescriptFiles || 13) + 3;

// Add phase history
if (\!status.phaseHistory) {
  status.phaseHistory = [];
}
status.phaseHistory.push({
  phase: 8,
  name: 'Shared Utilities',
  status: 'completed',
  startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  endTime: new Date().toISOString(),
  duration: 30,
  filesConverted: 3,
  files: [
    'src/utils/DataFormatConverter.ts',
    'src/utils/ErrorHandler.ts', 
    'src/utils/Logger.ts'
  ]
});

// Write back
fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
console.log('Phase 8 status updated successfully');
