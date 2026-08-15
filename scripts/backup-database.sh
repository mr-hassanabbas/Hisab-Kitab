#!/bin/bash

# Database backup script for Hisab Kitab
# This script creates automated database backups with compression and retention policy

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "❌ .env file not found. Please create it first."
  exit 1
fi

# Configuration
BACKUP_DIR="./backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="full_$DATE.sql"
COMPRESSED_FILE="$BACKUP_FILE.gz"
RETENTION_DAYS=30

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "💾 Starting database backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set in environment variables."
  exit 1
fi

# Create full backup
echo "📦 Creating full database backup..."
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/$BACKUP_FILE"

# Compress backup
echo "🗜️ Compressing backup..."
gzip "$BACKUP_DIR/$BACKUP_FILE"

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_FILE" | cut -f1)

echo -e "${GREEN}✅ Backup created: $BACKUP_DIR/$COMPRESSED_FILE ($BACKUP_SIZE)${NC}"

# Upload to cloud storage if AWS credentials are available (optional)
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ] && [ -n "$S3_BUCKET" ]; then
  echo "☁️ Uploading to S3..."
  aws s3 cp "$BACKUP_DIR/$COMPRESSED_FILE" "s3://$S3_BUCKET/hisabkitab-backups/"
  echo -e "${GREEN}✅ Backup uploaded to S3${NC}"
else
  echo -e "${YELLOW}⚠️ AWS credentials not configured, skipping S3 upload${NC}"
fi

# Apply retention policy
echo "🧹 Applying retention policy (keeping $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "full_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/full_*.sql.gz 2>/dev/null | wc -l)

echo ""
echo "========================================"
echo "Backup summary:"
echo "  File: $COMPRESSED_FILE"
echo "  Size: $BACKUP_SIZE"
echo "  Location: $BACKUP_DIR"
echo "  Retention: $RETENTION_DAYS days"
echo "  Total backups: $BACKUP_COUNT"
echo "========================================"
echo -e "${GREEN}✅ Database backup completed successfully!${NC}"