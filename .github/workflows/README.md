# CI/CD Workflows

This directory contains GitHub Actions workflows for the Signature Authentication Prototype.

## Workflows

### 1. CI Pipeline (`ci.yml`)

Runs on every push and pull request to ensure code quality.

**Jobs:**
- **Test Suite**: Runs on Node.js 18.x and 20.x with PostgreSQL
  - Linting (ESLint)
  - Type checking (TypeScript)
  - Unit and integration tests with coverage
  - Coverage threshold enforcement (≥90%)
  - Build verification
  - Performance benchmarks
- **Integration Tests**: Dedicated integration test suite
- **Security Scan**: npm audit and secret scanning
- **Bundle Analysis**: Tracks bundle sizes
- **Migration Status**: Verifies TypeScript migration progress

**Triggers:**
- Push to: main, staging, develop
- Pull requests to: main, staging, develop

### 2. Staging Deployment (`deploy-staging.yml`)

Automated deployment to staging environment.

**Features:**
- Runs full CI suite before deployment
- Database migrations
- PM2 process management
- Health checks
- Smoke tests
- Automatic rollback capability
- Keeps last 5 deployments

**Triggers:**
- Push to staging branch
- Manual workflow dispatch

### 3. Production Deployment (`deploy-production.yml`)

Production deployment with safety measures.

**Features:**
- Manual approval required (can be skipped via workflow_dispatch)
- Database backup before deployment
- Blue-green deployment strategy
- Comprehensive health checks
- Production smoke tests
- Automatic rollback on failure
- Release creation
- Deployment notifications

**Triggers:**
- Push to main branch
- Manual workflow dispatch

## Required Secrets

Configure these secrets in your GitHub repository:

### General
- `API_SECRET_KEY`: Application secret key

### Staging
- `STAGING_HOST`: Staging server hostname
- `STAGING_USER`: SSH user for staging
- `STAGING_PATH`: Deployment path on staging server
- `STAGING_DATABASE_URL`: Staging database connection string
- `STAGING_URL`: Public staging URL
- `STAGING_API_SECRET_KEY`: Staging API secret

### Production
- `PRODUCTION_HOST`: Production server hostname
- `PRODUCTION_USER`: SSH user for production
- `PRODUCTION_PATH`: Deployment path on production server
- `PRODUCTION_DATABASE_URL`: Production database connection string
- `PRODUCTION_URL`: Public production URL
- `BACKUP_STORAGE_PATH`: Path for database backups
- `DEPLOY_SSH_KEY`: SSH private key for deployment

## Environment Setup

### GitHub Environments

Create these environments in your repository settings:

1. **staging**: For staging deployments
2. **production-approval**: Requires manual approval
3. **production**: For production deployments
4. **production-rollback**: For emergency rollbacks

### Server Requirements

Both staging and production servers need:
- Node.js 18.x or 20.x
- PM2 for process management
- PostgreSQL 14+
- Nginx or similar for load balancing
- Sufficient disk space for deployments

## Deployment Process

### Staging
1. Push to staging branch
2. CI runs automatically
3. If CI passes, deployment starts
4. Database migrations run
5. New version deployed with PM2
6. Health checks verify deployment
7. Old deployments cleaned up

### Production
1. Push to main branch
2. CI runs automatically
3. Manual approval required
4. Database backup created
5. Database migrations run
6. Blue-green deployment:
   - New version starts on alternate port
   - Health checks verify new version
   - Traffic switched to new version
   - Old version stopped
7. Release created in GitHub
8. Notifications sent

## Rollback Procedures

### Staging
- Automatic rollback on deployment failure
- Manual rollback available via workflow

### Production
- Automatic rollback on deployment failure
- Manual rollback requires approval
- Previous version restored
- Database rollback handled separately

## Monitoring

Monitor these metrics after deployment:
- Application health endpoints
- Error rates
- Response times
- CPU/Memory usage
- Database connection pool

## Local Testing

Test workflows locally using [act](https://github.com/nektos/act):

```bash
# Test CI workflow
act -j test

# Test with specific event
act push -j test
```

## Troubleshooting

### Common Issues

1. **CI fails on coverage**: Ensure tests maintain ≥90% coverage
2. **Deployment fails**: Check SSH keys and server permissions
3. **Health checks fail**: Verify application starts correctly
4. **Database migrations fail**: Test migrations locally first

### Debug Commands

```bash
# Check workflow syntax
gh workflow list

# View workflow runs
gh run list

# View specific run
gh run view [run-id]

# Re-run failed workflow
gh run rerun [run-id]
```