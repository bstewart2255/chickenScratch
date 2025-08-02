import autocannon from 'autocannon';
import { app } from '../../backend/server';
import { DatabaseService } from '../../backend/services/DatabaseService';
import { TestDataGenerator } from '../helpers/generators';
import { Server } from 'http';

interface LoadTestResult {
  endpoint: string;
  duration: number;
  connections: number;
  pipelining: number;
  requests: {
    total: number;
    average: number;
    sent: number;
  };
  latency: {
    average: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
  };
  throughput: {
    average: number;
    total: number;
  };
  errors: number;
  timeouts: number;
}

class ApiBenchmark {
  private server: Server;
  private dbService: DatabaseService;
  private port: number = 3001;
  private baseUrl: string = `http://localhost:${this.port}`;
  private testUser: any;
  private authToken: string;

  async setup(): Promise<void> {
    // Set up database
    this.dbService = new DatabaseService();
    await this.dbService.connect();

    // Clear test data
    await this.dbService.query('DELETE FROM auth_attempts');
    await this.dbService.query('DELETE FROM biometric_data');
    await this.dbService.query('DELETE FROM users');

    // Start server
    this.server = app.listen(this.port);

    // Create test user for authenticated endpoints
    const registrationData = TestDataGenerator.generateRegistrationData();
    const response = await fetch(`${this.baseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });

    const result = await response.json();
    this.testUser = result.data.user;
    this.authToken = result.data.token;

    console.log('Test environment setup complete');
  }

  async teardown(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    await this.dbService.disconnect();
    console.log('Test environment cleaned up');
  }

  private async runLoadTest(
    options: autocannon.Options
  ): Promise<LoadTestResult> {
    return new Promise((resolve, reject) => {
      const instance = autocannon(options, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          endpoint: options.url,
          duration: options.duration || 10,
          connections: options.connections || 10,
          pipelining: options.pipelining || 1,
          requests: {
            total: result.requests.total,
            average: result.requests.average,
            sent: result.requests.sent
          },
          latency: {
            average: result.latency.average,
            p50: result.latency.p50 || 0,
            p90: result.latency.p90 || 0,
            p95: result.latency.p95 || 0,
            p99: result.latency.p99 || 0,
            max: result.latency.max
          },
          throughput: {
            average: result.throughput.average,
            total: result.throughput.total
          },
          errors: result.errors,
          timeouts: result.timeouts
        });
      });

      process.once('SIGINT', () => {
        instance.stop();
      });
    });
  }

  async benchmarkHealthEndpoint(): Promise<void> {
    console.log('\n=== Health Endpoint Benchmark ===\n');

    const result = await this.runLoadTest({
      url: `${this.baseUrl}/api/health`,
      connections: 100,
      pipelining: 10,
      duration: 30
    });

    this.printResult(result);
  }

  async benchmarkRegistration(): Promise<void> {
    console.log('\n=== Registration Endpoint Benchmark ===\n');

    let counter = 0;
    const result = await this.runLoadTest({
      url: `${this.baseUrl}/api/register`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TestDataGenerator.generateRegistrationData()),
      connections: 10,
      duration: 30,
      setupClient: (client) => {
        client.on('body', () => {
          // Generate unique data for each request
          const data = TestDataGenerator.generateRegistrationData();
          data.username = `loadtest${counter++}`;
          data.email = `loadtest${counter}@example.com`;
          client.setBody(JSON.stringify(data));
        });
      }
    });

    this.printResult(result);
  }

  async benchmarkAuthentication(): Promise<void> {
    console.log('\n=== Authentication Endpoint Benchmark ===\n');

    // Create test data
    const authData = TestDataGenerator.generateAuthenticationData({
      username: this.testUser.username
    });

    const result = await this.runLoadTest({
      url: `${this.baseUrl}/api/authenticate`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authData),
      connections: 50,
      pipelining: 5,
      duration: 30
    });

    this.printResult(result);
  }

  async benchmarkGetUserData(): Promise<void> {
    console.log('\n=== Get User Data Endpoint Benchmark ===\n');

    const result = await this.runLoadTest({
      url: `${this.baseUrl}/api/users/${this.testUser.id}`,
      headers: { 
        'Authorization': `Bearer ${this.authToken}`
      },
      connections: 100,
      pipelining: 10,
      duration: 30
    });

    this.printResult(result);
  }

  async benchmarkConcurrentMixedLoad(): Promise<void> {
    console.log('\n=== Mixed Load Benchmark (Simulating Real Usage) ===\n');

    // 70% health checks, 20% auth, 10% registration
    const endpoints = [
      { weight: 70, options: { url: `${this.baseUrl}/api/health` } },
      { 
        weight: 20, 
        options: {
          url: `${this.baseUrl}/api/authenticate`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(TestDataGenerator.generateAuthenticationData({
            username: this.testUser.username
          }))
        }
      },
      {
        weight: 10,
        options: {
          url: `${this.baseUrl}/api/register`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(TestDataGenerator.generateRegistrationData())
        }
      }
    ];

    console.log('Running mixed load test with weighted distribution...');
    console.log('- 70% Health checks');
    console.log('- 20% Authentication attempts');
    console.log('- 10% New registrations\n');

    // Run separate tests and aggregate results
    const results = await Promise.all(endpoints.map(endpoint => 
      this.runLoadTest({
        ...endpoint.options,
        connections: Math.floor(100 * endpoint.weight / 100),
        duration: 30
      })
    ));

    results.forEach((result, index) => {
      console.log(`\n${endpoints[index].options.url} (${endpoints[index].weight}% of load):`);
      this.printSummary(result);
    });
  }

  async benchmarkStressTest(): Promise<void> {
    console.log('\n=== Stress Test (Finding Breaking Point) ===\n');

    const connectionCounts = [10, 50, 100, 200, 500];
    
    for (const connections of connectionCounts) {
      console.log(`\nTesting with ${connections} concurrent connections:`);
      
      try {
        const result = await this.runLoadTest({
          url: `${this.baseUrl}/api/health`,
          connections,
          pipelining: 1,
          duration: 10
        });

        console.log(`- Avg latency: ${result.latency.average}ms`);
        console.log(`- P99 latency: ${result.latency.p99}ms`);
        console.log(`- Errors: ${result.errors}`);
        console.log(`- Timeouts: ${result.timeouts}`);
        console.log(`- Req/sec: ${result.requests.average}`);

        if (result.errors > result.requests.total * 0.01) {
          console.log(`\n⚠️  Error rate exceeded 1% at ${connections} connections`);
          break;
        }

        if (result.latency.p99 > 1000) {
          console.log(`\n⚠️  P99 latency exceeded 1000ms at ${connections} connections`);
          break;
        }
      } catch (error) {
        console.log(`\n❌ Test failed at ${connections} connections:`, error.message);
        break;
      }
    }
  }

  async benchmarkLargePayloads(): Promise<void> {
    console.log('\n=== Large Payload Benchmark ===\n');

    // Generate increasingly large biometric data
    const payloadSizes = [
      { name: 'Small', strokes: 5, points: 50 },
      { name: 'Medium', strokes: 20, points: 100 },
      { name: 'Large', strokes: 50, points: 200 },
      { name: 'Extra Large', strokes: 100, points: 500 }
    ];

    for (const size of payloadSizes) {
      const authData = TestDataGenerator.generateAuthenticationData({
        username: this.testUser.username,
        biometricData: TestDataGenerator.generateBiometricData({
          strokes: Array(size.strokes).fill(null).map(() =>
            TestDataGenerator.generateStrokeData(size.points)
          )
        })
      });

      const payloadSizeKB = (JSON.stringify(authData).length / 1024).toFixed(2);
      console.log(`\n${size.name} payload (${payloadSizeKB}KB):`);

      const result = await this.runLoadTest({
        url: `${this.baseUrl}/api/authenticate`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData),
        connections: 10,
        duration: 10
      });

      this.printSummary(result);
    }
  }

  private printResult(result: LoadTestResult): void {
    console.log(`Endpoint: ${result.endpoint}`);
    console.log(`Duration: ${result.duration}s`);
    console.log(`Connections: ${result.connections}`);
    console.log(`Pipelining: ${result.pipelining}`);
    console.log('\nRequests:');
    console.log(`  Total: ${result.requests.total}`);
    console.log(`  Average: ${result.requests.average} req/sec`);
    console.log('\nLatency:');
    console.log(`  Average: ${result.latency.average}ms`);
    console.log(`  P50: ${result.latency.p50}ms`);
    console.log(`  P90: ${result.latency.p90}ms`);
    console.log(`  P95: ${result.latency.p95}ms`);
    console.log(`  P99: ${result.latency.p99}ms`);
    console.log(`  Max: ${result.latency.max}ms`);
    console.log('\nThroughput:');
    console.log(`  Average: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/sec`);
    console.log(`  Total: ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`);
    console.log('\nErrors: ' + result.errors);
    console.log('Timeouts: ' + result.timeouts);
  }

  private printSummary(result: LoadTestResult): void {
    console.log(`  Requests/sec: ${result.requests.average}`);
    console.log(`  Avg latency: ${result.latency.average}ms`);
    console.log(`  P99 latency: ${result.latency.p99}ms`);
    console.log(`  Errors: ${result.errors} (${((result.errors / result.requests.total) * 100).toFixed(2)}%)`);
  }
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  (async () => {
    const benchmark = new ApiBenchmark();
    
    try {
      console.log('Starting API Performance Benchmarks...\n');
      
      await benchmark.setup();
      
      // Run all benchmarks
      await benchmark.benchmarkHealthEndpoint();
      await benchmark.benchmarkRegistration();
      await benchmark.benchmarkAuthentication();
      await benchmark.benchmarkGetUserData();
      await benchmark.benchmarkConcurrentMixedLoad();
      await benchmark.benchmarkLargePayloads();
      await benchmark.benchmarkStressTest();
      
      console.log('\n✅ All benchmarks completed!');
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
    } finally {
      await benchmark.teardown();
    }
  })();
}

export { ApiBenchmark };