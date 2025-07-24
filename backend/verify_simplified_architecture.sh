#!/bin/bash
# Verification script for simplified architecture changes

echo "=== Signature Authentication System - Architecture Simplification Verification ==="
echo ""
echo "This script will help you verify that the simplified architecture is working correctly."
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}1. Database Migration Status Check${NC}"
echo "Run these commands to apply the migration:"
echo ""
echo "  cd backend"
echo "  psql -U your_username -d your_database < migrations/simplify_architecture.sql"
echo ""
echo "Expected output: 'COMMIT' - indicating successful migration"
echo ""

echo -e "${YELLOW}2. Verify Database Schema${NC}"
echo "Run this command to check if signature_id was added to auth_attempts:"
echo ""
echo "  psql -U your_username -d your_database -c '\d auth_attempts'"
echo ""
echo "You should see a column: signature_id | integer"
echo ""

echo -e "${YELLOW}3. Test Enrollment Flow${NC}"
echo "1. Start the server: npm start"
echo "2. Open the app and register a new user"
echo "3. Complete all drawing steps"
echo "4. Check server logs for:"
echo "   - 'Saving drawing for [username]' messages"
echo "   - 'Using temporary data for registration' message"
echo "   - 'Cleared temporary data for [username]' message"
echo ""

echo -e "${YELLOW}4. Test Authentication Flow${NC}"
echo "1. Sign in with the registered user"
echo "2. Check server logs for:"
echo "   - 'Saved auth signature with ID: [number]'"
echo "   - No errors about 'Failed to record auth attempt'"
echo "3. Verify in database:"
echo "   psql -c 'SELECT id, user_id, success, confidence, signature_id FROM auth_attempts ORDER BY created_at DESC LIMIT 5;'"
echo "   - signature_id column should have values (not NULL)"
echo ""

echo -e "${YELLOW}5. Verify ML Dashboard${NC}"
echo "1. Open /ml-dashboard.html"
echo "2. Click on a user to view details"
echo "3. Check that:"
echo "   - Enrollment signatures display correctly"
echo "   - Authentication attempts show with proper ML features"
echo "   - No 'Loading component scores...' spinner stuck"
echo "   - Console shows no errors about missing signature data"
echo ""

echo -e "${YELLOW}6. Check for Removed Files${NC}"
echo "These files are no longer needed and can be removed:"
echo "  - backend/updateServerForDatabase.js"
echo "  - backend/migrations/add_temp_enrollments.sql (after documenting)"
echo "  - backend/temp-enrollments-schema-docs.md (after documenting)"
echo ""

echo -e "${YELLOW}7. Performance Verification${NC}"
echo "Run this query to check if indexes are being used:"
echo ""
echo "  psql -c 'EXPLAIN ANALYZE SELECT s.*, a.created_at as auth_time FROM auth_attempts a JOIN signatures s ON s.id = a.signature_id WHERE a.user_id = 1 LIMIT 10;'"
echo ""
echo "Look for 'Index Scan' in the output - this confirms indexes are working"
echo ""

echo -e "${GREEN}✓ Checklist Summary:${NC}"
echo "□ Migration applied successfully"
echo "□ signature_id column exists in auth_attempts"
echo "□ SQL injection fix verified (shape query uses ANY)"
echo "□ Enrollment flow works with in-memory storage"
echo "□ Authentication saves signature_id correctly"
echo "□ ML dashboard displays data without time-window matching"
echo "□ No temp table references remain in code"
echo "□ Performance indexes are being used"
echo ""

echo -e "${YELLOW}Rollback Instructions (if needed):${NC}"
echo "If you need to rollback, use the rollback script at the bottom of:"
echo "  backend/migrations/simplify_architecture.sql"