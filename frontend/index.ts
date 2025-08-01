/**
 * Main entry point for frontend modules
 * Exports all TypeScript modules for use in HTML
 */

export { DeviceCapabilityDetector } from './DeviceCapabilityDetector';
export { ApiClient, apiClient, ApiError } from './ApiClient';
export { SignatureCapture } from './SignatureCapture';
export type { SignatureData, SignatureMetrics } from './SignatureCapture';
export type { DeviceCapabilities } from '../src/types/core/biometric';

// For backward compatibility, also attach to window object
import { DeviceCapabilityDetector } from './DeviceCapabilityDetector';
import { apiClient } from './ApiClient';

if (typeof window !== 'undefined') {
  (window as any).DeviceCapabilityDetector = DeviceCapabilityDetector;
  (window as any).apiClient = apiClient;
}