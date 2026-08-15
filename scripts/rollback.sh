#!/bin/bash

# Rollback script for Hisab Kitab AI Voice Assistant
# This script handles rollback to previous version

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔄 Starting rollback process..."

# 1. Confirm rollback
read -p "Are you sure you want to rollback? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Rollback cancelled."
  exit 0
fi

# 2. Stop services
echo "⏹️ Stopping services..."
pm2 stop hisab-kitab-api || true
pm2 stop hisab-kitab-frontend || true

# 3. Revert to previous commit
echo "📦 Reverting to previous commit..."
git revert HEAD --no-edit

# 4. Rebuild
echo "🔨 Rebuilding..."
pnpm run build

# 5. Rollback database if needed
read -p "Rollback database as well? (yes/no): " DB_ROLLBACK
if [ "$DB_ROLLBACK" = "yes" ]; then
  echo "🗄️ Rolling back database..."
  # Find the latest backup file
  BACKUP_FILE=$(ls -t backup_*.sql 2>/dev/null | head -n 1)
  if [ -n "$BACKUP_FILE" ]; then
    psql "$DATABASE_URL" < "$BACKUP_FILE"
    echo "✅ Database restored from: $BACKUP_FILE"
  else
    echo -e "${YELLOW}⚠️ No backup file found, skipping database rollback${NC}"
  fi
fi

# 6. Restart services
echo "▶️ Restarting services..."
cd artifacts/api-server
pm2 restart hisab-kitab-api || pm2 start dist/index.js --name hisab-kitab-api
cd ../..

cd artifacts/hisab-kitab
pm2 restart hisab-kitab-frontend || pm2 start 'pnpm run preview' --name hisab-kitab-frontend
cd ../..

# 7. Verify rollback
echo "🏥 Verifying rollback..."
sleep 5

if curl -f http://localhost:3000/api/healthz > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend health check passed${NC}"
else
  echo -e "${RED}❌ Backend health check failed${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Rollback completed successfully!${NC}"
echo ""
echo "📝 Please verify that the application is working correctly."