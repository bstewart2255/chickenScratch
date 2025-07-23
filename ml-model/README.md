# Signature Authentication ML System

This directory contains the machine learning components for signature authentication.

## Overview

The ML system uses a Random Forest classifier to determine if a signature is genuine or a potential forgery by comparing biometric features like velocity, shape, and timing patterns.

## Quick Start

### 1. Train the Model

First time setup or retraining with new data:

```bash
./retrain_model.sh
```

This script will:
- Export latest signature data from the database
- Train a new Random Forest model
- Save the model artifacts to the `models/` directory
- Display training accuracy

### 2. Start the ML API Server

```bash
./start_ml_server.sh
```

The ML API server runs on http://localhost:5002 and provides:
- `POST /api/predict` - Get authenticity prediction for a signature
- `GET /api/health` - Check if model is loaded
- `POST /api/reload-model` - Reload latest model after retraining

### 3. Backend Integration

The backend automatically uses the ML API when available. If the ML server is offline, it falls back to rule-based scoring.

## Model Details

### Features Used (19 total)
- **Basic Stats**: stroke_count, total_points, total_duration_ms, avg_points_per_stroke
- **Velocity Features**: avg_velocity, max_velocity, min_velocity, velocity_std
- **Shape Features**: width, height, area, aspect_ratio, center_x, center_y
- **Stroke Features**: avg_stroke_length, total_length, length_variation, avg_stroke_duration, duration_variation

### Training Data Format
The model expects signatures in this format:
```json
{
  "user_id": "username",
  "type": "genuine" | "forgery",
  "features": {
    "basic_stats": {...},
    "velocity_features": {...},
    "shape_features": {...},
    "stroke_features": {...}
  }
}
```

### Model Performance
- Current accuracy: ~75% (varies with training data)
- Minimum samples needed: 10
- Recommended: 50+ samples with mix of genuine and forgery attempts

## Files

- `train_model_sklearn.py` - Main training script using scikit-learn
- `ml_api_server.py` - Flask API server for predictions
- `exportMLDataForTraining.js` - Exports data from database
- `retrain_model.sh` - Automated retraining pipeline
- `start_ml_server.sh` - Start the ML API server
- `models/` - Saved model artifacts
- `data/` - Training data exported from database

## Manual Training

If you need more control:

```bash
# 1. Export data from database
cd ../backend
node exportMLDataForTraining.js

# 2. Train model
cd ../ml-model
python3 train_model_sklearn.py

# 3. Start server
python3 ml_api_server.py
```

## Deployment

For production deployment:

1. Set the ML_API_URL environment variable in your backend:
   ```
   ML_API_URL=http://your-ml-server:5000
   ```

2. Run the ML server as a service or in a container

3. Set up a cron job for periodic retraining:
   ```cron
   0 2 * * * cd /path/to/ml-model && ./retrain_model.sh
   ```

## Troubleshooting

### "No module named 'numpy'"
Install dependencies: `pip3 install numpy scikit-learn flask flask-cors`

### "No trained model found!"
Run `./retrain_model.sh` to train your first model

### ML predictions not being used
1. Check ML server is running: `curl http://localhost:5002/api/health`
2. Check backend logs for "ML API Response" messages
3. Ensure ML_API_URL is set correctly in backend environment