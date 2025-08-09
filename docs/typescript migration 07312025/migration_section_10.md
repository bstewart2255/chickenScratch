# 10. AI Execution Guidelines

## **10.1 Context Management & Session Continuity**

### **Migration State Persistence**
Every AI session must begin by checking and loading the migration state:

```bash
# Required first command in every session
node scripts/show-migration-status.js
```

**Critical Rules:**
1. **NEVER** assume knowledge of previous sessions
2. **ALWAYS** check `.migration-status.json` before making changes
3. **VERIFY** current phase completion before proceeding
4. **UPDATE** migration status after every significant change

### **Session Handoff Protocol**
```typescript
// Session handoff information that must be communicated
interface SessionHandoff {
  currentPhase: string;
  completedTasks: string[];
  pendingTasks: string[];
  knownIssues: string[];
  nextSteps: string[];
  rollbackPoints: string[];
  criticalDecisions: Array<{
    decision: string;
    rationale: string;
    alternatives: string[];
  }>;
}
```

## **10.2 Safety-First Execution Principles**

### **Before Every Major Change**
```bash
# 1. Create rollback point
git add .
git commit -m "Pre-change checkpoint: [description]"
git tag checkpoint-$(date +%Y%m%d-%H%M%S)

# 2. Update migration status
node scripts/update-migration-status.js "Starting [task description]"

# 3. Run validation
npm run type-check || echo "Type errors exist - proceed with caution"
npm test || echo "Tests failing - investigate before proceeding"
```

### **After Every Major Change**
```bash
# 1. Verify functionality
npm run build
npm test
curl -f http://localhost:3000/api/health

# 2. Update status
node scripts/update-migration-status.js "Completed [task description]"

# 3. Document changes
echo "$(date): [Change description] - Status: [success/failed]" >> migration.log
```

## **10.3 Phase-Specific Guidelines**

### **Phase 0: Pre-Migration Validation**
**AI Must:**
- Run complete validation script
- Fix ALL identified issues before proceeding
- Document baseline performance metrics
- Create comprehensive backup

**AI Must NOT:**
- Skip validation even if "minor" issues
- Proceed with known data inconsistencies
- Assume database schema is correct

```bash
# Required validation sequence
node pre-migration-validator.js
# Only proceed if output shows "✅ READY"

# Fix any issues found
node backend/fix-data-inconsistencies.js
node backend/verify-migrations.js

# Create backup
bash scripts/create-migration-backup.sh
```

### **Phase 1: Infrastructure Setup**
**AI Must:**
- Use EXACT version numbers specified in plan
- Test build process after each configuration change
- Verify gradual migration settings work

**AI Must NOT:**
- Update to "latest" versions of packages
- Enable strict mode initially
- Skip build verification

```bash
# Required after infrastructure changes
npm ci  # Never npm install
npm run build
npm run type-check  # Should pass even with allowJs: true
```

### **Phase 2: Type Definitions**
**AI Must:**
- Create types that match existing runtime behavior exactly
- Include legacy data format support
- Test type definitions with real data

**AI Must NOT:**
- Make types stricter than current runtime behavior
- Remove null/undefined possibilities that exist in practice
- Create types that break existing functionality

```typescript
// Good: Matches runtime behavior
interface StrokeData {
  points: Point[];
  minX: number | undefined;  // Can be undefined in legacy data
  maxX: number | undefined;
  // ...
}

// Bad: Stricter than runtime
interface StrokeData {
  points: Point[];
  minX: number;  // Runtime has undefined values
  maxX: number;
  // ...
}
```

### **Phase 3-4: Backend & Frontend Migration**
**AI Must:**
- Migrate one service/module at a time
- Maintain backward compatibility during transition
- Test each migrated component thoroughly

**Migration Order (MUST follow this sequence):**
1. Data conversion utilities first
2. Core services (BiometricEngine, DatabaseService)
3. API controllers
4. Middleware
5. Frontend modules

```bash
# After each file migration
npm run build
npm run type-check:strict  # For migrated files only
npm test -- --testNamePattern="[ModuleName]"
```

## **10.4 Error Handling Protocols**

### **When TypeScript Compilation Fails**
```bash
# 1. Don't ignore - investigate immediately
npm run type-check 2>&1 | tee type-errors.log

# 2. Fix errors one by one, not in bulk
# Start with the first error only

# 3. If stuck, rollback the problematic change
git reset --hard HEAD~1

# 4. Try a different approach
```

### **When Tests Fail After Migration**
```bash
# 1. Identify root cause
npm test -- --verbose 2>&1 | tee test-failures.log

# 2. Don't disable tests - fix the underlying issue
# 3. Check if it's a type issue vs logic issue

# 4. If critical, rollback and reassess
git reset --hard [last-working-commit]
```

### **When Performance Degrades**
```bash
# 1. Measure impact
node scripts/performance-comparison.js

# 2. If >20% degradation, investigate immediately
# 3. If >50% degradation, consider rollback

# 4. Profile the specific issue
npm run profile  # If available
```

## **10.5 Decision-Making Framework**

### **When to Proceed vs. Rollback**

