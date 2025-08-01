// Additional setup after Jest environment is initialized
import '@testing-library/jest-dom';

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toHaveValidBiometricData(received: any) {
    const pass = 
      received &&
      typeof received === 'object' &&
      'strokeCount' in received &&
      'totalDuration' in received &&
      'avgPressure' in received &&
      typeof received.strokeCount === 'number' &&
      typeof received.totalDuration === 'number' &&
      typeof received.avgPressure === 'number';
      
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be valid biometric data`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be valid biometric data`,
        pass: false,
      };
    }
  }
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveValidBiometricData(): R;
    }
  }
}

// Mock timers for consistent testing
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Clean up after each test
afterEach(() => {
  jest.useRealTimers();
});