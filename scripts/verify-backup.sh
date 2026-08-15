#!/bin/bash

# Backup integrity verification script for Hisab Kitab
# This script verifies that backups can be restored successfully

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "❌ .env file not found. Please create it first."
  exit 1
fi

# Configuration
BACKUP_FILE=$1
TEST_DB_NAME="hisabkitab_backup_test"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if backup file is provided
if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Usage: $0 <backup_file.sql.gz>"
  echo "   Example: $0 ./backups/database/full_20240115_120000.sql.gz"
  exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "🔍 Starting backup integrity verification..."
echo "📁 Backup file: $BACKUP_FILE"

# Create test database
echo "➕ Creating test database: $TEST_DB_NAME"
dropdb "$TEST_DB_NAME" 2>/dev/null || true
createdb "$TEST_DB_NAME"

# Restore backup to test database
echo "📥 Restoring backup to test database..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  if gunzip -c "$BACKUP_FILE" | psql "$TEST_DB_NAME" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backup restoration successful${NC}"
  else
    echo -e "${RED}❌ Backup restoration failed${NC}"
    dropdb "$TEST_DB_NAME"
    exit 1
  fi
else
  if psql "$TEST_DB_NAME" < "$BACKUP_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backup restoration successful${NC}"
  else
    echo -e "${RED}❌ Backup restoration failed${NC}"
    dropdb "$TEST_DB_NAME"
    exit 1
  fi
fi

# Run integrity checks
echo "🔎 Running integrity checks..."

# Check if key tables exist
TABLES=("labour" "projects" "attendance" "daily_expenses" "ai_audit_log")
ALL_TABLES_EXIST=true

for table in "${TABLES[@]}"; do
  TABLE_EXISTS=$(psql -d "$TEST_DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table')")
  if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✓ Table $table exists${NC}"
  else
    echo -e "${RED}✗ Table $table missing${NC}"
    ALL_TABLES_EXIST=false
  fi
done

# Check row counts
echo ""
echo "📊 Row counts:"
psql -d "$TEST_DB_NAME" -c "
  SELECT 
    'labour' as table_name, COUNT(*) as row_count FROM labour
  UNION ALL
  SELECT 'projects', COUNT(*) FROM projects
  UNION ALL
  SELECT 'attendance', COUNT(*) FROM attendance
  UNION ALL
  SELECT 'daily_expenses', COUNT(*) FROM daily_expenses
  UNION ALL
  SELECT 'ai_audit_log', COUNT(*) FROM ai_audit_log;
" 2>/dev/null || echo -e "${YELLOW}⚠️ Could not query row counts${NC}"

# Cleanup test database
echo ""
echo "🧹 Cleaning up test database..."
dropdb "$TEST_DB_NAME"

# Final result
echo ""
echo "========================================"
if [ "$ALL_TABLES_EXIST" = true ]; then
  echo -e "${GREEN}✅ Backup integrity verification PASSED${NC}"
  echo "========================================"
  exit 0
else
  echo -e "${RED}❌ Backup integrity verification FAILED${NC}"
  echo "========================================"
  exit 1
fi