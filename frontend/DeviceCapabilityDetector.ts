/**
 * Device Capability Detection Module
 * Detects and reports device capabilities for enhanced biometric features
 */

import type { DeviceCapabilities } from '../src/types/core/biometric';

// Extended interfaces for browser-specific APIs
interface ExtendedPointerEvent extends PointerEvent {
  // pressure is already defined in PointerEvent
}

interface ExtendedTouch extends Touch {
  webkitForce?: number;
  // force is already defined in Touch
}

// ExtendedTouchEvent interface removed - not used

// Navigator with vendor-specific properties
interface ExtendedNavigator extends Navigator {
  msMaxTouchPoints?: number;
}

export class DeviceCapabilityDetector {
  /**
   * Main detection function that returns all device capabilities
   */
  static detectCapabilities(): DeviceCapabilities {
    return {
      supportsPressure: this.detectPressureSupport(),
      supportsTouch: this.detectTouchSupport(),
      inputMethod: this.detectInputMethod(),
      pointerTypes: this.detectPointerType(),
      browser: this.detectBrowser(),
      os: this.detectOS(),
      devicePixelRatio: window.devicePixelRatio || 1,
      canvasSupport: this.detectCanvasSupport()
    };
  }

  /**
   * Detect if device supports pressure/force touch
   */
  static detectPressureSupport(): boolean {
    // Check for PointerEvent pressure support
    if ('PointerEvent' in window) {
      // Modern browsers with pressure support
      if ('pressure' in PointerEvent.prototype) {
        return true;
      }
    }
    
    // Check for webkit Force Touch (older Safari)
    if ('Touch' in window && 'webkitForce' in Touch.prototype) {
      return true;
    }
    
    // Check for Force Touch on iOS devices
    if (this.isIOS() && 'Touch' in window && 'force' in Touch.prototype) {
      return true;
    }
    
    return false;
  }

  /**
   * Detect touch support
   */
  static detectTouchSupport(): boolean {
    const nav = navigator as ExtendedNavigator;
    return 'ontouchstart' in window || 
           nav.maxTouchPoints > 0 || 
           (nav.msMaxTouchPoints && nav.msMaxTouchPoints > 0) || 
           false;
  }

  /**
   * Detect primary input method
   */
  static detectInputMethod(): 'mouse' | 'touch' | 'stylus' {
    // Check for touch support
    if (this.detectTouchSupport()) {
      // Check if it's primarily a touch device
      if (navigator.maxTouchPoints > 0) {
        // Check for stylus support
        if (this.detectStylusSupport()) {
          return 'stylus';
        }
        return 'touch';
      }
    }
    
    return 'mouse';
  }

  /**
   * Detect stylus support
   */
  static detectStylusSupport(): boolean {
    // Check if device reports stylus capabilities
    if ('PointerEvent' in window) {
      // This is a heuristic - actual detection happens during use
      return navigator.maxTouchPoints > 0 && this.detectPressureSupport();
    }
    return false;
  }

  /**
   * Detect pointer type capabilities
   */
  static detectPointerType(): string[] {
    const types: string[] = [];
    
    if ('PointerEvent' in window) {
      types.push('pointer');
    }
    
    if (this.detectTouchSupport()) {
      types.push('touch');
    }
    
    types.push('mouse'); // Always support mouse
    
    return types;
  }

  /**
   * Detect browser type
   */
  static detectBrowser(): string {
    const ua = navigator.userAgent;
    
    if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
      return 'Chrome';
    } else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
      return 'Safari';
    } else if (ua.indexOf('Firefox') > -1) {
      return 'Firefox';
    } else if (ua.indexOf('Edg') > -1) {
      return 'Edge';
    }
    
    return 'Unknown';
  }

  /**
   * Detect operating system
   */
  static detectOS(): string {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    
    if (this.isIOS()) {
      if (ua.indexOf('iPad') > -1) return 'iPadOS';
      return 'iOS';
    }
    
    if (ua.indexOf('Android') > -1) return 'Android';
    if (platform.indexOf('Win') > -1) return 'Windows';
    if (platform.indexOf('Mac') > -1) return 'macOS';
    if (platform.indexOf('Linux') > -1) return 'Linux';
    
    return 'Unknown';
  }

  /**
   * Check if device is iOS
   */
  static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /**
   * Detect Canvas API support and features
   */
  static detectCanvasSupport(): {
    basic: boolean;
    webgl: boolean;
    webgl2: boolean;
    offscreenCanvas: boolean;
  } {
    const canvas = document.createElement('canvas');
    
    return {
      basic: !!canvas.getContext,
      webgl: !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
      webgl2: !!canvas.getContext('webgl2'),
      offscreenCanvas: typeof OffscreenCanvas !== 'undefined'
    };
  }

  /**
   * Get real-time pressure data availability
   * This should be called during actual drawing to verify pressure data
   */
  static verifyPressureData(event: PointerEvent | Touch | ExtendedTouch): boolean {
    const extEvent = event as ExtendedPointerEvent & ExtendedTouch;
    
    if (extEvent.pressure !== undefined && extEvent.pressure > 0 && extEvent.pressure < 1) {
      // Valid pressure data (between 0 and 1, not default values)
      return true;
    }
    
    if (extEvent.webkitForce !== undefined && extEvent.webkitForce > 0) {
      // WebKit force touch data
      return true;
    }
    
    if (extEvent.force !== undefined && extEvent.force > 0) {
      // Touch force data
      return true;
    }
    
    return false;
  }

  /**
   * Get normalized pressure value from various sources
   */
  static getNormalizedPressure(event: PointerEvent | Touch | ExtendedTouch): number | null {
    const extEvent = event as ExtendedPointerEvent & ExtendedTouch;
    
    // Standard pressure (0-1 range)
    if (extEvent.pressure !== undefined && extEvent.pressure > 0) {
      return extEvent.pressure;
    }
    
    // WebKit Force Touch (needs normalization)
    if (extEvent.webkitForce !== undefined && extEvent.webkitForce > 0) {
      // WebKit force is typically 0-3, normalize to 0-1
      return Math.min(extEvent.webkitForce / 3, 1);
    }
    
    // Touch force
    if (extEvent.force !== undefined && extEvent.force > 0) {
      return extEvent.force;
    }
    
    // No pressure data available
    return null;
  }
}

// Make it available globally if needed (for backward compatibility)
if (typeof window !== 'undefined') {
  (window as any).DeviceCapabilityDetector = DeviceCapabilityDetector;
}

// Export for module systems
export default DeviceCapabilityDetector;