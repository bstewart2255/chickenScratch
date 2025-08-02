"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationTracker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MigrationTracker {
    constructor(statusFile = '.migration-status.json') {
        this.phaseRequirements = {
            5: { maxUnresolvedErrors: 0 },
            6: { maxUnresolvedErrors: 5, requiredFiles: ['src/types/index.ts'] },
            7: { maxUnresolvedErrors: 5, requiredFiles: ['src/config/index.ts'] },
            8: { maxUnresolvedErrors: 5, requiredFiles: ['src/utils/index.ts'] },
            9: { maxUnresolvedErrors: 10, minCoverage: 30 },
            10: { maxUnresolvedErrors: 10, minCoverage: 50 },
            11: { maxUnresolvedErrors: 5, minCoverage: 70 },
            12: { maxUnresolvedErrors: 5, minCoverage: 80 },
            13: { maxUnresolvedErrors: 5, minCoverage: 85 },
            14: { maxUnresolvedErrors: 5, minCoverage: 90 },
            15: { maxUnresolvedErrors: 0, minCoverage: 90 },
            16: { maxUnresolvedErrors: 0, minCoverage: 95 },
            17: { maxUnresolvedErrors: 0, minCoverage: 100 },
        };
        this.statusFile = path.resolve(process.cwd(), statusFile);
        this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.statusFile)) {
                const data = fs.readFileSync(this.statusFile, 'utf-8');
                const loaded = JSON.parse(data);
                // Initialize with defaults if fields are missing
                this.status = {
                    currentPhase: loaded.currentPhase || 1,
                    phaseStatus: loaded.phaseStatus || 'not_started',
                    lastUpdated: loaded.lastUpdated || new Date().toISOString(),
                    errors: loaded.errors || [],
                    metrics: loaded.metrics || this.getDefaultMetrics(),
                    rollbackPoints: loaded.rollbackPoints || [],
                    phaseHistory: loaded.phaseHistory || []
                };
            }
            else {
                this.status = {
                    currentPhase: 1,
                    phaseStatus: 'not_started',
                    lastUpdated: new Date().toISOString(),
                    errors: [],
                    metrics: this.getDefaultMetrics(),
                    rollbackPoints: [],
                    phaseHistory: []
                };
            }
        }
        catch (error) {
            console.error('Error loading migration status:', error);
            throw new Error('Failed to load migration status');
        }
    }
    save() {
        try {
            fs.writeFileSync(this.statusFile, JSON.stringify(this.status, null, 2));
        }
        catch (error) {
            console.error('Error saving migration status:', error);
            throw new Error('Failed to save migration status');
        }
    }
    getDefaultMetrics() {
        return {
            totalFiles: 0,
            jsFiles: 0,
            tsFiles: 0,
            convertedFiles: 0,
            typeErrors: 0,
            resolvedErrors: 0,
            coverage: 0,
            lastUpdated: new Date().toISOString()
        };
    }
    updatePhase(phase, status) {
        const now = new Date().toISOString();
        // Update phase history
        const currentPhaseHistory = this.status.phaseHistory.find(p => p.phase === this.status.currentPhase && !p.endTime);
        if (currentPhaseHistory && phase !== this.status.currentPhase) {
            currentPhaseHistory.endTime = now;
            currentPhaseHistory.status = 'completed';
        }
        if (phase !== this.status.currentPhase || status === 'in_progress') {
            this.status.phaseHistory.push({
                phase,
                startTime: now,
                status: status
            });
        }
        this.status.currentPhase = phase;
        this.status.phaseStatus = status;
        this.status.lastUpdated = now;
        this.save();
    }
    addError(fileName, errorType, message) {
        const error = {
            id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            phase: this.status.currentPhase,
            fileName,
            errorType,
            message,
            timestamp: new Date().toISOString(),
            resolved: false
        };
        this.status.errors.push(error);
        this.save();
        return error.id;
    }
    resolveError(errorId, resolution) {
        const error = this.status.errors.find(e => e.id === errorId);
        if (!error) {
            return false;
        }
        error.resolved = true;
        error.resolution = resolution;
        this.status.metrics.resolvedErrors++;
        this.save();
        return true;
    }
    updateMetrics(updates) {
        this.status.metrics = {
            ...this.status.metrics,
            ...updates,
            lastUpdated: new Date().toISOString()
        };
        // Calculate coverage if files are updated
        if (updates.convertedFiles !== undefined || updates.totalFiles !== undefined) {
            const converted = updates.convertedFiles ?? this.status.metrics.convertedFiles;
            const total = updates.totalFiles ?? this.status.metrics.totalFiles;
            this.status.metrics.coverage = total > 0 ? Math.round((converted / total) * 100) : 0;
        }
        this.save();
    }
    createRollbackPoint(gitCommit, description) {
        const rollbackPoint = {
            id: `rollback-${Date.now()}`,
            phase: this.status.currentPhase,
            timestamp: new Date().toISOString(),
            gitCommit,
            description,
            metrics: { ...this.status.metrics }
        };
        this.status.rollbackPoints.push(rollbackPoint);
        this.save();
        return rollbackPoint.id;
    }
    canProceedToPhase(targetPhase) {
        const reasons = [];
        const requirements = this.phaseRequirements[targetPhase];
        if (!requirements) {
            return { canProceed: true, reasons: [] };
        }
        // Check unresolved errors
        const unresolvedErrors = this.status.errors.filter(e => !e.resolved).length;
        if (requirements.maxUnresolvedErrors !== undefined && unresolvedErrors > requirements.maxUnresolvedErrors) {
            reasons.push(`Too many unresolved errors: ${unresolvedErrors} (max: ${requirements.maxUnresolvedErrors})`);
        }
        // Check coverage
        if (requirements.minCoverage !== undefined && this.status.metrics.coverage < requirements.minCoverage) {
            reasons.push(`Coverage too low: ${this.status.metrics.coverage}% (min: ${requirements.minCoverage}%)`);
        }
        // Check required files
        if (requirements.requiredFiles) {
            const missingFiles = requirements.requiredFiles.filter(file => !fs.existsSync(path.resolve(process.cwd(), file)));
            if (missingFiles.length > 0) {
                reasons.push(`Missing required files: ${missingFiles.join(', ')}`);
            }
        }
        // Custom validation
        if (requirements.customValidation && !requirements.customValidation(this.status)) {
            reasons.push('Custom validation failed');
        }
        return {
            canProceed: reasons.length === 0,
            reasons
        };
    }
    getStatus() {
        return { ...this.status };
    }
    getUnresolvedErrors() {
        return this.status.errors.filter(e => !e.resolved);
    }
    getErrorsByPhase(phase) {
        return this.status.errors.filter(e => e.phase === phase);
    }
    getLatestRollbackPoint() {
        return this.status.rollbackPoints[this.status.rollbackPoints.length - 1];
    }
}
exports.MigrationTracker = MigrationTracker;
// Export for use in other scripts
exports.default = MigrationTracker;
