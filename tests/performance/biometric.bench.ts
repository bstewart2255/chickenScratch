import { BiometricEngine } from '../../backend/services/BiometricEngine';
import { TestDataGenerator } from '../helpers/generators';
import { BiometricData } from '../../src/types';

interface BenchmarkResult {
  name: string;
  operations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
}

class BiometricBenchmark {
  private engine: BiometricEngine;

  constructor() {
    this.engine = new BiometricEngine();
  }

  private async runBenchmark(
    name: string,
    fn: () => void | Promise<void>,
    iterations: number = 1000
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    
    // Warmup
    for (let i = 0; i < 10; i++) {
      await fn();
    }

    // Actual benchmark
    const startTotal = Date.now();
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    const totalTime = Date.now() - startTotal;

    return {
      name,
      operations: iterations,
      totalTime,
      avgTime: times.reduce((a, b) => a + b, 0) / iterations,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      opsPerSecond: (iterations / totalTime) * 1000
    };
  }

  async benchmarkFeatureExtraction(): Promise<void> {
    console.log('\n=== Feature Extraction Benchmarks ===\n');

    // Small dataset (typical single signature)
    const smallData = TestDataGenerator.generateBiometricData({
      strokes: Array(3).fill(null).map(() => 
        TestDataGenerator.generateStrokeData(50)
      )
    });

    const smallResult = await this.runBenchmark(
      'Feature extraction - small (3 strokes, 50 points each)',
      () => this.engine.extractFeatures(smallData),
      1000
    );
    this.printResult(smallResult);

    // Medium dataset (complex signature)
    const mediumData = TestDataGenerator.generateBiometricData({
      strokes: Array(10).fill(null).map(() => 
        TestDataGenerator.generateStrokeData(100)
      )
    });

    const mediumResult = await this.runBenchmark(
      'Feature extraction - medium (10 strokes, 100 points each)',
      () => this.engine.extractFeatures(mediumData),
      500
    );
    this.printResult(mediumResult);

    // Large dataset (very complex drawing)
    const largeData = TestDataGenerator.generateBiometricData({
      strokes: Array(50).fill(null).map(() => 
        TestDataGenerator.generateStrokeData(200)
      )
    });

    const largeResult = await this.runBenchmark(
      'Feature extraction - large (50 strokes, 200 points each)',
      () => this.engine.extractFeatures(largeData),
      100
    );
    this.printResult(largeResult);

    // Edge case - single point strokes
    const edgeCaseData = TestDataGenerator.generateBiometricData({
      strokes: Array(100).fill(null).map(() => ({
        points: [TestDataGenerator.generatePoint()],
        startTime: Date.now(),
        endTime: Date.now(),
        strokeType: 'signature' as const
      }))
    });

    const edgeResult = await this.runBenchmark(
      'Feature extraction - edge case (100 single-point strokes)',
      () => this.engine.extractFeatures(edgeCaseData),
      500
    );
    this.printResult(edgeResult);
  }

  async benchmarkFeatureComparison(): Promise<void> {
    console.log('\n=== Feature Comparison Benchmarks ===\n');

    const features1 = TestDataGenerator.generateBiometricFeatures();
    const features2 = TestDataGenerator.generateBiometricFeatures();

    // Basic comparison
    const basicResult = await this.runBenchmark(
      'Feature comparison - standard features',
      () => this.engine.compareFeatures(features1, features2),
      10000
    );
    this.printResult(basicResult);

    // Comparison with empty arrays
    const emptyFeatures1 = TestDataGenerator.generateBiometricFeatures({
      strokeLengths: [],
      pauseDurations: [],
      accelerationPatterns: []
    });
    const emptyFeatures2 = TestDataGenerator.generateBiometricFeatures({
      strokeLengths: [],
      pauseDurations: [],
      accelerationPatterns: []
    });

    const emptyResult = await this.runBenchmark(
      'Feature comparison - empty arrays',
      () => this.engine.compareFeatures(emptyFeatures1, emptyFeatures2),
      10000
    );
    this.printResult(emptyResult);

    // Comparison with large arrays
    const largeFeatures1 = TestDataGenerator.generateBiometricFeatures({
      strokeLengths: Array(1000).fill(100),
      pauseDurations: Array(1000).fill(50),
      accelerationPatterns: Array(1000).fill(0.1)
    });
    const largeFeatures2 = TestDataGenerator.generateBiometricFeatures({
      strokeLengths: Array(1000).fill(110),
      pauseDurations: Array(1000).fill(60),
      accelerationPatterns: Array(1000).fill(0.15)
    });

    const largeResult = await this.runBenchmark(
      'Feature comparison - large arrays (1000 elements each)',
      () => this.engine.compareFeatures(largeFeatures1, largeFeatures2),
      1000
    );
    this.printResult(largeResult);
  }

