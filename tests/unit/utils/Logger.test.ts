import { Logger, LogLevel } from '../../../src/utils/Logger';

// Mock config service
jest.mock('../../../src/config/ConfigService', () => ({
  configService: {
    get: jest.fn(() => ({
      env: 'test',
      logging: { level: 'info' }
    }))
  }
}));

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    
    // Mock Date for consistent timestamps
    const fixedDate = new Date('2024-01-01T12:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(fixedDate);
    
    // Create logger instance
    logger = new Logger('TestLogger');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create logger with context', () => {
      const testLogger = new Logger('CustomContext');
      expect(testLogger).toBeDefined();
    });

    it('should inherit log level from configuration', () => {
      const testLogger = new Logger('CustomContext');
      // Log level is set to INFO in mock config
      testLogger.debug('Debug message');
      
      // Debug should not be logged when level is INFO
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      logger.info('Info message', { data: 'test' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestLogger]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"data":"test"}')
      );
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestLogger]')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      );
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestLogger]')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('should log debug messages when level allows', () => {
      // Set log level to DEBUG
      Logger.setGlobalLogLevel(LogLevel.DEBUG);
      const debugLogger = new Logger('TestLogger');
      
      debugLogger.debug('Debug message', { debug: true });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
    });
  });

  describe('log formatting', () => {
    it('should format log messages with timestamp', () => {
      logger.info('Test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('2024-01-01T12:00:00.000Z')
      );
    });

    it('should include context in log messages', () => {
      const contextLogger = new Logger('CustomContext');
      contextLogger.info('Message with context');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CustomContext]')
      );
    });

    it('should handle metadata object', () => {
      logger.info('Message with metadata', { test: true, array: [1, 2, 3] });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message with metadata')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"test":true,"array":[1,2,3]}')
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('TestOperation completed')
      );
    });

    it('should handle failed operations', async () => {
      const error = new Error('Test error');
      
      await expect(logger.time('FailedOperation', async () => {
        throw error;
      })).rejects.toThrow(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('FailedOperation failed')
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
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User action')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(structuredData))
      );
    });

    it('should serialize objects in console logs', () => {
      const data = { complex: { nested: { object: true } } };
      
      logger.info('Complex data', data);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(data))
      );
    });
  });

  describe('log level behavior', () => {
    it('should not log debug when level is INFO', () => {
      // Default level is INFO from mock config
      logger.debug('Debug message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log debug when global level is DEBUG', () => {
      Logger.setGlobalLogLevel(LogLevel.DEBUG);
      const debugLogger = new Logger('TestLogger');
      
      debugLogger.debug('Debug in development');
      
      expect(consoleLogSpy).toHaveBeenCalled();
      
      // Reset global level
      Logger.setGlobalLogLevel(null as any);
    });
  });

  describe('error handling', () => {
    it('should log error messages', () => {
      const error = new Error('Test error with stack');
      logger.error('Error occurred', { error: error.message, stack: error.stack });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      );
    });

    it('should handle non-error objects in error logs', () => {
      logger.error('Non-error object', { errorCode: 'TEST001', message: 'Test' });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
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
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestLogger:SubModule]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Child logger message')
      );
    });

    it('should inherit parent logger settings', () => {
      const childLogger = logger.child('Child');
      const grandchildLogger = childLogger.child('Grandchild');
      
      grandchildLogger.info('Nested message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestLogger:Child:Grandchild]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Nested message')
      );
    });
  });
});