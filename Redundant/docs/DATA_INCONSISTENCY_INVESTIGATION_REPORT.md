# Data Collection Investigation: Signature vs Shape Data Inconsistencies

**INVESTIGATION REPORT**  
*Date: January 2025*  
*Scope: Comprehensive analysis of data inconsistencies between signature and shape data*

## Executive Summary

This investigation reveals significant data inconsistencies between signature and shape data collection, storage, and processing systems. The issues stem from different data storage formats, coordinate processing methods, and metric calculation approaches that have evolved over time through multiple migrations.

## Key Findings

### 1. Data Format Storage Inconsistency

**Issue**: Shapes show `data_format: base64` while containing JSONB stroke data, while signatures correctly show `data_format: stroke_data`.

**Root Cause**: 
- **Shapes**: All 115 shape records use `data_format: base64` despite containing JSONB stroke data in `shape_data.raw`
- **Signatures**: 91 records use `data_format: stroke_data`, 1 record uses `data_format: base64`
- **Timeline**: Shapes were created from July 19-26, 2025, while signatures migrated to stroke_data format starting July 21, 2025

**Impact**: 
- Shapes are incorrectly labeled as base64 format
- This affects data retrieval logic that checks `data_format` field
- Potential for data processing errors in ML pipeline

**Evidence**:
```sql
-- Data format distribution
shapes: base64 - 115 records (Jul 19-26, 2025)
signatures: stroke_data - 91 records (Jul 21-26, 2025)  
signatures: base64 - 1 record (Jul 19, 2025)
```

### 2. Pressure Data Capture Inconsistency

**Issue**: Both signatures and shapes show pressure data in raw coordinates, but pressure metrics are not being calculated or stored.

**Root Cause**:
- **Raw Data**: Both signatures and shapes capture pressure data (0.5 for signatures, 0 for shapes)
- **Metrics**: Neither table has pressure_variation metrics stored (0/92 signatures, 0/115 shapes)
- **Processing**: Frontend captures pressure but backend doesn't calculate pressure metrics

**Evidence**:
```javascript
// Signature raw data shows pressure: 0.5
{"x":60,"y":26.28125,"time":1753133237407,"pressure":0.5}

// Shape raw data shows pressure: 0  
{"x":289,"y":77,"time":1753564210348,"pressure":0}
```

**Impact**: 
- Loss of valuable pressure variation data for ML features
- Inconsistent pressure capture between signatures and shapes
- Missing biometric pressure patterns

### 3. Coordinate Precision Inconsistency

**Issue**: Signatures use sub-pixel precision while shapes use integer coordinates.

**Root Cause**:
- **Signatures**: Use SignaturePad library with high DPI support, resulting in sub-pixel coordinates
- **Shapes**: Use different drawing implementation with integer coordinate rounding
- **Canvas Scaling**: Different scaling factors applied during capture

**Evidence**:
```javascript
// Signature coordinates (sub-pixel precision)
{"x":60,"y":26.28125,"time":1753133237407,"pressure":0.5}

// Shape coordinates (integer precision)  
{"x":289,"y":77,"time":1753564210348,"pressure":0}
```

**Impact**:
- Inconsistent coordinate precision affects spatial accuracy
- Different measurement scales for ML feature extraction
- Potential accuracy degradation in authentication

### 4. Center Point Calculation Error

**Issue**: Calculated center points are outside the actual coordinate ranges.

**Root Cause**:
- **Coordinate Transformation**: Coordinates are transformed/scaled before center calculation
- **Bounding Box Calculation**: Uses transformed coordinates instead of raw coordinates
- **Scaling Factor**: Different scaling applied to shapes vs signatures

**Evidence**:
```javascript
// Actual coordinate range: 247 to 402 (X), 50 to 201 (Y)
// Calculated center should be: (324.5, 125.5)
// Actual stored center: (108.16666666666666, 41.833333333333336)
// ❌ ISSUE: Center X (108.17) is outside X range (247-402)
```

**Impact**:
- Incorrect spatial metrics for ML model training
- Inaccurate bounding box calculations
- Compromised authentication accuracy

### 5. Storage Schema Evolution Issues

**Issue**: Multiple storage implementations running simultaneously with different data formats.

**Root Cause**:
- **Migration History**: Database evolved from base64 to stroke_data format
- **Incomplete Migration**: Shapes were not migrated to stroke_data format
- **Dual Storage**: Both `signature_data` and `stroke_data` columns used simultaneously

**Evidence**:
```sql
-- Migration timeline
Jul 19, 2025: Initial data with base64 format
Jul 21, 2025: Signatures migrated to stroke_data format  
Jul 19-26, 2025: Shapes remain in base64 format despite having stroke data
```

