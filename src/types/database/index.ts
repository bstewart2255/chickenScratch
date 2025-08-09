/**
 * Database types index
 * Exports all database-related types and interfaces
 */

export * from './tables';

// Legacy type aliases for backward compatibility
export type User = import('./tables').UsersTable;
export type Signature = import('./tables').SignaturesTable;
export type Shape = import('./tables').SignaturesTable; // Shapes are stored in signatures table
export type AuthenticationAttempt = import('./tables').AuthLogsTable;
export type DatabaseTables = {
  users: import('./tables').UsersTable;
  signatures: import('./tables').SignaturesTable;
  auth_logs: import('./tables').AuthLogsTable;
  enrollment_tokens: import('./tables').EnrollmentTokensTable;
  api_keys: import('./tables').ApiKeysTable;
  sessions: import('./tables').SessionsTable;
  biometric_comparisons: import('./tables').BiometricComparisonsTable;
  system_config: import('./tables').SystemConfigTable;
  migration_audit: import('./tables').MigrationAuditTable;
}; 