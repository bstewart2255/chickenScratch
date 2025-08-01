/**
 * Signature Capture Module with full Canvas API typing
 * Handles signature, shape, and drawing capture with biometric data
 */

import SignaturePad, { PointGroup, BasicPoint } from 'signature_pad';
import { DeviceCapabilityDetector } from './DeviceCapabilityDetector';
import type { DeviceCapabilities, StrokeData, StrokePoint } from '../src/types/core/biometric';

// Extended Canvas context with all 2D methods properly typed
interface ExtendedCanvasRenderingContext2D extends CanvasRenderingContext2D {
  // Additional methods that might be vendor-specific
  webkitBackingStorePixelRatio?: number;
  mozBackingStorePixelRatio?: number;
  msBackingStorePixelRatio?: number;
  oBackingStorePixelRatio?: number;
  backingStorePixelRatio?: number;
}

// SignaturePad uses PointGroup[] format
type SignaturePadData = PointGroup[];

// Signature metrics for analysis
export interface SignatureMetrics {
  // Basic metrics
  strokeCount: number;
  totalPoints: number;
  duration: number;
  
  // Spatial metrics
  boundingBox: {
    width: number;
    height: number;
    area: number;
    centerX: number;
    centerY: number;
  };
  totalLength: number;
  averageStrokeLength: number;
  
  // Velocity metrics
  averageSpeed: number;
  maxSpeed: number;
  speedVariation: number;
  
  // Pressure metrics
  averagePressure: number;
  pressureVariation: number;
  pressureRange: {
    min: number;
    max: number;
  };
  
  // Complexity metrics
  angularVariation: number;
  curvatureComplexity: number;
  intersectionCount: number;
  
  // Timing metrics
  averageStrokeDuration: number;
  pauseCount: number;
  totalPauseTime: number;
  writingSpeed: number;
  
  // Device-specific
  devicePixelRatio: number;
  canvasWidth: number;
  canvasHeight: number;
}

// Signature data structure
export interface SignatureData {
  data: SignaturePadData;
  raw: StrokeData[];
  metrics: SignatureMetrics;
  timestamp: string;
}

// Canvas configuration
interface CanvasConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
  penColor?: string;
  minWidth?: number;
  maxWidth?: number;
  velocityFilterWeight?: number;
  throttle?: number;
  minDistance?: number;
}

export class SignatureCapture {
  private canvas: HTMLCanvasElement;
  private ctx: ExtendedCanvasRenderingContext2D;
  private signaturePad: SignaturePad;
  private deviceCapabilities: DeviceCapabilities;
  private drawingStartTime: number | null = null;
  private strokeStartTimes: number[] = [];
  private currentStrokeData: StrokePoint[] = [];
  private allStrokesData: StrokeData[] = [];
  private config: CanvasConfig;