**Impact**:
- Data retrieval complexity
- Inconsistent storage patterns
- Potential data loss during format transitions

### 6. Drawing Tool Configuration Differences

**Issue**: Signatures and shapes use different drawing tool configurations.

**Root Cause**:
- **Signatures**: Use SignaturePad library with specific configuration
- **Shapes**: Use different drawing implementation
- **Parameters**: Different `maxWidth`, `minWidth`, `velocityFilterWeight` settings

**Evidence**:
```javascript
// Signature configuration (from index.html)
signaturePad = new SignaturePad(canvas, {
    backgroundColor: 'rgba(255,255,255,0)',
    penColor: 'rgb(0, 0, 0)',
    minWidth: 2,
    maxWidth: 4,
    velocityFilterWeight: 0.7,
    throttle: 16,
    minDistance: 2,
});

// Shape configuration: Different implementation
// (No equivalent configuration found in codebase)
```

**Impact**:
- Inconsistent stroke rendering
- Different velocity calculations
- Varied drawing quality and characteristics

## Data Quality Assessment

### Quantified Impact

| Issue | Affected Records | Severity | ML Impact |
|-------|------------------|----------|-----------|
| Data Format Mismatch | 115 shapes | High | High |
| Pressure Data Loss | 207 total | Medium | Medium |
| Coordinate Precision | All shapes | Medium | Medium |
| Center Point Errors | Multiple shapes | High | High |
| Storage Inconsistency | 207 total | High | High |

### Pattern Analysis

**Systematic Issues**:
- All shapes have incorrect data_format labeling
- All records lack pressure variation metrics
- All shapes use integer coordinate precision

**Intermittent Issues**:
- Center point calculation errors (affects specific shapes)
- Mixed data format usage in signatures (1 base64, 91 stroke_data)

## Timeline Correlation

### Code Deployment Correlation

1. **July 19, 2025**: Initial deployment with base64 storage
2. **July 21, 2025**: Signature migration to stroke_data format
3. **July 19-26, 2025**: Shapes continue using base64 format despite having stroke data

### Data Migration Issues

- **Incomplete Migration**: Shapes table not updated during stroke_data migration
- **Dual Storage**: Both old and new storage methods active simultaneously
- **Format Inconsistency**: data_format field not updated for shapes

## Root Cause Analysis

### Primary Causes

1. **Incomplete Database Migration**: The migration script only updated signatures table, not shapes table
2. **Different Drawing Implementations**: Signatures and shapes use different frontend drawing libraries
3. **Inconsistent Metric Calculation**: Pressure and spatial metrics calculated differently
4. **Coordinate Transformation Issues**: Different scaling factors applied to shapes vs signatures

### Secondary Causes

1. **Lack of Data Validation**: No validation checks for data format consistency
2. **Missing Pressure Processing**: Backend doesn't calculate pressure variation metrics
3. **Inconsistent Configuration**: Different drawing tool parameters for signatures vs shapes

## Impact Assessment

### ML Model Training Impact

**High Impact**:
- Incorrect center point calculations affect spatial feature extraction
- Data format inconsistencies may cause processing errors
- Missing pressure data reduces biometric feature set

**Medium Impact**:
- Coordinate precision differences affect measurement accuracy
- Drawing tool configuration differences affect stroke characteristics

### Authentication Accuracy Impact

**High Impact**:
- Center point errors affect spatial matching algorithms
- Data format inconsistencies may cause comparison failures

**Medium Impact**:
- Missing pressure patterns reduce authentication security
- Coordinate precision differences affect matching accuracy

## Recommendations

### Immediate Actions (No Code Changes)

1. **Data Audit**: Complete audit of all data format inconsistencies
2. **Impact Assessment**: Quantify ML model performance impact
3. **Validation Framework**: Design data validation checks

### Future Remediation Planning

1. **Complete Migration**: Migrate shapes to stroke_data format
2. **Unified Drawing Implementation**: Standardize drawing tools across signatures and shapes
3. **Pressure Metric Implementation**: Add pressure variation calculation to backend
4. **Coordinate Standardization**: Implement consistent coordinate processing
5. **Data Validation**: Add validation checks for data format consistency

## Conclusion

The investigation reveals systematic data inconsistencies between signature and shape data collection systems. These issues stem from incomplete database migrations, different drawing implementations, and inconsistent metric calculations. The impact on ML model training and authentication accuracy is significant, particularly for center point calculations and data format inconsistencies.

The issues are primarily systematic rather than intermittent, indicating the need for comprehensive remediation rather than isolated fixes. A complete data migration and standardization effort is recommended to ensure consistent data quality across all drawing types. 