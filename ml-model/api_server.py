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

if __name__ == '__main__':
    print("Starting ML API Server on http://localhost:5000")
    print("Ready to receive signature data!")
    app.run(debug=True, port=5001, host='0.0.0.0')