#!/bin/bash

# CI Database User Fix Script
# This script helps debug and fix database user issues in CI environments

echo "🔧 CI Database User Fix Script"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    local status=$1
    local message=$2
    case $status in
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "success")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "info")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

echo ""
print_status "info" "Current Environment Analysis"

# Check OS environment
echo "=== OS Environment ==="
echo "USER: ${USER:-not set}"
echo "HOME: ${HOME:-not set}"
echo "CI: ${CI:-not set}"
echo "GITHUB_ACTIONS: ${GITHUB_ACTIONS:-not set}"

# Check database environment
echo ""
echo "=== Database Environment ==="
db_vars=("DATABASE_URL" "DB_USER" "PGUSER" "POSTGRES_USER" "DB_HOST" "DB_NAME" "DB_PASSWORD")
for var in "${db_vars[@]}"; do
    if [[ -n "${!var}" ]]; then
        if [[ "$var" == *"PASSWORD"* ]]; then
            echo "$var: *** (masked)"
        else
            echo "$var: ${!var}"
        fi
    else
        echo "$var: not set"
    fi
done

# Check for root user issues
echo ""
print_status "info" "Root User Analysis"

has_root_issues=false

# Check individual variables
if [[ "$DB_USER" == "root" ]]; then
    print_status "error" "DB_USER is set to 'root'"
    has_root_issues=true
fi

if [[ "$PGUSER" == "root" ]]; then
    print_status "error" "PGUSER is set to 'root'"
    has_root_issues=true
fi

if [[ "$POSTGRES_USER" == "root" ]]; then
    print_status "error" "POSTGRES_USER is set to 'root'"
    has_root_issues=true
fi

# Check DATABASE_URL
if [[ -n "$DATABASE_URL" ]]; then
    if echo "$DATABASE_URL" | grep -q "://root@"; then
        print_status "error" "DATABASE_URL contains 'root' user"
        has_root_issues=true
    fi
fi

# Check OS user fallback
if [[ "$USER" == "root" ]] && [[ -z "$DB_USER" ]] && [[ -z "$PGUSER" ]]; then
    print_status "warning" "OS USER is 'root' and no explicit DB_USER/PGUSER is set"
    print_status "info" "This will cause PostgreSQL to reject the connection"
    has_root_issues=true
fi

# Determine effective user
echo ""
print_status "info" "Effective User Analysis"

effective_user=""
if [[ -n "$DB_USER" ]]; then
    effective_user="$DB_USER"
    print_status "success" "Using DB_USER: $effective_user"
elif [[ -n "$PGUSER" ]]; then
    effective_user="$PGUSER"
    print_status "success" "Using PGUSER: $effective_user"
elif [[ -n "$DATABASE_URL" ]]; then
    # Extract from DATABASE_URL
    if echo "$DATABASE_URL" | grep -q "://.*@"; then
        effective_user=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        print_status "success" "Using DATABASE_URL user: $effective_user"
    else
        effective_user="$USER"
        print_status "warning" "Could not parse DATABASE_URL, using OS USER: $effective_user"
    fi
else
    effective_user="$USER"
    print_status "warning" "No explicit database user set, using OS USER: $effective_user"
fi

if [[ "$effective_user" == "root" ]]; then
    print_status "error" "CRITICAL: Effective user is 'root' - this will cause connection failure!"
    has_root_issues=true
else
    print_status "success" "Effective user is '$effective_user' (safe)"
fi

# Provide solutions
echo ""
if [[ "$has_root_issues" == true ]]; then
    print_status "error" "Database user issues detected!"
    echo ""
    print_status "info" "Solutions for CI environment:"
    echo "1. Add these environment variables to your CI workflow:"
    echo "   env:"
    echo "     DB_USER: postgres"
    echo "     PGUSER: postgres"
    echo "     POSTGRES_USER: postgres"
    echo "     DATABASE_URL: postgresql://postgres:password@localhost:5432/dbname"
    echo ""
    echo "2. Ensure PostgreSQL service is configured with:"
    echo "   env:"
    echo "     POSTGRES_USER: postgres"
    echo "     POSTGRES_PASSWORD: postgres"
    echo "     POSTGRES_DB: your_database_name"
    echo ""
    echo "3. Check GitHub repository variables/secrets for any 'root' values"
    echo ""
    exit 1
else
    print_status "success" "No database user issues detected!"
    echo ""
    print_status "info" "Current configuration is safe for PostgreSQL connections"
    exit 0
fi 