#!/bin/bash

echo "🔄 Retraining ML Model with Latest Data"
echo "========================================"
echo ""

# Get the directory of this script
DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$DIR/../backend"

# Step 1: Export latest data from database
echo "📊 Step 1: Exporting latest signature data from database..."
cd "$BACKEND_DIR"
node exportMLDataForTraining.js

# Check if export was successful
if [ $? -ne 0 ]; then
    echo "❌ Failed to export data from database"
    exit 1
fi

# Step 2: Train the model
echo ""
echo "🧠 Step 2: Training ML model..."
cd "$DIR"
python3 train_model_sklearn.py

# Check if training was successful
if [ $? -ne 0 ]; then
    echo "❌ Failed to train model"
    exit 1
fi

# Step 3: Reload model if ML server is running
echo ""
echo "🔄 Step 3: Reloading model in ML API server (if running)..."
curl -X POST http://localhost:5000/api/reload-model 2>/dev/null

echo ""
echo "✅ Model retraining complete!"
echo ""
echo "Next steps:"
echo "1. If ML server isn't running: ./start_ml_server.sh"
echo "2. The backend will automatically use the new model"