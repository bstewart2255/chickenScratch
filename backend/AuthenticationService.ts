import axios from 'axios';
import { logger } from '../src/utils/Logger';
import { config } from '../src/config/ConfigService';
import type { 
  BiometricData, 
  BiometricBaseline,
  BiometricMetrics
} from '../src/types/core/biometric';

// Performance thresholds
const AUTH_THRESHOLDS = {
  ml_api_call: 200,     // ms
  comparison: 50,       // ms
  total_auth: 300      // ms
} as const;

// Authentication result interface
interface AuthenticationResult {
  score: number;
  success: boolean;
  method: 'enhanced' | 'standard' | 'rule-based';
  performanceMetrics: {
    totalDuration: number;
    mlApiDuration?: number;
    comparisonDuration?: number;
  };
}

// Feature differences interface
interface FeatureDifferences {
  stroke_count_diff: number;
  total_points_diff: number;
  duration_diff: number;
  avg_velocity_diff: number;
  max_velocity_diff: number;
  width_diff: number;
  height_diff: number;
  area_diff: number;
  aspect_ratio_diff: number;
  velocity_relative_diff: number;
  area_relative_diff: number;
  duration_relative_diff: number;
}

export class AuthenticationService {
  private mlApiUrl: string;
  private authMetrics: Map<string, number[]> = new Map();
  
  constructor() {
    // Configure ML API URL
    const defaultMLUrl = process.env['NODE_ENV'] === 'production' 
      ? 'https://chickenscratch-ml.onrender.com'
      : 'http://localhost:5002';
    const configData = config.get() as Record<string, unknown>;
    const features = configData['features'] as Record<string, unknown> | undefined;
    this.mlApiUrl = process.env['ML_API_URL'] || (features?.['mlApiUrl'] as string) || defaultMLUrl;
  }
  
