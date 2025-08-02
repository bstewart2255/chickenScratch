# 4. Migration Phases & Timeline

## **Phase 0: Pre-Migration Validation (Week 0)**

### 0.1 Data Consistency Check
```bash
# Run validation script
node pre-migration-validator.js

# Fix any identified issues
node backend/fix-data-inconsistencies.js

# Verify all migrations are complete
node backend/verify-migrations.js
```

### 0.2 Create Initial Migration Status
```bash
# Initialize migration tracking
node scripts/init-migration-status.js

# Create first rollback point
git add .
git commit -m "Pre-migration checkpoint"
git tag migration-v2-start
```

## **Phase 1: Infrastructure Setup (Week 1)**

### 1.1 Install TypeScript Dependencies with Exact Versions
```json
{
  "devDependencies": {
    "typescript": "5.3.3",
    "@types/node": "20.10.5",
    "@types/express": "4.17.21",
    "@types/cors": "2.8.17",
    "@types/pg": "8.10.9",
    "ts-node": "10.9.2",
    "nodemon": "3.0.2",
    "@types/body-parser": "1.19.5",
    "jest": "29.7.0",
    "@types/jest": "29.5.11",
    "ts-jest": "29.1.1",
    "zod": "3.22.4",
    "@types/canvas": "2.11.2",
    "eslint": "8.56.0",
    "@typescript-eslint/eslint-plugin": "6.16.0",
    "@typescript-eslint/parser": "6.16.0"
  }
}
```

**IMPORTANT**: Always use `npm ci` instead of `npm install` after initial setup to ensure consistent dependencies.

### 1.2 TypeScript Configuration with Gradual Migration Support
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "allowJs": true,                    // Critical for gradual migration
    "checkJs": false,                   // Don't type-check JS files initially
    "strict": false,                    // Start permissive, tighten gradually
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "incremental": true,                // Speed up builds
    "tsBuildInfoFile": ".tsbuildinfo",  // Cache build info
    "noEmit": false,
    "noImplicitAny": false,            // Gradual strictness
    "strictNullChecks": false,         // Gradual strictness
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": false, // Enable after migration
    "baseUrl": "./",
    "paths": {
      "@types/*": ["src/types/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"]
    }
  },
  "include": [
    "src/**/*",
    "backend/**/*",
    "frontend/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "legacy",
    "**/*.spec.ts",
    "**/*.test.ts"
  ]
}
```

### 1.3 Strict Configuration for Migrated Files
```json
// tsconfig.strict.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": [
    "src/types/**/*",
    "src/services/**/*"
  ]
}
```

### 1.4 Update Package.json Scripts
```json
{
  "scripts": {
    "build": "tsc",
    "build:strict": "tsc -p tsconfig.strict.json",
    "dev": "ts-node backend/server.ts",
    "dev:js": "nodemon backend/server.js",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "type-check": "tsc --noEmit",
    "type-check:strict": "tsc --noEmit -p tsconfig.strict.json",
    "lint": "eslint . --ext .ts,.js",
    "lint:fix": "eslint . --ext .ts,.js --fix",
    "migration:status": "node scripts/show-migration-status.js",
    "migration:validate": "node pre-migration-validator.js"
  }
}
```

### 1.5 Create Directory Structure
```bash
mkdir -p src/types/{core,api,database,validation}
mkdir -p src/services/{auth,database,ml,monitoring}
mkdir -p src/utils/{validation,conversion,errors}
mkdir -p src/middleware
mkdir -p src/controllers
mkdir -p dist
mkdir -p scripts
```

## **Phase 2: Type Definitions (Week 1-2)**

### 2.1 Core Biometric Types
```typescript
// src/types/core/biometric.ts
export interface Point {
  x: number;
  y: number;
  time?: number;
  pressure?: number;
}

export interface StrokeData {
  points: Point[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  pressure?: number[];
}

export interface BiometricFeatures {
  // Core metrics (required)
  totalTime: number;
  averageSpeed: number;
  pathLength: number;
  
  // Optional enhanced features
  pressureVariation?: number;
  accelerationPattern?: number[];
  velocityProfile?: number[];
  spatialDensity?: number;
  
  // Shape-specific features
  corners?: number;
  straightLines?: number;
  curves?: number;
  
