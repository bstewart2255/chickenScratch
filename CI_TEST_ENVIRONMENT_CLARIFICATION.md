# CI/CD Test Environment Clarification

## Important: Test vs Production Databases

### Production Database (Render)
- **User**: `signatureauth_user`
- **Host**: `dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com`
- **Database**: `signatureauth`
- **NEVER use for testing!**

### CI/CD Test Database (GitHub Actions)
- **User**: `postgres`
- **Host**: `localhost`
- **Database**: `signature_auth_test` or `signature_auth_integration`
- **Created temporarily for each test run**
- **Destroyed after tests complete**

## The Issue

The `.env` file contains production database credentials, which could interfere with tests if not properly overridden. The test setup has been updated to:

1. Force the use of test database credentials
2. Override any `.env` file settings
3. Ensure tests never touch the production database

## How It Works

1. **GitHub Actions CI**:
   - Creates a PostgreSQL service container
   - Uses `postgres` user (default for PostgreSQL Docker image)
   - Completely isolated from production

2. **Local Testing**:
   - Should use local PostgreSQL instance
   - Use `.env.test` for configuration
   - Never use `.env` (production) for tests

## Running Tests Locally

```bash
# Option 1: Use .env.test
cp .env.test .env
npm run test:coverage

# Option 2: Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/signature_auth_test"
export NODE_ENV=test
npm run test:coverage

# Option 3: Use npm script with env vars
NODE_ENV=test DATABASE_URL="postgresql://postgres:postgres@localhost:5432/signature_auth_test" npm run test:coverage
```

## Security Note

- The `.env` file with production credentials should NEVER be committed to Git
- It's already in `.gitignore`
- Use environment variables in your deployment platform (Render) for production
- Keep test and production environments completely separate