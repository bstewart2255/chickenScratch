# Fix for Low Shape Scores During Authentication

## Problem
Shape scores during authentication (27%, 32%, 27%) are much lower than expected baseline scores (97%, 87%, 85%).

## Root Cause
The authentication endpoint is likely using the wrong comparison method for shapes. It's probably comparing shapes as if they were signatures instead of using shape-specific metrics.

## Solution
In the `/login` endpoint, the shape comparison needs to use aspect ratio and shape-specific metrics instead of the ML signature comparison.

### Current Code (lines 833-877 in server.js):
```javascript
// Verify each provided shape
if (shapes.circle && storedShapes.circle) {
    console.log('Comparing circle shape...');
    const circleScore = await compareSignatures(
        storedShapes.circle.data.data, 
        shapes.circle.data,
        storedShapes.circle.metrics,
        shapes.circle.metrics || {},
        username
    );
    scores.circle = Math.round(circleScore);
    totalScore += circleScore;
    scoreCount++;
    console.log('✅ Circle shape score:', scores.circle);
}
```

### Fixed Code:
```javascript
// Verify each provided shape using shape-specific comparison
if (shapes.circle && storedShapes.circle) {
    console.log('Comparing circle shape...');
    // Use shape-specific comparison based on metrics
    const providedMetrics = shapes.circle.metrics || {};
    const storedMetrics = storedShapes.circle.metrics || {};
    
    // Compare aspect ratios for circle roundness
    const circleScore = calculateCircleRoundness(providedMetrics);
    
    // Alternative: compare the difference between stored and provided
    // const aspectDiff = Math.abs((providedMetrics.aspect_ratio || 1) - (storedMetrics.aspect_ratio || 1));
    // const circleScore = Math.max(0, 100 - aspectDiff * 100);
    
    scores.circle = Math.round(circleScore);
    totalScore += circleScore;
    scoreCount++;
    console.log('✅ Circle shape score:', scores.circle);
}
```

## Key Changes Needed:
1. Don't use `compareSignatures()` for shapes - it's designed for signature ML comparison
2. Use the shape-specific scoring functions (`calculateCircleRoundness`, etc.) on the PROVIDED shape metrics
3. This will give scores based on how well-formed the shape is, not how similar it is to the stored shape

## Expected Results After Fix:
- Circle scores should be ~97% (based on aspect ratio close to 1.0)
- Square scores should be ~87% (based on aspect ratio)
- Triangle scores should be ~85% (based on velocity consistency)