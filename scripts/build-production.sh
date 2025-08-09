#!/bin/bash

# Production Build Script
# Runs strict TypeScript compilation, minifies output, and prepares for deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BUILD_DIR="dist"
SOURCE_MAP_DIR="sourcemaps"
VERSION_FILE="version.json"
BUILD_LOG="build.log"

# Start time for build duration tracking
START_TIME=$(date +%s)

echo -e "${GREEN}🚀 Starting Production Build...${NC}"
echo "Build started at: $(date)" | tee $BUILD_LOG

# 1. Clean previous build
echo -e "\n${YELLOW}📦 Cleaning previous build...${NC}"
rm -rf $BUILD_DIR $SOURCE_MAP_DIR
mkdir -p $BUILD_DIR/{backend,frontend,public} $SOURCE_MAP_DIR

# 2. Generate version file
echo -e "\n${YELLOW}📝 Generating version file...${NC}"
cat > $VERSION_FILE << EOF
{
  "version": "$(git describe --tags --always)",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "commit": "$(git rev-parse HEAD)",
  "branch": "$(git rev-parse --abbrev-ref HEAD)",
  "nodeVersion": "$(node -v)",
  "npmVersion": "$(npm -v)"
}
EOF

# 3. Run TypeScript compilation (strict mode)
echo -e "\n${YELLOW}🔨 Running TypeScript compilation (strict mode)...${NC}"

# Create strict tsconfig for production
cat > tsconfig.production.json << EOF
{
  "extends": "./tsconfig.strict.json",
  "compilerOptions": {
    "outDir": "./dist",
    "sourceMap": true,
    "removeComments": true,
    "declaration": true,
    "declarationMap": true,
    "inlineSources": false,
    "noEmitOnError": true,
    "rootDir": "."
  },
  "include": [
    "src/**/*",
    "backend/**/*",
    "frontend/**/*",
    "scripts/MigrationTracker.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
EOF

# Compile with strict settings
npx tsc -p tsconfig.production.json | tee -a $BUILD_LOG

if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo -e "${RED}❌ TypeScript compilation failed!${NC}"
  exit 1
fi

# 4. Minify JavaScript files
echo -e "\n${YELLOW}🗜️  Minifying JavaScript files...${NC}"

# Install terser if not available
if ! command -v terser &> /dev/null; then
  npm install -g terser
fi

# Function to minify a file
minify_file() {
  local input=$1
  local output=$2
  local map=$3
  
  terser "$input" \
    --compress \
    --mangle \
    --source-map "filename='$map',url='$(basename $map)'" \
    --output "$output" \
    2>> $BUILD_LOG
}

# Minify all JS files
find $BUILD_DIR -name "*.js" -type f | while read -r file; do
  echo "Minifying: $file"
  
  # Generate paths
  relative_path=${file#$BUILD_DIR/}
  map_file="$SOURCE_MAP_DIR/${relative_path}.map"
  mkdir -p "$(dirname "$map_file")"
  
  # Create temp file for minified version
  temp_file="${file}.tmp"
  
  # Minify
  minify_file "$file" "$temp_file" "$map_file"
  
  # Replace original with minified
  mv "$temp_file" "$file"
done

# 5. Copy static assets
echo -e "\n${YELLOW}📁 Copying static assets...${NC}"

# Copy frontend HTML and CSS
cp -r frontend/*.html $BUILD_DIR/frontend/ 2>/dev/null || true
cp -r frontend/*.css $BUILD_DIR/frontend/ 2>/dev/null || true
cp -r frontend/styles $BUILD_DIR/frontend/ 2>/dev/null || true

# Copy public assets if they exist
if [ -d "public" ]; then
  cp -r public/* $BUILD_DIR/public/ 2>/dev/null || true
fi

# Copy configuration files (excluding sensitive data)
cp package.json $BUILD_DIR/
cp package-lock.json $BUILD_DIR/
cp $VERSION_FILE $BUILD_DIR/

# 6. Generate production environment template
echo -e "\n${YELLOW}🔐 Creating environment template...${NC}"
cat > $BUILD_DIR/.env.production.template << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=

# Security
JWT_SECRET=
SESSION_SECRET=

# Monitoring
ENABLE_MONITORING=true
MONITORING_INTERVAL=60000
ALERT_EMAIL=
ALERT_WEBHOOK=

# Performance
MAX_MEMORY_MB=512
REQUEST_TIMEOUT_MS=30000
EOF

# 7. Validate build output
echo -e "\n${YELLOW}✅ Validating build output...${NC}"

# Check required files exist
REQUIRED_FILES=(
  "$BUILD_DIR/backend/server.js"
  "$BUILD_DIR/frontend/app.js"
  "$BUILD_DIR/package.json"
  "$BUILD_DIR/$VERSION_FILE"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ Missing required file: $file${NC}"
    exit 1
  fi
done

# 8. Calculate build metrics
END_TIME=$(date +%s)
BUILD_TIME=$((END_TIME - START_TIME))

# Get build size
BUILD_SIZE=$(du -sh $BUILD_DIR | cut -f1)

# Count files
FILE_COUNT=$(find $BUILD_DIR -type f | wc -l)

# 9. Type coverage check
echo -e "\n${YELLOW}📊 Checking type coverage...${NC}"
TYPE_COVERAGE=$(npx type-coverage --ignore-catch --detail | grep "^Coverage" | awk '{print $2}' | sed 's/%//')

if (( $(echo "$TYPE_COVERAGE < 95" | bc -l) )); then
  echo -e "${YELLOW}⚠️  Warning: Type coverage is ${TYPE_COVERAGE}% (target: 95%)${NC}"
fi

# 10. Generate build report
cat > $BUILD_DIR/build-report.json << EOF
{
  "buildTime": $BUILD_TIME,
  "buildSize": "$BUILD_SIZE",
  "fileCount": $FILE_COUNT,
  "typeCoverage": "$TYPE_COVERAGE%",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "success": true
}
EOF

# 11. Create deployment package
echo -e "\n${YELLOW}📦 Creating deployment package...${NC}"
tar -czf "build-$(date +%Y%m%d-%H%M%S).tar.gz" $BUILD_DIR

# Summary
echo -e "\n${GREEN}✅ Production build completed successfully!${NC}"
echo -e "Build time: ${BUILD_TIME}s"
echo -e "Build size: ${BUILD_SIZE}"
echo -e "Files: ${FILE_COUNT}"
echo -e "Type coverage: ${TYPE_COVERAGE}%"

# Check if build time exceeds threshold
if [ $BUILD_TIME -gt 60 ]; then
  echo -e "${YELLOW}⚠️  Warning: Build time exceeded 60 seconds threshold${NC}"
  exit 2
fi

# Clean up temporary files
rm -f tsconfig.production.json

echo -e "\n${GREEN}🎉 Build ready for deployment!${NC}"