#!/bin/bash

echo "🔍 Checking ML Dashboard Deployment Status"
echo "=========================================="

# Check local vs production
echo -e "\n1️⃣ Backend Changes:"
echo "Local backend/server.js last modified:"
stat -f "%Sm" backend/server.js

echo -e "\n2️⃣ Frontend Changes:"
echo "Local frontend/ml-dashboard-v2.html last modified:"
stat -f "%Sm" frontend/ml-dashboard-v2.html

echo -e "\n3️⃣ Git Status:"
echo "Last pushed commit:"
git log --oneline -1 origin/main

echo -e "\n4️⃣ Recent Backend Changes in Git:"
git log --oneline -5 backend/server.js

echo -e "\n5️⃣ Component Scoring Implementation:"
echo "Checking for component score estimation in server.js:"
grep -n "Generate estimated scores" backend/server.js | head -2

echo -e "\n6️⃣ Dashboard File Comparison:"
echo "Checking which dashboard files exist:"
ls -la frontend/ml-dashboard*.html

echo -e "\n7️⃣ API Test (Production):"
echo "Testing production API for component scores:"
curl -s "https://chickenscratch.onrender.com/api/user/migrationtest/detailed-analysis" | \
  jq -r '.authAttempts[0] | {id: .id, confidence: .confidence, shape_scores: .shape_scores, drawing_scores: .drawing_scores}' 2>/dev/null || \
  echo "Unable to parse JSON - check if jq is installed"

echo -e "\n⚠️  IMPORTANT CHECKS:"
echo "[ ] Are you accessing /frontend/ml-dashboard-v2.html (not ml-dashboard.html)?"
echo "[ ] Has the production server been redeployed since changes?"
echo "[ ] Have you cleared browser cache (Cmd+Shift+R)?"
echo "[ ] Are the changes pushed to the main branch?"

echo -e "\n✅ If all backend changes are committed and pushed,"
echo "   the issue is likely that the production server"
echo "   hasn't been redeployed with the latest changes."