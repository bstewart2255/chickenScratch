from collect_signature_data import SignatureDataCollector
import random
import numpy as np

collector = SignatureDataCollector()

print("🎯 Generating training data...")

# Generate different signature styles
def generate_signature(style='normal', user_id='user'):
    """Generate synthetic signature data with different characteristics"""
    
    if style == 'normal':
        # Normal signature
        strokes = []
        for stroke_num in range(random.randint(2, 4)):  # 2-4 strokes
            points = []
            start_x = random.randint(100, 200)
            start_y = random.randint(100, 150)
            
            for i in range(random.randint(10, 20)):  # 10-20 points per stroke
                x = start_x + i * random.randint(5, 15)
                y = start_y + random.randint(-10, 10)
                time = i * random.randint(20, 40)  # Normal speed
                points.append({'x': x, 'y': y, 'time': time})
            
            strokes.append({
                'points': points,
                'startTime': 0,
                'endTime': points[-1]['time']
            })
    
    elif style == 'rushed':
        # Rushed signature (faster)
        strokes = []
        for stroke_num in range(random.randint(1, 2)):  # Fewer strokes
            points = []
            start_x = random.randint(100, 200)
            start_y = random.randint(100, 150)
            
            for i in range(random.randint(5, 10)):  # Fewer points
                x = start_x + i * random.randint(15, 25)  # Longer jumps
                y = start_y + random.randint(-20, 20)
                time = i * random.randint(5, 15)  # Much faster
                points.append({'x': x, 'y': y, 'time': time})
            
            strokes.append({
                'points': points,
                'startTime': 0,
                'endTime': points[-1]['time']
            })
    
    elif style == 'careful':
        # Very careful signature (slower)
        strokes = []
        for stroke_num in range(random.randint(3, 5)):  # More strokes
            points = []
            start_x = random.randint(100, 200)
            start_y = random.randint(100, 150)
            
            for i in range(random.randint(20, 30)):  # Many points
                x = start_x + i * random.randint(3, 8)  # Small movements
                y = start_y + random.randint(-5, 5)
                time = i * random.randint(50, 80)  # Very slow
                points.append({'x': x, 'y': y, 'time': time})
            
            strokes.append({
                'points': points,
                'startTime': 0,
                'endTime': points[-1]['time']
            })
    
    return {'strokes': strokes}

# Generate genuine signatures for different users
users = ['alice', 'bob', 'charlie', 'diana', 'eve']
styles = ['normal', 'rushed', 'careful']

for user in users:
    # Each user signs 2-3 times
    for i in range(random.randint(2, 3)):
        style = random.choice(styles)
        signature = generate_signature(style, user)
        collector.save_signature(signature, user, 'genuine')
        print(f"✓ Generated genuine signature for {user} (style: {style})")

# Generate some forgery attempts
print("\nGenerating forgeries...")
forgers = ['forger_x', 'forger_y', 'forger_z']

for forger in forgers:
    # Each forger tries to copy a real user
    target_user = random.choice(users)
    
    # Forgeries are usually different in subtle ways
    signature = generate_signature('rushed', forger)  # Forgers often rush
    collector.save_signature(signature, f"{forger}_copying_{target_user}", 'forgery')
    print(f"✓ Generated forgery: {forger} attempting to copy {target_user}")

print("\n✅ Training data generation complete!")
print("You should now have enough data to train the model.")    