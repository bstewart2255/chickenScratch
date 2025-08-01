# Database User Configuration Fix

## Problem

The primary cause of job failures was the database connection error:

```
FATAL: role "root" does not exist
```

Tests and backend services were trying to connect to PostgreSQL using the "root" role, which does not exist in the test environment.

## Root Cause

The issue was caused by:
1. Environment variables or configuration files setting the database user to "root"
2. Missing or incorrect database configuration in test environments
3. CI/CD environment variables not properly set

## Solution

### 1. Updated Test Configuration

**File: `tests/setup.ts`**
- Added comprehensive environment variable setup
- Ensured all database-related variables use "postgres" user
- Added safeguards to prevent "root" user usage

```typescript
// Force test database URL - override any .env file
process.env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5432/signature_auth_test';

// Set explicit database config for tests - ensure no "root" user can be used
process.env['DB_HOST'] = 'localhost';
process.env['DB_PORT'] = '5432';
process.env['DB_NAME'] = 'signature_auth_test';
process.env['DB_USER'] = 'postgres';
process.env['DB_PASSWORD'] = 'postgres';
process.env['PGUSER'] = 'postgres';
process.env['PGPASSWORD'] = 'postgres';
process.env['PGHOST'] = 'localhost';
process.env['PGPORT'] = '5432';
process.env['PGDATABASE'] = 'signature_auth_test';

// Additional safeguards to prevent any "root" user usage
process.env['POSTGRES_USER'] = 'postgres';
process.env['POSTGRES_PASSWORD'] = 'postgres';
process.env['POSTGRES_DB'] = 'signature_auth_test';
```

### 2. Updated Test Helpers

**File: `tests/helpers/mocks.ts`**
- Enhanced `setupTestDatabase` function
- Added additional environment variable safeguards
- Ensured NODE_ENV is properly set

### 3. Created Validation Scripts

**File: `scripts/validate-db-config.js`**
- Validates database configuration
- Checks for "root" user usage
- Tests database connections
- Provides detailed error messages and solutions

**File: `scripts/fix-database-user.js`**
- Automatically fixes "root" user references
- Updates configuration files
- Creates test environment setup script
- Provides comprehensive reporting

### 4. Added Package.json Scripts

```json
{
  "scripts": {
    "db:validate": "node scripts/validate-db-config.js",
    "db:fix-user": "node scripts/fix-database-user.js"
  }
}
```

## Usage

### Validate Database Configuration

```bash
npm run db:validate
```

This will:
- Check all environment variables
- Validate DATABASE_URL format
- Test database connection
- Report any "root" user usage

### Fix Database User Issues

```bash
npm run db:fix-user
```

This will:
- Scan configuration files for "root" user references
- Automatically replace with "postgres" user
- Create test environment setup script
- Provide detailed reporting

### Set Up Test Environment

```bash
source scripts/setup-test-env.sh
```

This will:
- Set all necessary environment variables
- Validate configuration
- Ensure no "root" user is used

## Environment Variables

### Required for Tests

```bash
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/signature_auth_test
DB_HOST=localhost
DB_PORT=5432
DB_NAME=signature_auth_test
DB_USER=postgres
DB_PASSWORD=postgres
PGUSER=postgres
PGPASSWORD=postgres
PGHOST=localhost
PGPORT=5432
PGDATABASE=signature_auth_test
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=signature_auth_test
```

### CI/CD Configuration

The GitHub Actions workflow (`.github/workflows/ci.yml`) already includes the correct configuration:

```yaml
services:
  postgres:
    image: postgres:14
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: signature_auth_test

steps:
  - name: Run tests with coverage
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/signature_auth_test
      NODE_ENV: test
      DB_USER: postgres
      DB_HOST: localhost
      DB_PORT: 5432
      DB_NAME: signature_auth_test
      DB_PASSWORD: postgres
```

## Prevention

### 1. Environment Variable Validation

Always validate environment variables before running tests:

```bash
npm run db:validate
```

### 2. CI/CD Checks

Add validation to CI/CD pipelines:

```yaml
- name: Validate database configuration
  run: npm run db:validate
```

### 3. Pre-commit Hooks

Consider adding pre-commit hooks to check for "root" user references:

```bash
# .git/hooks/pre-commit
if grep -r "root.*user\|user.*root" . --include="*.ts" --include="*.js" --include="*.json" --include="*.env*"; then
  echo "❌ Found 'root' user references. Please fix before committing."
  exit 1
fi
```

### 4. Documentation

Keep this documentation updated and ensure all team members are aware of the correct database configuration.

## Troubleshooting

### Common Issues

1. **"role 'root' does not exist"**
   - Run: `npm run db:fix-user`
   - Check environment variables: `npm run db:validate`

2. **Connection refused**
   - Ensure PostgreSQL is running
   - Check port configuration
   - Verify host settings

3. **Authentication failed**
   - Verify password configuration
   - Check user permissions
   - Ensure correct database name

### Debug Commands

```bash
# Check current environment
env | grep -E "(DB_|PG_|POSTGRES_)"

# Test database connection
psql -h localhost -U postgres -d signature_auth_test -c "SELECT current_user;"

# Validate configuration
npm run db:validate

# Fix issues
npm run db:fix-user
```

## Files Modified

1. `tests/setup.ts` - Enhanced test environment setup
2. `tests/helpers/mocks.ts` - Updated test database helpers
3. `scripts/validate-db-config.js` - New validation script
4. `scripts/fix-database-user.js` - New fix script
5. `scripts/setup-test-env.sh` - New test environment setup
6. `package.json` - Added new scripts
7. `docs/DATABASE_USER_FIX.md` - This documentation

## Testing

After applying fixes, run the following to verify:

```bash
# Validate configuration
npm run db:validate

# Run tests
npm test

# Run specific database tests
npm test -- --testNamePattern="database|connection"
```

## Conclusion

This fix ensures that:
- All tests use the correct "postgres" user
- No "root" user references exist in the codebase
- Database configuration is validated automatically
- CI/CD environments are properly configured
- Future issues are prevented through validation scripts

The solution is comprehensive and provides both immediate fixes and long-term prevention measures. 