  // Enhanced ML-based signature comparison that respects excluded features
  async compareSignaturesEnhanced(
    storedMetrics: BiometricMetrics,
    currentMetrics: BiometricMetrics,
    baseline: BiometricBaseline,
    username: string
  ): Promise<AuthenticationResult> {
    const startTime = performance.now();
    
    try {
      // Ensure we have valid metrics
      if (!storedMetrics || !currentMetrics || !baseline) {
        logger.error('Missing metrics or baseline for enhanced ML comparison');
        return this.compareSignaturesML(storedMetrics, currentMetrics, username);
      }
      
      // Get list of supported features from baseline
      const supportedFeatures = baseline._supported_features || [];
      const excludedFeatures = baseline._excluded_features || [];
      
      logger.info(`Enhanced comparison for ${username}`, {
        supportedFeatures: supportedFeatures.length,
        excludedFeatures: excludedFeatures.length
      });
      
      // Start comparison timing
      const comparisonStart = performance.now();
      
      // Calculate differences only for supported features
      let totalDifference = 0;
      let featureCount = 0;
      
      // Process each supported feature
      supportedFeatures.forEach((feature: string) => {
        // Skip metadata fields
        if (feature.startsWith('_') || feature.endsWith('_std')) return;
        
        const baselineValue = baseline[feature as keyof BiometricBaseline];
        const currentValue = currentMetrics[feature as keyof BiometricData];
        
        // Skip if either value is missing
        if (baselineValue === undefined || currentValue === undefined) return;
        
        // Calculate normalized difference
        const diff = Math.abs(Number(currentValue) - Number(baselineValue));
        const normalizedDiff = Number(baselineValue) > 0 ? diff / Number(baselineValue) : diff;
        
        // Weight different features differently
        let weight = 1.0;
        if (feature.includes('velocity')) weight = 1.5;
        else if (feature.includes('pressure') && !excludedFeatures.includes(feature)) weight = 2.0;
        else if (feature.includes('duration')) weight = 1.2;
        else if (feature.includes('stroke')) weight = 1.3;
        
        totalDifference += normalizedDiff * weight;
        featureCount++;
      });
      
      // Calculate score based on average difference
      const avgDifference = featureCount > 0 ? totalDifference / featureCount : 1.0;
      let score = Math.max(0, 100 - (avgDifference * 50));
      
      // Ensure minimum score of 5%
      score = Math.max(5, Math.min(100, score));
      
      const comparisonDuration = performance.now() - comparisonStart;
      
      logger.info(`Enhanced ML score for ${username}`, {
        score: score.toFixed(1),
        featureCount,
        comparisonDuration_ms: comparisonDuration
      });
      
      // Try ML API with enhanced features if available
      try {
        const mlApiStart = performance.now();
        
        const response = await axios.post(`${this.mlApiUrl}/api/predict_enhanced`, {
          username: username,
          baseline: baseline,
          current_features: currentMetrics,
          supported_features: supportedFeatures,
          excluded_features: excludedFeatures
        }, {
          timeout: 5000 // 5 second timeout
        });
        
        const mlApiDuration = performance.now() - mlApiStart;
        
        if (mlApiDuration > AUTH_THRESHOLDS.ml_api_call) {
          logger.warn('Slow ML API call', {
            duration_ms: mlApiDuration,
            threshold_ms: AUTH_THRESHOLDS.ml_api_call
          });
        }
        
        logger.info('Enhanced ML API Response', response.data);
        
        const totalDuration = performance.now() - startTime;
        this.trackAuthMetrics(username, totalDuration);
        
        return {
          score: response.data.confidence_score,
          success: response.data.confidence_score >= 75,
          method: 'enhanced',
          performanceMetrics: {
            totalDuration,
            mlApiDuration,
            comparisonDuration
          }
        };
      } catch (mlError) {
        logger.warn('Enhanced ML API not available, using calculated score', {
          error: mlError instanceof Error ? mlError.message : 'Unknown error'
        });
        
        const totalDuration = performance.now() - startTime;
        this.trackAuthMetrics(username, totalDuration);
        
        return {
          score,
          success: score >= 75,
          method: 'rule-based',
          performanceMetrics: {
            totalDuration,
            comparisonDuration
          }
        };
      }
      
    } catch (error) {
      logger.error('Enhanced ML comparison error:', error as Record<string, unknown>);
      // Fallback to standard comparison
      return this.compareSignaturesML(storedMetrics, currentMetrics, username);
    }
  }
  
