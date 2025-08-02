# 3. Migration State Management

## **Migration State Tracking System**

Create and maintain a migration state file to prevent context drift between AI sessions:

```json
// .migration-status.json
{
  "version": "2.0",
  "startDate": "",
  "lastUpdated": "",
  "currentPhase": "pre-migration",
  "phases": {
    "preMigration": {
      "status": "pending",
      "startTime": null,
      "endTime": null,
      "validation": {
        "dataConsistency": null,
        "schemaVersion": null,
        "issues": []
      }
    },
    "infrastructure": {
      "status": "pending",
      "startTime": null,
      "endTime": null,
      "tasks": {
        "dependencies": false,
        "tsconfig": false,
        "buildScripts": false,
        "eslint": false
      }
    },
    "types": {
      "status": "pending",
      "startTime": null,
      "endTime": null,
      "files": {
        "core": [],
        "api": [],
        "database": [],
        "validation": []
      }
    },
    "backend": {
      "status": "pending",
      "startTime": null,
      "endTime": null,
      "migratedFiles": [],
      "pendingFiles": [],
      "failedFiles": []
    },
    "frontend": {
      "status": "pending",
      "startTime": null,
      "endTime": null,
      "migratedFiles": [],
      "pendingFiles": [],
      "failedFiles": []
    },
    "testing": {
      "status": "pending",
      "startTime": null,
      "endTime": null,
      "unitTests": false,
      "integrationTests": false,
      "e2eTests": false,
      "performanceTests": false
    },
    "deployment": {
      "status": "pending",
      "startTime": null,
      "endTime": null,
      "stagingDeployed": false,
      "productionDeployed": false,
      "rollbackTested": false
    }
  },
  "rollbackPoints": [],
  "errors": [],
  "metrics": {
    "filesConverted": 0,
    "totalFiles": 0,
    "typeErrors": 0,
    "testCoverage": 0,
    "buildTime": 0,
    "performanceBaseline": {}
  }
}
```

## **State Tracking Class**

```typescript
// scripts/MigrationTracker.ts
interface PhaseStatus {
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime: string | null;
  endTime: string | null;
  [key: string]: any;
}

interface MigrationMetrics {
  filesConverted: number;
  totalFiles: number;
  typeErrors: number;
  testCoverage: number;
  buildTime: number;
  performanceBaseline: Record<string, any>;
}

export class MigrationTracker {
  private statusFile: string;
  private status: any;

  constructor(statusFile: string = '.migration-status.json') {
    this.statusFile = statusFile;
    this.loadStatus();
  }

  private loadStatus(): void {
    if (fs.existsSync(this.statusFile)) {
      this.status = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
    } else {
      throw new Error(`Migration status file not found. Run pre-migration validation first.`);
    }
  }

  public saveStatus(): void {
    this.status.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.statusFile, JSON.stringify(this.status, null, 2));
  }

  public updatePhase(phase: string, updates: Partial<PhaseStatus>): void {
    if (!this.status.phases[phase]) {
      throw new Error(`Unknown phase: ${phase}`);
    }
    
    this.status.phases[phase] = {
      ...this.status.phases[phase],
      ...updates
    };
    
    if (updates.status === 'in-progress' && !this.status.phases[phase].startTime) {
      this.status.phases[phase].startTime = new Date().toISOString();
    }
    
    if (updates.status === 'completed' || updates.status === 'failed') {
      this.status.phases[phase].endTime = new Date().toISOString();
    }
    
    this.status.currentPhase = phase;
    this.saveStatus();
  }

  public addError(phase: string, file: string, error: string): void {
    this.status.errors.push({
      phase,
      file,
      error,
      timestamp: new Date().toISOString(),
      resolved: false
    });
    this.saveStatus();
  }

  public createRollbackPoint(phase: string, description: string): void {
    const gitCommit = require('child_process')
      .execSync('git rev-parse HEAD')
      .toString()
      .trim();
    
    this.status.rollbackPoints.push({
      phase,
      timestamp: new Date().toISOString(),
      gitCommit,
      description
    });
    this.saveStatus();
  }

  public updateMetrics(metrics: Partial<MigrationMetrics>): void {
    this.status.metrics = {
      ...this.status.metrics,
      ...metrics
    };
    this.saveStatus();
  }

  public canProceedToPhase(phase: string): boolean {
    const phaseOrder = [
      'preMigration',
      'infrastructure',
      'types',
      'backend',
      'frontend',
      'testing',
      'deployment'
    ];
    
    const currentIndex = phaseOrder.indexOf(this.status.currentPhase);
    const targetIndex = phaseOrder.indexOf(phase);
    
    if (targetIndex <= currentIndex + 1) {
      const previousPhase = phaseOrder[targetIndex - 1];
      return !previousPhase || this.status.phases[previousPhase].status === 'completed';
    }
    
    return false;
  }

  public getCurrentPhase(): string {
    return this.status.currentPhase;
  }

  public isPhaseComplete(phase: string): boolean {
    return this.status.phases[phase]?.status === 'completed';
  }
}
```