/**
 * Central export file for all type definitions
 * This makes it easy to import types from a single location
 */

// Core types
export * from './core/biometric';
export * from './core/errors';

// API types
export * from './api/auth';
export * from './api/schemas';

// Database types
export * from './database/tables';

// Validation schemas
export * from './validation/schemas';

// Canvas types
export * from './canvas';

// Configuration types
export * from './config';


/**
 * Migration-specific types (temporary, for migration tracking)
 */
export interface MigrationStatus {
  currentPhase: number;
  phaseStatus: 'not_started' | 'in_progress' | 'completed' | 'failed';
  lastUpdated: string;
  errors: MigrationError[];
  metrics: MigrationMetrics;
  rollbackPoints: RollbackPoint[];
  phaseHistory: PhaseHistoryEntry[];
}

export interface MigrationError {
  id: string;
  phase: number;
  fileName: string;
  errorType: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolution?: string;
}

export interface MigrationMetrics {
  totalFiles: number;
  jsFiles: number;
  tsFiles: number;
  convertedFiles: number;
  typeErrors: number;
  resolvedErrors: number;
  coverage: number;
  lastUpdated: string;
}

export interface RollbackPoint {
  id: string;
  phase: number;
  timestamp: string;
  gitCommit: string;
  description: string;
  metrics: MigrationMetrics;
}

export interface PhaseHistoryEntry {
  phase: number;
  startTime: string;
  endTime?: string;
  status: 'in_progress' | 'completed' | 'failed';
}

export interface PhaseRequirements {
  maxUnresolvedErrors?: number;
  minCoverage?: number;
  requiredFiles?: string[];
  customValidation?: (status: MigrationStatus) => boolean;
}