| Situation | Proceed If | Rollback If |
|-----------|------------|-------------|
| Type errors | <5 errors, all minor | >10 errors, any critical |
| Test failures | <10% of tests, no core functionality | >10% of tests, core features broken |
| Performance regression | <10% impact | >20% impact |
| Build failures | Fixable in <30 minutes | Complex issues, >1 hour to fix |
| Runtime errors | Development only | Any production impact |

### **Complex Decision Points**

**Data Format Conversion:**
- ✅ Proceed: If converter handles all existing formats
- ❌ Rollback: If any data loss or corruption risk

**ML Algorithm Migration:**
- ✅ Proceed: If accuracy within 2% of baseline
- ❌ Rollback: If accuracy drops >5%

**API Breaking Changes:**
- ✅ Proceed: If all clients can handle both old/new formats
- ❌ Rollback: If any breaking changes to external API

## **10.6 Communication Protocols**

### **Status Updates (Required)**
Every AI session must provide:

```markdown
## Session Status Report

**Current Phase:** [phase name]
**Session Duration:** [time spent]
**Tasks Completed:**
- [specific task 1]
- [specific task 2]

**Tasks Started but Incomplete:**
- [task with current status]

**Issues Encountered:**
- [issue 1 with resolution]
- [issue 2 - still investigating]

**Next Session Should:**
1. [specific first task]
2. [specific second task]

**Critical Decisions Made:**
- [decision 1: rationale]
- [decision 2: alternatives considered]

**Rollback Points Available:**
- [git tag 1]: [description]
- [git tag 2]: [description]
```

### **Escalation Triggers**
AI must escalate (ask for human input) when:

1. **Data Loss Risk:** Any operation that could lose user data
2. **Breaking Changes:** Changes that could break existing functionality
3. **Performance Critical:** >20% performance impact
4. **Complex Decisions:** Multiple valid approaches with trade-offs
5. **Migration Stuck:** Unable to proceed for >2 hours of work

## **10.7 Code Quality Standards**

### **TypeScript Migration Quality Gates**

**Every migrated file must:**
- [ ] Compile without errors in strict mode
- [ ] Have explicit return types for all functions
- [ ] Use proper interfaces instead of `any`
- [ ] Include JSDoc comments for public methods
- [ ] Pass existing tests
- [ ] Maintain backward compatibility

### **Code Review Checklist**
```typescript
// ✅ Good TypeScript Migration
export class BiometricEngine {
  /**
   * Extract features from stroke data
   * @param strokeData - Raw stroke data
   * @param options - Extraction options
   * @returns Promise of extracted features
   */
  public async extractFeatures(
    strokeData: StrokeData,
    options: FeatureExtractionOptions = {}
  ): Promise<BiometricFeatures> {
    // Implementation
  }
}

// ❌ Poor TypeScript Migration
export class BiometricEngine {
  public async extractFeatures(data: any, opts?: any): Promise<any> {
    // Implementation
  }
}
```

## **10.8 Testing Requirements**

### **Required Tests for Each Phase**

**Phase 1: Infrastructure**
```bash
npm run build          # Must succeed
npm run type-check     # Must pass
npm run lint          # Must pass
```

**Phase 2: Types**
```bash
npm run type-check:strict  # For type files only
node -e "console.log(require('./src/types/core/biometric').StrokeData)"  # Must not error
```

**Phase 3-4: Implementation**
```bash
npm test                    # All existing tests must pass
npm run test:integration    # If available
curl localhost:3000/api/health  # Must return 200
```

### **Performance Testing**
```bash
# Before migration
node scripts/benchmark.js > baseline.json

# After migration
node scripts/benchmark.js > migrated.json
node scripts/compare-performance.js baseline.json migrated.json
```

## **10.9 Documentation Standards**

### **Required Documentation Updates**
For every migrated component:

1. **Type Documentation**
   ```typescript
   /**
    * Represents biometric stroke data
    * @interface StrokeData
    * @property {Point[]} points - Array of coordinate points
    * @property {number} minX - Minimum X coordinate
    */
   ```

2. **Migration Notes**
   ```typescript
   /**
    * MIGRATION NOTE: This function previously accepted string|object
    * Now requires StrokeData interface. Legacy string format is
    * automatically converted via DataFormatConverter.
    * 
    * Breaking changes: None (backward compatible)
    * Performance impact: +5ms average (acceptable)
    */
   ```

3. **Usage Examples**
   ```typescript
   /**
    * @example
    * ```typescript
    * const engine = new BiometricEngine();
    * const features = await engine.extractFeatures(strokeData);
    * ```
    */
   ```

## **10.10 Final Validation Checklist**

Before marking any phase complete, AI must verify:

### **Technical Validation**
- [ ] All code compiles without errors
- [ ] All tests pass
- [ ] Performance within acceptable range
- [ ] Memory usage stable
- [ ] No data corruption

### **Functional Validation**
- [ ] All existing features work
- [ ] API endpoints return correct responses
- [ ] Frontend functionality intact
- [ ] Database operations successful

### **Process Validation**
- [ ] Migration status updated
- [ ] Documentation complete
- [ ] Rollback points created
- [ ] Next phase prerequisites met

**Only mark phase complete after ALL validations pass.**