from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from datetime import datetime
from collect_signature_data import SignatureDataCollector

# Create Flask app
app = Flask(__name__)
CORS(app)  # Allow requests from your frontend

# Create our signature collector
collector = SignatureDataCollector()

@app.route('/api/collect-signature', methods=['POST'])
def collect_signature():
    """
    Endpoint to receive signature data from the frontend
    """
    try:
        data = request.json
        user_id = data.get('userId', 'unknown')
        signature_type = data.get('type', 'genuine')
        
        # Transform frontend data to match our expected format
        signature_data = {
            'strokes': []
        }
        
        # Convert the signature pad data
        if 'signaturePadData' in data:
            for stroke in data['signaturePadData']:
                stroke_data = {
                    'points': [],
                    'startTime': stroke.get('startTime', 0),
                    'endTime': stroke.get('endTime', 0)
                }
                
                # Add points with timestamps
                for i, point in enumerate(stroke.get('points', [])):
                    stroke_data['points'].append({
                        'x': point.get('x', 0),
                        'y': point.get('y', 0),
                        'time': point.get('time', i * 10)  # Estimate time if not provided
                    })
                
                signature_data['strokes'].append(stroke_data)
        
        # Save and process the signature
        features = collector.save_signature(signature_data, user_id, signature_type)
        
        return jsonify({
            'success': True,
            'message': 'Signature collected successfully',
            'features': features
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze-user', methods=['GET'])
def analyze_user():
    """
    Get consistency analysis for a user
    """
    user_id = request.args.get('userId')
    if not user_id:
        return jsonify({'error': 'userId parameter required'}), 400
    
    analysis = collector.analyze_consistency(user_id)
    return jsonify(analysis)

@app.route('/api/verify-ml', methods=['POST'])
def verify_with_ml():
    """Use ML model to verify a signature"""
    try:
        from verify_signature import SignatureVerifier
        
        data = request.json
        signature_data = data.get('signatureData')
        user_id = data.get('userId')
        
        verifier = SignatureVerifier()
        is_genuine, confidence, analysis = verifier.verify_signature(
            signature_data, user_id
        )
        
        return jsonify({
            'success': True,
            'is_genuine': is_genuine,
            'confidence': confidence,
            'analysis': analysis
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Simple health check endpoint
    """
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    """Get aggregated statistics for ML dashboard"""
    try:
        import os
        import glob
        
        # Get time period from query params
        period = request.args.get('period', 'today')
        
        # Count users (unique user IDs from saved signatures)
        data_files = glob.glob('data/signature_data_*.json')
        user_ids = set()
        genuine_count = 0
        forgery_count = 0
        
        for file in data_files:
            # Extract user ID from filename
            filename = os.path.basename(file)
            parts = filename.replace('signature_data_', '').replace('.json', '').split('_')
            user_id = parts[0]
            user_ids.add(user_id)
            
            # Count genuine vs forgery
            if 'forger' in filename.lower():
                forgery_count += 1
            else:
                genuine_count += 1
        
        # Calculate model performance (simulated for now)
        # In production, load actual model metrics
        model_accuracy = 92.3  # You can load this from model training logs
        false_positive_rate = 2.1
        
        # Get recent activity (simulated)
        recent_activity = []
        if os.path.exists('models/features_20250718_201827.json'):
            recent_activity.append({
                'time': '2 min ago',
                'user': 'alice',
                'type': 'genuine',
                'confidence': 94.2,
                'status': 'success',
                'device': 'ML API'
            })
        
        stats = {
            'totalUsers': len(user_ids),
            'modelAccuracy': model_accuracy,
            'authAttempts': 156,  # This would come from a database in production
            'falsePositiveRate': false_positive_rate,
            'genuineSamples': genuine_count,
            'forgerySamples': forgery_count,
            'avgSamplesPerUser': genuine_count // max(len(user_ids), 1),
            'performanceHistory': {
                'labels': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                'accuracy': [89.2, 90.5, 91.1, 90.8, 91.9, 92.1, 92.3],
                'falsePositives': [3.2, 2.8, 2.5, 2.7, 2.3, 2.2, 2.1]
            },
            'recentActivity': recent_activity
        }
        
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/feature-importance', methods=['GET'])
def get_feature_importance():
    """Get feature importance from the trained model"""
    try:
        import os
        
        # Load feature names from saved model
        if os.path.exists('models/features_20250718_201827.json'):
            with open('models/features_20250718_201827.json', 'r') as f:
                features_info = json.load(f)
                feature_names = features_info.get('feature_names', [])
        else:
            # Default feature names if model not found
            feature_names = [
                'total_strokes', 'total_duration', 'avg_stroke_duration',
                'total_points', 'avg_points_per_stroke', 'avg_velocity',
                'max_velocity', 'velocity_std', 'total_distance',
                'avg_stroke_length', 'width', 'height', 'area',
                'aspect_ratio', 'avg_pressure'
            ]
        
        # Simulated importance scores (in production, extract from model)
        importance_scores = {
            'total_strokes': 0.85,
            'avg_velocity': 0.78,
            'total_duration': 0.72,
            'area': 0.65,
            'avg_pressure': 0.60,
            'velocity_std': 0.55,
            'aspect_ratio': 0.50,
            'avg_stroke_duration': 0.45,
            'total_points': 0.40,
            'avg_stroke_length': 0.35
        }
        
        # Get top features
        top_features = []
        for feature in feature_names[:10]:
            if feature in importance_scores:
                top_features.append({
                    'name': feature.replace('_', ' ').title(),
                    'importance': importance_scores.get(feature, 0.5) * 100
                })
        
        return jsonify({
            'features': top_features,
            'total_features': len(feature_names)
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/user-metrics/<user_id>', methods=['GET'])
def get_user_metrics(user_id):
    """Get specific user's signature consistency metrics"""
    try:
        # Analyze user's signature consistency
        analysis = collector.analyze_consistency(user_id)
        
        # Add additional metrics
        metrics = {
            'userId': user_id,
            'sampleCount': analysis.get('sample_count', 0),
            'consistency': analysis.get('consistency_score', 0),
            'avgDuration': analysis.get('avg_duration', 0),
            'avgStrokes': analysis.get('avg_strokes', 0),
            'variability': {
                'duration': analysis.get('duration_std', 0),
                'strokes': analysis.get('stroke_count_std', 0),
                'velocity': analysis.get('velocity_std', 0)
            },
            'lastSeen': datetime.now().isoformat(),
            'status': 'active' if analysis.get('sample_count', 0) >= 3 else 'needs_training'
        }
        
        return jsonify(metrics)
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'userId': user_id
        }), 500

@app.route('/api/ml-stats', methods=['GET'])
def get_ml_stats():
    """Get ML model statistics and performance metrics"""
    try:
        import os
        import glob
        
        # Find the latest model file
        model_files = glob.glob('models/signature_model_*.h5')
        
        if model_files:
            # Get the latest model file
            latest_model = max(model_files, key=os.path.getctime)
            model_date = os.path.basename(latest_model).split('_')[2].split('.')[0]
            
            # Format the date
            formatted_date = f"{model_date[:4]}-{model_date[4:6]}-{model_date[6:]}"
            
            # Load saved features info if available
            features_file = latest_model.replace('.h5', '.json').replace('signature_model', 'features')
            if os.path.exists(features_file):
                with open(features_file, 'r') as f:
                    features_info = json.load(f)
                    # Extract model metrics if saved
                    model_accuracy = features_info.get('model_accuracy', 92.3)
                    false_positive_rate = features_info.get('false_positive_rate', 2.1)
            else:
                # Default values
                model_accuracy = 92.3
                false_positive_rate = 2.1
            
            return jsonify({
                'modelAccuracy': model_accuracy,
                'falsePositiveRate': false_positive_rate,
                'lastTrainingDate': formatted_date,
                'modelFile': os.path.basename(latest_model),
                'totalFeatures': 15  # Number of features used in the model
            })
        else:
            return jsonify({
                'error': 'No trained model found',
                'modelAccuracy': 0,
                'falsePositiveRate': 0,
                'lastTrainingDate': None
            })
            
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/retrain-model', methods=['POST'])
def retrain_model():
    """Trigger model retraining"""
    try:
        # In a real implementation, this would trigger the training process
        # For now, we'll simulate it
        return jsonify({
            'success': True,
            'message': 'Model retraining initiated',
            'estimatedTime': '2-3 minutes'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("Starting ML API Server on http://localhost:5000")
    print("Ready to receive signature data!")
    app.run(debug=True, port=5001, host='0.0.0.0')