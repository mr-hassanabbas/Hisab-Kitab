#!/bin/bash

# Post-deployment verification script
# This script verifies that the deployment was successful

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Running post-deployment verification..."

# Track check results
PASSED=0
FAILED=0

# Function to check and report
check() {
  local name=$1
  local command=$2
  
  echo -n "Checking $name... "
  if eval "$command"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
  fi
}

# 1. Check backend health
check "Backend health" "curl -f http://localhost:3000/api/healthz > /dev/null 2>&1"

# 2. Check frontend health
check "Frontend health" "curl -f http://localhost:5173 > /dev/null 2>&1"

# 3. Check database connection
check "Database connection" "pnpm --filter @workspace/db run db:push"

# 4. Check AI endpoints
check "AI intent endpoint" "curl -f http://localhost:3000/api/ai/v2/intent > /dev/null 2>&1 || true"

# 5. Check tools endpoint
check "Tools endpoint" "curl -f http://localhost:3000/api/tools > /dev/null 2>&1 || true"

# 6. Check build output exists
check "Backend build output" "test -d artifacts/api-server/dist"
check "Frontend build output" "test -d artifacts/hisab-kitab/dist"

# 7. Check for process errors
if pm2 list > /dev/null 2>&1; then
  check "Backend process running" "pm2 status hisab-kitab-api | grep -q 'online'"
  check "Frontend process running" "pm2 status hisab-kitab-frontend | grep -q 'online' || true"
fi

# Print summary
echo ""
echo "========================================"
echo "Post-deployment verification summary:"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "========================================"

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Post-deployment verification failed. Please check the issues above.${NC}"
  echo ""
  echo "📝 Troubleshooting steps:"
  echo "  1. Check application logs: pm2 logs"
  echo "  2. Check error logs in the application"
  echo "  3. Verify environment variables are set correctly"
  echo "  4. Check database connection"
  echo "  5. Consider rollback if issues persist"
  exit 1
else
  echo -e "${GREEN}✅ All post-deployment verification checks passed.${NC}"
  echo ""
  echo "📝 Recommended next steps:"
  echo "  1. Perform manual testing of key features"
  echo "  2. Test AI voice commands"
  echo "  3. Monitor error logs for the next hour"
  echo "  4. Check monitoring dashboards"
  echo "  5. Verify performance metrics"
  exit 0
fi