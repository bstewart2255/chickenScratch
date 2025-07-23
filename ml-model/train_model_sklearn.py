import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report
import json
import os
import glob
import pickle
from datetime import datetime

class SignatureMLModel:
    """
    ML model for signature authentication using Random Forest
    """
    
    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.feature_names = []
        
    def load_training_data(self):
        """Load all signature data from exported JSON files"""
        print("Loading signature data...")
        
        all_features = []
        all_labels = []
        all_users = []
        
        # Find all JSON files in the data directory
        data_files = glob.glob('data/signature_data_*.json')
        
        print(f"Found {len(data_files)} signature files")
        
        for file_path in data_files:
            with open(file_path, 'r') as f:
                data = json.load(f)
                
                # Extract features into a flat list of numbers
                features = self._flatten_features(data['features'])
                all_features.append(features)
                
                # Label: 1 for genuine, 0 for forgery
                label = 1 if data['type'] == 'genuine' else 0
                all_labels.append(label)
                
                # Keep track of which user this is
                all_users.append(data['user_id'])
        
        return np.array(all_features), np.array(all_labels), all_users
    
    def _flatten_features(self, features_dict):
        """Convert nested feature dictionary into flat list"""
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
        
        # Store feature names
        if not self.feature_names:
            self.feature_names = [
                'stroke_count', 'total_points', 'total_duration_ms', 'avg_points_per_stroke',
                'avg_velocity', 'max_velocity', 'min_velocity', 'velocity_std',
                'width', 'height', 'area', 'aspect_ratio', 'center_x', 'center_y',
                'avg_stroke_length', 'total_length', 'length_variation',
                'avg_stroke_duration', 'duration_variation'
            ]
        
        # Replace None with 0
        flat_features = [0 if x is None else x for x in flat_features]
        
        return flat_features
    
    def train(self):
        """Train the model on signature data"""
        # Load the data
        X, y, users = self.load_training_data()
        
        if len(X) < 10:
            print("\n⚠️  Warning: You need at least 10 signature samples to train the model.")
            print("Current samples:", len(X))
            return None, None
        
        print(f"\nTotal samples: {len(X)}")
        print(f"Genuine signatures: {sum(y)}")
        print(f"Potential forgeries: {len(y) - sum(y)}")
        print(f"Unique users: {len(set(users))}")
        
        # Normalize the features
        X_scaled = self.scaler.fit_transform(X)
        
        # Split into training and testing sets
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y
        )
        
        print(f"\nTraining samples: {len(X_train)}")
        print(f"Testing samples: {len(X_test)}")
        
        # Train the model
        print("\n🧠 Training Random Forest model...")
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"\n✅ Model trained successfully!")
        print(f"Test accuracy: {accuracy * 100:.2f}%")
        
        # Feature importance
        print("\n🔍 Feature Importance:")
        importances = self.model.feature_importances_
        for i, (feature, importance) in enumerate(sorted(
            zip(self.feature_names, importances),
            key=lambda x: x[1],
            reverse=True
        )[:5]):
            print(f"{i+1}. {feature}: {importance:.3f}")
        
        # Save the model
        self.save_model()
        
        return accuracy, self.model
    
    def save_model(self):
        """Save the trained model and scaler"""
        os.makedirs('models', exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save the model
        model_path = f'models/signature_model_{timestamp}.pkl'
        with open(model_path, 'wb') as f:
            pickle.dump(self.model, f)
        print(f"\n💾 Model saved to: {model_path}")
        
        # Save the scaler
        scaler_path = f'models/scaler_{timestamp}.pkl'
        with open(scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)
        print(f"Scaler saved to: {scaler_path}")
        
        # Save feature names
        feature_path = f'models/features_{timestamp}.json'
        with open(feature_path, 'w') as f:
            json.dump(self.feature_names, f)
        print(f"Feature names saved to: {feature_path}")
        
        # Save latest model paths for easy access
        latest_path = 'models/latest_model_info.json'
        with open(latest_path, 'w') as f:
            json.dump({
                'model_path': model_path,
                'scaler_path': scaler_path,
                'feature_path': feature_path,
                'timestamp': timestamp,
                'feature_names': self.feature_names
            }, f, indent=2)
        print(f"Latest model info saved to: {latest_path}")

if __name__ == "__main__":
    print("🚀 Signature ML Model Training (scikit-learn)")
    print("="*50)
    
    trainer = SignatureMLModel()
    accuracy, model = trainer.train()
    
    if model:
        print("\n✨ Training complete! Model is ready for use.")
        print("\nNext steps:")
        print("1. Run the ML API server: python ml_api_server.py")
        print("2. The backend will automatically use the ML model for authentication")