  // Temporal features
  pauseCount?: number;
  drawingRhythm?: number[];
}

export interface DeviceCapabilities {
  hasPressure: boolean;
  maxPressure: number;
  hasTouch: boolean;
  screenDensity: number;
  inputType: 'mouse' | 'touch' | 'stylus';
}
```

### 2.2 API Types with Zod Validation
```typescript
// src/types/api/auth.ts
import { z } from 'zod';
import { Point, StrokeData } from '../core/biometric';

export const AuthRequestSchema = z.object({
  username: z.string().min(1).max(100),
  signature: z.object({
    points: z.array(z.object({
      x: z.number(),
      y: z.number(),
      time: z.number().optional(),
      pressure: z.number().optional()
    })),
    minX: z.number(),
    maxX: z.number(),
    minY: z.number(),
    maxY: z.number()
  }),
  shapes: z.record(z.any()).optional(),
  drawings: z.record(z.any()).optional(),
  deviceCapabilities: z.object({
    hasPressure: z.boolean(),
    maxPressure: z.number(),
    hasTouch: z.boolean(),
    screenDensity: z.number(),
    inputType: z.enum(['mouse', 'touch', 'stylus'])
  }).optional()
});

export type AuthRequest = z.infer<typeof AuthRequestSchema>;

export interface AuthResponse {
  success: boolean;
  message: string;
  scores?: {
    signature: number;
    shapes?: Record<string, number>;
    drawings?: Record<string, number>;
    overall: number;
  };
  debug?: any;
}
```

### 2.3 Database Types
```typescript
// src/types/database/tables.ts
export interface SignatureRow {
  id: number;
  user_id: number;
  signature_data: any; // JSONB
  features: any;       // JSONB
  enhanced_features?: any; // JSONB
  data_format: 'base64' | 'stroke_data';
  device_info?: any;   // JSONB
  created_at: Date;
  is_enrollment?: boolean;
}

export interface ShapeRow {
  id: number;
  user_id: number;
  shape_type: string;
  shape_data: any;     // JSONB
  metrics: any;        // JSONB
  enhanced_features?: any; // JSONB
  data_format: 'base64' | 'stroke_data';
  created_at: Date;
}

export interface UserRow {
  id: number;
  username: string;
  created_at: Date;
  last_login?: Date;
}
```

## **Phase 3: Backend Migration (Week 2-3)**

### 3.1 Create Migration Utilities
```typescript
// src/utils/DataFormatConverter.ts
export class DataFormatConverter {
  static convertBase64ToStrokeData(base64Data: string): StrokeData | null {
    try {
      // Handle legacy base64 format
      const decoded = JSON.parse(Buffer.from(base64Data, 'base64').toString());
      return this.normalizeToStrokeData(decoded);
    } catch (error) {
      console.warn('Failed to convert base64 data:', error);
      return null;
    }
  }

  static normalizeToStrokeData(data: any): StrokeData {
    // Handle multiple input formats
    if (data.points && Array.isArray(data.points)) {
      return data as StrokeData;
    }
    
    // Convert from other formats
    throw new Error('Unsupported data format');
  }
}
```

### 3.2 Migrate Core Services
```typescript
// src/services/BiometricEngine.ts
import { StrokeData, BiometricFeatures } from '../types/core/biometric';
import { DataFormatConverter } from '../utils/DataFormatConverter';

export class BiometricEngine {
  public async extractFeatures(
    strokeData: StrokeData, 
    options: { enhanced?: boolean } = {}
  ): Promise<BiometricFeatures> {
    // Type-safe feature extraction
    const features: BiometricFeatures = {
      totalTime: this.calculateTotalTime(strokeData),
      averageSpeed: this.calculateAverageSpeed(strokeData),
      pathLength: this.calculatePathLength(strokeData)
    };

    if (options.enhanced) {
      features.pressureVariation = this.calculatePressureVariation(strokeData);
      features.accelerationPattern = this.calculateAcceleration(strokeData);
    }

    return features;
  }

  private calculateTotalTime(strokeData: StrokeData): number {
    if (!strokeData.points.length) return 0;
    
    const firstPoint = strokeData.points[0];
    const lastPoint = strokeData.points[strokeData.points.length - 1];
    
    return (lastPoint.time || 0) - (firstPoint.time || 0);
  }

  private calculateAverageSpeed(strokeData: StrokeData): number {
    // Implementation with proper typing
    return 0;
  }

  private calculatePathLength(strokeData: StrokeData): number {
    // Implementation with proper typing
    return 0;
  }
}
```

## **Phase 4: Frontend Migration (Week 3)**

### 4.1 DeviceCapabilityDetector
```typescript
// src/frontend/DeviceCapabilityDetector.ts
import { DeviceCapabilities } from '../types/core/biometric';

export class DeviceCapabilityDetector {
  public static detect(): DeviceCapabilities {
    return {
      hasPressure: this.detectPressureSupport(),
      maxPressure: this.getMaxPressure(),
      hasTouch: this.detectTouchSupport(),
      screenDensity: this.getScreenDensity(),
      inputType: this.detectInputType()
    };
  }

