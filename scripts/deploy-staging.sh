#!/bin/bash

# Staging Deployment Script
# Performs safe deployment with health checks and rollback capability

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
STAGING_HOST="${STAGING_HOST:-localhost}"
STAGING_PORT="${STAGING_PORT:-3001}"
STAGING_USER="${STAGING_USER:-deploy}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/signature-auth-staging}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/signature-auth}"
HEALTH_ENDPOINT="http://${STAGING_HOST}:${STAGING_PORT}/health"
DB_NAME="${STAGING_DB_NAME:-signature_auth_staging}"
MAX_RETRIES=5
RETRY_DELAY=10

# Deployment tracking
DEPLOYMENT_ID="staging-$(date +%Y%m%d-%H%M%S)"
DEPLOYMENT_LOG="deployment-${DEPLOYMENT_ID}.log"

echo -e "${BLUE}🚀 Starting Staging Deployment${NC}"
echo "Deployment ID: ${DEPLOYMENT_ID}" | tee $DEPLOYMENT_LOG

# Function to check health endpoint
check_health() {
  local url=$1
  local max_attempts=${2:-3}
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    echo -e "${YELLOW}Checking health (attempt $attempt/$max_attempts)...${NC}"
    
    if curl -f -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
      echo -e "${GREEN}✅ Health check passed${NC}"
      return 0
    fi
    
    sleep $RETRY_DELAY
    ((attempt++))
  done
  
  echo -e "${RED}❌ Health check failed after $max_attempts attempts${NC}"
  return 1
}

# Function to run database migration check
check_database_migrations() {
  echo -e "\n${YELLOW}🗄️  Checking database migrations...${NC}"
  
  # Check if migrations table exists
  MIGRATIONS_EXIST=$(psql -h "$STAGING_HOST" -U "$STAGING_USER" -d "$DB_NAME" -tAc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migrations');" 2>/dev/null || echo "false")
  
  if [ "$MIGRATIONS_EXIST" = "f" ]; then
    echo -e "${YELLOW}⚠️  Migrations table does not exist. Will be created on first run.${NC}"
    return 0
  fi
  
  # Check for pending migrations
  PENDING=$(psql -h "$STAGING_HOST" -U "$STAGING_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM migrations WHERE status = 'pending';" 2>/dev/null || echo "0")
  
  if [ "$PENDING" -gt 0 ]; then
    echo -e "${YELLOW}📋 Found $PENDING pending migrations${NC}"
  else
    echo -e "${GREEN}✅ All migrations are up to date${NC}"
  fi
}

# Function to backup current deployment
backup_current_deployment() {
  echo -e "\n${YELLOW}💾 Backing up current deployment...${NC}"
  
  if [ -d "$DEPLOY_DIR" ]; then
    BACKUP_PATH="${BACKUP_DIR}/${DEPLOYMENT_ID}-backup.tar.gz"
    mkdir -p "$BACKUP_DIR"
    
    tar -czf "$BACKUP_PATH" -C "$(dirname "$DEPLOY_DIR")" "$(basename "$DEPLOY_DIR")" 2>/dev/null || true
    echo -e "${GREEN}✅ Backup created: $BACKUP_PATH${NC}"
  else
    echo -e "${YELLOW}⚠️  No existing deployment to backup${NC}"
  fi
}

# Function to deploy new code
deploy_code() {
  echo -e "\n${YELLOW}📦 Deploying new code...${NC}"
  
  # Create deployment directory if needed
  ssh "${STAGING_USER}@${STAGING_HOST}" "mkdir -p $DEPLOY_DIR"
  
  # Copy build artifacts
  if [ -f "build-*.tar.gz" ]; then
    LATEST_BUILD=$(ls -t build-*.tar.gz | head -1)
    echo "Deploying build: $LATEST_BUILD"
    
    # Transfer and extract
    scp "$LATEST_BUILD" "${STAGING_USER}@${STAGING_HOST}:/tmp/${DEPLOYMENT_ID}.tar.gz"
    ssh "${STAGING_USER}@${STAGING_HOST}" "
      cd $DEPLOY_DIR && \
      tar -xzf /tmp/${DEPLOYMENT_ID}.tar.gz --strip-components=1 && \
      rm /tmp/${DEPLOYMENT_ID}.tar.gz
    "
  else
    echo -e "${RED}❌ No build artifact found. Run build-production.sh first!${NC}"
    exit 1
  fi
  
  # Install production dependencies
  echo -e "${YELLOW}📦 Installing production dependencies...${NC}"
  ssh "${STAGING_USER}@${STAGING_HOST}" "cd $DEPLOY_DIR && npm ci --production"
}

# Function to run database migrations
run_migrations() {
  echo -e "\n${YELLOW}🗄️  Running database migrations...${NC}"
  
  ssh "${STAGING_USER}@${STAGING_HOST}" "
    cd $DEPLOY_DIR && \
    NODE_ENV=staging npm run migrate:up
  " | tee -a $DEPLOYMENT_LOG
  
  if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}❌ Migration failed!${NC}"
    return 1
  fi
  
  echo -e "${GREEN}✅ Migrations completed successfully${NC}"
}

# Function to restart application
restart_application() {
  echo -e "\n${YELLOW}🔄 Restarting application...${NC}"
  
  # Stop existing process
  ssh "${STAGING_USER}@${STAGING_HOST}" "
    if pm2 list | grep -q signature-auth-staging; then
      pm2 stop signature-auth-staging
      pm2 delete signature-auth-staging
    fi
  " 2>/dev/null || true
  
  # Start new process
  ssh "${STAGING_USER}@${STAGING_HOST}" "
    cd $DEPLOY_DIR && \
    pm2 start backend/server.js \
      --name signature-auth-staging \
      --env staging \
      --log ${DEPLOYMENT_ID}.log \
      --time \
      --merge-logs
  "
  
  # Wait for startup
  sleep 5
}

