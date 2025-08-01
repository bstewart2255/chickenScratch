import { Logger } from '../../../src/utils/Logger';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  createWriteStream: jest.fn(() => ({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
  }))
}));

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    
    // Mock Date.now for consistent timestamps
    dateNowSpy = jest.spyOn(global.Date, 'now').mockReturnValue(1234567890000);
    
    // Create logger instance
    logger = new Logger('TestLogger');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create logger with context', () => {
      const testLogger = new Logger('CustomContext');
      expect(testLogger).toBeDefined();
    });

    it('should create logs directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      new Logger('TestLogger');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true }
      );
    });
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      logger.info('Info message', { data: 'test' });
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('[TestLogger]'),
        expect.stringContaining('Info message'),
        expect.stringContaining('{"data":"test"}')
      );
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.stringContaining('[TestLogger]'),
        'Error occurred',
        error
      );
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        expect.stringContaining('[TestLogger]'),
        'Warning message'
      );
    });

    it('should log debug messages', () => {
      logger.debug('Debug message', { debug: true });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        expect.stringContaining('[TestLogger]'),
        'Debug message',
        { debug: true }
      );
    });
  });

  describe('log formatting', () => {
    it('should format log messages with timestamp', () => {
      const fixedDate = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      logger.info('Test message');
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('2024-01-01T12:00:00.000Z'),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should include context in log messages', () => {
      const contextLogger = new Logger('CustomContext');
      contextLogger.info('Message with context');
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[CustomContext]'),
        expect.any(String)
      );
    });

    it('should handle metadata object', () => {
      logger.info('Message with metadata', { test: true, array: [1, 2, 3] });
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'Message with metadata',
        { test: true, array: [1, 2, 3] }
      );
    });
  });

  describe('file logging', () => {
    it('should write logs to file', () => {
      const appendFileSpy = fs.appendFileSync as jest.Mock;
      
      logger.info('File log test');
      
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('app.log'),
        expect.stringContaining('File log test'),
        'utf8'
      );
    });

    it('should write errors to error log file', () => {
      const appendFileSpy = fs.appendFileSync as jest.Mock;
      
      logger.error('Error log test');
      
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('error.log'),
        expect.stringContaining('Error log test'),
        'utf8'
      );
    });

    it('should handle file write errors gracefully', () => {
      (fs.appendFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File write error');
      });
      
      expect(() => {
        logger.info('Should not throw');
      }).not.toThrow();
      
      expect(consoleInfoSpy).toHaveBeenCalled();
    });
  });

  describe('log rotation', () => {
    it('should create daily log files', () => {
      const appendFileSpy = fs.appendFileSync as jest.Mock;
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      logger.info('Daily log');
      
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('app-2024-01-15.log'),
        expect.any(String),
        'utf8'
      );
    });

    it('should use different files for different days', () => {
      const appendFileSpy = fs.appendFileSync as jest.Mock;
      
      // Day 1
      const date1 = new Date('2024-01-15T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => date1 as any);
      logger.info('Day 1 log');
      
      // Day 2
      const date2 = new Date('2024-01-16T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => date2 as any);
      logger.info('Day 2 log');
      
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('app-2024-01-15.log'),
        expect.any(String),
        'utf8'
      );
      
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('app-2024-01-16.log'),
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('time measurement', () => {
    it('should measure async operations', async () => {
      const result = await logger.time('TestOperation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('TestOperation')
      );
    });

    it('should handle failed operations', async () => {
      const error = new Error('Test error');
      
      await expect(logger.time('FailedOperation', async () => {
        throw error;
      })).rejects.toThrow(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('FailedOperation')
      );
    });
  });

  describe('structured logging', () => {
    it('should support structured log data', () => {
      const structuredData = {
        user: 'testuser',
        action: 'login',
        timestamp: Date.now(),
        metadata: {
          ip: '127.0.0.1',
          userAgent: 'test-agent'
        }
      };
      
      logger.info('User action', structuredData);
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'User action',
        structuredData
      );
    });

    it('should serialize objects in file logs', () => {
      const appendFileSpy = fs.appendFileSync as jest.Mock;
      const data = { complex: { nested: { object: true } } };
      
      logger.info('Complex data', data);
      
      const logContent = appendFileSpy.mock.calls[0]?.[1];
      expect(logContent).toContain(JSON.stringify(data));
    });
  });

  describe('environment-specific behavior', () => {
    it('should not log debug in production', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      
      logger.debug('Debug in production');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should log debug in development', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';
      
      logger.debug('Debug in development');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should not write to files in test environment', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'test';
      
      logger.info('Test environment log');
      
      expect(fs.appendFileSync).not.toHaveBeenCalled();
      
      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('error handling', () => {
    it('should log error stack traces', () => {
      const error = new Error('Test error with stack');
      logger.error('Error occurred', error);
      
      const appendFileSpy = fs.appendFileSync as jest.Mock;
      const errorLogContent = appendFileSpy.mock.calls.find(
        call => call[0].includes('error.log')
      )?.[1];
      
      expect(errorLogContent).toContain(error.stack);
    });

    it('should handle non-error objects in error logs', () => {
      logger.error('Non-error object', { errorCode: 'TEST001', message: 'Test' });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    it('should handle circular references in logged objects', () => {
      const circular: any = { prop: 'value' };
      circular.self = circular;
      
      expect(() => {
        logger.info('Circular reference', circular);
      }).not.toThrow();
    });
  });

  describe('child loggers', () => {
    it('should create child logger with nested context', () => {
      const childLogger = logger.child('SubModule');
      childLogger.info('Child logger message');
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[TestLogger:SubModule]'),
        'Child logger message'
      );
    });

    it('should inherit parent logger settings', () => {
      const childLogger = logger.child('Child');
      const grandchildLogger = childLogger.child('Grandchild');
      
      grandchildLogger.info('Nested message');
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[TestLogger:Child:Grandchild]'),
        'Nested message'
      );
    });
  });
});