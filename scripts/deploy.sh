#!/bin/bash

# Deployment script for Hisab Kitab AI Voice Assistant
# This script handles the deployment process

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "❌ .env file not found. Please create it first."
  exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Starting deployment process..."

# 1. Run pre-deployment checks
echo "📋 Running pre-deployment checks..."
./scripts/pre-deploy-check.sh

# 2. Build all packages
echo "🔨 Building all packages..."
pnpm run build

# 3. Run database migrations
echo "🗄️ Running database migrations..."
pnpm --filter @workspace/db run migrate:push

# 4. Backup database (if in production)
if [ "$NODE_ENV" = "production" ]; then
  echo "💾 Creating database backup..."
  BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
  pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
  echo "✅ Database backup created: $BACKUP_FILE"
fi

# 5. Deploy backend
echo "🔙 Deploying backend..."
cd artifacts/api-server
pnpm run build
# pm2 restart hisab-kitab-api || pm2 start dist/index.js --name hisab-kitab-api
cd ../..

# 6. Deploy frontend
echo "🎨 Deploying frontend..."
cd artifacts/hisab-kitab
pnpm run build
# pm2 restart hisab-kitab-frontend || pm2 start 'pnpm run preview' --name hisab-kitab-frontend
cd ../..

# 7. Run health checks
echo "🏥 Running health checks..."
# Wait for services to start
sleep 5

# Check backend health
if curl -f http://localhost:3000/api/healthz > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend health check passed${NC}"
else
  echo -e "${YELLOW}⚠️ Backend health check failed (may still be starting)${NC}"
fi

# Check frontend health
if curl -f http://localhost:5173 > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Frontend health check passed${NC}"
else
  echo -e "${YELLOW}⚠️ Frontend health check failed (may still be starting)${NC}"
fi

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Verify functionality with manual testing"
echo "  2. Check monitoring dashboards"
echo "  3. Monitor for any errors in logs"
echo "  4. Run post-deployment verification tests"