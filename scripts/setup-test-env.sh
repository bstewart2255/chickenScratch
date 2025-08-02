#!/bin/bash

# Test Environment Setup Script
# This script ensures the correct database configuration for tests

echo "🔧 Setting up test environment..."

# Set test environment variables
export NODE_ENV=test
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/signature_auth_test"
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=signature_auth_test
export DB_USER=postgres
export DB_PASSWORD=postgres
export PGUSER=postgres
export PGPASSWORD=postgres
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=signature_auth_test
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_DB=signature_auth_test

echo "✅ Test environment variables set"
echo "📋 Current configuration:"
echo "  DATABASE_URL: $DATABASE_URL"
echo "  DB_USER: $DB_USER"
echo "  PGUSER: $PGUSER"
echo "  POSTGRES_USER: $POSTGRES_USER"

# Validate no "root" user is being used
if echo "$DATABASE_URL" | grep -q "root"; then
  echo "❌ ERROR: DATABASE_URL still contains 'root' user!"
  exit 1
fi

if [ "$DB_USER" = "root" ] || [ "$PGUSER" = "root" ] || [ "$POSTGRES_USER" = "root" ]; then
  echo "❌ ERROR: Database user is still set to 'root'!"
  exit 1
fi

echo "✅ No 'root' user found in configuration"
echo "🎉 Test environment setup complete!"
