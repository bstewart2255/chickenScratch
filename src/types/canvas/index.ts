/**
 * Canvas API type augmentations and interfaces
 * Provides proper typing for Canvas 2D context and related APIs
 */

import { StrokePoint, DeviceCapabilities } from '../core/biometric';

/**
 * Extended Canvas 2D rendering context with biometric support
 */
export interface BiometricCanvasContext extends CanvasRenderingContext2D {
  // Custom properties for biometric tracking
  _biometricTracking?: {
    isRecording: boolean;
    currentStroke: StrokePoint[];
    strokeHistory: StrokePoint[][];
  };
}

/**
 * Canvas initialization options
 */
export interface CanvasOptions {
  width: number;
  height: number;
  backgroundColor?: string;
  lineWidth?: number;
  strokeStyle?: string;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  smoothingEnabled?: boolean;
  pixelRatio?: number;
}

/**
 * Pointer event with pressure and tilt data
 */
export interface BiometricPointerEvent extends PointerEvent {
  // Ensure these properties are defined (they're optional in standard PointerEvent)
  pressure: number;
  tangentialPressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  width: number;
  height: number;
  pointerType: 'mouse' | 'pen' | 'touch';
}

/**
 * Touch event with biometric data
 */
export interface BiometricTouchEvent extends TouchEvent {
  touches: BiometricTouchList;
  targetTouches: BiometricTouchList;
  changedTouches: BiometricTouchList;
}

/**
 * Extended touch interface with pressure data
 */
export interface BiometricTouch extends Touch {
  force: number;
  radiusX: number;
  radiusY: number;
  rotationAngle: number;
}

/**
 * Touch list with biometric touches
 */
export interface BiometricTouchList extends TouchList {
  [index: number]: BiometricTouch;
  item(index: number): BiometricTouch | null;
}

/**
 * Canvas drawing state
 */
export interface DrawingState {
  isDrawing: boolean;
  lastPoint: { x: number; y: number } | null;
  currentStrokeId: string | null;
  strokeCount: number;
  totalPoints: number;
}

/**
 * Canvas bounds and scaling info
 */
export interface CanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  pixelRatio: number;
  cssWidth: number;
  cssHeight: number;
}

/**
 * Coordinate transformation result
 */
export interface TransformedCoordinates {
  canvas: { x: number; y: number };
  normalized: { x: number; y: number };
  client: { x: number; y: number };
}

/**
 * Canvas export options
 */
export interface CanvasExportOptions {
  format: 'png' | 'jpeg' | 'webp';
  quality?: number; // 0-1 for JPEG/WebP
  backgroundColor?: string;
  includeMetadata?: boolean;
}

/**
 * Canvas clear options
 */
export interface CanvasClearOptions {
  preserveTransform?: boolean;
  fillColor?: string;
  clearRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Stroke rendering options
 */
export interface StrokeRenderOptions {
  color?: string;
  width?: number;
  opacity?: number;
  smoothing?: boolean;
  pressureMapping?: {
    enabled: boolean;
    minWidth: number;
    maxWidth: number;
  };
}

/**
 * Canvas event handlers
 */
export interface CanvasEventHandlers {
  onDrawStart?: (event: BiometricPointerEvent | BiometricTouchEvent) => void;
  onDrawMove?: (event: BiometricPointerEvent | BiometricTouchEvent) => void;
  onDrawEnd?: (event: BiometricPointerEvent | BiometricTouchEvent) => void;
  onCanvasClear?: () => void;
  onStrokeComplete?: (strokeId: string, points: StrokePoint[]) => void;
}

/**
 * Canvas performance metrics
 */
export interface CanvasPerformanceMetrics {
  fps: number;
  drawCalls: number;
  pointsPerSecond: number;
  memoryUsage?: number;
  renderTime: number;
}

/**
 * Bezier curve control points for smooth drawing
 */
export interface BezierControlPoints {
  start: { x: number; y: number };
  control1: { x: number; y: number };
  control2: { x: number; y: number };
  end: { x: number; y: number };
}

/**
 * Canvas smoothing algorithm options
 */
export interface SmoothingOptions {
  algorithm: 'none' | 'simple' | 'bezier' | 'catmull-rom';
  tension?: number; // For catmull-rom
  iterations?: number; // For iterative smoothing
}

/**
 * Type guards for canvas events
 */
export function isBiometricPointerEvent(
  event: Event
): event is BiometricPointerEvent {
  return event instanceof PointerEvent && 'pressure' in event;
}

export function isBiometricTouchEvent(
  event: Event
): event is BiometricTouchEvent {
  return event instanceof TouchEvent && event.touches.length > 0;
}

/**
 * Helper to get coordinates from various event types
 */
export function getEventCoordinates(
  event: MouseEvent | TouchEvent | PointerEvent,
  canvas: HTMLCanvasElement
): TransformedCoordinates {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  
  let clientX: number;
  let clientY: number;
  
  if (event instanceof TouchEvent) {
    const touch = event.touches[0] || event.changedTouches[0];
    if (touch) {
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = 0;
      clientY = 0;
    }
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }
  
  const x = (clientX - rect.left) * pixelRatio;
  const y = (clientY - rect.top) * pixelRatio;
  
  return {
    canvas: { x, y },
    normalized: {
      x: x / (canvas.width || 1),
      y: y / (canvas.height || 1)
    },
    client: { x: clientX, y: clientY }
  };
}

/**
 * Helper to get pressure from various event types
 */
export function getEventPressure(
  event: MouseEvent | TouchEvent | PointerEvent
): number {
  if (event instanceof PointerEvent) {
    return event.pressure;
  } else if (event instanceof TouchEvent) {
    const touch = event.touches[0] || event.changedTouches[0];
    return (touch as any).force || 0.5;
  }
  return event.buttons > 0 ? 0.5 : 0;
}

/**
 * Canvas utility type for managing multiple canvases
 */
export interface CanvasManager {
  canvases: Map<string, HTMLCanvasElement>;
  contexts: Map<string, BiometricCanvasContext>;
  states: Map<string, DrawingState>;
  
  create(id: string, options: CanvasOptions): HTMLCanvasElement;
  destroy(id: string): void;
  clear(id: string, options?: CanvasClearOptions): void;
  export(id: string, options?: CanvasExportOptions): Promise<string>;
  getMetrics(id: string): CanvasPerformanceMetrics | null;
}

/**
 * Augment global Window interface for canvas features
 */
declare global {
  interface Window {
    BiometricCanvas?: {
      version: string;
      supportsPressure: boolean;
      supportsTouch: boolean;
      deviceCapabilities: DeviceCapabilities;
    };
  }
  
  interface HTMLCanvasElement {
    getBiometricContext?: () => BiometricCanvasContext | null;
  }
}