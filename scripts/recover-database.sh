#!/bin/bash

# Database recovery script for Hisab Kitab
# This script restores database from a backup file

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "❌ .env file not found. Please create it first."
  exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "❌ Usage: $0 <backup_file.sql.gz>"
  echo "   Example: $0 ./backups/database/full_20240115_120000.sql.gz"
  exit 1
fi

BACKUP_FILE=$1

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "🔄 Starting database recovery..."
echo "📁 Backup file: $BACKUP_FILE"

# Confirm recovery
read -p "⚠️  This will replace the current database. Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Recovery cancelled."
  exit 0
fi

# Stop application services
echo "⏹️ Stopping application services..."
pm2 stop hisab-kitab-api 2>/dev/null || true
pm2 stop hisab-kitab-frontend 2>/dev/null || true

# Extract database name from DATABASE_URL
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

if [ -z "$DB_NAME" ]; then
  echo "❌ Could not extract database name from DATABASE_URL"
  exit 1
fi

echo "🗄️ Database name: $DB_NAME"

# Drop existing database
echo "🗑️ Dropping existing database..."
dropdb "$DB_NAME" 2>/dev/null || true

# Create new database
echo "➕ Creating new database..."
createdb "$DB_NAME"

# Restore from backup
echo "📥 Restoring from backup..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | psql "$DB_NAME"
else
  psql "$DB_NAME" < "$BACKUP_FILE"
fi

echo -e "${GREEN}✅ Database restored successfully${NC}"

# Restart application services
echo "▶️ Restarting application services..."
cd artifacts/api-server
pm2 restart hisab-kitab-api || pm2 start dist/index.js --name hisab-kitab-api
cd ../..

cd artifacts/hisab-kitab
pm2 restart hisab-kitab-frontend || pm2 start 'pnpm run preview' --name hisab-kitab-frontend
cd ../..

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Verify recovery
echo "🏥 Verifying recovery..."
if curl -f http://localhost:3000/api/healthz > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend health check passed${NC}"
else
  echo -e "${YELLOW}⚠️ Backend health check failed (may still be starting)${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ Database recovery completed successfully!${NC}"
echo "========================================"
echo ""
echo "📝 Next steps:"
echo "  1. Verify data integrity"
echo "  2. Test application functionality"
echo "  3. Check for any errors in logs"
echo "  4. Monitor application performance"