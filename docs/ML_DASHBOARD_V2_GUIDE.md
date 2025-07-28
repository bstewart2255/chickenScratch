# ML Dashboard V2 - Component-Level Analysis Guide

## Overview

The redesigned ML Dashboard provides comprehensive visibility into signature authentication performance at the component level. It analyzes signatures, shapes, and drawings individually to help understand why authentications succeed or fail.

## New Features Implemented

### 1. Drawing Verification System ✅
- **Backend**: `drawingVerification.js` - Complete drawing comparison algorithms
- **Database**: New `drawings` table to store user drawings
- **Scoring**: Individual scores for face, star, house, and connect-dots drawings

### 2. Component-Level API Endpoints ✅
- `/api/user/:username/detailed-analysis` - Comprehensive user analysis
- `/api/user/:username/component-performance/:type` - Component-specific metrics
- `/api/auth-attempt/:attemptId/breakdown` - Detailed attempt analysis
- `/api/model/training-status` - ML model health and training info
- `/api/analytics/device-performance` - Cross-device performance stats

### 3. New Dashboard UI ✅
- **File**: `ml-dashboard-v2.html`
- **Features**:
  - Visual signature/shape/drawing comparisons
  - Real-time component scoring breakdown
  - Device performance analytics
  - ML feature-level analysis
  - Historical trend charts

## Setup Instructions

### 1. Run Database Migrations

```bash
# Set your database URL
export DATABASE_URL="postgresql://username:password@host:port/database"

# Run migrations
node backend/run_migrations.js
```

This will create:
- `drawings` table for storing creative drawings
- `drawing_scores` column in `auth_attempts` table

### 2. Update Backend

The backend has been updated with:
- Drawing verification implementation in login endpoint
- Drawing storage in registration endpoint
- New API endpoints for dashboard

No additional setup needed - just restart your server.

### 3. Access New Dashboard

Open the new dashboard at:
```
http://localhost:3000/ml-dashboard-v2.html?username=YOUR_USERNAME
```

## Dashboard Components

### Header Section
- **User Info**: Username and enrollment date
- **Model Status**: Training status, data composition, last trained date

### Enrollment Baseline (Left Panel)
- **Signatures**: Visual display of 3 enrollment signatures with quality scores
- **Shapes**: Circle, square, triangle baseline drawings
- **Drawings**: Face, star, house, connect-dots baseline (if enrolled)
- **Device Info**: Enrollment device details

### Authentication Attempts (Right Panel)
- **Attempt Cards**: Clickable cards showing:
  - Timestamp and device info
  - Pass/fail status
  - Component scores breakdown
  - Overall confidence score
- **Filters**: Filter by result (all/success/failed) and device type

### Component Deep Dive (Bottom Section)
Appears when an attempt is selected:

#### Signature Analysis
- Side-by-side visual comparison (baseline vs attempt)
- 19 ML features with similarity bars
- Feature breakdown showing:
  - Stroke count, velocity, timing
  - Shape characteristics
  - Movement patterns

#### Shapes Analysis
- Individual shape comparisons
- Shape-specific metrics
- Visual overlays (coming soon)

#### Drawings Analysis
- Individual drawing scores
- Drawing-specific analysis
- Visual comparisons (coming soon)

### Analytics Section

#### Device Performance Table
- Success rate by device type
- Average scores
- Input method impact (touch vs mouse)

#### Score Trends Chart
- Historical authentication scores
- Pass/fail threshold line
- Trend visualization

#### Component Performance Chart
- Average scores by component type
- Identifies weak components

## Drawing Verification Algorithms

### Face Drawing
- Feature detection (eyes, nose, mouth)
- Symmetry analysis
- Component presence scoring

### Star Drawing
- Point count detection
- Symmetry measurement
- Ray angle consistency

### House Drawing
- Component detection (roof, door, windows)
- Proportion analysis
- Structure similarity

### Connect-Dots
- Path order comparison
- Connection efficiency
- Pattern accuracy

## Interpreting Results

### Score Classifications
- **High (70-100%)**: Green - Strong match
- **Medium (50-69%)**: Yellow - Acceptable match
- **Low (0-49%)**: Red - Poor match

### Quality Indicators
- **Signature Quality**: Based on complexity, duration, consistency
- **Device Performance**: Shows which devices work best for the user
- **Feature Similarity**: How closely attempt matches baseline

### Failure Analysis
1. Check which component failed (signature, shapes, drawings)
2. Review feature-level differences
3. Consider device impact
4. Look for patterns in failures

## Troubleshooting

### "No drawings enrolled"
- User registered before drawing system was implemented
- Re-register to include drawings

### Model Status Shows "No Model"
- ML model hasn't been trained yet
- Run the training scripts in `ml-model/` directory

### Missing Drawing Scores
- Drawing verification was just implemented
- New authentications will include drawing scores

## Future Enhancements

1. **Visual Overlays**: Overlay attempt drawings on baseline for direct comparison
2. **Shape-Specific Metrics**: Detailed shape analysis (roundness, corner accuracy)
3. **Real-time Updates**: WebSocket support for live dashboard updates
4. **Threshold Recommendations**: ML-based threshold adjustments per user
5. **Export Features**: Download analysis reports and visualizations

## API Response Examples

### Detailed Analysis Response
```json
{
  "user": {
    "id": 123,
    "username": "testuser",
    "enrolled_at": "2024-07-15T10:30:00Z"
  },
  "enrollment": {
    "signatures": [...],
    "shapes": [...],
    "drawings": [...]
  },
  "baseline": {
    "stroke_count": 7.5,
    "avg_velocity": 125.3,
    ...
  },
  "authAttempts": [...],
  "devicePerformance": [...]
}
```

### Drawing Scores in Auth Attempts
```json
{
  "drawing_scores": {
    "face": 78,
    "star": 65,
    "house": 84,
    "connect_dots": 61
  }
}
```

## Security Considerations

- All endpoints require valid user authentication
- Drawing data is stored encrypted in JSONB columns
- No PII is exposed in the dashboard
- API rate limiting should be implemented for production

## Performance Notes

- Dashboard loads last 50 authentication attempts
- Charts use client-side rendering for responsiveness
- Large signature data is compressed for storage
- Caching implemented for model status endpoint