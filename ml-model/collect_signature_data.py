import json
import numpy as np
from datetime import datetime
import os

class SignatureDataCollector:
    """
    This class helps us collect and analyze signature data
    Think of it as a very detailed recorder that captures not just 
    what your signature looks like, but HOW you draw it
    """
    
    def __init__(self):
        self.signatures = []
        
    def process_signature(self, signature_data):
        """
        Takes raw signature data from the frontend and extracts useful features
        This is like taking a video of someone signing and noting all the important details
        """
        
        # Extract the points from the signature
        strokes = signature_data.get('strokes', [])
        
        features = {
            'timestamp': datetime.now().isoformat(),
            'basic_stats': self._calculate_basic_stats(strokes),
            'velocity_features': self._calculate_velocity_features(strokes),
            'shape_features': self._calculate_shape_features(strokes),
            'stroke_features': self._calculate_stroke_features(strokes)
        }
        
        return features
    
    def _calculate_basic_stats(self, strokes):
        """Calculate basic statistics about the signature"""
        
        # Count total points across all strokes
        total_points = sum(len(stroke['points']) for stroke in strokes)
        
        # Calculate total time (if we have timestamps)
        total_duration = 0
        if strokes and 'startTime' in strokes[0] and 'endTime' in strokes[-1]:
            total_duration = strokes[-1]['endTime'] - strokes[0]['startTime']
        
        return {
            'stroke_count': len(strokes),
            'total_points': total_points,
            'total_duration_ms': total_duration,
            'average_points_per_stroke': total_points / len(strokes) if strokes else 0
        }
    
    def _calculate_velocity_features(self, strokes):
        """Calculate how fast the signature was drawn"""
        
        velocities = []
        
        for stroke in strokes:
            points = stroke.get('points', [])
            
            for i in range(1, len(points)):
                # Calculate distance between consecutive points
                p1 = points[i-1]
                p2 = points[i]
                
                distance = np.sqrt((p2['x'] - p1['x'])**2 + (p2['y'] - p1['y'])**2)
                
                # Calculate time difference (if available)
                time_diff = 1  # Default to 1 if no timestamp
                if 'time' in p1 and 'time' in p2:
                    time_diff = max(p2['time'] - p1['time'], 1)
                
                velocity = distance / time_diff
                velocities.append(velocity)
        
        if velocities:
            return {
                'average_velocity': np.mean(velocities),
                'max_velocity': np.max(velocities),
                'min_velocity': np.min(velocities),
                'velocity_std': np.std(velocities)
            }
        else:
            return {
                'average_velocity': 0,
                'max_velocity': 0,
                'min_velocity': 0,
                'velocity_std': 0
            }
    
    def _calculate_shape_features(self, strokes):
        """Calculate the overall shape characteristics"""
        
        all_points = []
        for stroke in strokes:
            for point in stroke.get('points', []):
                all_points.append([point['x'], point['y']])
        
        if not all_points:
            return {
                'width': 0,
                'height': 0,
                'area': 0,
                'aspect_ratio': 0
            }
        
        points_array = np.array(all_points)
        
        # Find bounding box
        min_x, min_y = points_array.min(axis=0)
        max_x, max_y = points_array.max(axis=0)
        
        width = max_x - min_x
        height = max_y - min_y
        
        return {
            'width': width,
            'height': height,
            'area': width * height,
            'aspect_ratio': width / height if height > 0 else 0,
            'center_x': (min_x + max_x) / 2,
            'center_y': (min_y + max_y) / 2
        }
    
    def _calculate_stroke_features(self, strokes):
        """Analyze individual stroke characteristics"""
        
        stroke_lengths = []
        stroke_durations = []
        
        for stroke in strokes:
            points = stroke.get('points', [])
            
            # Calculate stroke length
            length = 0
            for i in range(1, len(points)):
                p1 = points[i-1]
                p2 = points[i]
                length += np.sqrt((p2['x'] - p1['x'])**2 + (p2['y'] - p1['y'])**2)
            
            stroke_lengths.append(length)
            
            # Calculate stroke duration if available
            if 'startTime' in stroke and 'endTime' in stroke:
                duration = stroke['endTime'] - stroke['startTime']
                stroke_durations.append(duration)
        
        features = {
            'average_stroke_length': np.mean(stroke_lengths) if stroke_lengths else 0,
            'total_length': sum(stroke_lengths),
            'length_variation': np.std(stroke_lengths) if stroke_lengths else 0
        }
        
        if stroke_durations:
            features['average_stroke_duration'] = np.mean(stroke_durations)
            features['duration_variation'] = np.std(stroke_durations)
        
        return features
    
    def save_signature(self, signature_data, user_id, signature_type='genuine'):
        """
        Save a signature with all its features
        signature_type can be 'genuine' or 'forgery' for training
        """
        
        features = self.process_signature(signature_data)
        
        record = {
            'user_id': user_id,
            'type': signature_type,
            'raw_data': signature_data,
            'features': features
        }
        
        self.signatures.append(record)
        
        # Save to file
        filename = f'signature_data_{user_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        filepath = os.path.join('data', filename)
        
        # Create data directory if it doesn't exist
        os.makedirs('data', exist_ok=True)
        
        with open(filepath, 'w') as f:
            # Convert numpy types to regular Python types for JSON
            json.dump(record, f, indent=2, default=str)
        
        print(f"Signature saved to {filepath}")
        return features
    
    def analyze_consistency(self, user_id):
        """
        Check how consistent a user's signatures are
        This helps us set appropriate thresholds for authentication
        """
        
        user_signatures = [s for s in self.signatures if s['user_id'] == user_id and s['type'] == 'genuine']
        
        if len(user_signatures) < 2:
            return "Need at least 2 signatures to analyze consistency"
        
        # Extract features for comparison
        velocities = [s['features']['velocity_features']['average_velocity'] for s in user_signatures]
        stroke_counts = [s['features']['basic_stats']['stroke_count'] for s in user_signatures]
        areas = [s['features']['shape_features']['area'] for s in user_signatures]
        
        consistency_report = {
            'velocity_consistency': 1 - (np.std(velocities) / np.mean(velocities) if np.mean(velocities) > 0 else 0),
            'stroke_count_consistency': 1 - (np.std(stroke_counts) / np.mean(stroke_counts) if np.mean(stroke_counts) > 0 else 0),
            'area_consistency': 1 - (np.std(areas) / np.mean(areas) if np.mean(areas) > 0 else 0),
            'sample_count': len(user_signatures)
        }
        
        return consistency_report


# Example usage
if __name__ == "__main__":
    # Create a collector
    collector = SignatureDataCollector()
    
    # Example signature data (this would come from your frontend)
    example_signature = {
        'strokes': [
            {
                'points': [
                    {'x': 100, 'y': 100, 'time': 0},
                    {'x': 150, 'y': 120, 'time': 50},
                    {'x': 200, 'y': 130, 'time': 100}
                ],
                'startTime': 0,
                'endTime': 100
            }
        ]
    }
    
    # Process and save
    features = collector.save_signature(example_signature, 'user123')
    
    # Print the extracted features
    print("\nExtracted Features:")
    print("Features have been extracted and saved!")
    print(f"Check the file: data/signature_data_user123_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")