import { configService } from '../config/ConfigService';
import type { Request, Response, NextFunction } from 'express';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Zod schema for log metadata - avoid infinite recursion (commented out as not currently used)
// const LogMetadataSchema = z.any().optional();

// Log entry interface
interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  context: string;
  message: string;
  metadata?: Record<string, any>;
}

// Color codes for console output
const LOG_COLORS = {
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[37m',  // White
  [LogLevel.WARN]: '\x1b[33m',  // Yellow
  [LogLevel.ERROR]: '\x1b[31m'  // Red
};

const RESET_COLOR = '\x1b[0m';

export class Logger {
  private context: string;
  private logLevel: LogLevel;
  private static globalLogLevel: LogLevel | null = null;

  constructor(context: string) {
    this.context = context;
    this.logLevel = this.getConfiguredLogLevel();
  }

  /**
   * Get log level from configuration
   */
  private getConfiguredLogLevel(): LogLevel {
    // Use global level if set
    if (Logger.globalLogLevel !== null) {
      return Logger.globalLogLevel;
    }

    // Get from config
    const config = configService.get();
    const levelString = config.logging?.level || 'info';
    
    switch (levelString.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  /**
   * Set global log level
   */
  static setGlobalLogLevel(level: LogLevel): void {
    Logger.globalLogLevel = level;
  }

  /**
   * Format timestamp for logs
   */
  private formatTimestamp(date: Date): string {
    return date.toISOString();
  }

  /**
   * Format log message
   */
  private formatMessage(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const color = LOG_COLORS[entry.level];
    
    let message = `${this.formatTimestamp(entry.timestamp)} [${levelName}] [${entry.context}] ${entry.message}`;
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }
    
    // Add color for console output
    if (process.stdout.isTTY) {
      message = `${color}${message}${RESET_COLOR}`;
    }
    
    return message;
  }

  /**
   * Write log entry
   */
  private writeLog(level: LogLevel, message: string, metadata?: unknown): void {
    // Check if we should log this level
    if (level < this.logLevel) {
      return;
    }

    // Skip metadata validation to avoid infinite recursion
    const validatedMetadata = metadata as Record<string, any> | undefined;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      context: this.context,
      message,
      metadata: validatedMetadata
    };

    const formattedMessage = this.formatMessage(entry);

    // Write to appropriate console method
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }

    // In production, you might also send to a logging service
    if (configService.get().env === 'production') {
      this.sendToLoggingService(entry);
    }
  }

  /**
   * Send logs to external service (placeholder)
   */
  private sendToLoggingService(_entry: LogEntry): void {
    // TODO: Implement external logging service integration
    // For now, this is a placeholder
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.writeLog(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.writeLog(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.writeLog(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: Record<string, any>): void {
    this.writeLog(LogLevel.ERROR, message, metadata);
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: string): Logger {
    return new Logger(`${this.context}:${additionalContext}`);
  }

  /**
   * Measure and log execution time
   */
  async time<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.debug(`${operation} completed`, {
        duration_ms: duration,
        success: true
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.error(`${operation} failed`, {
        duration_ms: duration,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Log HTTP request (for Express middleware)
   */
  static httpLogger() {
    const logger = new Logger('HTTP');
    
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Log request
      logger.info(`${req.method} ${(req as any).path || req.url}`, {
        query: (req as any).query,
        ip: (req as any).ip,
        userAgent: (req as any).get?.('user-agent')
      });
      
      // Capture response
      const originalSend = (res as any).send;
      (res as any).send = function(data: unknown) {
        (res as any).send = originalSend;
        
        const duration = Date.now() - startTime;
        const level = (res as any).statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
        
        logger.writeLog(level, `${req.method} ${(req as any).path || req.url} ${(res as any).statusCode}`, {
          duration_ms: duration,
          status: (res as any).statusCode,
          size: data ? (data as any).length : 0
        });
        
        return (res as any).send(data);
      };
      
      next();
    };
  }

  /**
   * Create structured log entry
   */
  static structured(data: {
    action: string;
    userId?: string | number;
    resourceType?: string;
    resourceId?: string | number;
    result?: 'success' | 'failure';
    metadata?: Record<string, any>;
  }): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      ...data
    };
  }
}

// Create default logger instance
export const logger = new Logger('App');