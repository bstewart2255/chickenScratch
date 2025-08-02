# 6. Build & Deployment Changes

## **6.1 TypeScript Build Configuration**

### Production Build Pipeline
```json
{
  "scripts": {
    "prebuild": "npm run clean && npm run type-check:strict",
    "build": "tsc",
    "build:watch": "tsc --watch",
    "build:production": "npm run test:coverage && tsc --build tsconfig.json",
    "clean": "rimraf dist && rimraf .tsbuildinfo",
    "postbuild": "npm run copy-assets"
  }
}
```

### TypeScript Build Configuration
```json
// tsconfig.production.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "sourceMap": false,
    "declaration": false,
    "removeComments": true,
    "noEmitOnError": true
  },
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "src/tests/**/*",
    "legacy/**/*"
  ]
}
```

## **6.2 Asset Management**

### Copy Non-TypeScript Assets
```javascript
// scripts/copy-assets.js
const fs = require('fs-extra');
const path = require('path');

async function copyAssets() {
  const assetsMap = [
    { from: 'frontend/*.html', to: 'dist/frontend/' },
    { from: 'frontend/*.css', to: 'dist/frontend/' },
    { from: 'frontend/lib/*', to: 'dist/frontend/lib/' },
    { from: 'backend/config/*.json', to: 'dist/backend/config/' },
    { from: 'package.json', to: 'dist/' },
  ];

  for (const asset of assetsMap) {
    try {
      await fs.copy(asset.from, asset.to);
      console.log(`✓ Copied ${asset.from} → ${asset.to}`);
    } catch (error) {
      console.error(`✗ Failed to copy ${asset.from}:`, error.message);
    }
  }
}

copyAssets();
```

## **6.3 Environment Configuration**

### Development vs Production Settings
```typescript
// src/config/environment.ts
export interface EnvironmentConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableTypeChecking: boolean;
  enableSourceMaps: boolean;
}

export const getEnvironmentConfig = (): EnvironmentConfig => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  return {
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl: process.env.DATABASE_URL || '',
    logLevel: (process.env.LOG_LEVEL as any) || (isDevelopment ? 'debug' : 'info'),
    enableTypeChecking: isDevelopment,
    enableSourceMaps: isDevelopment
  };
};
```

## **6.4 Deployment Scripts**

### Pre-deployment Validation
```bash
#!/bin/bash
# scripts/pre-deploy-check.sh

set -e

echo "🔍 Running pre-deployment checks..."

# 1. Type checking
echo "Running TypeScript type check..."
npm run type-check:strict

# 2. Run tests
echo "Running test suite..."
npm run test:coverage

# 3. Build production
echo "Building for production..."
npm run build:production

# 4. Check for critical files
echo "Verifying build output..."
if [ ! -f "dist/backend/server.js" ]; then
  echo "❌ Server build failed - missing dist/backend/server.js"
  exit 1
fi

if [ ! -f "dist/package.json" ]; then
  echo "❌ Package.json not copied to dist"
  exit 1
fi

# 5. Database migration check
echo "Checking database migrations..."
node dist/backend/check-migrations.js

echo "✅ All pre-deployment checks passed!"
```

### Staging Deployment
```bash
#!/bin/bash
# scripts/deploy-staging.sh

set -e

echo "🚀 Deploying to staging environment..."

# Run pre-deployment checks
./scripts/pre-deploy-check.sh

# Backup current deployment
if [ -d "/var/www/signature-auth-staging" ]; then
  cp -r /var/www/signature-auth-staging /var/www/signature-auth-staging-backup-$(date +%Y%m%d-%H%M%S)
fi

# Deploy new version
rsync -av --delete dist/ /var/www/signature-auth-staging/

# Install production dependencies
cd /var/www/signature-auth-staging
npm ci --only=production

# Run database migrations
npm run migrate:up

# Restart services
sudo systemctl restart signature-auth-staging

# Health check
sleep 5
curl -f http://staging.signature-auth.local/api/health || {
  echo "❌ Health check failed - rolling back"
  sudo systemctl stop signature-auth-staging
  rm -rf /var/www/signature-auth-staging
  mv /var/www/signature-auth-staging-backup-* /var/www/signature-auth-staging
  sudo systemctl start signature-auth-staging
  exit 1
}

echo "✅ Staging deployment successful!"
```

### Production Deployment
```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

echo "🚀 Production deployment starting..."

# Extra safety checks for production
read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Deployment cancelled"
  exit 1
fi

# Verify staging deployment
echo "Verifying staging deployment..."
curl -f http://staging.signature-auth.local/api/health || {
  echo "❌ Staging environment unhealthy - aborting production deployment"
  exit 1
}

# Run comprehensive tests on staging
npm run test:e2e:staging

# Production deployment with zero-downtime
echo "Creating production backup..."
timestamp=$(date +%Y%m%d-%H%M%S)
cp -r /var/www/signature-auth-production /var/www/signature-auth-production-backup-$timestamp

echo "Deploying to production..."
rsync -av --delete dist/ /var/www/signature-auth-production-new/

# Install dependencies
cd /var/www/signature-auth-production-new
npm ci --only=production

# Run migrations (if any)
npm run migrate:up

# Atomic switch
mv /var/www/signature-auth-production /var/www/signature-auth-production-old
mv /var/www/signature-auth-production-new /var/www/signature-auth-production

# Restart services
sudo systemctl restart signature-auth-production

# Health check with retry
echo "Running production health checks..."
for i in {1..5}; do
  if curl -f http://signature-auth.com/api/health; then
    echo "✅ Production deployment successful!"
    rm -rf /var/www/signature-auth-production-old
    exit 0
  fi
  echo "Health check attempt $i failed, retrying in 10 seconds..."
  sleep 10
done

# Rollback on failure
echo "❌ Production health checks failed - rolling back"
sudo systemctl stop signature-auth-production
mv /var/www/signature-auth-production /var/www/signature-auth-production-failed
mv /var/www