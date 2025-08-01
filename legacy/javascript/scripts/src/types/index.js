"use strict";
/**
 * Central export file for all type definitions
 * This makes it easy to import types from a single location
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Core types
__exportStar(require("./core/biometric"), exports);
__exportStar(require("./core/errors"), exports);
// API types
__exportStar(require("./api/auth"), exports);
__exportStar(require("./api/schemas"), exports);
// Database types
__exportStar(require("./database/tables"), exports);
// Validation schemas
__exportStar(require("./validation/schemas"), exports);
// Canvas types
__exportStar(require("./canvas"), exports);
// Configuration types
__exportStar(require("./config"), exports);
