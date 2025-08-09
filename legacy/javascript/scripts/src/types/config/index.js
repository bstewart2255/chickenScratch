"use strict";
/**
 * Configuration type definitions for the application
 * Ensures type safety for all configuration values
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.isCompleteConfig = void 0;
/**
 * Type guard for complete configuration
 */
function isCompleteConfig(config) {
    return (config &&
        typeof config === 'object' &&
        config.env &&
        config.server &&
        config.database &&
        config.jwt &&
        config.biometric &&
        config.security &&
        config.logging &&
        config.features);
}
exports.isCompleteConfig = isCompleteConfig;
/**
 * Configuration defaults
 */
exports.DEFAULT_CONFIG = {
    env: {
        name: 'development',
        debug: true,
        verbose: false,
        mockExternalServices: false
    },
    server: {
        port: 3000,
        host: '0.0.0.0',
        cors: {
            origin: true,
            credentials: true
        },
        bodyParser: {
            jsonLimit: '10mb',
            urlencodedLimit: '10mb'
        },
        trustProxy: false,
        compression: true
    },
    biometric: {
        signature: {
            minPoints: 10,
            maxPoints: 10000,
            minStrokes: 1,
            maxStrokes: 100,
            minDuration: 100,
            maxDuration: 60000,
            qualityThreshold: 0.7
        },
        comparison: {
            algorithm: 'hybrid',
            weights: {
                pressure: 0.3,
                timing: 0.3,
                geometry: 0.3,
                velocity: 0.1
            },
            thresholds: {
                authentication: 0.8,
                verification: 0.85,
                enrollment: 0.7
            }
        },
        enhancement: {
            enablePressureNormalization: true,
            enableTimeWarping: true,
            enableNoiseReduction: true,
            enableFeatureExtraction: true
        }
    },
    features: {
        enableMFA: false,
        enableAPIKeys: true,
        enableWebhooks: false,
        enableAdvancedAnalytics: false,
        enableBatchOperations: false,
        enableExperimentalFeatures: false,
        maintenanceMode: false
    }
};