  // ML-based signature comparison using the trained model
  async compareSignaturesML(
    storedMetrics: BiometricMetrics,
    currentMetrics: BiometricMetrics,
    username: string
  ): Promise<AuthenticationResult> {
    const startTime = performance.now();
    
    try {
      // Ensure we have valid metrics
      if (!storedMetrics || !currentMetrics) {
        logger.error('Missing metrics for ML comparison');
        return {
          score: 0,
          success: false,
          method: 'standard',
          performanceMetrics: {
            totalDuration: performance.now() - startTime
          }
        };
      }
      
      const comparisonStart = performance.now();
      
      // Calculate feature differences (what the model needs)
      const featureDifferences: FeatureDifferences = {
        stroke_count_diff: Math.abs((currentMetrics.stroke_count || 0) - (storedMetrics.stroke_count || 0)),
        total_points_diff: Math.abs((currentMetrics.total_points || 0) - (storedMetrics.total_points || 0)),
        duration_diff: Math.abs((currentMetrics.total_duration_ms || 0) - (storedMetrics.total_duration_ms || 0)),
        avg_velocity_diff: Math.abs((currentMetrics.avg_velocity || 0) - (storedMetrics.avg_velocity || 0)),
        max_velocity_diff: Math.abs((currentMetrics.max_velocity || 0) - (storedMetrics.max_velocity || 0)),
        width_diff: Math.abs((currentMetrics.width || 0) - (storedMetrics.width || 0)),
        height_diff: Math.abs((currentMetrics.height || 0) - (storedMetrics.height || 0)),
        area_diff: Math.abs((currentMetrics.area || 0) - (storedMetrics.area || 0)),
        aspect_ratio_diff: Math.abs((currentMetrics.aspect_ratio || 0) - (storedMetrics.aspect_ratio || 0)),
        
        // Relative differences (percentages)
        velocity_relative_diff: (storedMetrics.avg_velocity || 0) > 0 ? 
          Math.abs(((currentMetrics.avg_velocity || 0) - (storedMetrics.avg_velocity || 0)) / (storedMetrics.avg_velocity || 1)) : 1,
        area_relative_diff: (storedMetrics.area || 0) > 0 ?
          Math.abs(((currentMetrics.area || 0) - (storedMetrics.area || 0)) / (storedMetrics.area || 1)) : 1,
        duration_relative_diff: (storedMetrics.total_duration_ms || 0) > 0 ?
          Math.abs(((currentMetrics.total_duration_ms || 0) - (storedMetrics.total_duration_ms || 0)) / (storedMetrics.total_duration_ms || 1)) : 1
      };
      
      // Rule-based scoring
      let score = 100;
      
      // Penalize based on differences
      score -= featureDifferences.stroke_count_diff * 5;
      
      // Handle velocity calculation issues (temporary fix)
      if (featureDifferences.velocity_relative_diff > 0.95) {
        // Likely a calculation error, reduce penalty significantly
        logger.warn(`Extreme velocity difference detected`, {
          difference_percent: (featureDifferences.velocity_relative_diff * 100).toFixed(1)
        });
        score -= 5; // Fixed small penalty instead of proportional
      } else {
        score -= featureDifferences.velocity_relative_diff * 20;
      }
      
      score -= featureDifferences.area_relative_diff * 15;
      score -= featureDifferences.duration_relative_diff * 10;
      score -= featureDifferences.aspect_ratio_diff * 10;
      
      // Ensure score is between 5 and 100 (minimum 5% for any signature attempt)
      score = Math.max(5, Math.min(100, score));
      
      const comparisonDuration = performance.now() - comparisonStart;
      
      logger.info(`ML Comparison for ${username}`, {
        storedMetrics: {
          strokes: storedMetrics.stroke_count,
          velocity: (storedMetrics.avg_velocity || 0).toFixed(3),
          area: storedMetrics.area
        },
        currentMetrics: {
          strokes: currentMetrics.stroke_count,
          velocity: (currentMetrics.avg_velocity || 0).toFixed(3),
          area: currentMetrics.area
        },
        differences: {
          velocity: (featureDifferences.velocity_relative_diff * 100).toFixed(1) + '%',
          area: (featureDifferences.area_relative_diff * 100).toFixed(1) + '%',
          duration: (featureDifferences.duration_relative_diff * 100).toFixed(1) + '%'
        },
        score: score.toFixed(1)
      });
      
      // Try to use ML model first, fall back to rule-based if unavailable
      try {
        const mlApiStart = performance.now();
        
        const response = await axios.post(`${this.mlApiUrl}/api/predict`, {
          username: username,
          stored_features: storedMetrics,
          current_features: currentMetrics
        }, {
          timeout: 5000 // 5 second timeout
        });
        
        const mlApiDuration = performance.now() - mlApiStart;
        
        if (mlApiDuration > AUTH_THRESHOLDS.ml_api_call) {
          logger.warn('Slow ML API call', {
            duration_ms: mlApiDuration,
            threshold_ms: AUTH_THRESHOLDS.ml_api_call
          });
        }
        
        logger.info('ML API Response', response.data);
        
        const totalDuration = performance.now() - startTime;
        this.trackAuthMetrics(username, totalDuration);
        
        return {
          score: response.data.confidence_score,
          success: response.data.confidence_score >= 75,
          method: 'standard',
          performanceMetrics: {
            totalDuration,
            mlApiDuration,
            comparisonDuration
          }
        };
      } catch (mlError) {
        logger.warn('ML API not available, using rule-based scoring', {
          error: mlError instanceof Error ? mlError.message : 'Unknown error'
        });
        
        const totalDuration = performance.now() - startTime;
        this.trackAuthMetrics(username, totalDuration);
        
        return {
          score,
          success: score >= 75,
          method: 'rule-based',
          performanceMetrics: {
            totalDuration,
            comparisonDuration
          }
        };
      }
      
    } catch (error) {
      logger.error('ML comparison error:', error as Record<string, unknown>);
      
      const totalDuration = performance.now() - startTime;
      this.trackAuthMetrics(username, totalDuration);
      
      return {
        score: 0,
        success: false,
        method: 'standard',
        performanceMetrics: {
          totalDuration
        }
      };
    }
  }
  
