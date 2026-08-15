# Version 1 Deployment Guide

## Overview

This guide covers deploying Version 1 of the Hisab Kitab AI Voice Assistant to production. Version 1 includes advanced voice recognition, expanded tool coverage, enhanced AI integration, and robust security features.

## Prerequisites

### System Requirements

**Production Server:**
- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **CPU**: 4 cores minimum (8 cores recommended)
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 50GB minimum (100GB recommended)
- **Network**: Stable internet connection

**Software Requirements:**
- **Node.js**: v18 or higher
- **PostgreSQL**: v14 or higher
- **Nginx**: v1.18+ (for reverse proxy)
- **PM2**: Latest version (for process management)
- **Git**: Latest version

**Optional (for production SSL):**
- **Certbot**: For Let's Encrypt SSL certificates
- **Domain name**: For HTTPS

### Access Requirements

- **Server access**: SSH access to production server
- **Database access**: PostgreSQL superuser or database owner
- **API Keys**: OpenRouter API key (for AI integration)
- **Domain access**: DNS management (if using custom domain)

## Pre-Deployment Checklist

- [ ] Review VERSION_1_SETUP_GUIDE.md for installation instructions
- [ ] Test all Version 1 features in development environment
- [ ] Verify database migrations work correctly
- [ ] Confirm OpenRouter API key is valid
- [ ] Set up production environment variables
- [ ] Configure SSL certificate (if using HTTPS)
- [ ] Set up monitoring and logging
- [ ] Plan backup strategy
- [ ] Test rollback procedure

## Deployment Options

### Option 1: PM2 (Recommended)

**Pros:**
- Simple setup
- Built-in process management
- Auto-restart on failure
- Log management
- Cluster mode for scaling

**Cons:**
- Single server only
- Manual scaling

### Option 2: Docker

**Pros:**
- Containerized deployment
- Consistent environment
- Easy scaling
- Rollback capability

**Cons:**
- Requires Docker knowledge
- More complex setup
- Larger deployment size

### Option 3: Vercel

**Pros:**
- Cloud deployment
- Automatic SSL
- Easy scaling
- No server management

**Cons:**
- Serverless constraints
- Limited to serverless features
- Higher cost for high traffic

**This guide covers Option 1 (PM2) as it's the recommended approach.**

## Step-by-Step Deployment (PM2)

### Step 1: Prepare Production Server

```bash
# SSH into production server
ssh user@your-server.com

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git
```

### Step 2: Clone Repository

```bash
# Navigate to desired directory
cd /var/www

# Clone repository
sudo git clone https://github.com/your-org/Hisab-Kitab.git
cd Hisab-Kitab

# Set permissions
sudo chown -R $USER:$USER /var/www/Hisab-Kitab
```

### Step 3: Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install project dependencies
pnpm install

# Build voice recognition library
cd lib/voice-recognition
pnpm install
pnpm build
cd ../..

# Build the application
pnpm build
```

### Step 4: Configure Environment Variables

Create `.env.production`:

```bash
# Copy example env file
cp .env.example .env.production

# Edit environment variables
nano .env.production
```

Add the following production values:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hisabkitab_v1

# OpenRouter API Configuration
VITE_OPENROUTER_API_KEY=sk-or-production-api-key-here

# JWT Secret (generate secure random string)
JWT_SECRET=your-super-secure-jwt-secret-min-32-characters-long

# Google OAuth (if using)
GOOGLE_CLIENT_ID=production-client-id
GOOGLE_CLIENT_SECRET=production-client-secret

# Version 1 Configuration
V1_ENABLE_WHISPER=true
V1_WHISPER_MODEL=tiny
V1_ENABLE_NOISE_CANCELLATION=true
V1_ENABLE_VAD=true
V1_MAX_CONVERSATION_TURNS=10
V1_COMMAND_HISTORY_RETENTION_DAYS=90
V1_RATE_LIMIT_PER_USER=30
V1_RATE_LIMIT_GLOBAL=1000

# Production Configuration
NODE_ENV=production
PORT=3000
```

### Step 5: Setup Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE hisabkitab_v1;

# Create user (if needed)
CREATE USER hisabkitab_user WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE hisabkitab_v1 TO hisabkitab_user;

# Exit psql
\q

# Run migrations
pnpm --filter @workspace/db migrate

