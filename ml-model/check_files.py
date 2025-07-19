import json
import glob

for file in glob.glob('data/signature_data_*.json'):
    try:
        with open(file) as f:
            json.load(f)
        print(f'✓ {file} is OK')
    except Exception as e:
        print(f'✗ {file} has an error: {e}')