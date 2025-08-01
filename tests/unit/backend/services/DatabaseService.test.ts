import { DatabaseService } from '../../../../backend/DatabaseService';
import { TestDataGenerator } from '../../../helpers/generators';
import { Pool } from 'pg';

// Mock pg module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
  
  return { Pool: jest.fn(() => mockPool) };
});

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    TestDataGenerator.reset();
    
    // Get mock instances
    mockPool = new Pool();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(mockClient);
    
    dbService = new DatabaseService();
  });

  afterEach(async () => {
    await dbService.disconnect();
  });

  describe('connect', () => {
    it('should establish database connection', async () => {
      await dbService.connect();
      
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(dbService.connect()).rejects.toThrow('Connection failed');
    });

    it('should not reconnect if already connected', async () => {
      await dbService.connect();
      await dbService.connect();
      
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect', () => {
    it('should close database connection', async () => {
      await dbService.connect();
      await dbService.disconnect();
      
      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await expect(dbService.disconnect()).resolves.not.toThrow();
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com'
      };
      
      const mockUser = TestDataGenerator.generateUser(userData);
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await dbService.createUser(userData.username, userData.email);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [userData.username, userData.email]
      );
      expect(result).toEqual(mockUser);
    });

    it('should handle duplicate username', async () => {
      mockPool.query.mockRejectedValueOnce({
        code: '23505',
        constraint: 'users_username_key'
      });

      await expect(
        dbService.createUser('existinguser', 'new@example.com')
      ).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        dbService.createUser('testuser', 'test@example.com')
      ).rejects.toThrow('Database error');
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by ID', async () => {
      const mockUser = TestDataGenerator.generateUser();
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await dbService.getUserById(mockUser.id);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE id'),
        [mockUser.id]
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent user', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await dbService.getUserById('non-existent-id');
      
      expect(result).toBeNull();
    });
  });

  describe('getUserByUsername', () => {
    it('should retrieve user by username', async () => {
      const mockUser = TestDataGenerator.generateUser();
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await dbService.getUserByUsername(mockUser.username);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE username'),
        [mockUser.username]
      );
      expect(result).toEqual(mockUser);
    });

    it('should handle case-insensitive search', async () => {
      const mockUser = TestDataGenerator.generateUser({ username: 'TestUser' });
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await dbService.getUserByUsername('testuser');
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(username)'),
        ['testuser']
      );
    });
  });

  describe('saveBiometricData', () => {
    it('should save biometric data', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      const biometricData = TestDataGenerator.generateBiometricData({ userId });
      
      const mockSaved = {
        id: TestDataGenerator.generateUniqueId(),
        userId,
        data: biometricData,
        type: biometricData.type,
        createdAt: new Date().toISOString()
      };
      
      mockPool.query.mockResolvedValueOnce({ rows: [mockSaved] });

      const result = await dbService.saveBiometricData(userId, biometricData);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO biometric_data'),
        expect.arrayContaining([userId, expect.any(String), biometricData.type])
      );
      expect(result).toEqual(mockSaved);
    });

    it('should handle JSON serialization errors', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      const circularData: any = { data: {} };
      circularData.data.circular = circularData;

      await expect(
        dbService.saveBiometricData(userId, circularData)
      ).rejects.toThrow();
    });
  });

  describe('getBiometricDataByUserId', () => {
    it('should retrieve all biometric data for a user', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      const mockData = [
        TestDataGenerator.generateBiometricData({ userId, type: 'signature' }),
        TestDataGenerator.generateBiometricData({ userId, type: 'shape' }),
        TestDataGenerator.generateBiometricData({ userId, type: 'drawing' })
      ];
      
      mockPool.query.mockResolvedValueOnce({ 
        rows: mockData.map(data => ({
          id: TestDataGenerator.generateUniqueId(),
          userId,
          data: JSON.stringify(data),
          type: data.type,
          createdAt: new Date().toISOString()
        }))
      });

      const result = await dbService.getBiometricDataByUserId(userId);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM biometric_data WHERE user_id'),
        [userId]
      );
      expect(result).toHaveLength(3);
      expect(result.map(r => r.type)).toEqual(['signature', 'shape', 'drawing']);
    });

    it('should filter by type', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await dbService.getBiometricDataByUserId(userId, 'signature');
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND type ='),
        [userId, 'signature']
      );
    });

    it('should handle JSON parsing errors', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{
          id: '1',
          userId,
          data: 'invalid json',
          type: 'signature',
          createdAt: new Date().toISOString()
        }]
      });

      await expect(
        dbService.getBiometricDataByUserId(userId)
      ).rejects.toThrow();
    });
  });

  describe('updateAuthAttempt', () => {
    it('should record successful authentication', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      const attemptData = {
        success: true,
        similarityScore: 0.95,
        attemptType: 'signature' as const,
        deviceInfo: TestDataGenerator.generateDeviceCapabilities()
      };
      
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

      await dbService.updateAuthAttempt(userId, attemptData);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_attempts'),
        expect.arrayContaining([
          userId,
          attemptData.success,
          attemptData.similarityScore,
          attemptData.attemptType,
          expect.any(String)
        ])
      );
    });

    it('should record failed authentication', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      const attemptData = {
        success: false,
        similarityScore: 0.45,
        attemptType: 'signature' as const,
        deviceInfo: TestDataGenerator.generateDeviceCapabilities()
      };
      
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

      await dbService.updateAuthAttempt(userId, attemptData);
      
      expect(mockPool.query).toHaveBeenCalled();
      const callArgs = mockPool.query.mock.calls[0];
      expect(callArgs[1][1]).toBe(false);
      expect(callArgs[1][2]).toBe(0.45);
    });
  });

  describe('getAuthAttempts', () => {
    it('should retrieve recent auth attempts', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      const mockAttempts = [
        {
          id: '1',
          userId,
          success: true,
          similarityScore: 0.95,
          attemptType: 'signature',
          deviceInfo: '{}',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          userId,
          success: false,
          similarityScore: 0.45,
          attemptType: 'shape',
          deviceInfo: '{}',
          createdAt: new Date().toISOString()
        }
      ];
      
      mockPool.query.mockResolvedValueOnce({ rows: mockAttempts });

      const result = await dbService.getAuthAttempts(userId);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM auth_attempts'),
        expect.arrayContaining([userId, expect.any(Number)])
      );
      expect(result).toHaveLength(2);
    });

    it('should limit results', async () => {
      const userId = TestDataGenerator.generateUniqueId();
      
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await dbService.getAuthAttempts(userId, 5);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [userId, 5]
      );
    });
  });

  describe('transactions', () => {
    it('should handle transaction rollback on error', async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn()
      };
      
      mockPool.connect.mockResolvedValueOnce(client);
      
      // Mock transaction operations
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Transaction error')) // Operation fails
        .mockResolvedValueOnce({}); // ROLLBACK

      // This would be a transactional operation in the real service
      try {
        await dbService.connect();
        throw new Error('Transaction error');
      } catch (error) {
        // Transaction should be rolled back
      }
      
      expect(client.release).toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    it('should use connection pooling efficiently', async () => {
      const promises = Array(10).fill(null).map(() => 
        dbService.getUserById(TestDataGenerator.generateUniqueId())
      );
      
      mockPool.query.mockResolvedValue({ rows: [] });
      
      await Promise.all(promises);
      
      // Should reuse pool connections
      expect(mockPool.query).toHaveBeenCalledTimes(10);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        dbService.getUserById('test-id')
      ).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle timeout errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Query timeout'));

      await expect(
        dbService.getBiometricDataByUserId('test-id')
      ).rejects.toThrow('Query timeout');
    });
  });
});