from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import json
import os

app = Flask(__name__)
CORS(app)

# Load the latest model
def load_model():
    """Load the latest trained model and scaler"""
    try:
        with open('models/latest_model_info.json', 'r') as f:
            model_info = json.load(f)
        
        # Load model
        with open(model_info['model_path'], 'rb') as f:
            model = pickle.load(f)
        
        # Load scaler
        with open(model_info['scaler_path'], 'rb') as f:
            scaler = pickle.load(f)
        
        # Load feature names
        feature_names = model_info['feature_names']
        
        print(f"✅ Loaded model from {model_info['timestamp']}")
        return model, scaler, feature_names
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return None, None, None

# Load model on startup
model, scaler, feature_names = load_model()

@app.route('/api/predict', methods=['POST'])
def predict():
    """Predict if a signature is genuine or forgery"""
    try:
        data = request.json
        
        # Extract metrics from stored and current signatures
        stored_metrics = data['stored_features']
        current_metrics = data['current_features']
        username = data.get('username', 'unknown')
        
        # Calculate differences as features
        features = []
        for feature_name in feature_names:
            stored_val = stored_metrics.get(feature_name, 0)
            current_val = current_metrics.get(feature_name, 0)
            
            # Absolute difference
            diff = abs(current_val - stored_val)
            
            # Relative difference (percentage)
            if stored_val != 0:
                rel_diff = abs((current_val - stored_val) / stored_val)
            else:
                rel_diff = 1.0 if current_val != 0 else 0.0
            
            # Use relative difference for continuous features, absolute for counts
            if feature_name in ['stroke_count', 'total_points']:
                features.append(diff)
            else:
                features.append(rel_diff)
        
        # Normalize features
        features_array = np.array(features).reshape(1, -1)
        features_scaled = scaler.transform(features_array)
        
        # Predict
        prediction = model.predict(features_scaled)[0]
        probability = model.predict_proba(features_scaled)[0]
        
        # Convert to confidence score (0-100)
        # If prediction is 1 (genuine), use the probability of genuine class
        # If prediction is 0 (forgery), use 1 - probability of forgery class
        if prediction == 1:
            confidence_score = probability[1] * 100
        else:
            confidence_score = (1 - probability[0]) * 100
        
        # Log for debugging
        print(f"ML Prediction for {username}:")
        print(f"  Prediction: {'Genuine' if prediction == 1 else 'Forgery'}")
        print(f"  Confidence: {confidence_score:.1f}%")
        print(f"  Probabilities: Forgery={probability[0]:.3f}, Genuine={probability[1]:.3f}")
        
        return jsonify({
            'success': True,
            'prediction': int(prediction),
            'confidence_score': float(confidence_score),
            'is_genuine': bool(prediction == 1),
            'probabilities': {
                'forgery': float(probability[0]),
                'genuine': float(probability[1])
            }
        })
        
    except Exception as e:
        print(f"Error in prediction: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'confidence_score': 0
        }), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'feature_count': len(feature_names) if feature_names else 0
    })

@app.route('/api/reload-model', methods=['POST'])
def reload_model():
    """Reload the latest model (useful after retraining)"""
    global model, scaler, feature_names
    model, scaler, feature_names = load_model()
    
    return jsonify({
        'success': model is not None,
        'message': 'Model reloaded' if model else 'Failed to reload model'
    })

if __name__ == '__main__':
    port = int(os.environ.get('ML_PORT', 5002))
    print(f"🚀 ML API Server starting on http://localhost:{port}")
    print("Available endpoints:")
    print("  POST /api/predict - Get signature prediction")
    print("  GET  /api/health - Health check")
    print("  POST /api/reload-model - Reload latest model")
    app.run(host='0.0.0.0', port=port, debug=True)