/**
 * API Client for frontend-backend communication
 * Handles all API requests with proper typing and validation
 */

import { z } from 'zod';
import type { DeviceCapabilities } from '../src/types/core/biometric';

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Zod schemas for response validation
const CheckUsernameResponseSchema = z.object({
  available: z.boolean(),
  message: z.string().optional()
});

const CheckUserExistsResponseSchema = z.object({
  exists: z.boolean(),
  message: z.string().optional()
});

const RegisterResponseSchema = z.object({
  success: z.boolean(),
  user_id: z.string(),
  message: z.string().optional(),
  features_extracted: z.object({
    signatures: z.number(),
    shapes: z.number(),
    drawings: z.number()
  }).optional()
});

const LoginResponseSchema = z.object({
  success: z.boolean(),
  auth_score: z.number(),
  threshold: z.number(),
  message: z.string(),
  is_authentic: z.boolean(),
  feature_scores: z.object({
    pressure: z.number().optional(),
    velocity: z.number().optional(),
    acceleration: z.number().optional(),
    jerk: z.number().optional(),
    stroke_length: z.number().optional(),
    stroke_count: z.number().optional(),
    duration: z.number().optional(),
    shape_complexity: z.number().optional()
  }).optional(),
  ml_predictions: z.object({
    rf_score: z.number().optional(),
    rf_confidence: z.number().optional(),
    svm_score: z.number().optional(),
    svm_confidence: z.number().optional(),
    ensemble_score: z.number().optional(),
    prediction: z.string().optional()
  }).optional()
});

// Signature data interfaces
interface SignatureData {
  data: any; // SignaturePad data format
  raw: any;  // Raw stroke data
  metrics: any; // Computed metrics
  timestamp: string;
}

interface ShapeData {
  [key: string]: SignatureData;
}

interface DrawingData {
  [key: string]: SignatureData;
}

export class ApiClient {
  private baseUrl: string;
  private headers: HeadersInit;
  private retryCount: number = 3;
  private retryDelay: number = 1000;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || this.detectApiUrl();
    this.headers = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Detect API URL based on environment
   */
  private detectApiUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://chickenscratch.onrender.com';
    }
    return 'http://localhost:3000';
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const finalOptions: RequestInit = {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers
      }
    };

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiError(
            response.status,
            errorData.code || 'UNKNOWN_ERROR',
            errorData.message || `HTTP ${response.status}`,
            errorData.details
          );
        }

        const data = await response.json();
        
        // Validate response if schema provided
        if (schema) {
          return schema.parse(data);
        }
        
        return data as T;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        // Wait before retrying
        if (attempt < this.retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }
    
    throw lastError || new Error('Request failed');
  }

  /**
   * Check if username is available
   */
  async checkUsername(username: string): Promise<boolean> {
    try {
      const response = await this.request(
        '/api/check-username',
        {
          method: 'POST',
          body: JSON.stringify({ username })
        },
        CheckUsernameResponseSchema
      );
      return response.available;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        return false; // Username taken
      }
      throw error;
    }
  }

  /**
   * Check if user exists
   */
  async checkUserExists(username: string): Promise<boolean> {
    try {
      const response = await this.request(
        '/api/check-user-exists',
        {
          method: 'POST',
          body: JSON.stringify({ username })
        },
        CheckUserExistsResponseSchema
      );
      return response.exists;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return false; // User doesn't exist
      }
      throw error;
    }
  }

  /**
   * Register new user with biometric data
   */
  async register(data: {
    username: string;
    signatures: SignatureData[];
    shapes: ShapeData;
    drawings: DrawingData;
    device_info: string;
    device_capabilities: DeviceCapabilities;
    timestamp: string;
  }) {
    return this.request(
      '/register',
      {
        method: 'POST',
        body: JSON.stringify(data)
      },
      RegisterResponseSchema
    );
  }

  /**
   * Login with biometric authentication
   */
  async login(data: {
    username: string;
    signature: SignatureData;
    shape: SignatureData;
    drawing: SignatureData;
    device_info: string;
    device_capabilities: DeviceCapabilities;
    timestamp: string;
  }) {
    return this.request(
      '/login',
      {
        method: 'POST',
        body: JSON.stringify(data)
      },
      LoginResponseSchema
    );
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string) {
    this.headers = {
      ...this.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Clear authentication token
   */
  clearAuthToken() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { Authorization: _auth, ...rest } = this.headers as any;
    this.headers = rest;
  }

  /**
   * Get current API URL
   */
  getApiUrl(): string {
    return this.baseUrl;
  }

  /**
   * Update API URL
   */
  setApiUrl(url: string) {
    this.baseUrl = url;
  }

  /**
   * Health check endpoint
   */
  async healthCheck() {
    return this.request('/api/health', {
      method: 'GET'
    });
  }

  /**
   * Get user data by ID
   */
  async getUserData(userId: string) {
    return this.request(`/api/users/${userId}`, {
      method: 'GET'
    });
  }
}

// Export singleton instance for convenience
export const apiClient = new ApiClient();

// Export default
export default ApiClient;