  constructor(canvasId: string, config?: CanvasConfig) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }
    
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as ExtendedCanvasRenderingContext2D;
    if (!this.ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    
    this.config = {
      backgroundColor: 'rgba(255,255,255,0)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 2,
      maxWidth: 4,
      velocityFilterWeight: 0.7,
      throttle: 16,
      minDistance: 2,
      ...config
    };
    
    // Detect device capabilities
    this.deviceCapabilities = DeviceCapabilityDetector.detectCapabilities();
    
    // Initialize SignaturePad
    this.signaturePad = new SignaturePad(this.canvas, {
      backgroundColor: this.config.backgroundColor,
      penColor: this.config.penColor,
      minWidth: this.config.minWidth,
      maxWidth: this.config.maxWidth,
      velocityFilterWeight: this.config.velocityFilterWeight,
      throttle: this.config.throttle,
      minDistance: this.config.minDistance
    });
    
    // Set up event listeners
    this.signaturePad.addEventListener('beginStroke', this.onStrokeBegin.bind(this));
    this.signaturePad.addEventListener('endStroke', this.onStrokeEnd.bind(this));
    
    // Set up event listeners for pressure data
    this.setupEventListeners();
    
    // Initialize canvas size
    this.resizeCanvas();
    
    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  /**
   * Set up event listeners for capturing pressure and tilt data
   */
  private setupEventListeners(): void {
    // Pointer events (preferred for pressure data)
    if ('PointerEvent' in window) {
      this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
      this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
      this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
    }
    
    // Touch events fallback
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
  }

  /**
   * Handle pointer down event
   */
  private handlePointerDown(event: PointerEvent): void {
    const point = this.createStrokePoint(event);
    this.currentStrokeData = [point];
  }

  /**
   * Handle pointer move event
   */
  private handlePointerMove(event: PointerEvent): void {
    if (event.buttons !== 1) return; // Not drawing
    
    const point = this.createStrokePoint(event);
    this.currentStrokeData.push(point);
  }

  /**
   * Handle pointer up event
   */
  private handlePointerUp(event: PointerEvent): void {
    const point = this.createStrokePoint(event);
    this.currentStrokeData.push(point);
  }

  /**
   * Handle touch start event
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      const point = this.createStrokePointFromTouch(touch);
      this.currentStrokeData = [point];
    }
  }

  /**
   * Handle touch move event
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      const point = this.createStrokePointFromTouch(touch);
      this.currentStrokeData.push(point);
    }
  }

  /**
   * Handle touch end event
   */
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
  }

  /**
   * Create stroke point from pointer event
   */
  private createStrokePoint(event: PointerEvent): StrokePoint {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
    
    return {
      x,
      y,
      pressure: event.pressure || 0.5,
      timestamp: Date.now(),
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      width: event.width,
      height: event.height,
      twist: (event as any).twist,
      tangentialPressure: (event as any).tangentialPressure
    };
  }

  /**
   * Create stroke point from touch event
   */
  private createStrokePointFromTouch(touch: Touch): StrokePoint {
    const rect = this.canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
    
    const pressure = DeviceCapabilityDetector.getNormalizedPressure(touch) || 0.5;
    
    return {
      x,
      y,
      pressure,
      timestamp: Date.now(),
      radiusX: touch.radiusX,
      radiusY: touch.radiusY,
      rotationAngle: touch.rotationAngle
    };
  }

  /**
   * Handle stroke begin
   */
  private onStrokeBegin(): void {
    if (!this.drawingStartTime) {
      this.drawingStartTime = Date.now();
    }
    this.strokeStartTimes.push(Date.now());
  }

  /**
   * Handle stroke end
   */
  private onStrokeEnd(): void {
    if (this.currentStrokeData.length > 0) {
      const strokeData: StrokeData = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        points: [...this.currentStrokeData],
        startTime: this.strokeStartTimes[this.strokeStartTimes.length - 1] || Date.now(),
        endTime: Date.now(),
        duration: Date.now() - (this.strokeStartTimes[this.strokeStartTimes.length - 1] || Date.now()),
        deviceType: this.deviceCapabilities.inputMethod === 'stylus' ? 'pen' : this.deviceCapabilities.inputMethod as 'mouse' | 'touch',
        pressure: this.currentStrokeData.length > 0 ? {
          min: Math.min(...this.currentStrokeData.map(p => p.pressure)),
          max: Math.max(...this.currentStrokeData.map(p => p.pressure)),
          average: this.currentStrokeData.reduce((sum, p) => sum + p.pressure, 0) / this.currentStrokeData.length
        } : undefined
      };
      
      this.allStrokesData.push(strokeData);
      this.currentStrokeData = [];
    }
  }

  /**
   * Resize canvas to fit container
   */
  resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    const isMobile = window.innerWidth < 768;
    
    let width: number, height: number;
    
    if (isMobile) {
      // Mobile: Use viewport dimensions with padding
      width = window.innerWidth - 40;
      height = window.innerHeight - 40;
    } else {
      // Desktop: Use container dimensions
      width = this.config.width || containerRect.width || 600;
      height = this.config.height || containerRect.height || 400;
    }
    
    // Set canvas actual size (in memory) with DPI scaling
    this.canvas.width = width * devicePixelRatio;
    this.canvas.height = height * devicePixelRatio;
    
    // Set canvas display size (CSS)
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    
    // Scale context to match device pixel ratio
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    
    // Preserve signature data during resize
    const currentData = this.signaturePad.toData();
    this.signaturePad.clear();
    if (currentData.length > 0) {
      this.signaturePad.fromData(currentData);
    }
  }

  /**
   * Handle window resize
   */
  private handleResize = (): void => {
    // Debounce resize events
    clearTimeout((this as any).resizeTimeout);
    (this as any).resizeTimeout = setTimeout(() => {
      this.resizeCanvas();
    }, 100);
  };

  /**
   * Clear the canvas
   */
  clear(): void {
    this.signaturePad.clear();
    this.drawingStartTime = null;
    this.strokeStartTimes = [];
    this.currentStrokeData = [];
    this.allStrokesData = [];
  }

  /**
   * Check if canvas is empty
   */
  isEmpty(): boolean {
    return this.signaturePad.isEmpty();
  }

  /**
   * Get signature data with metrics
   */
  getSignatureData(): SignatureData {
    const endTime = Date.now();
    const duration = this.drawingStartTime ? endTime - this.drawingStartTime : 0;
    const rawData = this.signaturePad.toData();
    
    return {
      data: rawData,
      raw: this.allStrokesData,
      metrics: this.calculateMetrics(rawData, duration),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate comprehensive metrics
   */
  private calculateMetrics(rawData: SignaturePadData, duration: number): SignatureMetrics {
    const strokes = rawData.map(group => group.points);
    const allPoints = strokes.flat();
    
    // Basic metrics
    const strokeCount = strokes.length;
    const totalPoints = allPoints.length;
    
    // Bounding box
    const xCoords = allPoints.map(p => p.x);
    const yCoords = allPoints.map(p => p.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    
    const boundingBox = {
      width: maxX - minX,
      height: maxY - minY,
      area: (maxX - minX) * (maxY - minY),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
    
    // Calculate distances and speeds
    let totalLength = 0;
    const speeds: number[] = [];
    const strokeLengths: number[] = [];
    
    strokes.forEach(stroke => {
      let strokeLength = 0;
      for (let i = 1; i < stroke.length; i++) {
        const dx = stroke[i].x - stroke[i - 1].x;
        const dy = stroke[i].y - stroke[i - 1].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        strokeLength += distance;
        
        const dt = (stroke[i] as any).time - (stroke[i - 1] as any).time;
        if (dt > 0) {
          speeds.push(distance / dt);
        }
      }
      totalLength += strokeLength;
      strokeLengths.push(strokeLength);
    });
    
    // Pressure metrics from raw stroke data
    const pressures = this.allStrokesData
      .flatMap(stroke => stroke.points.map(p => p.pressure))
      .filter(p => p > 0);
    
    const averagePressure = pressures.length > 0
      ? pressures.reduce((a, b) => a + b, 0) / pressures.length
      : 0.5;
    
    const pressureVariation = pressures.length > 1
      ? Math.sqrt(pressures.reduce((sum, p) => sum + Math.pow(p - averagePressure, 2), 0) / pressures.length)
      : 0;
    
    // Speed metrics
    const averageSpeed = speeds.length > 0 
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length 
      : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
    const speedVariation = speeds.length > 1
      ? Math.sqrt(speeds.reduce((sum, s) => sum + Math.pow(s - averageSpeed, 2), 0) / speeds.length)
      : 0;
    
    // Angular variation (simplified)
    let angularVariation = 0;
    let angles: number[] = [];
    
    strokes.forEach(stroke => {
      for (let i = 2; i < stroke.length; i++) {
        const dx1 = stroke[i - 1].x - stroke[i - 2].x;
        const dy1 = stroke[i - 1].y - stroke[i - 2].y;
        const dx2 = stroke[i].x - stroke[i - 1].x;
        const dy2 = stroke[i].y - stroke[i - 1].y;
        
        const angle1 = Math.atan2(dy1, dx1);
        const angle2 = Math.atan2(dy2, dx2);
        let angleDiff = angle2 - angle1;
        
        // Normalize angle difference to [-π, π]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        angles.push(Math.abs(angleDiff));
      }
    });
    
    if (angles.length > 0) {
      angularVariation = angles.reduce((a, b) => a + b, 0) / angles.length;
    }
    
    // Timing metrics
    const strokeDurations = this.allStrokesData.map(s => s.duration);
    const averageStrokeDuration = strokeDurations.length > 0
      ? strokeDurations.reduce((a, b) => a + b, 0) / strokeDurations.length
      : 0;
    
    // Pause detection (gaps > 100ms between strokes)
    let pauseCount = 0;
    let totalPauseTime = 0;
    
    for (let i = 1; i < this.strokeStartTimes.length; i++) {
      const gap = this.strokeStartTimes[i] - this.strokeStartTimes[i - 1];
      if (gap > 100) {
        pauseCount++;
        totalPauseTime += gap;
      }
    }
    
    return {
      strokeCount,
      totalPoints,
      duration,
      boundingBox,
      totalLength,
      averageStrokeLength: strokeLengths.length > 0 
        ? totalLength / strokeLengths.length 
        : 0,
      averageSpeed,
      maxSpeed,
      speedVariation,
      averagePressure,
      pressureVariation,
      pressureRange: {
        min: pressures.length > 0 ? Math.min(...pressures) : 0,
        max: pressures.length > 0 ? Math.max(...pressures) : 1
      },
      angularVariation,
      curvatureComplexity: angularVariation * strokeCount, // Simplified metric
      intersectionCount: 0, // Would require complex calculation
      averageStrokeDuration,
      pauseCount,
      totalPauseTime,
      writingSpeed: duration > 0 ? totalLength / duration : 0,
      devicePixelRatio: window.devicePixelRatio || 1,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height
    };
  }

  /**
   * Export signature as image
   */
  toDataURL(type?: string, encoderOptions?: number): string {
    return this.signaturePad.toDataURL(type, encoderOptions);
  }

  /**
   * Import signature from data
   */
  fromData(data: SignaturePadData): void {
    this.signaturePad.fromData(data);
  }

  /**
   * Get raw signature pad instance
   */
  getSignaturePad(): SignaturePad {
    return this.signaturePad;
  }

  /**
   * Get device capabilities
   */
  getDeviceCapabilities(): DeviceCapabilities {
    return this.deviceCapabilities;
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    this.signaturePad.off();
    this.clear();
  }
}

// Export default
export default SignatureCapture;