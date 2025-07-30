#!/bin/bash

echo "🔍 Testing ML Dashboard Data Endpoints..."
echo "========================================"

# Replace with your actual backend URL
API_URL="https://chickenscratch-1.onrender.com"

echo -e "\n1. Dashboard Stats:"
curl -s "$API_URL/api/dashboard-stats" | python3 -m json.tool || echo "Failed to fetch dashboard stats"

echo -e "\n2. Recent Activity (last 20):"
curl -s "$API_URL/api/recent-activity" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'Total activities: {len(data.get(\"activities\", []))}')
    if data.get('activities'):
        latest = data['activities'][0]
        print(f'Latest activity:')
        print(f'  User: {latest.get(\"user\")}')
        print(f'  Time: {latest.get(\"time\")}')
        print(f'  Success: {latest.get(\"success\")}')
        print(f'  Confidence: {latest.get(\"confidence\")}%')
except:
    print('Failed to parse activity data')
"

echo -e "\n3. Check for very recent activities (last 5 minutes):"
CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Current UTC time: $CURRENT_TIME"