# This will run:
# - Performance optimization migrations (Phase 13)
# - Command history table migration (Version 1)
```

### Step 6: Start Application with PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'hisab-kitab-v1',
    script: 'node',
    args: 'artifacts/hisab-kitab/dist/server/index.js',
    cwd: '/var/www/Hisab-Kitab',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions provided
```

### Step 7: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/hisab-kitab-v1
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for voice processing
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Allow larger file uploads (if needed)
    client_max_body_size 10M;
}
```

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/hisab-kitab-v1 /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 8: Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts
# Certbot will automatically configure Nginx with SSL

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 9: Setup Monitoring

```bash
# Install PM2 monitoring
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss

# Setup PM2 monitoring dashboard
pm2 monit
```

### Step 10: Configure Firewall

```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Deployment Verification

### Check Application Status

```bash
# Check PM2 status
pm2 status

# Check application logs
pm2 logs hisab-kitab-v1

# Check application metrics
pm2 show hisab-kitab-v1
```

### Test Database Connection

```bash
# Connect to database
sudo -u postgres psql hisabkitab_v1

# Check tables
\dt

# Check command_history table exists
SELECT * FROM command_history LIMIT 1;

# Exit
\q
```

### Test API Endpoints

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test API endpoint (requires authentication)
curl http://localhost:3000/api/workers
```

### Test Voice Features

1. Open browser to your domain
2. Test voice recognition (microphone permission)
3. Test Whisper.cpp loading (check console)
4. Test multi-language detection
5. Test context memory
6. Test command history persistence

## Performance Optimization

### Nginx Caching

Add caching to Nginx configuration:

```nginx
# Add to http block in /etc/nginx/nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m use_temp_path=off;

# Add to server block
location /api {
    proxy_cache my_cache;
    proxy_cache_valid 200 10m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    proxy_pass http://localhost:3000;
}
```

### PostgreSQL Optimization

Edit `/etc/postgresql/14/main/postgresql.conf`:

```ini
# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Connection settings
max_connections = 100

# Query optimization
random_page_cost = 1.1
effective_io_concurrency = 200
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### Node.js Optimization

The application uses Phase 13 optimizations, but you can tune further:

```bash
# Increase PM2 instances if needed
pm2 scale hisab-kitab-v1 4

# Adjust memory limit
pm2 set hisab-kitab-v1:max_memory_restart 2G
```

## Backup Strategy

### Database Backup

Create backup script `/var/www/Hisab-Kitab/scripts/backup-db.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/hisabkitab"
mkdir -p $BACKUP_DIR

pg_dump hisabkitab_v1 > $BACKUP_DIR/hisabkitab_v1_$DATE.sql
gzip $BACKUP_DIR/hisabkitab_v1_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "hisabkitab_v1_*.sql.gz" -mtime +7 -delete
```

Make executable and setup cron:

```bash
chmod +x /var/www/Hisab-Kitab/scripts/backup-db.sh

# Add to crontab for daily backup at 2 AM
crontab -e
# Add: 0 2 * * * /var/www/Hisab-Kitab/scripts/backup-db.sh
```

### Application Backup

```bash
# Backup application files
tar -czf /var/backups/hisabkitab/app_$(date +%Y%m%d).tar.gz /var/www/Hisab-Kitab

# Backup PM2 configuration
pm2 save
cp ~/.pm2/dump.pm2 /var/backups/hisabkitab/
```

## Monitoring and Logging

### Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# PM2 keymetrics (optional - online monitoring)
pm2 link <public_key> <secret_key>
```

### Log Monitoring

```bash
# Application logs
tail -f /var/www/Hisab-Kitab/logs/out.log
tail -f /var/www/Hisab-Kitab/logs/err.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-14-main.log
```

### Performance Monitoring

Setup basic monitoring:

```bash
# Install monitoring tools
sudo apt install -y htop iotop

# Monitor system resources
htop

# Monitor disk I/O
iotop
```

## Security Hardening

### SSL Configuration

Edit `/etc/letsencrypt/options-ssl-nginx.conf`:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

### Firewall Rules

```bash
# Restrict database access to localhost only
sudo ufw deny 5432

# Only allow SSH from specific IP (optional)
sudo ufw allow from YOUR_IP to any port 22
```

### Application Security

- Rotate API keys regularly
- Use strong database passwords
- Enable rate limiting (configured in Version 1)
- Keep dependencies updated
- Monitor audit logs regularly

## Rolling Updates

### Update Application

```bash
# Pull latest changes
cd /var/www/Hisab-Kitab
git pull origin main

