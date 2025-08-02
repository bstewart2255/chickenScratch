// Database-specific type definitions

export interface DatabaseMigration {
  id: string;
  name: string;
  version: string;
  appliedAt: Date;
  checksum: string;
  rollbackSql?: string;
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  indexes: DatabaseIndex[];
  constraints: DatabaseConstraint[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isIndexed: boolean;
}

export interface DatabaseIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
  type: 'btree' | 'hash' | 'gin' | 'gist';
}

export interface DatabaseConstraint {
  name: string;
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check';
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  checkCondition?: string;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  tableID: number;
  columnID: number;
  dataTypeID: number;
  dataTypeSize: number;
  dataTypeModifier: number;
  format: string;
}

export interface TransactionOptions {
  isolationLevel?: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
  timeout?: number;
}

export interface DatabaseStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  queryCount: number;
  averageQueryTime: number;
  slowQueries: number;
  errors: number;
}

export interface BackupConfig {
  schedule: string; // cron expression
  retention: number; // days
  compression: boolean;
  encryption: boolean;
  location: string;
}

export interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  checksum: string;
  status: 'completed' | 'failed' | 'in_progress';
  error?: string;
} 