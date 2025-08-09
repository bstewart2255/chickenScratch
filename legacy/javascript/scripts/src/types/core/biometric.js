"use strict";
/**
 * Core biometric types for signature authentication
 * Matches existing runtime behavior with proper TypeScript definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEnhancedFeatures = exports.isDeviceCapabilities = exports.isStrokePoint = void 0;
/**
 * Type guards for runtime validation
 */
function isStrokePoint(point) {
    return (typeof point === 'object' &&
        point !== null &&
        typeof point.x === 'number' &&
        typeof point.y === 'number' &&
        typeof point.pressure === 'number' &&
        typeof point.timestamp === 'number');
}
exports.isStrokePoint = isStrokePoint;
function isDeviceCapabilities(caps) {
    return (typeof caps === 'object' &&
        caps !== null &&
        typeof caps.touch === 'boolean' &&
        typeof caps.pressure === 'boolean' &&
        typeof caps.tilt === 'boolean' &&
        ['high', 'medium', 'low'].includes(caps.precision) &&
        ['mouse', 'pen', 'touch', 'unknown'].includes(caps.pointerType) &&
        typeof caps.maxPressure === 'number' &&
        typeof caps.timestamp === 'string');
}
exports.isDeviceCapabilities = isDeviceCapabilities;
function isEnhancedFeatures(features) {
    return (typeof features === 'object' &&
        features !== null &&
        features.pressureDynamics &&
        features.timingPatterns &&
        features.geometricProperties &&
        features.securityIndicators &&
        features.deviceCapabilities &&
        features.metadata);
}
exports.isEnhancedFeatures = isEnhancedFeatures;