# Install dependencies
pnpm install

# Build voice recognition
cd lib/voice-recognition
pnpm install
pnpm build
cd ../..

# Build application
pnpm build

# Run migrations (if needed)
pnpm --filter @workspace/db migrate

# Restart PM2
pm2 restart hisab-kitab-v1
```

### Zero-Downtime Deployment

```bash
# PM2 handles zero-downtime reload in cluster mode
pm2 reload hisab-kitab-v1

# If using multiple instances, PM2 will reload one at a time
```

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs hisab-kitab-v1 --lines 100

# Check port is not in use
sudo lsof -i :3000

# Check database connection
sudo -u postgres psql hisabkitab_v1 -c "SELECT 1"
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
sudo -u postgres psql -l

# Check connection string in .env.production
```

### Voice Recognition Issues

```bash
# Check Whisper.cpp is loading
# Look in browser console for WASM load errors

# Check Web Speech API is available
# Open browser console and check window.SpeechRecognition

# Check permissions
# Ensure microphone permission is granted
```

### Performance Issues

```bash
# Check PM2 memory usage
pm2 show hisab-kitab-v1

# Check system resources
htop

# Check database performance
sudo -u postgres psql hisabkitab_v1 -c "SELECT * FROM pg_stat_activity"

# Clear PM2 cache
pm2 flush
```

## Rollback Procedure

### Quick Rollback

```bash
# Stop current version
pm2 stop hisab-kitab-v1

# Revert to previous git commit
cd /var/www/Hisab-Kitab
git log
git checkout <previous-commit-hash>

# Rebuild
pnpm install
cd lib/voice-recognition && pnpm install && pnpm build && cd ../..
pnpm build

# Restart
pm2 start hisab-kitab-v1
```

### Database Rollback

```bash
# Restore from backup
gunzip < /var/backups/hisabkitab/hisabkitab_v1_BACKUP.sql.gz | sudo -u postgres psql hisabkitab_v1
```

## Scaling

### Horizontal Scaling

To run on multiple servers:

1. **Load Balancer**: Setup Nginx load balancer
2. **Shared Database**: All servers connect to same PostgreSQL
3. **Session Storage**: Use Redis for session storage (optional)
4. **CDN**: Use CDN for static assets

Load balancer configuration:

```nginx
upstream hisab_kitab {
    server server1.example.com:3000;
    server server2.example.com:3000;
    server server3.example.com:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://hisab_kitab;
        # ... other proxy settings
    }
}
```

### Vertical Scaling

To scale on single server:

```bash
# Increase PM2 instances
pm2 scale hisab-kitab-v1 4

# Increase memory limit
pm2 set hisab-kitab-v1:max_memory_restart 2G

# Increase PostgreSQL connections
# Edit postgresql.conf: max_connections = 200
```

## Cost Optimization

Version 1 includes cost-optimized AI routing:

**Estimated Costs (with intelligent routing):**
- **Daily**: $0-5 (varies with usage)
- **Monthly**: $0-150 (varies with usage)

**Cost Saving Tips:**
1. Use context memory to reduce repeated queries
2. Leverage caching for repeated commands
3. Use simple phrasing when possible
4. Monitor cost dashboard regularly
5. Adjust model routing preferences

## Support and Maintenance

### Regular Maintenance Tasks

**Daily:**
- Check application logs for errors
- Monitor system resources
- Review audit logs for security events

**Weekly:**
- Review analytics dashboard
- Check anomaly detection reports
- Verify backup completion

**Monthly:**
- Update dependencies
- Review and rotate API keys
- Clean up old command history (if needed)
- Performance review

### Getting Help

For deployment issues:
1. Check this deployment guide
2. Review application logs
3. Check VERSION_1_SETUP_GUIDE.md
4. Check VERSION_1_USER_GUIDE.md
5. Contact your system administrator

## Conclusion

Version 1 is now deployed and ready for production use. The system includes:

- Advanced voice recognition with Whisper.cpp
- Multi-language support (Urdu, Hindi, English)
- Expanded tool coverage (18 tools)
- Enhanced AI integration with context memory
- Robust security with audit logging
- Rich feedback UI with confidence scores
- Persisted command history
- Analytics and monitoring

Regular monitoring and maintenance will ensure optimal performance and security.

---

**Deployment Complete! Hisab Kitab AI Voice Assistant Version 1 is now live.**