# Function to verify deployment
verify_deployment() {
  echo -e "\n${YELLOW}🔍 Verifying deployment...${NC}"
  
  # Check process is running
  if ! ssh "${STAGING_USER}@${STAGING_HOST}" "pm2 list | grep -q signature-auth-staging"; then
    echo -e "${RED}❌ Application is not running!${NC}"
    return 1
  fi
  
  # Check health endpoint
  if ! check_health "$HEALTH_ENDPOINT" $MAX_RETRIES; then
    return 1
  fi
  
  # Check version
  VERSION=$(curl -s "${HEALTH_ENDPOINT}" | jq -r '.version' 2>/dev/null || echo "unknown")
  echo -e "${GREEN}✅ Deployed version: $VERSION${NC}"
  
  # Run smoke tests
  echo -e "\n${YELLOW}🧪 Running smoke tests...${NC}"
  
  # Test key endpoints
  ENDPOINTS=(
    "/api/status"
    "/api/auth/login"
    "/api/health/db"
  )
  
  for endpoint in "${ENDPOINTS[@]}"; do
    if curl -f -s -o /dev/null "http://${STAGING_HOST}:${STAGING_PORT}${endpoint}"; then
      echo -e "${GREEN}✅ ${endpoint} - OK${NC}"
    else
      echo -e "${YELLOW}⚠️  ${endpoint} - Failed (may require auth)${NC}"
    fi
  done
  
  return 0
}

# Function to rollback deployment
rollback_deployment() {
  echo -e "\n${RED}⚠️  Rolling back deployment...${NC}"
  
  if [ -f "${BACKUP_DIR}/${DEPLOYMENT_ID}-backup.tar.gz" ]; then
    # Restore backup
    ssh "${STAGING_USER}@${STAGING_HOST}" "
      cd $(dirname $DEPLOY_DIR) && \
      rm -rf $(basename $DEPLOY_DIR) && \
      tar -xzf ${BACKUP_DIR}/${DEPLOYMENT_ID}-backup.tar.gz
    "
    
    # Restart with old code
    restart_application
    
    echo -e "${YELLOW}✅ Rollback completed${NC}"
  else
    echo -e "${RED}❌ No backup available for rollback!${NC}"
  fi
}

# Main deployment flow
main() {
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo -e "${BLUE}   Staging Deployment - ${DEPLOYMENT_ID}${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  
  # Pre-deployment checks
  echo -e "\n${YELLOW}📋 Running pre-deployment checks...${NC}"
  
  # 1. Check if build exists
  if [ ! -f build-*.tar.gz ]; then
    echo -e "${RED}❌ No build artifact found. Run ./scripts/build-production.sh first!${NC}"
    exit 1
  fi
  
  # 2. Check staging server connectivity
  if ! ssh -o ConnectTimeout=5 "${STAGING_USER}@${STAGING_HOST}" "echo 'Connected'" &>/dev/null; then
    echo -e "${RED}❌ Cannot connect to staging server${NC}"
    exit 1
  fi
  
  # 3. Check current health (if deployed)
  if curl -f -s -o /dev/null "$HEALTH_ENDPOINT" 2>/dev/null; then
    echo -e "${GREEN}✅ Current deployment is healthy${NC}"
  else
    echo -e "${YELLOW}⚠️  No current deployment or unhealthy${NC}"
  fi
  
  # 4. Check database connectivity
  check_database_migrations
  
  # Start deployment
  echo -e "\n${YELLOW}🚀 Starting deployment process...${NC}"
  
  # Backup current deployment
  backup_current_deployment
  
  # Deploy new code
  if ! deploy_code; then
    echo -e "${RED}❌ Code deployment failed!${NC}"
    exit 1
  fi
  
  # Run migrations
  if ! run_migrations; then
    echo -e "${RED}❌ Database migrations failed!${NC}"
    rollback_deployment
    exit 1
  fi
  
  # Restart application
  restart_application
  
  # Verify deployment
  if ! verify_deployment; then
    echo -e "${RED}❌ Deployment verification failed!${NC}"
    rollback_deployment
    exit 1
  fi
  
  # Success!
  echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ Staging deployment completed successfully!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════${NC}"
  echo -e "Deployment ID: ${DEPLOYMENT_ID}"
  echo -e "Log file: ${DEPLOYMENT_LOG}"
  
  # Generate deployment report
  cat > "deployment-report-${DEPLOYMENT_ID}.json" << EOF
{
  "deploymentId": "${DEPLOYMENT_ID}",
  "environment": "staging",
  "status": "success",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "host": "${STAGING_HOST}",
  "version": "${VERSION}",
  "duration": "$SECONDS seconds"
}
EOF
}

# Run with dry-run support
if [ "${1:-}" = "--dry-run" ]; then
  echo -e "${YELLOW}🔍 DRY RUN MODE - No changes will be made${NC}"
  echo "Would deploy to: ${STAGING_HOST}:${STAGING_PORT}"
  echo "Deploy directory: ${DEPLOY_DIR}"
  echo "Latest build: $(ls -t build-*.tar.gz 2>/dev/null | head -1 || echo 'none')"
  exit 0
fi

# Execute main deployment
main "$@"