/**
 * Database table interfaces matching PostgreSQL schema
 * These types ensure type safety for database operations
 */

import { 
  EnhancedFeatures, 
  LegacySignatureData,
  DeviceCapabilities 
} from '../core/biometric';

/**
 * Users table
 */
export interface UsersTable {
  id: string; // UUID primary key
  email: string;
  username: string;
  full_name?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  enrollment_status: 'pending' | 'active' | 'expired';
  created_at: Date;
  updated_at: Date;
  last_active?: Date | null;
  metadata?: Record<string, any> | null; // JSONB
  settings?: UserSettings | null; // JSONB
}

/**
 * User settings stored in JSONB
 */
export interface UserSettings {
  requiredSamples: number;
  strictMode: boolean;
  mfaEnabled: boolean;
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
  };
}

/**
 * Signatures table
 */
export interface SignaturesTable {
  id: string; // UUID primary key
  user_id: string; // Foreign key to users
  biometric_type: 'signature' | 'shape' | 'drawing';
  signature_data: LegacySignatureData | any; // JSONB - supports legacy format
  enhanced_features?: EnhancedFeatures | null; // JSONB
  device_capabilities: DeviceCapabilities; // JSONB
  image_data?: string | null; // Base64 PNG
  quality_score?: number | null;
  is_reference: boolean;
  is_enrollment?: boolean; // TRUE for enrollment signatures, FALSE for verification
  created_at: Date;
  updated_at?: Date | null;
  deleted_at?: Date | null; // Soft delete
  session_id?: string | null;
  metadata?: Record<string, any> | null; // JSONB
}

/**
 * Authentication logs table
 */
export interface AuthLogsTable {
  id: string; // UUID primary key
  user_id: string; // Foreign key to users
  signature_id?: string | null; // Foreign key to signatures
  auth_type: 'signature' | 'token' | 'api_key' | 'mfa';
  success: boolean;
  match_score?: number | null;
  confidence_level?: number | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device_info?: Record<string, any> | null; // JSONB
  error_message?: string | null;
  created_at: Date;
  response_time_ms?: number | null;
}

/**
 * Enrollment tokens table
 */
export interface EnrollmentTokensTable {
  id: string; // UUID primary key
  user_id: string; // Foreign key to users
  token: string; // Unique token
  expires_at: Date;
  used: boolean;
  used_at?: Date | null;
  created_at: Date;
  metadata?: Record<string, any> | null; // JSONB
}

/**
 * API keys table
 */
export interface ApiKeysTable {
  id: string; // UUID primary key
  user_id?: string | null; // Foreign key to users (null for system keys)
  key_hash: string; // Hashed API key
  name: string;
  permissions: string[]; // Array of permission strings
  last_used?: Date | null;
  expires_at?: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any> | null; // JSONB
}

/**
 * Sessions table for user sessions
 */
export interface SessionsTable {
  id: string; // UUID primary key
  user_id: string; // Foreign key to users
  token_hash: string; // Hashed session token
  expires_at: Date;
  ip_address?: string | null;
  user_agent?: string | null;
  device_info?: Record<string, any> | null; // JSONB
  created_at: Date;
  last_activity: Date;
  revoked: boolean;
  revoked_at?: Date | null;
}

/**
 * Biometric comparisons table (for audit trail)
 */
export interface BiometricComparisonsTable {
  id: string; // UUID primary key
  user_id: string; // Foreign key to users
  reference_signature_id: string; // Foreign key to signatures
  challenge_signature_id: string; // Foreign key to signatures
  comparison_type: 'authentication' | 'verification' | 'quality_check';
  overall_score: number;
  pressure_score: number;
  timing_score: number;
  geometry_score: number;
  recommendation: 'accept' | 'reject' | 'review';
  processing_time_ms: number;
  algorithm_version: string;
  created_at: Date;
  details?: Record<string, any> | null; // JSONB for additional metrics
}

/**
 * System configuration table
 */
export interface SystemConfigTable {
  id: string; // UUID primary key
  key: string; // Unique configuration key
  value: any; // JSONB value
  category: string;
  description?: string | null;
  is_sensitive: boolean;
  created_at: Date;
  updated_at: Date;
  updated_by?: string | null; // User ID who updated
}

/**
 * Migration audit table
 */
export interface MigrationAuditTable {
  id: string; // UUID primary key
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: any | null; // JSONB
  new_data?: any | null; // JSONB
  migration_phase: number;
  created_at: Date;
  created_by?: string | null;
}

/**
 * Database views
 */

/**
 * User enrollment status view
 */
export interface UserEnrollmentStatusView {
  user_id: string;
  username: string;
  email: string;
  enrollment_status: string;
  signature_count: number;
  shape_count: number;
  drawing_count: number;
  last_enrollment_date?: Date | null;
  days_since_enrollment?: number | null;
}

/**
 * Authentication statistics view
 */
export interface AuthenticationStatsView {
  user_id: string;
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  success_rate: number;
  average_match_score?: number | null;
  average_response_time?: number | null;
  last_auth_date?: Date | null;
}

/**
 * Database query builders and helpers
 */

/**
 * Query filter options
 */
export interface QueryFilters {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  where?: Record<string, any>;
}

/**
 * Bulk insert options
 */
export interface BulkInsertOptions {
  returning?: string[];
  onConflict?: {
    columns: string[];
    action: 'DO NOTHING' | 'UPDATE';
    updateColumns?: string[];
  };
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  readOnly?: boolean;
  deferrable?: boolean;
}

/**
 * Database connection pool stats
 */
export interface PoolStats {
  total: number;
  idle: number;
  waiting: number;
  max: number;
}

/**
 * Type guards for nullable fields
 */
export function hasEnhancedFeatures(
  signature: Pick<SignaturesTable, 'enhanced_features'>
): signature is { enhanced_features: EnhancedFeatures } {
  return signature.enhanced_features !== null && signature.enhanced_features !== undefined;
}

export function hasMetadata<T extends { metadata?: any | null }>(
  record: T
): record is T & { metadata: Record<string, any> } {
  return record.metadata !== null && record.metadata !== undefined;
}

/**
 * Database timestamp helpers
 */
export function toPostgresTimestamp(date: Date): string {
  return date.toISOString();
}

export function fromPostgresTimestamp(timestamp: string | Date): Date {
  return typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
}