# Stroke Data Migration Guide

## Overview

This guide helps you migrate from inefficient base64 image storage to efficient stroke data storage, reducing storage size by 90%+ while maintaining all functionality.

## Current Problem

- **Base64 images**: ~28-32KB each
- **Multiple images per user**: signatures, shapes, drawings
- **Performance issues**: slow queries, large database size
- **Inefficient for ML**: raw data is better for feature extraction

## Solution Benefits

- **90%+ storage reduction**: ~1-5KB vs 28-32KB per signature
- **Better ML performance**: raw data is perfect for feature extraction
- **Reconstructible**: can always generate images from stroke data
- **Searchable**: can query stroke patterns and characteristics
- **Future-proof**: easier to add new analysis features

## Implementation Steps

### 1. Database Migration

Run the migration script to add new columns:

```bash
cd backend
psql -d your_database -f migrate_to_stroke_data.sql
```

### 2. Update Backend Code

Modify your `server.js` to use the new stroke storage:

```javascript
const { storeSignatureWithStrokeData, getSignatureData } = require('./update_to_stroke_storage');

// Replace your existing signature storage with:
app.post('/api/signature', async (req, res) => {
    try {
        const { userId, signatureData, metrics } = req.body;
        
        const result = await storeSignatureWithStrokeData(userId, signatureData, metrics);
        
        res.json({
            success: true,
            signatureId: result.signatureId,
            dataFormat: result.dataFormat,
            size: result.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### 3. Migrate Existing Data

Run the migration script to convert existing base64 data:

```bash
cd backend
node update_to_stroke_storage.js
```

### 4. Update Frontend Display

Use the stroke-to-image utility for display:

```javascript
const { generateImageFromStrokes } = require('./stroke-to-image');

// When you need to display a signature:
app.get('/api/signature/:id/image', async (req, res) => {
    const signatureData = await getSignatureData(req.params.id);
    
    if (signatureData.type === 'stroke_data') {
        // Generate image from stroke data
        const imageData = generateImageFromStrokes(signatureData.data);
        res.json({ image: imageData });
    } else {
        // Return existing base64 data
        res.json({ image: signatureData.data });
    }
});
```

## Data Format Comparison

### Before (Base64)
```json
{
  "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "size": "32,768 bytes"
}
```

### After (Stroke Data)
```json
{
  "stroke_data": [
    {
      "points": [
        {"x": 100, "y": 100, "time": 0},
        {"x": 150, "y": 120, "time": 50},
        {"x": 200, "y": 130, "time": 100}
      ],
      "startTime": 0,
      "endTime": 100
    }
  ],
  "size": "1,024 bytes"
}
```

## Performance Improvements

### Storage
- **Before**: 32KB per signature
- **After**: 1-5KB per signature
- **Savings**: 90%+ reduction

### Query Performance
- **Before**: Large JSONB columns slow queries
- **After**: Smaller data, faster queries
- **Indexing**: Better GIN index performance

### ML Processing
- **Before**: Need to extract features from images
- **After**: Direct access to raw coordinates and timestamps
- **Accuracy**: Better feature extraction from raw data

## Backward Compatibility

The migration maintains backward compatibility:

1. **Existing base64 data**: Preserved during migration
2. **Fallback support**: System can handle both formats
3. **Gradual migration**: Convert data over time
4. **Display compatibility**: Images generated on-demand

## Advanced Features

### Compression Options

1. **JSON compression**: Use PostgreSQL LZ4 compression
2. **Binary format**: Convert to binary for maximum compression
3. **Delta encoding**: Store relative coordinates instead of absolute

### Caching Strategy

```javascript
// Cache generated images
const imageCache = new Map();

function getCachedImage(strokeData, options) {
    const key = JSON.stringify({ strokeData, options });
    
    if (imageCache.has(key)) {
        return imageCache.get(key);
    }
    
    const image = generateImageFromStrokes(strokeData, options);
    imageCache.set(key, image);
    
    return image;
}
```

### Analytics Integration

```javascript
// Extract analytics from stroke data
const metrics = extractStrokeMetrics(strokeData);
console.log('Signature metrics:', {
    strokeCount: metrics.strokeCount,
    totalPoints: metrics.totalPoints,
    totalLength: metrics.totalLength,
    area: metrics.area
});
```

## Monitoring and Validation

### Size Monitoring
```sql
-- Monitor storage savings
SELECT 
    data_format,
    COUNT(*) as count,
    AVG(LENGTH(stroke_data::text)) as avg_stroke_size,
    AVG(LENGTH(signature_data::text)) as avg_base64_size
FROM signatures 
GROUP BY data_format;
```

### Performance Monitoring
```sql
-- Monitor query performance
EXPLAIN ANALYZE 
SELECT * FROM signatures 
WHERE stroke_data @> '{"strokes": [{"points": [{"x": 100}]}]}';
```

## Troubleshooting

### Common Issues

1. **Missing stroke data**: Check if raw data is being captured
2. **Migration errors**: Verify JSON format compatibility
3. **Display issues**: Ensure stroke-to-image utility is working
4. **Performance**: Monitor query performance after migration

### Debug Commands

```bash
# Check migration status
psql -d your_database -c "SELECT data_format, COUNT(*) FROM signatures GROUP BY data_format;"

# Test stroke extraction
node -e "const { extractStrokeData } = require('./update_to_stroke_storage'); console.log(extractStrokeData(your_test_data));"

# Generate test image
node -e "const { generateImageFromStrokes } = require('./stroke-to-image'); console.log(generateImageFromStrokes(test_stroke_data));"
```

## Next Steps

1. **Run migration**: Execute the database migration
2. **Update backend**: Modify server.js to use stroke storage
3. **Migrate data**: Convert existing base64 data
4. **Update frontend**: Modify display logic
5. **Monitor performance**: Track storage and query improvements
6. **Optimize further**: Consider binary format for maximum efficiency

## Support

If you encounter issues during migration:

1. Check the migration logs for errors
2. Verify database connectivity
3. Test with a small subset of data first
4. Ensure all dependencies are installed
5. Review the troubleshooting section above 