#!/bin/bash

echo "🚀 Starting ML API Server..."
echo "Make sure you have trained a model first!"
echo ""

cd "$(dirname "$0")"

# Check if model exists
if [ ! -f "models/latest_model_info.json" ]; then
    echo "❌ No trained model found!"
    echo "Please run: python3 train_model_sklearn.py"
    exit 1
fi

# Install dependencies if needed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "📦 Installing Flask dependencies..."
    pip3 install flask flask-cors
fi

# Start the server
echo "✅ Starting server on http://localhost:5002"
python3 ml_api_server.py