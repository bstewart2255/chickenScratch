#!/bin/bash

echo "🔍 Checking ML Server Status..."
echo "================================"

# Check if server is responding
if curl -s http://localhost:5002/api/health > /dev/null 2>&1; then
    response=$(curl -s http://localhost:5002/api/health)
    model_loaded=$(echo $response | python3 -c "import sys, json; print(json.load(sys.stdin)['model_loaded'])")
    feature_count=$(echo $response | python3 -c "import sys, json; print(json.load(sys.stdin)['feature_count'])")
    
    if [ "$model_loaded" = "True" ]; then
        echo "✅ ML Server Status: ACTIVE"
        echo "📊 Model: Loaded"
        echo "🔢 Features: $feature_count"
        echo ""
        echo "Full response:"
        echo $response | python3 -m json.tool
    else
        echo "⚠️  ML Server Status: RUNNING (Model not loaded)"
    fi
else
    echo "❌ ML Server Status: OFFLINE"
    echo ""
    echo "Start the server with:"
    echo "  cd ml-model"
    echo "  ./start_ml_server.sh"
fi

echo ""
echo "Quick commands:"
echo "  Test prediction: curl -X POST http://localhost:5002/api/predict -H 'Content-Type: application/json' -d '{...}'"
echo "  Reload model:    curl -X POST http://localhost:5002/api/reload-model"