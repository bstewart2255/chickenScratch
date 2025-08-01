require('dotenv').config();
const { startServer } = require('../dist/src/server/index');

/**
 * TypeScript Server Integration
 * This file provides a bridge between the legacy JavaScript backend
 * and the new TypeScript server with full runtime validation
 */

// Check if TypeScript server should be used
const useTypeScriptServer = process.env.USE_TYPESCRIPT_SERVER === 'true';

if (useTypeScriptServer) {
  console.log('🚀 Starting TypeScript server with full runtime validation...');
  
  // Start the TypeScript server
  startServer().catch((error) => {
    console.error('Failed to start TypeScript server:', error);
    process.exit(1);
  });
  
} else {
  console.log('📦 Starting legacy JavaScript server...');
  
  // Import and start the legacy server
  const _legacyServer = require('./server');
  
  // The legacy server will start automatically when imported
  // This maintains backward compatibility
}

// Export for potential programmatic use
module.exports = {
  startTypeScriptServer: startServer,
  useTypeScriptServer
}; 