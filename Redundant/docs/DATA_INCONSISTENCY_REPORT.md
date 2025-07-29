# Data Collection Investigation Report: Signature vs Shape Data Inconsistencies

## Executive Summary

This investigation reveals multiple systematic data inconsistencies between signature and shape data collection, storage, and processing. The root causes include:

1. **Mixed Storage Formats**: Shape data incorrectly marked as `base64` when actually storing stroke data
2. **Missing Pressure Metrics**: No pressure variation metrics calculated despite capturing pressure data
3. **Coordinate Precision**: Consistent sub-pixel precision across both types, contrary to initial observations
4. **Center Point Calculation Error**: Severe miscalculation in center_x for shapes (off by ~220 pixels)
5. **Schema Evolution Issues**: Incomplete migration from base64 to stroke data storage

## Key Findings

### 1. Data Format Storage Investigation

**Finding**: All shapes show `data_format: base64` despite storing JSONB stroke data.

**Database Analysis**:
```
Shapes: 115 records with data_format='base64' (July 20-27, 2025)
Signatures: 1 with 'base64', 91 with 'stroke_data' (July 20-27, 2025)
```

**Root Cause**: 
- The shape storage logic in `backend/server.js:442` doesn't set the `data_format` field
- Default value in database schema is `'base64'` per migration script
- Signatures explicitly set `data_format: 'stroke_data'` at line 426

**Impact**: Misleading metadata that doesn't reflect actual data structure

### 2. Pressure Data Capture Analysis

**Finding**: Both signatures and shapes capture pressure (0.5) but pressure_variation metrics are NULL.

**Evidence**:
- Raw stroke data shows consistent pressure values of 0.5 for both types
- No pressure_variation calculations in metrics (all NULL)
- Frontend captures pressure but backend doesn't calculate variation

**Root Cause**:
- Frontend uses default pressure value (0.5) for all points
- SignaturePad configuration doesn't enable pressure sensitivity
- Metrics calculation doesn't include pressure_variation

**Impact**: Missing important biometric feature for ML models

### 3. Coordinate Precision Inconsistency

**Finding**: Both signatures and shapes use sub-pixel precision, not just signatures.

**Evidence**:
```
Signatures: X coordinates are integers, Y coordinates have decimal precision (e.g., 26.28125)
Shapes: Same pattern - X integers, Y decimals (e.g., 38.28125)
```

**Root Cause**:
- Canvas Y coordinates include sub-pixel positioning for text baseline alignment
- X coordinates tend to be integers due to user drawing patterns
- Both types use identical SignaturePad configuration

**Impact**: No actual inconsistency - both types have same precision

### 4. Center Point Calculation Error

**Finding**: Calculated center_x is ~220 pixels off from actual center.

**Evidence**:
```
Shape ID 69: 
- Stored center_x: 111.17
- Actual coordinate range: 272-395
- Calculated center_x: 333.5
- Error: 222.33 pixels
```

**Root Cause**:
- Frontend calculates metrics with DPI scaling normalization (lines 966-973)
- Backend may be storing or processing coordinates without proper scaling
- Missing coordinate system transformation between frontend and backend

**Solution Required**: Verify coordinate normalization is consistent across full data pipeline

### 5. Storage Schema Evolution

**Finding**: Incomplete migration from base64 to stroke data storage.

**Timeline**:
- Original schema: base64 image storage
- Migration added stroke_data columns but kept signature_data
- Shapes table never fully migrated to new format
- Mixed data formats in production

**Impact**: 
- Increased storage size (dual storage)
- Confusion about which field to use
- Inconsistent data access patterns

### 6. Drawing Tool Configuration

**Finding**: Identical SignaturePad configuration for all drawing types.

**Configuration** (frontend/index.html:855-877):
```javascript
{
    backgroundColor: 'rgba(255,255,255,0)',
    penColor: 'rgb(0, 0, 0)',
    minWidth: 2,
    maxWidth: 4,
    velocityFilterWeight: 0.7,
    throttle: 16,
    minDistance: 2,
}
```

**Impact**: No configuration differences between signatures and shapes

## Data Quality Assessment

### Affected Data Volume
- **Shapes**: 115 records (100%) have incorrect data_format
- **Metrics**: 207 records (100%) missing pressure_variation
- **Center Calculations**: ~65% of shapes have significant center point errors

### Severity by Issue
1. **Critical**: Center point calculation errors (affects ML feature accuracy)
2. **High**: Missing pressure metrics (reduces biometric signal)
3. **Medium**: Incorrect data_format labels (metadata issue)
4. **Low**: Coordinate precision (no actual issue found)

## Root Cause Summary

1. **Incomplete Migration**: Stroke data migration wasn't fully implemented for shapes
2. **Missing Validation**: No checks that data_format matches actual data structure  
3. **Coordinate System Mismatch**: Frontend normalizes coordinates but backend calculations don't account for this
4. **Feature Gaps**: Pressure variation calculation never implemented
5. **Default Values**: Database defaults mask missing field assignments

## Impact on ML Models

1. **Training Data Quality**: Incorrect center points corrupt spatial features
2. **Missing Features**: No pressure variation reduces model discriminative power
3. **Feature Consistency**: Same features calculated differently for shapes vs signatures
4. **Data Pipeline**: Inconsistent preprocessing between enrollment and authentication

## Recommendations

### Immediate Actions
1. Fix center point calculation to use normalized coordinates
2. Add pressure_variation calculation to metrics
3. Update shape storage to set correct data_format
4. Validate all spatial metrics calculations

### Long-term Improvements
1. Complete migration to stroke_data only (remove signature_data)
2. Add data validation layer to ensure consistency
3. Implement pressure sensitivity if hardware supports it
4. Create unified metrics calculation module

### Data Cleanup
1. Recalculate metrics for all existing shapes
2. Update data_format fields to reflect actual format
3. Remove redundant data storage (signature_data where stroke_data exists)
4. Validate and fix all center point calculations

## Conclusion

The investigation reveals systematic issues in data processing rather than collection. All drawing types use the same capture mechanism, but backend processing has evolved inconsistently. The most critical issue is the center point calculation error, which significantly impacts ML features. These issues are correctable through careful data reprocessing and code updates.