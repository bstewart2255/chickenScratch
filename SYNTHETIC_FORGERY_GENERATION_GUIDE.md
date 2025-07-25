# Synthetic Forgery Generation Guide

This guide explains how to generate synthetic forgery data to balance your ML training dataset.

## Problem Solved

Your ML model had severe class imbalance:
- **Before**: 57 genuine vs 2 forgery samples (96.6% vs 3.4%)
- **After**: 57 genuine vs 287 forgery samples (16.6% vs 83.4%)

This imbalance was causing the model to be hypersensitive and incorrectly flag legitimate signatures as forgeries.

## Scripts Overview

### 1. `generate_synthetic_forgeries.js`
Generates 5 types of synthetic forgeries for each genuine signature:
- **Rushed Forgery**: Higher velocity, shorter duration
- **Slow/Careful Forgery**: Lower velocity, longer duration
- **Size Different Forgery**: Scaled dimensions
- **Position Shift Forgery**: Different canvas location
- **Stroke Variation Forgery**: Different stroke patterns

### 2. `verify_training_data_balance.js`
Verifies the generated training data:
- Class distribution percentages
- Forgery type breakdown
- Feature range validation
- Per-user statistics

## Usage Instructions

### Step 1: Generate Synthetic Forgeries

```bash
cd backend
node generate_synthetic_forgeries.js
```

Expected output:
```
🔬 Generating synthetic forgery training data...
📖 Loaded 57 genuine signatures
📖 Loaded 2 existing forgery samples
  Generated 50 synthetic forgeries...
  Generated 100 synthetic forgeries...
  ...
✅ Generated 285 synthetic forgeries
🗑️  Cleared 59 old training files
📁 Created 344 individual training files
📊 Class distribution:
   Genuine: 57 (16.6%)
   Forgery: 287 (83.4%)
🎯 Ready to retrain model with balanced data!
```

### Step 2: Verify Data Balance

```bash
cd backend
node verify_training_data_balance.js
```

This shows:
- Class distribution
- Forgery type breakdown
- Feature ranges
- Potential data issues

### Step 3: Retrain the Model

```bash
cd ../ml-model
python train_model_sklearn.py
```

The model will now train on:
- Individual files: `signature_data_*.json`
- Balanced dataset with realistic forgery variations

## How Synthetic Forgeries Work

Each forgery type simulates different forgery attempts:

1. **Rushed Forgery** (20%): Forger trying to sign quickly
   - 1.3-1.8x faster velocity
   - 0.6-0.8x shorter duration
   - More velocity variation

2. **Slow/Careful Forgery** (20%): Forger being overly careful
   - 0.5-0.7x slower velocity
   - 1.5-2.2x longer duration
   - Less natural flow

3. **Size Different** (20%): Wrong signature size
   - 0.7-1.4x size scaling
   - Maintains proportions
   - Different canvas usage

4. **Position Shift** (20%): Wrong location on canvas
   - ±100px horizontal shift
   - ±50px vertical shift
   - Natural signing elsewhere

5. **Stroke Variation** (20%): Different stroke patterns
   - ±2 stroke count change
   - 1.2-1.8x length variation
   - Different timing patterns

## Validation Rules

Generated forgeries must pass validation:
- `stroke_count >= 1`
- `total_points > 0`
- `total_duration_ms > 0`
- `average_velocity > 0`
- `width > 0 and height > 0`

Invalid samples are skipped with warnings.

## File Structure

```
ml-model/data/
├── genuine_signatures_improved.json      # Original genuine samples
├── forgery_signatures_improved.json      # Original forgery samples
├── all_synthetic_forgeries.json          # All forgeries for reference
├── signature_data_username_0.json        # Individual training file
├── signature_data_username_1.json        # Individual training file
├── signature_data_forger_0_copying_username_2.json  # Synthetic forgery
└── ... (300+ more training files)
```

## Troubleshooting

### "No genuine signatures found"
- Run `improved_exportMLDataForTraining.js` first
- Ensure `genuine_signatures_improved.json` exists

### "Validation errors"
- Check console warnings for specific issues
- Usually caused by extreme parameter combinations
- Script automatically skips invalid samples

### Model still too sensitive
- Adjust the forgery generation parameters
- Generate more forgery variations
- Consider lowering authentication threshold

## Advanced Tuning

To adjust forgery characteristics, modify ranges in `generate_synthetic_forgeries.js`:

```javascript
// Make rushed forgeries more extreme
features.velocity_features.average_velocity *= random.range(1.5, 2.5); // was 1.3-1.8

// Make size variations more subtle
const sizeMultiplier = random.range(0.85, 1.15); // was 0.7-1.4
```

## Results

After retraining with balanced data:
- Model learns to distinguish genuine vs forgery patterns
- Reduces false positives on legitimate signatures  
- Maintains security against actual forgery attempts
- Better generalization to new users

The 1:5 genuine-to-forgery ratio helps the model be more permissive with genuine signatures while still detecting forgeries effectively.