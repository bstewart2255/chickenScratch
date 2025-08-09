import { Request, Response, NextFunction } from 'express';

// Mock Express objects
export const mockRequest = (overrides: any = {}): Partial<Request> => ({
  body: {},
  query: {},
  params: {},
  headers: {},
  get: jest.fn(),
  ...overrides
});

export const mockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
};

export const mockNext = (): NextFunction => jest.fn();

// Mock Database Service
export class MockDatabaseService {
  connect = jest.fn().mockResolvedValue(true);
  disconnect = jest.fn().mockResolvedValue(true);
  
  createUser = jest.fn().mockResolvedValue({
    id: 'mock-user-id',
    username: 'testuser',
    email: 'test@example.com'
  });
  
  getUserById = jest.fn().mockResolvedValue({
    id: 'mock-user-id',
    username: 'testuser',
    email: 'test@example.com'
  });
  
  getUserByUsername = jest.fn().mockResolvedValue({
    id: 'mock-user-id',
    username: 'testuser',
    email: 'test@example.com'
  });
  
  saveBiometricData = jest.fn().mockResolvedValue({
    id: 'mock-biometric-id',
    userId: 'mock-user-id'
  });
  
  getBiometricDataByUserId = jest.fn().mockResolvedValue([]);
  
  updateAuthAttempt = jest.fn().mockResolvedValue(true);
  
  getAuthAttempts = jest.fn().mockResolvedValue([]);
}

// Mock Biometric Engine
export class MockBiometricEngine {
  extractFeatures = jest.fn().mockReturnValue({
    strokeCount: 3,
    totalDuration: 2000,
    avgPressure: 0.75,
    avgSpeed: 150,
    strokeLengths: [100, 150, 200],
    pauseDurations: [50, 100],
    directionChanges: 15,
    pressureVariance: 0.1,
    accelerationPatterns: [0.1, 0.2, 0.15]
  });
  
  compareFeatures = jest.fn().mockReturnValue(0.95);
  
  validateBiometricData = jest.fn().mockReturnValue(true);
  
  calculateMetrics = jest.fn().mockReturnValue({
    speed: 150,
    acceleration: 0.15,
    jerk: 0.05
  });
}

// Mock Config Service
export class MockConfigService {
  get = jest.fn().mockImplementation((key: string) => {
    const config: any = {
      'server.port': 3000,
      'database.host': 'localhost',
      'biometric.threshold': 0.85,
      'features.enhanced_shapes': true
    };
    return config[key];
  });
  
  getAll = jest.fn().mockReturnValue({
    server: { port: 3000 },
    database: { host: 'localhost' },
    biometric: { threshold: 0.85 }
  });
}

// Mock Logger
export class MockLogger {
  info = jest.fn();
  error = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
}

// Mock Canvas API
export const mockCanvasContext = () => ({
  canvas: {
    width: 800,
    height: 600,
    getContext: jest.fn().mockReturnThis(),
    toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mockdata')
  },
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round',
  lineJoin: 'round',
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  quadraticCurveTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  clearRect: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  scale: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  getImageData: jest.fn().mockReturnValue({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1
  }),
  putImageData: jest.fn(),
  createLinearGradient: jest.fn().mockReturnValue({
    addColorStop: jest.fn()
  })
});

// Mock Fetch
export const mockFetch = (response: any, ok: boolean = true) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: jest.fn().mockResolvedValue(response),
    text: jest.fn().mockResolvedValue(JSON.stringify(response)),
    headers: new Headers({
      'content-type': 'application/json'
    })
  });
};

// Mock Local Storage
export class MockLocalStorage {
  private store: { [key: string]: string } = {};

  getItem = (key: string): string | null => {
    return this.store[key] || null;
  };

  setItem = (key: string, value: string): void => {
    this.store[key] = value;
  };

  removeItem = (key: string): void => {
    delete this.store[key];
  };

  clear = (): void => {
    this.store = {};
  };
}

// Mock WebSocket
export class MockWebSocket {
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  readyState = this.CONNECTING;
  url: string;
  
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = this.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send = jest.fn();
  close = jest.fn(() => {
    this.readyState = this.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });

  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Test database connection helper
export const setupTestDatabase = async (): Promise<void> => {
  // Ensure test database configuration is set - prevent any "root" user usage
  process.env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5432/signature_auth_test';
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
  
  // Additional safeguards to prevent any "root" user usage
  process.env['POSTGRES_USER'] = 'postgres';
  process.env['POSTGRES_PASSWORD'] = 'postgres';
  process.env['POSTGRES_DB'] = 'signature_auth_test';
  
  // Ensure NODE_ENV is set to test
  process.env['NODE_ENV'] = 'test';
};

export const teardownTestDatabase = async (): Promise<void> => {
  // Clean up test database configuration
  delete process.env['DATABASE_URL'];
  delete process.env['DB_HOST'];
  delete process.env['DB_PORT'];
  delete process.env['DB_NAME'];
  delete process.env['DB_USER'];
  delete process.env['DB_PASSWORD'];
  delete process.env['PGUSER'];
  delete process.env['PGPASSWORD'];
  delete process.env['PGHOST'];
  delete process.env['PGPORT'];
  delete process.env['PGDATABASE'];
};