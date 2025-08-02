#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== System Verification Script ==="
echo ""

ERRORS=0

echo -n "1. Checking Node.js installation... "
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "PASS ($NODE_VERSION)"
else
    echo "FAIL"
    ERRORS=$((ERRORS + 1))
fi

echo -n "2. Checking npm installation... "
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo "PASS ($NPM_VERSION)"
else
    echo "FAIL"
    ERRORS=$((ERRORS + 1))
fi

echo -n "3. Checking project structure... "
REQUIRED_DIRS=("backend" "frontend" "src" "scripts")
MISSING_DIRS=()
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$PROJECT_ROOT/$dir" ]; then
        MISSING_DIRS+=("$dir")
    fi
done

if [ ${#MISSING_DIRS[@]} -eq 0 ]; then
    echo "PASS"
else
    echo "FAIL (missing: ${MISSING_DIRS[*]})"
    ERRORS=$((ERRORS + 1))
fi

echo -n "4. Checking package.json... "
if [ -f "$PROJECT_ROOT/package.json" ]; then
    if node -e "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/package.json'))" 2>/dev/null; then
        echo "PASS"
    else
        echo "FAIL (invalid JSON)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "FAIL (not found)"
    ERRORS=$((ERRORS + 1))
fi

echo -n "5. Checking node_modules... "
if [ -d "$PROJECT_ROOT/node_modules" ]; then
    MODULE_COUNT=$(ls "$PROJECT_ROOT/node_modules" | wc -l)
    echo "PASS ($MODULE_COUNT modules)"
else
    echo "WARN (not installed - run npm install)"
fi

echo -n "6. Checking TypeScript configuration... "
if [ -f "$PROJECT_ROOT/tsconfig.json" ]; then
    if node -e "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/tsconfig.json'))" 2>/dev/null; then
        echo "PASS"
    else
        echo "FAIL (invalid JSON)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "WARN (TypeScript not configured)"
fi

echo -n "7. Checking migration status... "
if [ -f "$PROJECT_ROOT/.migration-status.json" ]; then
    PHASE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/.migration-status.json')).phase || 'unknown')" 2>/dev/null || echo "error")
    echo "PASS (phase: $PHASE)"
else
    echo "WARN (migration status not found)"
fi

echo -n "8. Checking environment configuration... "
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "PASS"
else
    echo "WARN (.env not found)"
fi

echo -n "9. Running basic build test... "
cd "$PROJECT_ROOT"
if npm run build >/dev/null 2>&1; then
    echo "PASS"
else
    echo "FAIL"
    ERRORS=$((ERRORS + 1))
fi

echo -n "10. Checking database connection... "
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
    if [ ! -z "$DATABASE_URL" ]; then
        if node -e "
        const { Client } = require('pg');
        const client = new Client({ connectionString: '$DATABASE_URL' });
        client.connect()
            .then(() => { console.log('PASS'); client.end(); process.exit(0); })
            .catch(() => { console.log('FAIL'); process.exit(1); });
        " 2>/dev/null; then
            :
        else
            echo "FAIL"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "SKIP (DATABASE_URL not set)"
    fi
else
    echo "SKIP (.env not found)"
fi

echo ""
echo "=== Verification Summary ==="
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed!"
    echo ""
    echo "System appears to be functioning correctly."
    echo "Recommended next steps:"
    echo "  1. Run the test suite: npm test"
    echo "  2. Start the application: npm start"
    echo "  3. Verify key functionality manually"
    exit 0
else
    echo "❌ $ERRORS errors found!"
    echo ""
    echo "Please review the errors above and take corrective action."
    echo "You may need to:"
    echo "  1. Run: npm install"
    echo "  2. Restore missing configuration files"
    echo "  3. Check database connectivity"
    exit 1
fi