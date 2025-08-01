#!/bin/bash

# Production Deployment Script
# Blue-green deployment with comprehensive health checks and automatic rollback

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
PROD_HOST="${PROD_HOST:-localhost}"
PROD_PORT_BLUE="${PROD_PORT_BLUE:-3000}"
PROD_PORT_GREEN="${PROD_PORT_GREEN:-3001}"
PROD_USER="${PROD_USER:-deploy}"
DEPLOY_DIR_BLUE="${DEPLOY_DIR_BLUE:-/var/www/signature-auth-blue}"
DEPLOY_DIR_GREEN="${DEPLOY_DIR_GREEN:-/var/www/signature-auth-green}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/signature-auth}"
DB_NAME="${PROD_DB_NAME:-signature_auth_production}"
LOAD_BALANCER_CONFIG="${LB_CONFIG:-/etc/nginx/sites-available/signature-auth}"

# Performance thresholds
MAX_RESPONSE_TIME=220  # baseline + 10%
MAX_MEMORY_MB=614     # baseline + 20%
MIN_TYPE_COVERAGE=95

# Notification settings
ALERT_EMAIL="${ALERT_EMAIL:-ops@example.com}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Deployment tracking
DEPLOYMENT_ID="prod-$(date +%Y%m%d-%H%M%S)"
DEPLOYMENT_LOG="deployment-${DEPLOYMENT_ID}.log"

# Determine active/inactive environments
get_active_env() {
  if curl -f -s "http://${PROD_HOST}:${PROD_PORT_BLUE}/health" &>/dev/null; then
    echo "blue"
  else
    echo "green"
  fi
}

ACTIVE_ENV=$(get_active_env)
INACTIVE_ENV=$([[ "$ACTIVE_ENV" == "blue" ]] && echo "green" || echo "blue")
INACTIVE_PORT=$([[ "$INACTIVE_ENV" == "blue" ]] && echo "$PROD_PORT_BLUE" || echo "$PROD_PORT_GREEN")
INACTIVE_DIR=$([[ "$INACTIVE_ENV" == "blue" ]] && echo "$DEPLOY_DIR_BLUE" || echo "$DEPLOY_DIR_GREEN")

echo -e "${MAGENTA}🚀 Starting Production Deployment${NC}"
echo "Deployment ID: ${DEPLOYMENT_ID}" | tee $DEPLOYMENT_LOG
echo "Active: ${ACTIVE_ENV} | Deploying to: ${INACTIVE_ENV}"

# Function to send notifications
send_notification() {
  local level=$1
  local message=$2
  
  # Email notification
  if [ -n "$ALERT_EMAIL" ]; then
    echo "$message" | mail -s "[${level}] Deployment ${DEPLOYMENT_ID}" "$ALERT_EMAIL" 2>/dev/null || true
  fi
  
  # Webhook notification
  if [ -n "$ALERT_WEBHOOK" ]; then
    curl -X POST "$ALERT_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{\"level\":\"${level}\",\"deployment\":\"${DEPLOYMENT_ID}\",\"message\":\"${message}\"}" \
      2>/dev/null || true
  fi
  
  # Slack notification
  if [ -n "$SLACK_WEBHOOK" ]; then
    local emoji="📢"
    [[ "$level" == "ERROR" ]] && emoji="🚨"
    [[ "$level" == "SUCCESS" ]] && emoji="✅"
    
    curl -X POST "$SLACK_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"${emoji} ${message}\"}" \
      2>/dev/null || true
  fi
}

# Function to check performance metrics
check_performance_metrics() {
  local host=$1
  local port=$2
  echo -e "\n${YELLOW}📊 Checking performance metrics...${NC}"
  
  # Response time check
  RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "http://${host}:${port}/api/status" | awk '{print int($1*1000)}')
  echo "Response time: ${RESPONSE_TIME}ms (max: ${MAX_RESPONSE_TIME}ms)"
  
  if [ "$RESPONSE_TIME" -gt "$MAX_RESPONSE_TIME" ]; then
    echo -e "${RED}❌ Response time exceeds threshold!${NC}"
    return 1
  fi
  
  # Memory usage check
  MEMORY_USAGE=$(ssh "${PROD_USER}@${PROD_HOST}" "
    pm2 info signature-auth-${INACTIVE_ENV} | grep 'memory' | awk '{print \$3}' | sed 's/mb//i'
  " 2>/dev/null || echo "0")
  
  echo "Memory usage: ${MEMORY_USAGE}MB (max: ${MAX_MEMORY_MB}MB)"
  
  if [ "${MEMORY_USAGE%%.*}" -gt "$MAX_MEMORY_MB" ]; then
    echo -e "${RED}❌ Memory usage exceeds threshold!${NC}"
    return 1
  fi
  
  echo -e "${GREEN}✅ Performance metrics within acceptable range${NC}"
  return 0
}

