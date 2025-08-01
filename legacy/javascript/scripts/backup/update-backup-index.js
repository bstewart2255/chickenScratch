#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const backupRoot = process.argv[2];
const timestamp = process.argv[3];

if (!backupRoot || !timestamp) {
  console.error('Usage: update-backup-index.js <backup-root> <timestamp>');
  process.exit(1);
}

try {
  const indexPath = path.join(backupRoot, 'index.json');
  let index = { backups: [] };
  
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }
  
  const manifestPath = path.join(backupRoot, `backup-${timestamp}`, 'manifest.json');
  const archivePath = path.join(backupRoot, `backup-${timestamp}.tar.gz`);
  
  if (fs.existsSync(manifestPath) && fs.existsSync(archivePath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    const backupEntry = {
      filename: `backup-${timestamp}.tar.gz`,
      ...manifest
    };
    
    index.backups = index.backups.filter(b => b.filename !== backupEntry.filename);
    
    index.backups.push(backupEntry);
    
    index.backups.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const maxBackups = 30;
    if (index.backups.length > maxBackups) {
      const toRemove = index.backups.splice(maxBackups);
      toRemove.forEach(backup => {
        const archiveToRemove = path.join(backupRoot, backup.filename);
        if (fs.existsSync(archiveToRemove)) {
          fs.unlinkSync(archiveToRemove);
          console.log(`Removed old backup: ${backup.filename}`);
        }
      });
    }
    
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    console.log(`Updated backup index with ${backupEntry.filename}`);
  } else {
    console.error('Manifest or archive not found');
    process.exit(1);
  }
} catch (error) {
  console.error('Error updating backup index:', error.message);
  process.exit(1);
}