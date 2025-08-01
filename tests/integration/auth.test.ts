import request from 'supertest';
import { app } from '../../backend/server';
import { DatabaseService } from '../../backend/services/DatabaseService';
import { TestDataGenerator } from '../helpers/generators';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/mocks';

describe('Authentication API Integration Tests', () => {
  let dbService: DatabaseService;
  let registeredUser: any;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    dbService = new DatabaseService();
    await dbService.connect();
  });

  afterAll(async () => {
    await dbService.disconnect();
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    TestDataGenerator.reset();
    // Clear test data
    await dbService.query('DELETE FROM auth_attempts');
    await dbService.query('DELETE FROM biometric_data');
    await dbService.query('DELETE FROM users');
  });

  describe('POST /api/register', () => {
    it('should register a new user with biometric data', async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();

      const response = await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            username: registrationData.username,
            email: registrationData.email,
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          },
          token: expect.any(String)
        }
      });

      // Verify user was created in database
      const user = await dbService.getUserByUsername(registrationData.username);
      expect(user).toBeDefined();
      expect(user?.email).toBe(registrationData.email);

      // Verify biometric data was saved
      const biometricData = await dbService.getBiometricDataByUserId(user!.id);
      expect(biometricData).toHaveLength(3); // signature, shape, drawing
    });

    it('should reject duplicate username', async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();

      // First registration
      await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists')
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        username: 'testuser',
        // Missing email and biometric data
      };

      const response = await request(app)
        .post('/api/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('validation')
      });
    });

    it('should validate biometric data format', async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();
      registrationData.signatureData = TestDataGenerator.generateInvalidBiometricData();

      const response = await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid biometric data')
      });
    });

    it('should handle very large biometric data', async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();
      registrationData.signatureData.strokes = Array(100).fill(null).map(() =>
        TestDataGenerator.generateStrokeData(1000)
      );

      const response = await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/authenticate', () => {
    beforeEach(async () => {
      // Register a user for authentication tests
      const registrationData = TestDataGenerator.generateRegistrationData();
      const response = await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(201);

      registeredUser = {
        ...response.body.data.user,
        registrationData
      };
      authToken = response.body.data.token;
    });

    it('should authenticate with valid signature', async () => {
      const authData = TestDataGenerator.generateAuthenticationData({
        username: registeredUser.username,
        // Use similar biometric data for high similarity
        biometricData: {
          ...registeredUser.registrationData.signatureData,
          id: TestDataGenerator.generateUniqueId()
        }
      });

      const response = await request(app)
        .post('/api/authenticate')
        .send(authData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          authenticated: true,
          similarityScore: expect.any(Number),
          token: expect.any(String)
        }
      });

      expect(response.body.data.similarityScore).toBeGreaterThan(0.8);
    });

    it('should reject authentication with low similarity', async () => {
      const authData = TestDataGenerator.generateAuthenticationData({
        username: registeredUser.username,
        // Use very different biometric data
        biometricData: TestDataGenerator.generateBiometricData({
          features: TestDataGenerator.generateBiometricFeatures({
            strokeCount: 20,
            totalDuration: 10000,
            avgPressure: 0.1
          })
        })
      });

      const response = await request(app)
        .post('/api/authenticate')
        .send(authData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          authenticated: false,
          similarityScore: expect.any(Number)
        }
      });

      expect(response.body.data.similarityScore).toBeLessThan(0.7);
    });

    it('should handle non-existent user', async () => {
      const authData = TestDataGenerator.generateAuthenticationData({
        username: 'nonexistentuser'
      });

      const response = await request(app)
        .post('/api/authenticate')
        .send(authData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('User not found')
      });
    });

    it('should track authentication attempts', async () => {
      const authData = TestDataGenerator.generateAuthenticationData({
        username: registeredUser.username,
        biometricData: registeredUser.registrationData.signatureData
      });

      // Multiple attempts
      await request(app).post('/api/authenticate').send(authData);
      await request(app).post('/api/authenticate').send(authData);
      await request(app).post('/api/authenticate').send(authData);

      const attempts = await dbService.getAuthAttempts(registeredUser.id);
      expect(attempts.length).toBeGreaterThanOrEqual(3);
    });

    it('should support different authentication types', async () => {
      // Test shape authentication
      const shapeAuthData = TestDataGenerator.generateAuthenticationData({
        username: registeredUser.username,
        type: 'shape',
        biometricData: {
          ...registeredUser.registrationData.shapeData,
          id: TestDataGenerator.generateUniqueId()
        }
      });

      const shapeResponse = await request(app)
        .post('/api/authenticate')
        .send(shapeAuthData)
        .expect(200);

      expect(shapeResponse.body.data.authenticated).toBe(true);

      // Test drawing authentication
      const drawingAuthData = TestDataGenerator.generateAuthenticationData({
        username: registeredUser.username,
        type: 'drawing',
        biometricData: {
          ...registeredUser.registrationData.drawingData,
          id: TestDataGenerator.generateUniqueId()
        }
      });

      const drawingResponse = await request(app)
        .post('/api/authenticate')
        .send(drawingAuthData)
        .expect(200);

      expect(drawingResponse.body.data.authenticated).toBe(true);
    });
  });

  describe('GET /api/users/:id', () => {
    beforeEach(async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();
      const response = await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(201);

      registeredUser = response.body.data.user;
      authToken = response.body.data.token;
    });

    it('should get user data with valid token', async () => {
      const response = await request(app)
        .get(`/api/users/${registeredUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: registeredUser.id,
          username: registeredUser.username,
          email: registeredUser.email
        }
      });
    });

    it('should reject request without token', async () => {
      await request(app)
        .get(`/api/users/${registeredUser.id}`)
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app)
        .get(`/api/users/${registeredUser.id}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should not allow access to other users data', async () => {
      // Create another user
      const otherUserData = TestDataGenerator.generateRegistrationData();
      const otherUserResponse = await request(app)
        .post('/api/register')
        .send(otherUserData)
        .expect(201);

      const otherUserId = otherUserResponse.body.data.user.id;

      // Try to access with first user's token
      await request(app)
        .get(`/api/users/${otherUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('GET /api/users/:id/biometric-data', () => {
    beforeEach(async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();
      const response = await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(201);

      registeredUser = response.body.data.user;
      authToken = response.body.data.token;
    });

    it('should get user biometric data', async () => {
      const response = await request(app)
        .get(`/api/users/${registeredUser.id}/biometric-data`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            type: 'signature',
            data: expect.any(Object)
          }),
          expect.objectContaining({
            type: 'shape',
            data: expect.any(Object)
          }),
          expect.objectContaining({
            type: 'drawing',
            data: expect.any(Object)
          })
        ])
      });
    });

    it('should filter by biometric type', async () => {
      const response = await request(app)
        .get(`/api/users/${registeredUser.id}/biometric-data?type=signature`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('signature');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent registrations', async () => {
      const registrations = Array(10).fill(null).map(() =>
        TestDataGenerator.generateRegistrationData()
      );

      const promises = registrations.map(data =>
        request(app)
          .post('/api/register')
          .send(data)
      );

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.status === 201).length;

      expect(successCount).toBe(10);
    }, 10000);

    it('should respond quickly to authentication requests', async () => {
      const registrationData = TestDataGenerator.generateRegistrationData();
      await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(201);

      const authData = TestDataGenerator.generateAuthenticationData({
        username: registrationData.username,
        biometricData: registrationData.signatureData
      });

      const startTime = Date.now();
      await request(app)
        .post('/api/authenticate')
        .send(authData)
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should respond within 500ms
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Temporarily disconnect database
      await dbService.disconnect();

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Database')
      });

      // Reconnect for other tests
      await dbService.connect();
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });

    it('should handle very large requests', async () => {
      const largeData = TestDataGenerator.generateRegistrationData();
      largeData.signatureData.strokes = Array(1000).fill(null).map(() =>
        TestDataGenerator.generateStrokeData(1000)
      );

      const response = await request(app)
        .post('/api/register')
        .send(largeData)
        .expect(413); // Payload too large

      expect(response.body.success).toBe(false);
    });
  });
});