# Function to run comprehensive health checks
comprehensive_health_check() {
  local host=$1
  local port=$2
  local environment=$3
  echo -e "\n${YELLOW}🏥 Running comprehensive health checks for ${environment}...${NC}"
  
  # Basic health check
  if ! curl -f -s "http://${host}:${port}/health" &>/dev/null; then
    echo -e "${RED}❌ Basic health check failed${NC}"
    return 1
  fi
  
  # Database connectivity
  DB_STATUS=$(curl -s "http://${host}:${port}/api/health/db" | jq -r '.status' 2>/dev/null || echo "error")
  if [ "$DB_STATUS" != "healthy" ]; then
    echo -e "${RED}❌ Database connectivity check failed${NC}"
    return 1
  fi
  
  # Feature availability checks
  FEATURES=(
    "/api/auth/status"
    "/api/shapes/metadata"
    "/api/analytics/summary"
  )
  
  for feature in "${FEATURES[@]}"; do
    if curl -f -s -o /dev/null "http://${host}:${port}${feature}"; then
      echo -e "${GREEN}✅ ${feature} - Available${NC}"
    else
      echo -e "${YELLOW}⚠️  ${feature} - Not available (may require auth)${NC}"
    fi
  done
  
  # Performance metrics
  if ! check_performance_metrics "$host" "$port"; then
    return 1
  fi
  
  echo -e "${GREEN}✅ All health checks passed${NC}"
  return 0
}

# Function to perform canary testing
canary_test() {
  local host=$1
  local port=$2
  echo -e "\n${YELLOW}🐤 Running canary tests...${NC}"
  
  # Send synthetic traffic
  echo "Sending synthetic requests..."
  
  for i in {1..10}; do
    START_TIME=$(date +%s%N)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${host}:${port}/api/status")
    END_TIME=$(date +%s%N)
    DURATION=$((($END_TIME - $START_TIME) / 1000000))
    
    if [ "$HTTP_CODE" = "200" ]; then
      echo -e "${GREEN}Request $i: ${DURATION}ms - OK${NC}"
    else
      echo -e "${RED}Request $i: Failed with HTTP ${HTTP_CODE}${NC}"
      return 1
    fi
    
    sleep 0.5
  done
  
  echo -e "${GREEN}✅ Canary tests completed successfully${NC}"
  return 0
}

# Function to switch load balancer
switch_load_balancer() {
  local new_active=$1
  echo -e "\n${YELLOW}🔀 Switching load balancer to ${new_active}...${NC}"
  
  # Update nginx configuration
  NEW_PORT=$([[ "$new_active" == "blue" ]] && echo "$PROD_PORT_BLUE" || echo "$PROD_PORT_GREEN")
  
  ssh "${PROD_USER}@${PROD_HOST}" "
    sudo sed -i 's/proxy_pass http:\/\/127.0.0.1:[0-9]*/proxy_pass http:\/\/127.0.0.1:${NEW_PORT}/' $LOAD_BALANCER_CONFIG
    sudo nginx -t && sudo systemctl reload nginx
  "
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Load balancer switched to ${new_active}${NC}"
    return 0
  else
    echo -e "${RED}❌ Failed to switch load balancer${NC}"
    return 1
  fi
}

