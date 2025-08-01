"use strict";
/**
 * Canvas API type augmentations and interfaces
 * Provides proper typing for Canvas 2D context and related APIs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventPressure = exports.getEventCoordinates = exports.isBiometricTouchEvent = exports.isBiometricPointerEvent = void 0;
/**
 * Type guards for canvas events
 */
function isBiometricPointerEvent(event) {
    return event instanceof PointerEvent && 'pressure' in event;
}
exports.isBiometricPointerEvent = isBiometricPointerEvent;
function isBiometricTouchEvent(event) {
    return event instanceof TouchEvent && event.touches.length > 0;
}
exports.isBiometricTouchEvent = isBiometricTouchEvent;
/**
 * Helper to get coordinates from various event types
 */
function getEventCoordinates(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    let clientX;
    let clientY;
    if (event instanceof TouchEvent) {
        const touch = event.touches[0] || event.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
    }
    else {
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
exports.getEventCoordinates = getEventCoordinates;
/**
 * Helper to get pressure from various event types
 */
function getEventPressure(event) {
    if (event instanceof PointerEvent) {
        return event.pressure;
    }
    else if (event instanceof TouchEvent) {
        const touch = event.touches[0] || event.changedTouches[0];
        return touch.force || 0.5;
    }
    return event.buttons > 0 ? 0.5 : 0;
}
exports.getEventPressure = getEventPressure;