  private static detectPressureSupport(): boolean {
    // Check for pressure support
    return 'ontouchstart' in window && 'TouchEvent' in window;
  }

  private static getMaxPressure(): number {
    return 1.0; // Default WebAPI maximum
  }

  private static detectTouchSupport(): boolean {
    return 'ontouchstart' in window;
  }

  private static getScreenDensity(): number {
    return window.devicePixelRatio || 1;
  }

  private static detectInputType(): 'mouse' | 'touch' | 'stylus' {
    if ('ontouchstart' in window) {
      return 'touch';
    }
    return 'mouse';
  }
}
```

### 4.2 Type-Safe API Client
```typescript
// src/frontend/apiClient.ts
import { 
  AuthRequest, 
  AuthResponse, 
  RegistrationRequest, 
  RegistrationResponse,
  HealthResponse,
  AuthRequestSchema,
  RegistrationRequestSchema
} from '../types/api';
import { StrokeData, DeviceCapabilities } from '../types/core/biometric';
import { z } from 'zod';

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  onError?: (error: ApiError) => void;
  onRetry?: (attempt: number, error: ApiError) => void;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private config: Required<ApiClientConfig>;
  
  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      onError: config.onError || (() => {}),
      onRetry: config.onRetry || (() => {})
    };
  }
  
  private async fetchWithRetry<T>(
    url: string, 
    options: RequestInit,
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(), 
          this.config.timeout
        );
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          );
        }
        
        const data = await response.json();
        
        if (schema) {
          return schema.parse(data);
        }
        
        return data as T;
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts) {
          this.config.onRetry(attempt, error as ApiError);
          await new Promise(resolve => 
            setTimeout(resolve, this.config.retryDelay * attempt)
          );
        }
      }
    }
    
    this.config.onError(lastError as ApiError);
    throw lastError!;
  }
  
  public async authenticate(request: AuthRequest): Promise<AuthResponse> {
    // Validate request
    AuthRequestSchema.parse(request);
    
    return this.fetchWithRetry<AuthResponse>(
      `${this.config.baseUrl}/api/authenticate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      }
    );
  }
  
  public async register(request: RegistrationRequest): Promise<RegistrationResponse> {
    // Validate request
    RegistrationRequestSchema.parse(request);
    
    return this.fetchWithRetry<RegistrationResponse>(
      `${this.config.baseUrl}/api/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      }
    );
  }
  
  public async healthCheck(): Promise<HealthResponse> {
    return this.fetchWithRetry<HealthResponse>(
      `${this.config.baseUrl}/api/health`
    );
  }
}
```

## **Phase 5: Testing & Validation (Week 4)**

### 5.1 Jest Configuration
```json
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/backend'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**/*.ts',
    '!src/types/**/*.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapping: {
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  }
};
```

### 5.2 Example Test Suite
```typescript
// src/services/__tests__/BiometricEngine.test.ts
import { BiometricEngine } from '../BiometricEngine';
import { StrokeData } from '../../types/core/biometric';

describe('BiometricEngine', () => {
  let engine: BiometricEngine;
  let sampleStroke: StrokeData;

  beforeEach(() => {
    engine = new BiometricEngine();
    sampleStroke = {
      points: [
        { x: 0, y: 0, time: 0 },
        { x: 10, y: 10, time: 100 },
        { x: 20, y: 0, time: 200 }
      ],
      minX: 0,
      maxX: 20,
      minY: 0,
      maxY: 10
    };
  });

  describe('extractFeatures', () => {
    it('should extract basic features correctly', async () => {
      const features = await engine.extractFeatures(sampleStroke);
      
      expect(features).toHaveProperty('totalTime');
      expect(features).toHaveProperty('averageSpeed');
      expect(features).toHaveProperty('pathLength');
      expect(features.totalTime).toBe(200);
    });

    it('should extract enhanced features when requested', async () => {
      const features = await engine.extractFeatures(sampleStroke, { enhanced: true });
      
      expect(features).toHaveProperty('pressureVariation');
      expect(features).toHaveProperty('accelerationPattern');
    });
  });
});
```

## **Phase 6: Deployment & Documentation (Week 4)**

### 6.1 Update Build Scripts
```json
// package.json additions
{
  "scripts": {
    "build:production": "npm run type-check:strict && npm run test:coverage && npm run build",
    "deploy:staging": "npm run build:production && ./scripts/deploy-staging.sh",
    "deploy:production": "npm run build:production && ./scripts/deploy-production.sh"
  }
}
```

### 6.2 Create Deployment Scripts
```bash
#!/bin/bash
# scripts/deploy-staging.sh

echo "🚀 Deploying to staging..."

# Run final checks
npm run type-check:strict
npm run test:coverage
npm run build

# Deploy
echo "Deployment complete ✓"
```