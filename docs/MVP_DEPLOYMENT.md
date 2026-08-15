# Hisab Kitab MVP - Deployment Configuration

## Production Deployment Guide

This guide covers deploying the Hisab Kitab MVP to production environment.

## Pre-Deployment Checklist

### Code Verification
- [ ] All MVP components implemented and tested
- [ ] Voice recognition tested in Urdu, English, and mixed
- [ ] AI integration working with OpenRouter
- [ ] Security features tested and verified
- [ ] Error handling and retry logic working
- [ ] Command history functionality tested

### Environment Setup
- [ ] Production database configured
- [ ] OpenRouter API key configured
- [ ] JWT secrets configured
- [ ] Environment variables set
- [ ] SSL certificates configured
- [ ] Domain name configured

### Database Preparation
- [ ] Database migrations run
- [ ] Performance indexes created (Phase 13)
- [ ] Backup procedures tested
- [ ] Database connection verified
- [ ] User accounts created

### Monitoring Setup
- [ ] Error logging configured
- [ ] Performance monitoring setup
- [ ] Cost monitoring configured
- [ ] Alert system tested
- [ ] Dashboard access configured

## Environment Configuration

### Production Environment Variables

Create `.env.production`:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hisabkitab_prod

# OpenRouter API Configuration
VITE_OPENROUTER_API_KEY=sk-or-production-api-key-here

# JWT Configuration
JWT_SECRET=production-jwt-secret-min-32-chars

# OAuth Configuration (if using Google OAuth)
GOOGLE_CLIENT_ID=production-client-id
GOOGLE_CLIENT_SECRET=production-client-secret

# Application Configuration
NODE_ENV=production
API_BASE_URL=https://your-domain.com
APP_URL=https://your-domain.com

# MVP Configuration
MVP_DAILY_BUDGET=10.00
MVP_MONTHLY_BUDGET=300.00
MVP_CACHE_TTL=300000
MVP_MAX_CACHE_SIZE=52428800
MVP_MAX_RETRIES=3

# Monitoring Configuration
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_COST_MONITORING=true
LOG_LEVEL=info
```

## Build Process

### 1. Production Build

```bash
# Install dependencies
pnpm install

# Build the application
pnpm build

# Build specific packages
pnpm --filter @workspace/ai-gateway run build
pnpm --filter @workspace/cost run build
pnpm --filter @workspace/security run build
pnpm --filter @workspace/observability run build
pnpm --filter @workspace/tools run build
```

### 2. Database Migration

```bash
# Run database migrations
pnpm --filter @workspace/db migrate:prod

# Verify database schema
pnpm --filter @workspace/db generate

# Backup database before migration
pg_dump hisabkitab_prod > backup_pre_migration.sql
```

### 3. Environment Validation

```bash
# Test environment variables
node -e "console.log(process.env.DATABASE_URL)"

# Test database connection
pnpm --filter @workspace/db test:connection

# Test OpenRouter connection
curl -H "Authorization: Bearer $VITE_OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models
```

## Deployment Options

### Option 1: PM2 Deployment (Recommended)

#### Install PM2
```bash
npm install -g pm2
```

#### Create Ecosystem File
Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'hisab-kitab-mvp',
      script: 'node_modules/.bin/vite',
      args: 'preview',
      cwd: '/home/hassanabbas/Hisab-Kitab/artifacts/hisab-kitab',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5173
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
```

#### Start Application
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable PM2 startup on boot
pm2 startup
```

### Option 2: Docker Deployment

#### Create Dockerfile
Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install

# Copy application files
COPY . .

# Build application
RUN pnpm build

# Expose port
EXPOSE 5173

# Start application
CMD ["pnpm", "preview"]
```

#### Build and Run
```bash
# Build Docker image
docker build -t hisab-kitab-mvp .

# Run container
docker run -d -p 5173:5173 \
  -e DATABASE_URL=$DATABASE_URL \
  -e VITE_OPENROUTER_API_KEY=$VITE_OPENROUTER_API_KEY \
  --name hisab-kitab-mvp \
  hisab-kitab-mvp
```

### Option 3: Vercel Deployment

#### Install Vercel CLI
```bash
npm install -g vercel
```

#### Deploy
```bash
# Login to Vercel
vercel login

# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
```

## SSL/HTTPS Configuration

### Using Nginx

Create nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Using Let's Encrypt

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

## Post-Deployment Verification

### Health Checks

```bash
# Check application is running
curl https://your-domain.com

# Check API health
curl https://your-domain.com/api/healthz

# Check database connection
curl https://your-domain.com/api/db/health
```

### Functionality Tests

Test these key MVP features:

1. **Voice Recognition**
   - Test Urdu commands
   - Test English commands
   - Test mixed language commands