# Function to monitor post-deployment
monitor_post_deployment() {
  echo -e "\n${YELLOW}📈 Monitoring post-deployment metrics (5 minutes)...${NC}"
  
  local start_time=$(date +%s)
  local errors=0
  local high_response_times=0
  
  while [ $(($(date +%s) - start_time)) -lt 300 ]; do
    # Check response time
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "http://${PROD_HOST}/api/status" | awk '{print int($1*1000)}')
    
    if [ "$RESPONSE_TIME" -gt "$MAX_RESPONSE_TIME" ]; then
      ((high_response_times++))
      echo -e "${YELLOW}⚠️  High response time: ${RESPONSE_TIME}ms${NC}"
    fi
    
    # Check for errors
    ERROR_COUNT=$(ssh "${PROD_USER}@${PROD_HOST}" "
      pm2 logs signature-auth-${INACTIVE_ENV} --lines 100 --nostream | grep -c 'ERROR' || echo 0
    " 2>/dev/null)
    
    if [ "$ERROR_COUNT" -gt "$errors" ]; then
      errors=$ERROR_COUNT
      echo -e "${YELLOW}⚠️  New errors detected: ${errors} total${NC}"
    fi
    
    # Check if we need to rollback
    if [ "$high_response_times" -gt 5 ] || [ "$errors" -gt 10 ]; then
      echo -e "${RED}❌ Post-deployment monitoring failed!${NC}"
      return 1
    fi
    
    sleep 30
  done
  
  echo -e "${GREEN}✅ Post-deployment monitoring completed successfully${NC}"
  echo "Total errors: ${errors}"
  echo "High response times: ${high_response_times}"
  return 0
}

