import numpy as np
import tensorflow as tf
from tensorflow import keras
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import json
import os
import glob
from datetime import datetime

class SignatureMLModel:
    """
    This is our AI brain that learns to recognize signatures
    Think of it like teaching a very smart pattern matcher
    """
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()  # This normalizes our data
        self.feature_names = []
        
    def load_training_data(self):
        """
        Load all the signature data we've collected
        """
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
        
        # Store feature names for later reference
        if not self.feature_names:
            self.feature_names = [
                'stroke_count', 'total_points', 'total_duration_ms', 'avg_points_per_stroke',
                'avg_velocity', 'max_velocity', 'min_velocity', 'velocity_std',
                'width', 'height', 'area', 'aspect_ratio', 'center_x', 'center_y',
                'avg_stroke_length', 'total_length', 'length_variation',
                'avg_stroke_duration', 'duration_variation'
            ]
        
        # Replace any None values with 0
        flat_features = [0 if x is None else x for x in flat_features]
        
        return flat_features
    
    def create_model(self, input_shape):
        """
        Create our neural network
        This is like building a brain with layers of neurons
        """
        print(f"\nCreating neural network with {input_shape} input features...")
        
        model = keras.Sequential([
            # Input layer
            keras.layers.Dense(64, activation='relu', input_shape=(input_shape,)),
            keras.layers.Dropout(0.3),  # Prevents overfitting
            
            # Hidden layers
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dropout(0.3),
            
            keras.layers.Dense(16, activation='relu'),
            
            # Output layer
            keras.layers.Dense(1, activation='sigmoid')  # 0-1 output for genuine/forgery
        ])
        
        # Compile the model
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy']
        )
        
        self.model = model
        return model
    
    def train(self, epochs=50):
        """
        Train the model on our signature data
        """
        # Load the data
        X, y, users = self.load_training_data()
        
        if len(X) < 10:
            print("\n⚠️  Warning: You need at least 10 signature samples to train the model.")
            print("Current samples:", len(X))
            print("Please collect more signatures before training!")
            return
        
        print(f"\nTotal samples: {len(X)}")
        print(f"Genuine signatures: {sum(y)}")
        print(f"Forgeries: {len(y) - sum(y)}")
        print(f"Unique users: {len(set(users))}")
        
        # Normalize the features
        X_scaled = self.scaler.fit_transform(X)
        
        # Split into training and testing sets
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )
        
        print(f"\nTraining samples: {len(X_train)}")
        print(f"Testing samples: {len(X_test)}")
        
        # Create the model
        self.create_model(X.shape[1])
        
        # Train the model
        print("\n🧠 Training the neural network...")
        print("This might take a minute...\n")
        
        history = self.model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=32,
            validation_split=0.2,
            verbose=1
        )
        
        # Evaluate on test set
        print("\n📊 Evaluating model performance...")
        test_loss, test_accuracy = self.model.evaluate(X_test, y_test)
        
        print(f"\n✅ Model trained successfully!")
        print(f"Test accuracy: {test_accuracy * 100:.2f}%")
        
        # Save the model
        self.save_model()
        
        return history, test_accuracy
    
    def save_model(self):
        """
        Save the trained model and scaler
        """
        # Create models directory if it doesn't exist
        os.makedirs('models', exist_ok=True)
        
        # Save with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save the neural network
        model_path = f'models/signature_model_{timestamp}.h5'
        self.model.save(model_path)
        print(f"\n💾 Model saved to: {model_path}")
        
        # Save the scaler (we need this to normalize new signatures)
        import pickle
        scaler_path = f'models/scaler_{timestamp}.pkl'
        with open(scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)
        print(f"Scaler saved to: {scaler_path}")
        
        # Save feature names for reference
        feature_path = f'models/features_{timestamp}.json'
        with open(feature_path, 'w') as f:
            json.dump(self.feature_names, f)
        print(f"Feature names saved to: {feature_path}")
    
    def analyze_feature_importance(self, X, y):
        """
        See which features are most important for identifying signatures
        """
        from sklearn.ensemble import RandomForestClassifier
        
        print("\n🔍 Analyzing feature importance...")
        
        # Use a Random Forest to get feature importance
        rf = RandomForestClassifier(n_estimators=100, random_state=42)
        rf.fit(X, y)
        
        # Get feature importance
        importances = rf.feature_importances_
        
        # Sort features by importance
        feature_importance = sorted(
            zip(self.feature_names, importances),
            key=lambda x: x[1],
            reverse=True
        )
        
        print("\nMost important features for signature recognition:")
        for i, (feature, importance) in enumerate(feature_importance[:5]):
            print(f"{i+1}. {feature}: {importance:.3f}")
        
        return feature_importance


def collect_sample_data():
    """
    Helper function to create some sample forgery data for testing
    This simulates someone trying to copy a signature
    """
    from collect_signature_data import SignatureDataCollector
    
    collector = SignatureDataCollector()
    
    # Create some fake forgery attempts
    print("\n📝 Creating sample forgery data for testing...")
    
    # Forgery attempt 1: Too fast
    forgery1 = {
        'strokes': [
            {
                'points': [
                    {'x': 100, 'y': 100, 'time': 0},
                    {'x': 200, 'y': 150, 'time': 10},  # Very fast
                    {'x': 300, 'y': 100, 'time': 20}
                ],
                'startTime': 0,
                'endTime': 20
            }
        ]
    }
    collector.save_signature(forgery1, 'forger1', 'forgery')
    
    # Forgery attempt 2: Wrong size
    forgery2 = {
        'strokes': [
            {
                'points': [
                    {'x': 50, 'y': 50, 'time': 0},
                    {'x': 60, 'y': 55, 'time': 100},  # Very small
                    {'x': 70, 'y': 60, 'time': 200}
                ],
                'startTime': 0,
                'endTime': 200
            }
        ]
    }
    collector.save_signature(forgery2, 'forger2', 'forgery')
    
    print("Sample forgeries created!")


if __name__ == "__main__":
    print("🚀 Signature ML Model Training")
    print("="*50)
    
    # Create sample forgery data if needed
    response = input("\nDo you want to create sample forgery data? (y/n): ")
    if response.lower() == 'y':
        collect_sample_data()
    
    # Train the model
    trainer = SignatureMLModel()
    
    # Load data to check if we have enough
    X, y, users = trainer.load_training_data()
    
    if len(X) >= 10:
        # Analyze features
        trainer.analyze_feature_importance(X, y)
        
        # Train the model
        trainer.train(epochs=50)
    else:
        print("\n⚠️  Not enough data to train!")
        print(f"You have {len(X)} samples, but need at least 10.")
        print("\nPlease:")
        print("1. Register more users in your frontend")
        print("2. Create some forgery samples")
        print("3. Run this script again")