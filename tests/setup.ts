// Global test setup
// import { MigrationTracker } from '../scripts/MigrationTracker'; // Unused import removed

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/signature_auth_test';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock migration tracker for tests
jest.mock('../scripts/MigrationTracker', () => ({
  MigrationTracker: {
    migrateFile: jest.fn().mockResolvedValue({
      success: true,
      hasTypeErrors: false,
      performanceImpact: 0
    }),
    getFileStatus: jest.fn().mockReturnValue({
      path: '',
      status: 'migrated',
      hasTypes: true,
      typeErrors: 0
    }),
    generateReport: jest.fn().mockReturnValue({
      summary: {
        totalFiles: 0,
        migratedFiles: 0,
        pendingFiles: 0,
        filesWithErrors: 0,
        overallProgress: 100
      }
    })
  }
}));

// Set up test timeouts
jest.setTimeout(10000);

// Clean up after tests
if (typeof afterAll !== 'undefined') {
  afterAll(() => {
    jest.restoreAllMocks();
  });
}