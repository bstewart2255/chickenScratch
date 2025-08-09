## TypeScript Migration v2.0 - AI Engineer Context Setup

**CRITICAL: Read this entire context before proceeding with any migration prompt.**

### Project Overview
You are migrating a JavaScript-based Signature Authentication Prototype to TypeScript. This is a biometric authentication system that captures and analyzes signatures, shapes, and drawings using Canvas API. The system consists of:
- **Backend**: Node.js/Express API with PostgreSQL database
- **Frontend**: Vanilla JavaScript with Canvas API for biometric capture
- **Core Features**: Signature analysis, biometric feature extraction, ML-based authentication

### Migration Principles
1. **Safety First**: This is a production system. Every change must maintain backward compatibility.
2. **Incremental Approach**: Use `allowJs: true` initially. Migrate one file at a time.
3. **Test Everything**: Run tests after EVERY file conversion. No exceptions.
4. **Track Progress**: Update migration status after each action using the MigrationTracker.
5. **Performance Matters**: Monitor that response times stay within baseline + 10%.

### Critical Constraints
- **DO NOT** change business logic during conversion - only add types
- **DO NOT** use `any` type except as last resort with justification comment
- **DO NOT** proceed to next phase if current phase has errors
- **ALWAYS** create git commits after each successful file migration
- **ALWAYS** maintain the migration status file (`.migration-status.json`)

### File Structure
```
├── backend/
│   ├── server.js
│   ├── services/
│   │   ├── BiometricEngine.js
│   │   └── DatabaseService.js
│   └── controllers/
├── frontend/
│   ├── js/
│   │   ├── signatureCapture.js
│   │   ├── deviceCapability.js
│   │   └── apiClient.js
│   └── *.html
├── src/
│   ├── types/        (TypeScript types - to be created)
│   ├── utils/        (Shared utilities - to be created)
│   └── config/       (Configuration - to be created)
└── scripts/
    └── migration/    (Migration tools)
```

### Migration Phases
You will receive prompts for these phases in order:
1. Pre-Migration Validation
2. Migration Tracker Setup
3. TypeScript & ESLint Setup
4. Strict Compiler Profile
5. MigrationTracker Implementation
6. Type System Foundation
7. Configuration System
8. Shared Utilities
9. Backend Migration
10. Frontend Migration
11. Testing Suite
12. CI/CD Pipeline
13. Database Migrations
14. Build & Monitoring
15. Backup & Rollback
16. Enable Strict Mode
17. Final Validation

### Key Technologies
- **Runtime**: Node.js with Express
- **Database**: PostgreSQL with JSONB columns for biometric data
- **Validation**: Zod for runtime type validation
- **Testing**: Jest with ts-jest
- **Canvas**: HTML5 Canvas API for signature capture
- **Biometrics**: Pressure, timing, velocity, geometric features

### Enhanced Features
The system includes enhanced biometric features that must be preserved:
- Pressure dynamics (min, max, mean, variance)
- Timing patterns (pause detection, rhythm analysis)
- Geometric properties (angles, curvature, symmetry)
- Security indicators (anomaly scores, authenticity metrics)

### Database Considerations
- Tables use JSONB columns for storing complex biometric data
- `enhanced_features` column contains pre-calculated biometric metrics
- Maintain backward compatibility with existing data

### Performance Baselines
These must be maintained throughout migration:
- API response time: < 200ms average
- Authentication processing: < 500ms
- Feature extraction: < 100ms
- Memory usage: < 512MB

### Common Pitfalls to Avoid
1. **JSON.parse on JSONB**: Database already returns parsed objects
2. **Losing Canvas context types**: Must properly type all Canvas operations
3. **Breaking legacy data**: Support both old and new data formats
4. **Skipping tests**: Every change needs test verification
5. **Type assertion abuse**: Prefer proper typing over assertions

### Success Criteria
- Zero runtime errors
- All tests passing with ≥90% coverage
- Performance within baseline + 10%
- Strict TypeScript mode enabled
- No remaining JavaScript files in src/

### How to Use Migration Prompts
1. Each prompt is self-contained with clear success criteria
2. Complete ALL steps in a prompt before moving to next
3. If you encounter errors, fix them before proceeding
4. Update `.migration-status.json` after each action
5. Run `node scripts/show-migration-status.js` to verify progress

**Remember**: You're working on a production authentication system. Security and reliability are paramount. When in doubt, choose the safer approach.