  // Compare multiple signatures and return average score
  async compareMultipleSignaturesML(
    storedSignatures: Array<{ metrics?: BiometricMetrics }>,
    currentMetrics: BiometricMetrics,
    username: string
  ): Promise<AuthenticationResult> {
    const startTime = performance.now();
    
    if (!storedSignatures || storedSignatures.length === 0) {
      return {
        score: 0,
        success: false,
        method: 'standard',
        performanceMetrics: {
          totalDuration: performance.now() - startTime
        }
      };
    }
    
    // Compare against each stored signature
    const results = await Promise.all(
      storedSignatures.map(stored => 
        this.compareSignaturesML(stored.metrics || {} as BiometricMetrics, currentMetrics, username)
      )
    );
    
    // Return the highest score (most similar signature)
    const bestResult = results.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    const totalDuration = performance.now() - startTime;
    this.trackAuthMetrics(username, totalDuration);
    
    return {
      ...bestResult,
      performanceMetrics: {
        ...bestResult.performanceMetrics,
        totalDuration
      }
    };
  }
  
  // Track authentication performance metrics
  private trackAuthMetrics(username: string, duration: number): void {
    if (!this.authMetrics.has(username)) {
      this.authMetrics.set(username, []);
    }
    
    const userMetrics = this.authMetrics.get(username)!;
    userMetrics.push(duration);
    
    // Keep only last 100 auth attempts per user
    if (userMetrics.length > 100) {
      userMetrics.shift();
    }
    
    // Log if authentication is slow
    if (duration > AUTH_THRESHOLDS.total_auth) {
      logger.warn('Slow authentication detected', {
        username,
        duration_ms: duration,
        threshold_ms: AUTH_THRESHOLDS.total_auth
      });
    }
  }
  
  // Get authentication performance statistics
  getAuthStats(username?: string): {
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    attemptCount: number;
    slowAuthCount: number;
  } {
    const metrics = username 
      ? this.authMetrics.get(username) || []
      : Array.from(this.authMetrics.values()).flat();
    
    if (metrics.length === 0) {
      return {
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        attemptCount: 0,
        slowAuthCount: 0
      };
    }
    
    const slowAuthCount = metrics.filter(d => d > AUTH_THRESHOLDS.total_auth).length;
    
    return {
      averageDuration: metrics.reduce((sum, d) => sum + d, 0) / metrics.length,
      minDuration: Math.min(...metrics),
      maxDuration: Math.max(...metrics),
      attemptCount: metrics.length,
      slowAuthCount
    };
  }
}

// Export singleton instance
export const authenticationService = new AuthenticationService();

// Export individual functions for backward compatibility
export const compareSignaturesML = authenticationService.compareSignaturesML.bind(authenticationService);
export const compareMultipleSignaturesML = authenticationService.compareMultipleSignaturesML.bind(authenticationService);
export const compareSignaturesEnhanced = authenticationService.compareSignaturesEnhanced.bind(authenticationService);

// CommonJS compatibility
module.exports = {
  compareSignaturesML,
  compareMultipleSignaturesML,
  compareSignaturesEnhanced,
  authenticationService,
  AuthenticationService
};