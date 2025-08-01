/**
 * @jest-environment jsdom
 */
import { SignatureCapture } from '../../../frontend/ts/SignatureCapture';
import { DeviceCapabilityDetector } from '../../../frontend/ts/DeviceCapabilityDetector';
import { TestDataGenerator } from '../../helpers/generators';
import { mockCanvasContext } from '../../helpers/mocks';
import { StrokeData, Point, CaptureMode } from '../../../src/types';

// Mock DeviceCapabilityDetector
jest.mock('../../../frontend/ts/DeviceCapabilityDetector');

describe('SignatureCapture', () => {
  let canvas: HTMLCanvasElement;
  let signatureCapture: SignatureCapture;
  let mockCtx: any;
  let mockDeviceDetector: jest.Mocked<DeviceCapabilityDetector>;

  beforeEach(() => {
    // Create mock canvas
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    
    // Mock canvas context
    mockCtx = mockCanvasContext();
    canvas.getContext = jest.fn().mockReturnValue(mockCtx);
    
    // Mock DeviceCapabilityDetector
    mockDeviceDetector = {
      detect: jest.fn().mockReturnValue({
        hasTouchSupport: true,
        hasPressureSupport: true,
        hasPointerSupport: true,
        maxTouchPoints: 10,
        pointerTypes: ['touch', 'pen', 'mouse'],
        pixelRatio: 2,
        screenSize: { width: 1920, height: 1080 },
        userAgent: 'test-agent',
        platform: 'test'
      }),
      capabilities: TestDataGenerator.generateDeviceCapabilities()
    } as any;
    
    (DeviceCapabilityDetector as jest.Mock).mockImplementation(() => mockDeviceDetector);
    
    // Create SignatureCapture instance
    signatureCapture = new SignatureCapture(canvas);
    
    TestDataGenerator.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
    signatureCapture.destroy();
  });

  describe('constructor', () => {
    it('should initialize with canvas element', () => {
      expect(signatureCapture).toBeDefined();
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('should detect device capabilities', () => {
      expect(mockDeviceDetector.detect).toHaveBeenCalled();
    });

    it('should set up event listeners', () => {
      const addEventListenerSpy = jest.spyOn(canvas, 'addEventListener');
      new SignatureCapture(canvas);
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('pointercancel', expect.any(Function));
    });

    it('should configure canvas context', () => {
      expect(mockCtx.lineCap).toBe('round');
      expect(mockCtx.lineJoin).toBe('round');
      expect(mockCtx.strokeStyle).toBe('#000000');
      expect(mockCtx.lineWidth).toBe(2);
    });
  });

  describe('startCapture', () => {
    it('should start signature capture', () => {
      signatureCapture.startCapture('signature');
      
      expect(signatureCapture.isCapturing).toBe(true);
      expect(signatureCapture.captureMode).toBe('signature');
    });

    it('should clear previous data', () => {
      // Add some strokes
      signatureCapture.currentStrokes = [TestDataGenerator.generateStrokeData()];
      
      signatureCapture.startCapture('drawing');
      
      expect(signatureCapture.currentStrokes).toEqual([]);
    });

    it('should clear canvas', () => {
      signatureCapture.startCapture('shape');
      
      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });
  });

  describe('stopCapture', () => {
    it('should stop capture and return data', () => {
      const strokeData = TestDataGenerator.generateStrokeData();
      signatureCapture.currentStrokes = [strokeData];
      signatureCapture.isCapturing = true;
      
      const result = signatureCapture.stopCapture();
      
      expect(signatureCapture.isCapturing).toBe(false);
      expect(result).toEqual({
        strokes: [strokeData],
        deviceCapabilities: mockDeviceDetector.capabilities,
        captureMode: 'signature'
      });
    });

    it('should return null if not capturing', () => {
      signatureCapture.isCapturing = false;
      
      const result = signatureCapture.stopCapture();
      
      expect(result).toBeNull();
    });
  });

  describe('pointer events', () => {
    it('should handle pointerdown event', () => {
      signatureCapture.startCapture('signature');
      
      const event = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pressure: 0.5,
        pointerId: 1,
        pointerType: 'pen'
      });
      
      canvas.dispatchEvent(event);
      
      expect(signatureCapture.isDrawing).toBe(true);
      expect(signatureCapture.currentStroke).toBeDefined();
      expect(signatureCapture.currentStroke?.points).toHaveLength(1);
    });

    it('should handle pointermove event', () => {
      signatureCapture.startCapture('drawing');
      
      // Start drawing
      const downEvent = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pressure: 0.5
      });
      canvas.dispatchEvent(downEvent);
      
      // Move
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 150,
        clientY: 150,
        pressure: 0.7
      });
      canvas.dispatchEvent(moveEvent);
      
      expect(signatureCapture.currentStroke?.points).toHaveLength(2);
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should handle pointerup event', () => {
      signatureCapture.startCapture('shape');
      
      // Start drawing
      const downEvent = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100
      });
      canvas.dispatchEvent(downEvent);
      
      // End drawing
      const upEvent = new PointerEvent('pointerup', {
        clientX: 200,
        clientY: 200
      });
      canvas.dispatchEvent(upEvent);
      
      expect(signatureCapture.isDrawing).toBe(false);
      expect(signatureCapture.currentStrokes).toHaveLength(1);
      expect(signatureCapture.currentStroke).toBeNull();
    });

    it('should ignore events when not capturing', () => {
      const event = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100
      });
      
      canvas.dispatchEvent(event);
      
      expect(signatureCapture.isDrawing).toBe(false);
      expect(signatureCapture.currentStroke).toBeNull();
    });
  });

  describe('pressure handling', () => {
    it('should use actual pressure when available', () => {
      signatureCapture.startCapture('signature');
      
      const event = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pressure: 0.75
      });
      
      canvas.dispatchEvent(event);
      
      const point = signatureCapture.currentStroke?.points[0];
      expect(point?.pressure).toBe(0.75);
    });

    it('should use default pressure when not available', () => {
      signatureCapture.startCapture('signature');
      
      const event = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pressure: 0 // No pressure
      });
      
      canvas.dispatchEvent(event);
      
      const point = signatureCapture.currentStroke?.points[0];
      expect(point?.pressure).toBe(0.5); // Default pressure
    });

    it('should adjust line width based on pressure', () => {
      signatureCapture.startCapture('signature');
      
      const downEvent = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pressure: 0.3
      });
      canvas.dispatchEvent(downEvent);
      
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 150,
        clientY: 150,
        pressure: 0.9
      });
      canvas.dispatchEvent(moveEvent);
      
      // Line width should be adjusted based on pressure
      expect(mockCtx.lineWidth).toBeGreaterThan(2);
    });
  });

  describe('coordinate transformation', () => {
    it('should handle canvas offset', () => {
      // Mock getBoundingClientRect
      canvas.getBoundingClientRect = jest.fn().mockReturnValue({
        left: 50,
        top: 50,
        width: 800,
        height: 600
      });
      
      signatureCapture.startCapture('signature');
      
      const event = new PointerEvent('pointerdown', {
        clientX: 150, // 150 - 50 = 100 relative to canvas
        clientY: 200  // 200 - 50 = 150 relative to canvas
      });
      
      canvas.dispatchEvent(event);
      
      const point = signatureCapture.currentStroke?.points[0];
      expect(point?.x).toBe(100);
      expect(point?.y).toBe(150);
    });

    it('should handle scaled canvas', () => {
      // Mock scaled canvas
      canvas.getBoundingClientRect = jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 400, // Half the actual canvas size
        height: 300
      });
      
      signatureCapture.startCapture('signature');
      
      const event = new PointerEvent('pointerdown', {
        clientX: 200, // Should be 400 on actual canvas
        clientY: 150  // Should be 300 on actual canvas
      });
      
      canvas.dispatchEvent(event);
      
      const point = signatureCapture.currentStroke?.points[0];
      expect(point?.x).toBe(400);
      expect(point?.y).toBe(300);
    });
  });

  describe('clear', () => {
    it('should clear canvas and strokes', () => {
      signatureCapture.currentStrokes = [
        TestDataGenerator.generateStrokeData(),
        TestDataGenerator.generateStrokeData()
      ];
      
      signatureCapture.clear();
      
      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(signatureCapture.currentStrokes).toEqual([]);
    });

    it('should stop current stroke', () => {
      signatureCapture.isDrawing = true;
      signatureCapture.currentStroke = TestDataGenerator.generateStrokeData();
      
      signatureCapture.clear();
      
      expect(signatureCapture.isDrawing).toBe(false);
      expect(signatureCapture.currentStroke).toBeNull();
    });
  });

  describe('getData', () => {
    it('should return current capture data', () => {
      const strokes = [
        TestDataGenerator.generateStrokeData(),
        TestDataGenerator.generateStrokeData()
      ];
      signatureCapture.currentStrokes = strokes;
      signatureCapture.captureMode = 'drawing';
      
      const data = signatureCapture.getData();
      
      expect(data).toEqual({
        strokes,
        deviceCapabilities: mockDeviceDetector.capabilities,
        captureMode: 'drawing'
      });
    });
  });

  describe('setStrokeStyle', () => {
    it('should update stroke style', () => {
      signatureCapture.setStrokeStyle({
        color: '#FF0000',
        width: 5
      });
      
      expect(mockCtx.strokeStyle).toBe('#FF0000');
      expect(signatureCapture.baseLineWidth).toBe(5);
    });

    it('should apply new style to ongoing strokes', () => {
      signatureCapture.startCapture('signature');
      
      // Start drawing
      const event = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100
      });
      canvas.dispatchEvent(event);
      
      // Change style
      signatureCapture.setStrokeStyle({
        color: '#00FF00',
        width: 3
      });
      
      expect(mockCtx.strokeStyle).toBe('#00FF00');
    });
  });

  describe('undo/redo', () => {
    it('should undo last stroke', () => {
      const stroke1 = TestDataGenerator.generateStrokeData();
      const stroke2 = TestDataGenerator.generateStrokeData();
      
      signatureCapture.currentStrokes = [stroke1, stroke2];
      
      signatureCapture.undo();
      
      expect(signatureCapture.currentStrokes).toEqual([stroke1]);
      expect(signatureCapture.undoStack).toEqual([stroke2]);
    });

    it('should redo undone stroke', () => {
      const stroke1 = TestDataGenerator.generateStrokeData();
      const stroke2 = TestDataGenerator.generateStrokeData();
      
      signatureCapture.currentStrokes = [stroke1];
      signatureCapture.undoStack = [stroke2];
      
      signatureCapture.redo();
      
      expect(signatureCapture.currentStrokes).toEqual([stroke1, stroke2]);
      expect(signatureCapture.undoStack).toEqual([]);
    });

    it('should redraw canvas after undo/redo', () => {
      signatureCapture.currentStrokes = [TestDataGenerator.generateStrokeData()];
      const redrawSpy = jest.spyOn(signatureCapture as any, 'redrawCanvas');
      
      signatureCapture.undo();
      
      expect(redrawSpy).toHaveBeenCalled();
      expect(mockCtx.clearRect).toHaveBeenCalled();
    });
  });

  describe('export functionality', () => {
    it('should export as image', () => {
      const dataUrl = signatureCapture.exportAsImage('png');
      
      expect(mockCtx.canvas.toDataURL).toHaveBeenCalledWith('image/png');
      expect(dataUrl).toBe('data:image/png;base64,mockdata');
    });

    it('should export as SVG', () => {
      const stroke = TestDataGenerator.generateStrokeData(3);
      signatureCapture.currentStrokes = [stroke];
      
      const svg = signatureCapture.exportAsSVG();
      
      expect(svg).toContain('<svg');
      expect(svg).toContain('width="800"');
      expect(svg).toContain('height="600"');
      expect(svg).toContain('<path');
    });
  });

  describe('performance', () => {
    it('should throttle pointermove events', () => {
      jest.useFakeTimers();
      signatureCapture.startCapture('signature');
      
      // Start drawing
      const downEvent = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100
      });
      canvas.dispatchEvent(downEvent);
      
      // Rapid move events
      for (let i = 0; i < 100; i++) {
        const moveEvent = new PointerEvent('pointermove', {
          clientX: 100 + i,
          clientY: 100 + i
        });
        canvas.dispatchEvent(moveEvent);
      }
      
      // Should not have 100 points due to throttling
      expect(signatureCapture.currentStroke?.points.length).toBeLessThan(100);
      
      jest.useRealTimers();
    });

    it('should handle large number of strokes', () => {
      const strokes = Array(1000).fill(null).map(() => 
        TestDataGenerator.generateStrokeData(100)
      );
      
      signatureCapture.currentStrokes = strokes;
      
      const startTime = Date.now();
      signatureCapture.getData();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe('destroy', () => {
    it('should remove event listeners', () => {
      const removeEventListenerSpy = jest.spyOn(canvas, 'removeEventListener');
      
      signatureCapture.destroy();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointercancel', expect.any(Function));
    });

    it('should clear data', () => {
      signatureCapture.currentStrokes = [TestDataGenerator.generateStrokeData()];
      signatureCapture.isCapturing = true;
      
      signatureCapture.destroy();
      
      expect(signatureCapture.currentStrokes).toEqual([]);
      expect(signatureCapture.isCapturing).toBe(false);
    });
  });
});