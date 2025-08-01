import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../src/config/ConfigService';
import { logger } from '../src/utils/Logger';
import { DatabaseError } from '../src/types/core/errors';
import type { 
  User, 
  Signature, 
  Shape, 
  AuthenticationAttempt,
  DatabaseTables 
} from '../src/types/core/database';

// Performance thresholds for query monitoring
const QUERY_THRESHOLDS = {
  warning: 50,  // ms
  error: 200    // ms
} as const;

// Query performance tracking
interface QueryMetrics {
  query: string;
  duration: number;
  rowCount: number;
  timestamp: Date;
}

class DatabaseService {
  private pool: Pool;
  private queryMetrics: QueryMetrics[] = [];
  private slowQueryCount = 0;
  
  constructor() {
    // Initialize connection pool with configuration
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? {
        rejectUnauthorized: false // Required for Render
      } : false,
      max: config.database.maxConnections,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis
    });
    
    // Test the connection
    this.testConnection();
    
    // Monitor pool health
    this.setupPoolMonitoring();
  }
  
  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      logger.info('✅ Connected to PostgreSQL database');
      client.release();
    } catch (err) {
      logger.error('Error connecting to database:', err);
      throw new DatabaseError('Failed to connect to database', { originalError: err });
    }
  }
  
  private setupPoolMonitoring(): void {
    // Log pool statistics every 5 minutes
    setInterval(() => {
      const poolStats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      };
      
      logger.info('Database pool statistics', poolStats);
      
      // Log slow query summary
      if (this.slowQueryCount > 0) {
        logger.warn(`Slow queries in last 5 minutes: ${this.slowQueryCount}`);
        this.slowQueryCount = 0;
      }
    }, 5 * 60 * 1000);
  }
  
  // Execute query with performance tracking
  async query<T extends QueryResultRow = any>(
    text: string, 
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = performance.now();
    let client: PoolClient | undefined;
    
    try {
      client = await this.pool.connect();
      const result = await client.query<T>(text, params);
      
      const duration = performance.now() - start;
      
      // Track metrics
      const metrics: QueryMetrics = {
        query: text.substring(0, 100), // Truncate for logging
        duration,
        rowCount: result.rowCount || 0,
        timestamp: new Date()
      };
      
      this.queryMetrics.push(metrics);
      
      // Keep only last 1000 queries
      if (this.queryMetrics.length > 1000) {
        this.queryMetrics.shift();
      }
      
      // Log performance
      if (duration > QUERY_THRESHOLDS.error) {
        this.slowQueryCount++;
        logger.error('Very slow query detected', {
          query: text,
          duration_ms: duration,
          row_count: result.rowCount,
          params: params?.length || 0
        });
      } else if (duration > QUERY_THRESHOLDS.warning) {
        this.slowQueryCount++;
        logger.warn('Slow query detected', {
          query: text,
          duration_ms: duration,
          row_count: result.rowCount
        });
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error('Query failed', {
        query: text,
        duration_ms: duration,
        error
      });
      throw new DatabaseError('Query execution failed', { 
        query: text,
        originalError: error 
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
  
  // Transaction support with performance tracking
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      const duration = performance.now() - start;
      if (duration > QUERY_THRESHOLDS.error) {
        logger.warn('Slow transaction', { duration_ms: duration });
      }
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      const duration = performance.now() - start;
      
      logger.error('Transaction failed', {
        duration_ms: duration,
        error
      });
      
      throw new DatabaseError('Transaction failed', { originalError: error });
    } finally {
      client.release();
    }
  }
  
  // Typed query methods for common operations
  async getUser(userId: number): Promise<User | null> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }
  
  async getUserByUsername(username: string): Promise<User | null> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  }
  
  async createUser(username: string, email?: string): Promise<User> {
    const result = await this.query<User>(
      'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *',
      [username, email]
    );
    return result.rows[0];
  }
  
  async getSignatures(userId: number): Promise<Signature[]> {
    const result = await this.query<Signature>(
      'SELECT * FROM signatures WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }
  
  async createSignature(
    userId: number, 
    strokeData: any,
    enhancedFeatures?: any
  ): Promise<Signature> {
    const result = await this.query<Signature>(
      `INSERT INTO signatures (user_id, stroke_data, enhanced_features) 
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, JSON.stringify(strokeData), enhancedFeatures ? JSON.stringify(enhancedFeatures) : null]
    );
    return result.rows[0];
  }
  
  async getShapes(userId: number): Promise<Shape[]> {
    const result = await this.query<Shape>(
      'SELECT * FROM shapes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }
  
  async createShape(
    userId: number,
    shapeType: string,
    strokeData: any,
    componentFeatures?: any,
    enhancedFeatures?: any
  ): Promise<Shape> {
    const result = await this.query<Shape>(
      `INSERT INTO shapes (user_id, shape_type, stroke_data, component_features, enhanced_features) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        userId, 
        shapeType, 
        JSON.stringify(strokeData),
        componentFeatures ? JSON.stringify(componentFeatures) : null,
        enhancedFeatures ? JSON.stringify(enhancedFeatures) : null
      ]
    );
    return result.rows[0];
  }
  
  async createAuthenticationAttempt(
    userId: number,
    success: boolean,
    score: number,
    details?: any
  ): Promise<AuthenticationAttempt> {
    const result = await this.query<AuthenticationAttempt>(
      `INSERT INTO authentication_attempts 
       (user_id, success, score, attempt_details, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [userId, success, score, details ? JSON.stringify(details) : null]
    );
    return result.rows[0];
  }
  
  // Get query performance statistics
  getQueryStats(): {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
    slowestQuery: QueryMetrics | null;
  } {
    const totalQueries = this.queryMetrics.length;
    const averageDuration = totalQueries > 0
      ? this.queryMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries
      : 0;
    
    const slowQueries = this.queryMetrics.filter(
      m => m.duration > QUERY_THRESHOLDS.warning
    ).length;
    
    const slowestQuery = this.queryMetrics.reduce((slowest, current) => 
      !slowest || current.duration > slowest.duration ? current : slowest
    , null as QueryMetrics | null);
    
    return {
      totalQueries,
      averageDuration,
      slowQueries,
      slowestQuery
    };
  }
  
  // Clean up connections
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
  
  // Get the pool for backward compatibility
  getPool(): Pool {
    return this.pool;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();

// Export for backward compatibility
export default databaseService.getPool();

// CommonJS compatibility
module.exports = databaseService.getPool();
module.exports.databaseService = databaseService;
module.exports.DatabaseService = DatabaseService;