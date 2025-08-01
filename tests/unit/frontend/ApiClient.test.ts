/**
 * @jest-environment jsdom
 */
import { ApiClient } from '../../../frontend/ts/ApiClient';
import { TestDataGenerator } from '../../helpers/generators';
import { mockFetch, MockLocalStorage } from '../../helpers/mocks';
import { RegistrationData, AuthenticationData, ApiResponse } from '../../../src/types';

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    // Set up mock localStorage
    mockLocalStorage = new MockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    // Reset fetch mock
    global.fetch = jest.fn();
    
    // Create ApiClient instance
    apiClient = new ApiClient('http://localhost:3000');
    
    TestDataGenerator.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with base URL', () => {
      const client = new ApiClient('https://api.example.com');
      expect(client.baseUrl).toBe('https://api.example.com');
    });

    it('should handle trailing slash in base URL', () => {
      const client = new ApiClient('https://api.example.com/');
      expect(client.baseUrl).toBe('https://api.example.com');
    });
  });

  describe('register', () => {
    it('should successfully register a user', async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();
      const mockResponse = {
        success: true,
        data: {
          user: TestDataGenerator.generateUser({ username: registrationData.username }),
          token: 'mock-jwt-token'
        }
      };

      mockFetch(mockResponse, true);

      const result = await apiClient.register(registrationData);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/register',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(registrationData)
        })
      );

      expect(result).toEqual(mockResponse);
      expect(mockLocalStorage.getItem('authToken')).toBe('mock-jwt-token');
    });

    it('should handle registration errors', async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();
      const mockResponse = {
        success: false,
        error: 'Username already exists'
      };

      mockFetch(mockResponse, false);

      await expect(apiClient.register(registrationData)).rejects.toThrow('Username already exists');
      expect(mockLocalStorage.getItem('authToken')).toBeNull();
    });

    it('should handle network errors', async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();
      
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(apiClient.register(registrationData)).rejects.toThrow('Network error');
    });

    it('should validate response with Zod schema', async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();
      const invalidResponse = {
        success: true,
        data: {
          // Missing required fields
          user: { invalidField: 'test' }
        }
      };

      mockFetch(invalidResponse, true);

      await expect(apiClient.register(registrationData)).rejects.toThrow();
    });
  });

  describe('authenticate', () => {
    it('should successfully authenticate a user', async () => {
      const authData = TestDataGenerator.generateAuthenticationData();
      const mockResponse = {
        success: true,
        data: {
          authenticated: true,
          similarityScore: 0.95,
          token: 'new-auth-token'
        }
      };

      mockFetch(mockResponse, true);

      const result = await apiClient.authenticate(authData);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/authenticate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(authData)
        })
      );

      expect(result).toEqual(mockResponse);
      expect(mockLocalStorage.getItem('authToken')).toBe('new-auth-token');
    });

    it('should handle failed authentication', async () => {
      const authData = TestDataGenerator.generateAuthenticationData();
      const mockResponse = {
        success: false,
        data: {
          authenticated: false,
          similarityScore: 0.45
        }
      };

      mockFetch(mockResponse, true);

      const result = await apiClient.authenticate(authData);

      expect(result.data.authenticated).toBe(false);
      expect(mockLocalStorage.getItem('authToken')).toBeNull();
    });

    it('should include auth token in request if available', async () => {
      mockLocalStorage.setItem('authToken', 'existing-token');
      
      const authData = TestDataGenerator.generateAuthenticationData();
      mockFetch({ success: true, data: { authenticated: true, similarityScore: 0.9 } }, true);

      await apiClient.authenticate(authData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer existing-token'
          })
        })
      );
    });
  });

  describe('getUserData', () => {
    it('should fetch user data', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      const mockUser = TestDataGenerator.generateUser({ id: userId });
      const mockResponse = {
        success: true,
        data: mockUser
      };

      mockLocalStorage.setItem('authToken', 'valid-token');
      mockFetch(mockResponse, true);

      const result = await apiClient.getUserData(userId);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/users/${userId}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle unauthorized requests', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      
      mockFetch({ success: false, error: 'Unauthorized' }, false);

      await expect(apiClient.getUserData(userId)).rejects.toThrow('Unauthorized');
    });
  });

  describe('request interceptor', () => {
    it('should add default headers', async () => {
      mockFetch({ success: true }, true);

      await apiClient.healthCheck();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Client-Version': '1.0.0'
          })
        })
      );
    });

    it('should handle request timeout', async () => {
      jest.useFakeTimers();
      
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true })
          }), 10000);
        })
      );

      const promise = apiClient.healthCheck();
      
      jest.advanceTimersByTime(5000);
      
      await expect(promise).rejects.toThrow('Request timeout');
      
      jest.useRealTimers();
    });
  });

  describe('response handling', () => {
    it('should handle non-JSON responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Plain text response'
      });

      await expect(apiClient.healthCheck()).rejects.toThrow();
    });

    it('should retry failed requests', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true })
        });
      });

      const result = await apiClient.healthCheck();

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle rate limiting', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 
          'content-type': 'application/json',
          'retry-after': '60'
        }),
        json: async () => ({ error: 'Rate limit exceeded' })
      });

      await expect(apiClient.healthCheck()).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('healthCheck', () => {
    it('should perform health check', async () => {
      const mockResponse = {
        success: true,
        data: {
          status: 'healthy',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }
      };

      mockFetch(mockResponse, true);

      const result = await apiClient.healthCheck();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/health',
        expect.objectContaining({
          method: 'GET'
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('error handling', () => {
    it('should handle 404 errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Not found' })
      });

      await expect(apiClient.getUserData('non-existent')).rejects.toThrow('Not found');
    });

    it('should handle 500 errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Internal server error' })
      });

      await expect(apiClient.healthCheck()).rejects.toThrow('Internal server error');
    });

    it('should handle malformed error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ unexpected: 'format' })
      });

      await expect(apiClient.healthCheck()).rejects.toThrow('Request failed');
    });
  });

  describe('token management', () => {
    it('should clear token on 401 response', async () => {
      mockLocalStorage.setItem('authToken', 'invalid-token');
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Token expired' })
      });

      await expect(apiClient.getUserData('test-id')).rejects.toThrow('Token expired');
      
      expect(mockLocalStorage.getItem('authToken')).toBeNull();
    });

    it('should refresh token if provided in response', async () => {
      const mockResponse = {
        success: true,
        data: { test: 'data' },
        newToken: 'refreshed-token'
      };

      mockFetch(mockResponse, true);

      await apiClient.healthCheck();

      expect(mockLocalStorage.getItem('authToken')).toBe('refreshed-token');
    });
  });

  describe('performance', () => {
    it('should handle concurrent requests', async () => {
      mockFetch({ success: true }, true);

      const promises = Array(10).fill(null).map(() => apiClient.healthCheck());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(global.fetch).toHaveBeenCalledTimes(10);
    });

    it('should cancel pending requests on abort', async () => {
      const abortController = new AbortController();
      
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise((resolve, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(new Error('Aborted'));
          });
        })
      );

      const promise = apiClient.healthCheck();
      abortController.abort();

      await expect(promise).rejects.toThrow('Aborted');
    });
  });
});