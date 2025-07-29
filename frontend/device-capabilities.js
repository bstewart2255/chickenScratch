/**
 * Device Capability Detection Module
 * Detects and reports device capabilities for enhanced biometric features
 */

const DeviceCapabilityDetector = {
  /**
   * Main detection function that returns all device capabilities
   */
  detectCapabilities() {
    return {
      supportsPressure: this.detectPressureSupport(),
      supportsTouch: this.detectTouchSupport(),
      inputMethod: this.detectInputMethod(),
      pointerType: this.detectPointerType(),
      browser: this.detectBrowser(),
      os: this.detectOS(),
      timestamp: Date.now()
    };
  },

  /**
   * Detect if device supports pressure/force touch
   */
  detectPressureSupport() {
    // Check for PointerEvent pressure support
    if ('PointerEvent' in window) {
      // Modern browsers with pressure support
      if ('pressure' in PointerEvent.prototype) {
        return true;
      }
    }
    
    // Check for webkit Force Touch (older Safari)
    if ('webkitForce' in Touch.prototype) {
      return true;
    }
    
    // Check for Force Touch on iOS devices
    if (this.isIOS() && 'force' in Touch.prototype) {
      return true;
    }
    
    return false;
  },

  /**
   * Detect touch support
   */
  detectTouchSupport() {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           navigator.msMaxTouchPoints > 0;
  },

  /**
   * Detect primary input method
   */
  detectInputMethod() {
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
  },

  /**
   * Detect stylus support
   */
  detectStylusSupport() {
    // Check if device reports stylus capabilities
    if ('PointerEvent' in window) {
      // This is a heuristic - actual detection happens during use
      return navigator.maxTouchPoints > 0 && this.detectPressureSupport();
    }
    return false;
  },

  /**
   * Detect pointer type capabilities
   */
  detectPointerType() {
    const types = [];
    
    if ('PointerEvent' in window) {
      types.push('pointer');
    }
    
    if (this.detectTouchSupport()) {
      types.push('touch');
    }
    
    types.push('mouse'); // Always support mouse
    
    return types;
  },

  /**
   * Detect browser type
   */
  detectBrowser() {
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
  },

  /**
   * Detect operating system
   */
  detectOS() {
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
  },

  /**
   * Check if device is iOS
   */
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },

  /**
   * Get real-time pressure data availability
   * This should be called during actual drawing to verify pressure data
   */
  verifyPressureData(event) {
    if (event.pressure !== undefined && event.pressure > 0 && event.pressure < 1) {
      // Valid pressure data (between 0 and 1, not default values)
      return true;
    }
    
    if (event.webkitForce !== undefined && event.webkitForce > 0) {
      // WebKit force touch data
      return true;
    }
    
    if (event.force !== undefined && event.force > 0) {
      // Touch force data
      return true;
    }
    
    return false;
  },

  /**
   * Get normalized pressure value from various sources
   */
  getNormalizedPressure(event) {
    // Standard pressure (0-1 range)
    if (event.pressure !== undefined && event.pressure > 0) {
      return event.pressure;
    }
    
    // WebKit Force Touch (needs normalization)
    if (event.webkitForce !== undefined && event.webkitForce > 0) {
      // WebKit force is typically 0-3, normalize to 0-1
      return Math.min(event.webkitForce / 3, 1);
    }
    
    // Touch force
    if (event.force !== undefined && event.force > 0) {
      return event.force;
    }
    
    // No pressure data available
    return null;
  }
};

// Make it available globally if needed
if (typeof window !== 'undefined') {
  window.DeviceCapabilityDetector = DeviceCapabilityDetector;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeviceCapabilityDetector;
}