  async benchmarkValidation(): Promise<void> {
    console.log('\n=== Validation Benchmarks ===\n');

    const validData = TestDataGenerator.generateBiometricData();
    const invalidData = TestDataGenerator.generateInvalidBiometricData();

    // Valid data validation
    const validResult = await this.runBenchmark(
      'Validation - valid biometric data',
      () => this.engine.validateBiometricData(validData),
      10000
    );
    this.printResult(validResult);

    // Invalid data validation
    const invalidResult = await this.runBenchmark(
      'Validation - invalid biometric data',
      () => this.engine.validateBiometricData(invalidData),
      10000
    );
    this.printResult(invalidResult);

    // Complex valid data
    const complexData = TestDataGenerator.generateBiometricData({
      strokes: Array(20).fill(null).map(() => 
        TestDataGenerator.generateStrokeData(150)
      )
    });

    const complexResult = await this.runBenchmark(
      'Validation - complex valid data (20 strokes, 150 points each)',
      () => this.engine.validateBiometricData(complexData),
      1000
    );
    this.printResult(complexResult);
  }

  async benchmarkEndToEnd(): Promise<void> {
    console.log('\n=== End-to-End Authentication Benchmarks ===\n');

    // Generate reference data
    const referenceData = Array(5).fill(null).map(() => 
      TestDataGenerator.generateBiometricData()
    );
    
    const referenceFeatures = referenceData.map(data => 
      this.engine.extractFeatures(data)
    );

    // Test authentication data
    const testData = TestDataGenerator.generateBiometricData();

    const authResult = await this.runBenchmark(
      'End-to-end authentication (validation + extraction + 5 comparisons)',
      () => {
        // Validate
        if (!this.engine.validateBiometricData(testData)) {
          throw new Error('Invalid data');
        }
        
        // Extract features
        const testFeatures = this.engine.extractFeatures(testData);
        
        // Compare with all reference features
        const scores = referenceFeatures.map(ref => 
          this.engine.compareFeatures(testFeatures, ref)
        );
        
        // Get best match
        return Math.max(...scores);
      },
      500
    );
    this.printResult(authResult);
  }

  async benchmarkMemoryUsage(): Promise<void> {
    console.log('\n=== Memory Usage Benchmarks ===\n');

    const initialMemory = process.memoryUsage();

    // Create large dataset
    const largeDataset: BiometricData[] = [];
    for (let i = 0; i < 1000; i++) {
      largeDataset.push(TestDataGenerator.generateBiometricData({
        strokes: Array(10).fill(null).map(() => 
          TestDataGenerator.generateStrokeData(100)
        )
      }));
    }

    const afterCreationMemory = process.memoryUsage();

    // Extract features from all
    const features = largeDataset.map(data => 
      this.engine.extractFeatures(data)
    );

    const afterExtractionMemory = process.memoryUsage();

    console.log('Memory usage for 1000 biometric samples:');
    console.log(`- Dataset creation: ${this.formatBytes(afterCreationMemory.heapUsed - initialMemory.heapUsed)}`);
    console.log(`- Feature extraction: ${this.formatBytes(afterExtractionMemory.heapUsed - afterCreationMemory.heapUsed)}`);
    console.log(`- Total: ${this.formatBytes(afterExtractionMemory.heapUsed - initialMemory.heapUsed)}`);
    console.log(`- Average per sample: ${this.formatBytes((afterExtractionMemory.heapUsed - initialMemory.heapUsed) / 1000)}`);
  }

  private printResult(result: BenchmarkResult): void {
    console.log(`${result.name}:`);
    console.log(`  Operations: ${result.operations}`);
    console.log(`  Total time: ${result.totalTime.toFixed(2)}ms`);
    console.log(`  Average: ${result.avgTime.toFixed(3)}ms`);
    console.log(`  Min: ${result.minTime.toFixed(3)}ms`);
    console.log(`  Max: ${result.maxTime.toFixed(3)}ms`);
    console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(2)}`);
    console.log('');
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  (async () => {
    const benchmark = new BiometricBenchmark();
    
    console.log('Starting Biometric Performance Benchmarks...\n');
    console.log('System:', process.platform, process.arch);
    console.log('Node.js:', process.version);
    console.log('Memory:', (require('os').totalmem() / (1024 * 1024 * 1024)).toFixed(2), 'GB');
    console.log('CPUs:', require('os').cpus().length, 'x', require('os').cpus()[0].model);
    
    await benchmark.benchmarkFeatureExtraction();
    await benchmark.benchmarkFeatureComparison();
    await benchmark.benchmarkValidation();
    await benchmark.benchmarkEndToEnd();
    await benchmark.benchmarkMemoryUsage();
    
    console.log('\nBenchmarks completed!');
  })().catch(console.error);
}

export { BiometricBenchmark };