# Main deployment function
main() {
  echo -e "${MAGENTA}═══════════════════════════════════════════${NC}"
  echo -e "${MAGENTA}   Production Deployment - ${DEPLOYMENT_ID}${NC}"
  echo -e "${MAGENTA}   Blue-Green Strategy: ${ACTIVE_ENV} → ${INACTIVE_ENV}${NC}"
  echo -e "${MAGENTA}═══════════════════════════════════════════${NC}"
  
  send_notification "INFO" "Starting production deployment ${DEPLOYMENT_ID}"
  
  # Pre-deployment validation
  echo -e "\n${YELLOW}🔍 Pre-deployment validation...${NC}"
  
  # 1. Check build artifact
  if [ ! -f build-*.tar.gz ]; then
    echo -e "${RED}❌ No build artifact found!${NC}"
    send_notification "ERROR" "Deployment failed: No build artifact"
    exit 1
  fi
  
  # 2. Verify staging deployment
  echo "Checking staging environment..."
  if ! curl -f -s "http://${STAGING_HOST:-staging.example.com}/health" &>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: Staging is not healthy${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
  
  # 3. Check type coverage
  if [ -f "dist/build-report.json" ]; then
    TYPE_COVERAGE=$(jq -r '.typeCoverage' dist/build-report.json | sed 's/%//')
    if (( $(echo "$TYPE_COVERAGE < $MIN_TYPE_COVERAGE" | bc -l) )); then
      echo -e "${RED}❌ Type coverage ${TYPE_COVERAGE}% is below minimum ${MIN_TYPE_COVERAGE}%${NC}"
      send_notification "ERROR" "Deployment failed: Low type coverage"
      exit 1
    fi
  fi
  
  # 4. Backup current production
  echo -e "\n${YELLOW}💾 Backing up current production...${NC}"
  ACTIVE_DIR=$([[ "$ACTIVE_ENV" == "blue" ]] && echo "$DEPLOY_DIR_BLUE" || echo "$DEPLOY_DIR_GREEN")
  
  ssh "${PROD_USER}@${PROD_HOST}" "
    mkdir -p $BACKUP_DIR
    tar -czf ${BACKUP_DIR}/prod-${DEPLOYMENT_ID}-backup.tar.gz -C $(dirname $ACTIVE_DIR) $(basename $ACTIVE_DIR)
  "
  
  # Deploy to inactive environment
  echo -e "\n${YELLOW}📦 Deploying to ${INACTIVE_ENV} environment...${NC}"
  
  # Transfer and extract build
  LATEST_BUILD=$(ls -t build-*.tar.gz | head -1)
  scp "$LATEST_BUILD" "${PROD_USER}@${PROD_HOST}:/tmp/${DEPLOYMENT_ID}.tar.gz"
  
  ssh "${PROD_USER}@${PROD_HOST}" "
    mkdir -p $INACTIVE_DIR
    cd $INACTIVE_DIR
    tar -xzf /tmp/${DEPLOYMENT_ID}.tar.gz --strip-components=1
    rm /tmp/${DEPLOYMENT_ID}.tar.gz
    npm ci --production
  "
  
  # Run database migrations
  echo -e "\n${YELLOW}🗄️  Running database migrations...${NC}"
  ssh "${PROD_USER}@${PROD_HOST}" "
    cd $INACTIVE_DIR
    NODE_ENV=production npm run migrate:up
  "
  
  # Start application in inactive environment
  echo -e "\n${YELLOW}🚀 Starting application in ${INACTIVE_ENV}...${NC}"
  ssh "${PROD_USER}@${PROD_HOST}" "
    pm2 delete signature-auth-${INACTIVE_ENV} 2>/dev/null || true
    cd $INACTIVE_DIR
    PORT=${INACTIVE_PORT} pm2 start backend/server.js \
      --name signature-auth-${INACTIVE_ENV} \
      --env production \
      --time \
      --merge-logs
  "
  
  sleep 10
  
  # Run comprehensive health checks
  if ! comprehensive_health_check "$PROD_HOST" "$INACTIVE_PORT" "$INACTIVE_ENV"; then
    echo -e "${RED}❌ Health checks failed!${NC}"
    ssh "${PROD_USER}@${PROD_HOST}" "pm2 delete signature-auth-${INACTIVE_ENV}"
    send_notification "ERROR" "Deployment failed: Health checks"
    exit 1
  fi
  
  # Run canary tests
  if ! canary_test "$PROD_HOST" "$INACTIVE_PORT"; then
    echo -e "${RED}❌ Canary tests failed!${NC}"
    ssh "${PROD_USER}@${PROD_HOST}" "pm2 delete signature-auth-${INACTIVE_ENV}"
    send_notification "ERROR" "Deployment failed: Canary tests"
    exit 1
  fi
  
  # Switch load balancer
  if ! switch_load_balancer "$INACTIVE_ENV"; then
    echo -e "${RED}❌ Failed to switch load balancer!${NC}"
    ssh "${PROD_USER}@${PROD_HOST}" "pm2 delete signature-auth-${INACTIVE_ENV}"
    send_notification "ERROR" "Deployment failed: Load balancer switch"
    exit 1
  fi
  
  # Monitor post-deployment
  if ! monitor_post_deployment; then
    echo -e "${RED}❌ Post-deployment monitoring detected issues!${NC}"
    echo -e "${YELLOW}🔄 Rolling back...${NC}"
    switch_load_balancer "$ACTIVE_ENV"
    ssh "${PROD_USER}@${PROD_HOST}" "pm2 delete signature-auth-${INACTIVE_ENV}"
    send_notification "ERROR" "Deployment rolled back: Post-deployment issues"
    exit 1
  fi
  
  # Stop old environment
  echo -e "\n${YELLOW}🛑 Stopping old ${ACTIVE_ENV} environment...${NC}"
  ssh "${PROD_USER}@${PROD_HOST}" "pm2 delete signature-auth-${ACTIVE_ENV} 2>/dev/null || true"
  
  # Success!
  echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ Production deployment completed successfully!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════${NC}"
  echo -e "Deployment ID: ${DEPLOYMENT_ID}"
  echo -e "New active environment: ${INACTIVE_ENV}"
  echo -e "Duration: $SECONDS seconds"
  
  # Generate deployment report
  cat > "deployment-report-${DEPLOYMENT_ID}.json" << EOF
{
  "deploymentId": "${DEPLOYMENT_ID}",
  "environment": "production",
  "status": "success",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "previousEnv": "${ACTIVE_ENV}",
  "newEnv": "${INACTIVE_ENV}",
  "duration": "$SECONDS seconds",
  "buildArtifact": "${LATEST_BUILD}"
}
EOF
  
  send_notification "SUCCESS" "Production deployment ${DEPLOYMENT_ID} completed successfully!"
}

# Command line options
case "${1:-}" in
  --dry-run)
    echo -e "${YELLOW}🔍 DRY RUN MODE${NC}"
    echo "Active environment: ${ACTIVE_ENV}"
    echo "Would deploy to: ${INACTIVE_ENV}"
    echo "Inactive port: ${INACTIVE_PORT}"
    echo "Inactive directory: ${INACTIVE_DIR}"
    ;;
  --status)
    echo -e "${BLUE}Current Production Status:${NC}"
    echo "Active environment: ${ACTIVE_ENV}"
    curl -s "http://${PROD_HOST}/health" | jq '.' || echo "Health check failed"
    ;;
  --rollback)
    echo -e "${YELLOW}🔄 Manual rollback initiated${NC}"
    switch_load_balancer "$ACTIVE_ENV"
    ;;
  *)
    main "$@"
    ;;
esac