2. **AI Integration**
   - Test attendance marking
   - Test worker creation
   - Test expense recording

3. **Security**
   - Test permission enforcement
   - Test input validation
   - Test error handling

4. **Performance**
   - Check response times
   - Verify caching works
   - Monitor cost usage

## Monitoring Setup

### Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# Check logs
pm2 logs hisab-kitab-mvp

# View metrics
pm2 show hisab-kitab-mvp
```

### Database Monitoring

```bash
# Check database size
psql -c "SELECT pg_sizeof('attendance');"

# Check query performance
psql -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check index usage
psql -c "SELECT * FROM pg_stat_user_indexes;"
```

### Cost Monitoring

Monitor through the application dashboard or:
```bash
# Check OpenRouter usage
curl -H "Authorization: Bearer $VITE_OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/usage
```

## Backup Strategy

### Automated Backups

Create backup script `/usr/local/bin/backup-hisabkitab.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/hisabkitab"
DATABASE_URL="postgres://user:pass@localhost:5432/hisabkitab_prod"

# Database backup
pg_dump $DATABASE_URL > "$BACKUP_DIR/db_$DATE.sql"
gzip "$BACKUP_DIR/db_$DATE.sql"

# Configuration backup
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
  /home/hassanabbas/Hisab-Kitab/.env.production

# Retention policy (keep 30 days)
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +90 -delete
```

### Cron Jobs

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-hisabkitab.sh

# Add cost monitoring report at 8 AM
0 8 * * * /usr/local/bin/cost-report.sh
```

## Scaling Considerations

### Horizontal Scaling

For higher traffic:

1. **Load Balancer**: Use Nginx or HAProxy
2. **Multiple Instances**: Run multiple app instances
3. **Database Pooling**: Configure connection pooling
4. **Redis Cache**: Add Redis for distributed caching

### Vertical Scaling

For better performance:

1. **More RAM**: Increase server memory to 8GB+
2. **Better CPU**: Use multi-core processors
3. **Faster Storage**: Use SSD instead of HDD
4. **Database Optimization**: Tune PostgreSQL settings

## Rollback Procedure

### Quick Rollback

```bash
# Stop current version
pm2 stop hisab-kitab-mvp

# Switch to previous version
git checkout previous-version-tag
pnpm install
pnpm build

# Restart
pm2 start hisab-kitab-mvp
```

### Database Rollback

```bash
# Restore from backup
gunzip -c /backups/hisabkitab/db_YYYYMMDD_HHMMSS.sql.gz | \
  psql hisabkitab_prod

# Restart application
pm2 restart hisab-kitab-mvp
```

## Security Hardening

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Application Security

1. **Environment Variables**: Never commit secrets to git
2. **API Keys**: Rotate OpenRouter API key regularly
3. **JWT Secrets**: Use strong, randomly generated secrets
4. **Dependencies**: Keep dependencies updated
5. **HTTPS Only**: Force HTTPS in production

## Performance Optimization

### Nginx Optimization

```nginx
# Add to server block
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;

# Caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Application Optimization

1. **Enable Production Mode**: Set `NODE_ENV=production`
2. **Minify Assets**: Build process minifies automatically
3. **Enable Compression**: Configure server compression
4. **CDN**: Use CDN for static assets

## Troubleshooting Deployment Issues

### Application Won't Start

**Check logs:**
```bash
pm2 logs hisab-kitab-mvp
```

**Common fixes:**
- Check environment variables are set
- Verify database connection
- Check port availability
- Review dependency installation

### Database Connection Issues

**Test connection:**
```bash
psql -U username -d hisabkitab_prod -h localhost
```

**Common fixes:**
- Check database is running
- Verify connection string
- Check firewall rules
- Review database logs

### AI API Issues

**Test API:**
```bash
curl -H "Authorization: Bearer $VITE_OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemini-2.5-flash","messages":[{"role":"user","content":"test"}]}'
```

**Common fixes:**
- Verify API key is valid
- Check quota limits
- Test network connectivity
- Review API usage logs

## Maintenance Tasks

### Daily Tasks
- Check application logs for errors
- Monitor cost usage
- Verify backup completion
- Review error rates

### Weekly Tasks
- Review command history patterns
- Check performance metrics
- Analyze cost trends
- Update dependencies if needed

### Monthly Tasks
- Review and rotate API keys
- Check database performance
- Review security logs
- Update documentation

## Support Contacts

### Technical Support

For deployment issues:
1. Check this documentation first
2. Review error logs
3. Check known issues in project documentation
4. Contact support with detailed error information

### Emergency Contacts

For critical issues:
- Database failures: Immediate backup restore
- Security breaches: Immediate incident response
- Total outage: Rollback to previous version

---

**The MVP is now ready for production deployment!**
