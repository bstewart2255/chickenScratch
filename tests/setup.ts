// Global test setup
// import { MigrationTracker } from '../scripts/MigrationTracker'; // Unused import removed

// Set test environment - MUST be done before any imports that might read env vars
process.env['NODE_ENV'] = 'test';

// Force test database URL - override any .env file
process.env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5432/signature_auth_test';

// Set explicit database config for tests
process.env['DB_HOST'] = 'localhost';
process.env['DB_PORT'] = '5432';
process.env['DB_NAME'] = 'signature_auth_test';
process.env['DB_USER'] = 'postgres';
process.env['DB_PASSWORD'] = 'postgres';
process.env['PGUSER'] = 'postgres';
process.env['PGPASSWORD'] = 'postgres';
process.env['PGHOST'] = 'localhost';
process.env['PGPORT'] = '5432';
process.env['PGDATABASE'] = 'signature_auth_test';

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