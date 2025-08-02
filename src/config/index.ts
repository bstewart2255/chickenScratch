// Re-export the ConfigService for backward compatibility
export { configService, type Config } from './ConfigService';

// Import the configService instance
import { configService } from './ConfigService';

// Export individual config sections for convenience
const config = configService.get();
export { config };
export const { 
  server: database, 
  security: auth, 
  biometric: ml, 
  logging, 
  features: monitoring, 
  security 
} = config;

// Configuration utilities
export function isDevelopment(): boolean {
  return configService.isDevelopment();
}

export function isProduction(): boolean {
  return configService.isProduction();
}

export function isStaging(): boolean {
  return configService.isStaging();
}

export function getDatabaseUrl(): string {
  const { host, port, database, user, password } = configService.getDatabase();
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
} 