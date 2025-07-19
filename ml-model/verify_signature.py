import tensorflow as tf
import numpy as np
import pickle
import json
import os
import glob
from collect_signature_data import SignatureDataCollector

class SignatureVerifier:
    """
    Uses the trained ML model to verify signatures
    """
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.collector = SignatureDataCollector()
        self.load_latest_model()
    
    def load_latest_model(self):
        """Load the most recently trained model"""
        
        # Find the latest model file
        model_files = glob.glob('models/signature_model_*.h5')
        if not model_files:
            raise Exception("No trained model found! Please run train_model.py first.")
        
        latest_model = sorted(model_files)[-1]
        # Extract timestamp from filename like 'models/signature_model_20250718_201827.h5'
        timestamp = '_'.join(latest_model.split('_')[-2:])[:-3]  # Remove .h5
        
        print(f"Loading model from {latest_model}")
        
        # Load the model
        self.model = tf.keras.models.load_model(latest_model)
        
        # Load the scaler
        scaler_path = f'models/scaler_{timestamp}.pkl'
        with open(scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        
        # Load feature names
        features_path = f'models/features_{timestamp}.json'
        with open(features_path, 'r') as f:
            self.feature_names = json.load(f)
        
        print("✅ Model loaded successfully!")
    
    def _flatten_features(self, features_dict):
        """
        Convert the nested feature dictionary into a flat list of numbers
        This is like turning a complex description into a series of measurements
        """
        flat_features = []
        
        # Basic stats
        basic = features_dict.get('basic_stats', {})
        flat_features.extend([
            basic.get('stroke_count', 0),
            basic.get('total_points', 0),
            basic.get('total_duration_ms', 0),
            basic.get('average_points_per_stroke', 0)
        ])
        
        # Velocity features
        velocity = features_dict.get('velocity_features', {})
        flat_features.extend([
            velocity.get('average_velocity', 0),
            velocity.get('max_velocity', 0),
            velocity.get('min_velocity', 0),
            velocity.get('velocity_std', 0)
        ])
        
        # Shape features
        shape = features_dict.get('shape_features', {})
        flat_features.extend([
            shape.get('width', 0),
            shape.get('height', 0),
            shape.get('area', 0),
            shape.get('aspect_ratio', 0),
            shape.get('center_x', 0),
            shape.get('center_y', 0)
        ])
        
        # Stroke features
        stroke = features_dict.get('stroke_features', {})
        flat_features.extend([
            stroke.get('average_stroke_length', 0),
            stroke.get('total_length', 0),
            stroke.get('length_variation', 0),
            stroke.get('average_stroke_duration', 0),
            stroke.get('duration_variation', 0)
        ])
        
        # Replace any None values with 0
        flat_features = [0 if x is None else x for x in flat_features]
        
        return flat_features
    
    def verify_signature(self, signature_data, claimed_user_id):
        """
        Verify if a signature is genuine or a forgery
        Returns: (is_genuine, confidence_score, analysis)
        """
        
        # Process the signature to extract features
        features = self.collector.process_signature(signature_data)
        
        # Flatten features (same as in training)
        flat_features = self._flatten_features(features)
        
        # Ensure we have the right number of features
        if len(flat_features) != len(self.feature_names):
            # Pad or truncate to match expected features
            if len(flat_features) < len(self.feature_names):
                flat_features.extend([0] * (len(self.feature_names) - len(flat_features)))
            else:
                flat_features = flat_features[:len(self.feature_names)]
        
        # Convert to numpy array and reshape
        X = np.array([flat_features])
        
        # Normalize using the same scaler from training
        X_scaled = self.scaler.transform(X)
        
        # Get prediction
        prediction = self.model.predict(X_scaled, verbose=0)[0][0]
        
        # Convert to percentage
        confidence = prediction * 100
        is_genuine = prediction > 0.5
        
        # Create analysis
        analysis = {
            'is_genuine': is_genuine,
            'confidence': float(confidence),
            'threshold': 50.0,
            'features': {
                name: float(value) for name, value in zip(self.feature_names[:len(flat_features)], flat_features)
            },
            'verdict': 'GENUINE' if is_genuine else 'FORGERY DETECTED'
        }
        
        return is_genuine, confidence, analysis
    
    def verify_from_file(self, filepath):
        """Verify a signature from a saved JSON file"""
        
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        user_id = data['user_id']
        signature_data = data['raw_data']
        actual_type = data['type']
        
        print(f"\n🔍 Verifying signature for user: {user_id}")
        print(f"Actual type: {actual_type}")
        
        is_genuine, confidence, analysis = self.verify_signature(signature_data, user_id)
        
        print(f"\n📊 ML Verdict: {analysis['verdict']}")
        print(f"Confidence: {confidence:.2f}%")
        print(f"Threshold: {analysis['threshold']}%")
        
        # Check if prediction matches reality
        if actual_type == 'genuine' and is_genuine:
            print("✅ Correctly identified as GENUINE")
        elif actual_type == 'forgery' and not is_genuine:
            print("✅ Correctly identified as FORGERY")
        else:
            print("❌ Incorrect prediction")
        
        return analysis


def test_all_signatures():
    """Test the model on all saved signatures"""
    
    verifier = SignatureVerifier()
    
    # Get all signature files
    files = glob.glob('data/signature_data_*.json')
    
    correct = 0
    total = 0
    
    print("\n" + "="*50)
    print("Testing all signatures...")
    print("="*50)
    
    for file in files:
        try:
            with open(file, 'r') as f:
                data = json.load(f)
            
            user_id = data['user_id']
            actual_type = data['type']
            
            is_genuine, confidence, _ = verifier.verify_signature(data['raw_data'], user_id)
            predicted_type = 'genuine' if is_genuine else 'forgery'
            
            # Check if correct
            is_correct = (actual_type == predicted_type)
            if is_correct:
                correct += 1
            
            total += 1
            
            # Print result
            symbol = "✓" if is_correct else "✗"
            print(f"{symbol} {user_id:20} | Actual: {actual_type:7} | Predicted: {predicted_type:7} | Confidence: {confidence:5.1f}%")
            
        except Exception as e:
            print(f"Error processing {file}: {e}")
    
    accuracy = (correct / total * 100) if total > 0 else 0
    print(f"\n📊 Overall Accuracy: {accuracy:.1f}% ({correct}/{total} correct)")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Verify a specific file
        verifier = SignatureVerifier()
        verifier.verify_from_file(sys.argv[1])
    else:
        # Test all signatures
        test_all_signatures()