import { ServerApp } from './ServerApp';
import { Logger } from '../utils';

/**
 * Main server entry point with TypeScript utilities integration
 * This replaces the legacy JavaScript server with full runtime validation
 */
async function startServer(): Promise<void> {
  const logger = new Logger('Server');
  
  try {
    // Get port from environment or use default
    const port = parseInt(process.env['PORT'] || '3000', 10);
    
    // Create and start the server
    const server = new ServerApp(port);
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      process.exit(0);
    });
    
    // Start the server
    server.start();
    
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unhandled error during server startup:', error);
    process.exit(1);
  });
}

export { startServer }; 