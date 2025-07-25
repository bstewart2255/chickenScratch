# ML Training Data Cleanup and Retraining Guide

This guide walks you through cleaning corrupted training data and retraining your signature authentication ML model.

## Overview

The ML model was performing poorly because:
1. Many training samples had all features set to 0 (corrupted data)
2. Failed authentication attempts without proper metrics were labeled as "forgeries"
3. The classification logic wasn't accurately distinguishing genuine vs forgery samples

## Step-by-Step Instructions

### Step 1: Clean Existing Training Data

First, remove corrupted samples from your existing training data:

```bash
cd backend
node clean_training_data.js
```

This script will:
- Scan all JSON files in `ml-model/data/`
- Create a backup in `ml-model/data/backup_YYYY-MM-DD/`
- Remove samples where >70% of features are zero/null
- Provide detailed statistics about corruption rates

**Expected output:**
```
=== ML Training Data Cleanup ===
Processing genuine_signatures.json...
  ✅ Wrote 45 clean samples (removed 23 corrupted)
Processing forgery_signatures.json...
  ✅ Wrote 12 clean samples (removed 38 corrupted)
```

### Step 2: Export Fresh Training Data

Generate new, high-quality training data from your database:

```bash
cd backend
node improved_exportMLDataForTraining.js
```

This creates:
- `ml-model/data/genuine_signatures_improved.json` - Clean genuine samples
- `ml-model/data/forgery_signatures_improved.json` - Clean forgery samples
- `ml-model/data/skipped_samples_report.json` - Report of invalid samples

**Classification logic:**
- First 3 signatures per user = "genuine" (enrollment)
- Failed auth attempts (with valid metrics) = "forgery"
- Successful auth attempts = "genuine"

### Step 3: Prepare Final Training Data

Replace old training files with the cleaned data:

```bash
cd backend
node prepare_final_training_data.js
```

This will:
- Backup existing `genuine_signatures.json` and `forgery_signatures.json`
- Replace them with the improved versions
- Create `all_signatures.json` (combined and shuffled)

### Step 4: Retrain the ML Model

```bash
cd ml-model
./retrain_model.sh
```

Or if the script isn't executable:

```bash
cd ml-model
python train_model.py
```

### Step 5: Deploy the New Model

The retrained model will be saved as `signature_model.pkl`. Your backend will automatically use the new model for authentication.

## Validation Checklist

After retraining, verify:

- [ ] Training data has <10% corrupted samples
- [ ] Genuine/forgery samples have valid metrics
- [ ] Class balance is reasonable (not >80% of one class)
- [ ] Model accuracy improved on test set
- [ ] Legitimate users can authenticate successfully

## Data Quality Standards

The scripts enforce these quality standards:

**Required metrics:**
- `stroke_count > 0 and < 50`
- `total_points > 0`
- `total_duration_ms > 0 and < 60000`
- `avg_velocity > 0 and < 10`
- `width > 0 and height > 0`

**Feature structure:**
```json
{
  "user_id": "username",
  "timestamp": 1234567890,
  "type": "genuine|forgery",
  "features": {
    "basic_stats": { ... },
    "velocity_features": { ... },
    "shape_features": { ... },
    "stroke_features": { ... }
  }
}
```

## Troubleshooting

### "No JSON files found"
- Ensure `ml-model/data/` directory exists
- Check that training files have `.json` extension

### "Very few forgery samples"
- Failed authentication attempts need valid metrics to be useful
- Consider having test users attempt authentication with wrong signatures

### "Class imbalance detected"
- Collect more samples of the minority class
- Consider data augmentation techniques

### Model still performing poorly
1. Check the skip report for why samples were excluded
2. Ensure users are drawing consistently during enrollment
3. Consider adjusting the authentication threshold (currently 70%)

## Monitoring Model Performance

After retraining:

1. Test with known users - they should authenticate >70% confidence
2. Test with wrong signatures - should score <50% confidence
3. Monitor the ML dashboard for real-world performance
4. Check `skipped_samples_report.json` for data quality issues

## Next Steps

1. Set up automated retraining pipeline
2. Implement model versioning
3. Add A/B testing for model updates
4. Create model performance monitoring dashboard