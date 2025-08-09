import { 
  TestBiometricData, 
  User, 
  DeviceCapabilities,
  StrokeData,
  StrokePoint,
  BiometricFeatures,
  RegistrationData,
  AuthenticationData
} from '../../src/types/core/biometric';

export class TestDataGenerator {
  private static counter = 0;

  static reset(): void {
    this.counter = 0;
  }

  static generateUniqueId(): string {
    return `test-id-${++this.counter}-${Date.now()}`;
  }

  static generateUser(overrides: Partial<User> = {}): User {
    return {
      id: this.generateUniqueId(),
      username: `testuser${this.counter}`,
      email: `test${this.counter}@example.com`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  static generatePoint(overrides: Partial<StrokePoint> = {}): StrokePoint {
    return {
      x: Math.random() * 500,
      y: Math.random() * 300,
      timestamp: Date.now(),
      pressure: Math.random(),
      ...overrides
    };
  }

  static generateStrokeData(pointCount: number = 10): StrokeData {
    const points: StrokePoint[] = [];
    const startTime = Date.now();
    
    for (let i = 0; i < pointCount; i++) {
      points.push({
        x: 100 + i * 10 + (Math.random() - 0.5) * 5,
        y: 100 + Math.sin(i * 0.5) * 50 + (Math.random() - 0.5) * 5,
        timestamp: startTime + i * 50,
        pressure: 0.5 + Math.random() * 0.5
      });
    }

    return {
      id: this.generateUniqueId(),
      points,
      startTime,
      endTime: startTime + pointCount * 50,
      duration: pointCount * 50,
      deviceType: 'pen' as const
    };
  }

  static generateBiometricFeatures(overrides: Partial<BiometricFeatures> = {}): BiometricFeatures {
    return {
      strokeCount: Math.floor(Math.random() * 10) + 1,
      totalDuration: Math.random() * 5000 + 1000,
      avgPressure: Math.random() * 0.5 + 0.5,
      avgSpeed: Math.random() * 100 + 50,
      strokeLengths: [100, 150, 200],
      pauseDurations: [50, 100, 150],
      directionChanges: Math.floor(Math.random() * 20),
      pressureVariance: Math.random() * 0.2,
      accelerationPatterns: [0.1, 0.2, 0.15],
      ...overrides
    };
  }

  static generateBiometricData(overrides: Partial<TestBiometricData> = {}): TestBiometricData {
    const strokes = [
      this.generateStrokeData(),
      this.generateStrokeData(),
      this.generateStrokeData()
    ];

    return {
      id: this.generateUniqueId(),
      userId: this.generateUniqueId(),
      strokes,
      features: this.generateBiometricFeatures(),
      type: 'signature' as const,
      createdAt: new Date().toISOString(),
      deviceInfo: this.generateDeviceCapabilities(),
      ...overrides
    };
  }

  static generateDeviceCapabilities(overrides: Partial<DeviceCapabilities> = {}): DeviceCapabilities {
    return {
      supportsPressure: true,
      supportsTouch: true,
      inputMethod: 'touch',
      pointerTypes: ['touch', 'pen', 'mouse'],
      browser: 'Mozilla/5.0 Test Browser',
      os: 'Test Platform',
      devicePixelRatio: 2,
      canvasSupport: {
        basic: true,
        webgl: true,
        webgl2: true,
        offscreenCanvas: false
      },
      ...overrides
    };
  }

  static generateRegistrationData(overrides: Partial<RegistrationData> = {}): RegistrationData {
    return {
      username: `testuser${this.counter}`,
      email: `test${this.counter}@example.com`,
      signatureData: this.generateBiometricData(),
      shapeData: this.generateBiometricData({ type: 'shape' as const }),
      drawingData: this.generateBiometricData({ type: 'drawing' as const }),
      deviceCapabilities: this.generateDeviceCapabilities(),
      ...overrides
    };
  }

  static generateAuthenticationData(overrides: Partial<AuthenticationData> = {}): AuthenticationData {
    return {
      username: `testuser${this.counter}`,
      biometricData: this.generateBiometricData(),
      type: 'signature' as const,
      deviceCapabilities: this.generateDeviceCapabilities(),
      ...overrides
    };
  }

  static generateInvalidBiometricData(): any {
    const invalidVariants = [
      null,
      undefined,
      {},
      { strokes: null },
      { strokes: [], features: null },
      { strokes: 'invalid' },
      { features: { strokeCount: 'invalid' } },
      { strokes: [{ points: null }] },
      { strokes: [{ points: [{ x: 'invalid' }] }] }
    ];

    return invalidVariants[Math.floor(Math.random() * invalidVariants.length)];
  }

  static generateEdgeCaseStrokes(): StrokeData[] {
    return [
      // Single point stroke
      {
        id: this.generateUniqueId(),
        points: [this.generatePoint()],
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        deviceType: 'pen' as const
      },
      // Very long stroke
      {
        id: this.generateUniqueId(),
        points: Array(1000).fill(null).map((_, i) => this.generatePoint({ x: i })),
        startTime: Date.now(),
        endTime: Date.now() + 10000,
        duration: 10000,
        deviceType: 'pen' as const
      },
      // Zero pressure stroke
      {
        id: this.generateUniqueId(),
        points: Array(10).fill(null).map(() => this.generatePoint({ pressure: 0 })),
        startTime: Date.now(),
        endTime: Date.now() + 1000,
        duration: 1000,
        deviceType: 'touch' as const
      }
    ];
  }

  static generatePerformanceTestData(size: 'small' | 'medium' | 'large'): TestBiometricData[] {
    const counts = {
      small: 10,
      medium: 100,
      large: 1000
    };

    return Array(counts[size]).fill(null).map(() => this.generateBiometricData());
  }
}