#!/bin/bash

# Configuration backup script for Hisab Kitab
# This script backs up environment configurations and important config files

set -e

# Configuration
BACKUP_DIR="./backups/config"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="config_$DATE.tar.gz"
RETENTION_DAYS=90

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "⚙️ Starting configuration backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup
echo "📦 Creating configuration backup..."
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
  .env \
  .env.example \
  artifacts/api-server/.env 2>/dev/null || true \
  artifacts/hisab-kitab/.env 2>/dev/null || true \
  pnpm-workspace.yaml \
  package.json \
  tsconfig.base.json \
  lib/db/drizzle.config.ts 2>/dev/null || true

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)

echo -e "${GREEN}✅ Configuration backup created: $BACKUP_DIR/$BACKUP_FILE ($BACKUP_SIZE)${NC}"

# Upload to cloud storage if AWS credentials are available (optional)
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ] && [ -n "$S3_BUCKET" ]; then
  echo "☁️ Uploading to S3..."
  aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$S3_BUCKET/hisabkitab-configs/"
  echo -e "${GREEN}✅ Configuration backup uploaded to S3${NC}"
else
  echo -e "${YELLOW}⚠️ AWS credentials not configured, skipping S3 upload${NC}"
fi

# Apply retention policy
echo "🧹 Applying retention policy (keeping $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "config_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/config_*.tar.gz 2>/dev/null | wc -l)

echo ""
echo "========================================"
echo "Configuration backup summary:"
echo "  File: $BACKUP_FILE"
echo "  Size: $BACKUP_SIZE"
echo "  Location: $BACKUP_DIR"
echo "  Retention: $RETENTION_DAYS days"
echo "  Total backups: $BACKUP_COUNT"
echo "========================================"
echo -e "${GREEN}✅ Configuration backup completed successfully!${NC}"