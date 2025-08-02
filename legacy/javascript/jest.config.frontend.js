module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: [
    '**/tests/unit/frontend/**/*.test.ts'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@backend/(.*)$': '<rootDir>/backend/$1',
    '^@frontend/(.*)$': '<rootDir>/frontend/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  setupFiles: ['jest-canvas-mock', '<rootDir>/tests/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.ts'],
  testTimeout: 10000,
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowJs: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        strict: false
      }
    }
  }
};