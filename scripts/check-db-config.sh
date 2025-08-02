#!/bin/bash

# Database Configuration Check Script
# This script validates database configuration to prevent root user issues

echo "🔍 Checking Database Configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
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
    esac
}

# Check all possible sources for root user
echo "=== Checking for 'root' user in database configuration ==="

has_errors=false
has_warnings=false

# Check DATABASE_URL
if [[ -n "$DATABASE_URL" ]]; then
    if echo "$DATABASE_URL" | grep -q "://root@"; then
        print_status "error" "DATABASE_URL contains 'root' user"
        has_errors=true
    else
        print_status "success" "DATABASE_URL does not contain 'root' user"
    fi
else
    print_status "warning" "DATABASE_URL is not set"
    has_warnings=true
fi

# Check individual database variables
db_vars=("DB_USER" "PGUSER" "POSTGRES_USER")
for var in "${db_vars[@]}"; do
    if [[ -n "${!var}" ]]; then
        if [[ "${!var}" == "root" ]]; then
            print_status "error" "$var is set to 'root'"
            has_errors=true
        else
            print_status "success" "$var is set to '${!var}' (not root)"
        fi
    else
        print_status "warning" "$var is not set"
        has_warnings=true
    fi
done

# Check OS user
if [[ "$USER" == "root" ]]; then
    print_status "warning" "OS USER is 'root' (this may cause issues if no DB_USER is set)"
    has_warnings=true
else
    print_status "success" "OS USER is '$USER' (not root)"
fi

# Check for missing required variables
echo ""
echo "=== Checking for required database configuration ==="

required_vars=("DB_HOST" "DB_NAME" "DB_PASSWORD")
for var in "${required_vars[@]}"; do
    if [[ -n "${!var}" ]]; then
        print_status "success" "$var is set"
    else
        print_status "warning" "$var is not set"
        has_warnings=true
    fi
done

# Determine effective database user
echo ""
echo "=== Effective Database User Analysis ==="

effective_user=""
if [[ -n "$DATABASE_URL" ]]; then
    # Try to extract user from DATABASE_URL
    if echo "$DATABASE_URL" | grep -q "://.*@"; then
        effective_user=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        print_status "success" "Effective user from DATABASE_URL: $effective_user"
    else
        print_status "warning" "Could not parse user from DATABASE_URL"
        has_warnings=true
    fi
elif [[ -n "$DB_USER" ]]; then
    effective_user="$DB_USER"
    print_status "success" "Effective user from DB_USER: $effective_user"
elif [[ -n "$PGUSER" ]]; then
    effective_user="$PGUSER"
    print_status "success" "Effective user from PGUSER: $effective_user"
else
    effective_user="$USER"
    print_status "warning" "Effective user from OS USER: $effective_user"
    has_warnings=true
fi

# Final validation
if [[ "$effective_user" == "root" ]]; then
    print_status "error" "CRITICAL: Database will attempt to connect as 'root' user!"
    has_errors=true
else
    print_status "success" "Database will connect as '$effective_user' (safe)"
fi

# Summary
echo ""
echo "=== Summary ==="
if [[ "$has_errors" == true ]]; then
    print_status "error" "Database configuration has ERRORS that must be fixed!"
    echo ""
    echo "💡 Solutions:"
    echo "   1. Set DB_USER=postgres in your environment"
    echo "   2. Set PGUSER=postgres in your environment"
    echo "   3. Update DATABASE_URL to use postgres user"
    echo "   4. Check GitHub repository variables/secrets"
    exit 1
elif [[ "$has_warnings" == true ]]; then
    print_status "warning" "Database configuration has warnings but should work"
    echo ""
    echo "💡 Recommendations:"
    echo "   1. Set explicit DB_USER or PGUSER for clarity"
    echo "   2. Ensure DATABASE_URL is properly configured"
    exit 0
else
    print_status "success" "Database configuration is valid!"
    exit 0
fi 