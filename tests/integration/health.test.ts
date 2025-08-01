import request from 'supertest';
import app from '../../backend/server';
import { DatabaseService } from '../../backend/DatabaseService';

describe('Health Check API Integration Tests', () => {
  let dbService: DatabaseService;

  beforeAll(async () => {
    // DatabaseService is initialized automatically in the app
    // No need to create a new instance for tests
  });

  afterAll(async () => {
    await dbService.disconnect();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all services are running', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          uptime: expect.any(Number),
          timestamp: expect.any(String),
          version: expect.any(String),
          services: {
            database: 'connected',
            biometricEngine: 'operational'
          },
          memory: {
            used: expect.any(Number),
            total: expect.any(Number),
            percentage: expect.any(Number)
          }
        }
      });

      // Validate timestamp format
      expect(new Date(response.body.data.timestamp).getTime()).not.toBeNaN();
      
      // Validate memory usage
      expect(response.body.data.memory.percentage).toBeGreaterThan(0);
      expect(response.body.data.memory.percentage).toBeLessThanOrEqual(100);
    });

    it('should include environment information', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.data).toHaveProperty('environment');
      expect(['development', 'test', 'production']).toContain(
        response.body.data.environment
      );
    });

    it('should be accessible without authentication', async () => {
      // No auth header
      await request(app)
        .get('/api/health')
        .expect(200);

      // With invalid auth header
      await request(app)
        .get('/api/health')
        .set('Authorization', 'Bearer invalid-token')
        .expect(200);
    });

    it('should respond quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should respond within 100ms
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return detailed health information with auth', async () => {
      // First register to get auth token
      const registrationData = {
        username: 'healthadmin',
        email: 'health@example.com',
        signatureData: {
          strokes: [],
          features: {},
          type: 'signature'
        },
        shapeData: {
          strokes: [],
          features: {},
          type: 'shape'
        },
        drawingData: {
          strokes: [],
          features: {},
          type: 'drawing'
        },
        deviceCapabilities: {}
      };

      const authResponse = await request(app)
        .post('/api/register')
        .send(registrationData)
        .expect(201);

      const token = authResponse.body.data.token;

      const response = await request(app)
        .get('/api/health/detailed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('cpu');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('database');
      expect(response.body.data.database).toMatchObject({
        connected: true,
        latency: expect.any(Number),
        activeConnections: expect.any(Number)
      });
    });

    it('should reject detailed health check without auth', async () => {
      await request(app)
        .get('/api/health/detailed')
        .expect(401);
    });
  });

  describe('Database health checks', () => {
    it('should detect database connection issues', async () => {
      // Temporarily disconnect database
      await dbService.disconnect();

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        data: {
          status: 'unhealthy',
          services: {
            database: 'disconnected'
          }
        }
      });

      // Reconnect for other tests
      await dbService.connect();
    });

    it('should measure database latency', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      if (response.body.data.database?.latency) {
        expect(response.body.data.database.latency).toBeGreaterThan(0);
        expect(response.body.data.database.latency).toBeLessThan(100); // Should be under 100ms
      }
    });
  });

  describe('Custom health check headers', () => {
    it('should include custom headers in response', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-api-version');
      expect(response.headers).toHaveProperty('x-response-time');
      expect(parseFloat(response.headers['x-response-time'])).toBeGreaterThan(0);
    });
  });

  describe('Health check formats', () => {
    it('should support JSON format by default', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body).toBeInstanceOf(Object);
    });

    it('should support simple text format', async () => {
      const response = await request(app)
        .get('/api/health?format=simple')
        .expect(200);

      expect(response.text).toBe('OK');
    });
  });

  describe('Monitoring endpoints', () => {
    it('should provide metrics endpoint', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          requests: {
            total: expect.any(Number),
            successful: expect.any(Number),
            failed: expect.any(Number)
          },
          performance: {
            avgResponseTime: expect.any(Number),
            p95ResponseTime: expect.any(Number),
            p99ResponseTime: expect.any(Number)
          }
        }
      });
    });

    it('should track request counts accurately', async () => {
      // Get initial metrics
      const initialMetrics = await request(app)
        .get('/api/metrics')
        .expect(200);

      const initialTotal = initialMetrics.body.data.requests.total;

      // Make some requests
      await request(app).get('/api/health');
      await request(app).get('/api/health');
      await request(app).get('/api/health');

      // Get updated metrics
      const updatedMetrics = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(updatedMetrics.body.data.requests.total).toBeGreaterThan(initialTotal);
    });
  });

  describe('Error recovery', () => {
    it('should recover from temporary issues', async () => {
      // First check - should be healthy
      await request(app)
        .get('/api/health')
        .expect(200);

      // Simulate temporary issue by disconnecting
      await dbService.disconnect();

      // Should be unhealthy
      await request(app)
        .get('/api/health')
        .expect(503);

      // Reconnect
      await dbService.connect();

      // Should be healthy again
      await request(app)
        .get('/api/health')
        .expect(200);
    });
  });
});