#!/bin/bash

# Pre-deployment checks for Hisab Kitab AI Voice Assistant
# This script verifies all requirements before deployment

set -e

echo "🔍 Running pre-deployment checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# 1. Check Node.js version
check "Node.js version >= 22" "node --version | grep -qE 'v2[2-9]\.'"

# 2. Check pnpm version
check "pnpm version >= 9" "pnpm --version | grep -qE '[9-9]\.'"

# 3. Check if all dependencies are installed
check "Dependencies installed" "test -d node_modules"

# 4. Run TypeScript compilation
check "TypeScript compilation" "pnpm run typecheck:libs"

# 5. Run all tests
check "All tests passing" "pnpm test -- --run"

# 6. Check environment variables
check "Environment variables configured" "test -f .env"

# 7. Check for required environment variables
if [ -f .env ]; then
  check "DATABASE_URL set" "grep -q 'DATABASE_URL=' .env"
  check "JWT_SECRET set" "grep -q 'JWT_SECRET=' .env"
else
  echo -e "${YELLOW}⚠ .env file not found${NC}"
  ((FAILED++))
fi

# 8. Check database connection (if DATABASE_URL is set)
if [ -f .env ] && grep -q 'DATABASE_URL=' .env; then
  check "Database connection" "pnpm --filter @workspace/db run db:push"
fi

# 9. Check build output exists
check "Frontend build" "test -d artifacts/hisab-kitab/dist || pnpm --filter @workspace/hisab-kitab run build"
check "Backend build" "test -d artifacts/api-server/dist || pnpm --filter @workspace/api-server run build"

# 10. Check for security issues
check "Security audit" "pnpm audit --audit-level moderate"

# Print summary
echo ""
echo "========================================"
echo "Pre-deployment check summary:"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "========================================"

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Pre-deployment checks failed. Please fix the issues above.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All pre-deployment checks passed. Ready for deployment.${NC}"
  exit 0
fi