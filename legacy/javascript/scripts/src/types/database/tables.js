"use strict";
/**
 * Database table interfaces matching PostgreSQL schema
 * These types ensure type safety for database operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromPostgresTimestamp = exports.toPostgresTimestamp = exports.hasMetadata = exports.hasEnhancedFeatures = void 0;
/**
 * Type guards for nullable fields
 */
function hasEnhancedFeatures(signature) {
    return signature.enhanced_features !== null && signature.enhanced_features !== undefined;
}
exports.hasEnhancedFeatures = hasEnhancedFeatures;
function hasMetadata(record) {
    return record.metadata !== null && record.metadata !== undefined;
}
exports.hasMetadata = hasMetadata;
/**
 * Database timestamp helpers
 */
function toPostgresTimestamp(date) {
    return date.toISOString();
}
exports.toPostgresTimestamp = toPostgresTimestamp;
function fromPostgresTimestamp(timestamp) {
    return typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
}
exports.fromPostgresTimestamp = fromPostgresTimestamp;
