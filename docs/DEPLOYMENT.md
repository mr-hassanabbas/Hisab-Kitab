# Deployment Guide

This guide covers deploying the Hisab Kitab application with AI voice assistant features to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Vercel Deployment](#vercel-deployment)
- [Database Setup](#database-setup)
- [AI Configuration](#ai-configuration)
- [Environment Variables](#environment-variables)
- [Post-Deployment Steps](#post-deployment-steps)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

- Vercel account (for hosting)
- PostgreSQL database (Vercel Postgres or external)
- AI API keys (OpenRouter and/or Groq)
- Domain name (optional)
- SSL certificate (Vercel provides automatically)

## Deployment Options

### Recommended: Vercel

**Pros**:
- Free tier available
- Automatic SSL
- Easy deployment
- Built-in CI/CD
- Edge network

**Cons**:
- Serverless execution limits
- Cold starts
- Limited file system

### Alternative: Self-Hosted

**Pros**:
- Full control
- No execution limits
- Persistent file system
- Custom configuration

**Cons**:
- Requires server management
- SSL setup required
- Manual scaling
- Higher maintenance

This guide focuses on Vercel deployment.

## Vercel Deployment

### 1. Prepare for Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login
```

### 2. Deploy Backend

```bash
cd artifacts/api-server
vercel

# Follow prompts:
# - Project name: hisab-kitab-api
# - Build command: pnpm build
# - Output directory: dist
# - Install command: pnpm install
```

### 3. Deploy Frontend

```bash
cd artifacts/hisab-kitab
vercel

# Follow prompts:
# - Project name: hisab-kitab
# - Build command: pnpm build
# - Output directory: dist
# - Install command: pnpm install
```

### 4. Configure Environment Variables

In Vercel dashboard, add environment variables for each project:

**Backend (hisab-kitab-api)**:
```
DATABASE_URL=your-production-database-url
JWT_SECRET=your-production-jwt-secret
OPENROUTER_API_KEY=your-openrouter-api-key
GROQ_API_KEY=your-groq-api-key
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.vercel.app
LOG_LEVEL=error
```

**Frontend (hisab-kitab)**:
```
VITE_API_URL=https://your-backend-domain.vercel.app
```

### 5. Redeploy with Environment Variables

```bash
# Backend
cd artifacts/api-server
vercel --prod

# Frontend
cd artifacts/hisab-kitab
vercel --prod
```

## Database Setup

### Option 1: Vercel Postgres (Recommended)

1. Go to Vercel dashboard
2. Create new project → Storage → Postgres
3. Select region and plan
4. Copy connection string
5. Add `DATABASE_URL` to environment variables

### Option 2: External PostgreSQL

1. Set up PostgreSQL instance (AWS RDS, DigitalOcean, etc.)
2. Create database
3. Allow Vercel IP ranges in firewall
4. Copy connection string
5. Add `DATABASE_URL` to environment variables

### Run Migrations

```bash
# From project root
pnpm --filter @workspace/db migrate:push
```

## AI Configuration

### 1. Get OpenRouter API Key

1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Go to API Keys
3. Create new API key
4. Add to environment variables as `OPENROUTER_API_KEY`

### 2. Get Groq API Key (Optional Fallback)

1. Sign up at [Groq](https://groq.com/)
2. Go to API Keys
3. Create new API key
4. Add to environment variables as `GROQ_API_KEY`

### 3. Configure Model Selection

The system automatically selects models based on complexity, but you can override:

```bash
# Optional: Set default model
AI_MODEL=gpt-4
```

### 4. Test AI Configuration

```bash
# Test OpenRouter connection
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Environment Variables

See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for complete reference.

### Production-Specific Variables

```bash
NODE_ENV=production
LOG_LEVEL=error
CORS_ORIGIN=https://your-domain.com
JWT_SECRET=strong-production-secret-min-32-chars
```

## Post-Deployment Steps

### 1. Verify Deployment

```bash
# Check backend health
curl https://your-backend-domain.vercel.app/health

# Check frontend
curl https://your-frontend-domain.vercel.app
```

### 2. Test AI Endpoints

```bash
# Test intent parsing
curl -X POST https://your-backend-domain.vercel.app/api/ai/v2/intent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Mark John as present for Project A"}'
```

### 3. Monitor Initial Traffic

Check Vercel dashboard for:
- Function execution times
- Error rates
- Response times
- Resource usage

### 4. Set Up Monitoring

**Vercel Analytics**:
- Automatic monitoring enabled
- Check response times and error rates

**Custom Monitoring**:
- Set up error tracking (Sentry, etc.)
- Monitor AI API usage and costs
- Track rate limit hits

## Monitoring

### Key Metrics to Monitor

1. **AI API Usage**
   - Request count per user
   - Average response time
   - Error rate
   - Cost per request

2. **Application Performance**
   - Response times
   - Error rates
   - Database query times
   - Rate limit hits

3. **User Activity**
   - Active users
   - AI command usage
   - Tool execution success rate
   - Permission denials

### Monitoring Tools

**Vercel Built-in**:
- Analytics dashboard
- Log streaming
- Function metrics
- Error tracking

**Recommended External Tools**:
- Sentry for error tracking
- Datadog for APM
- Prometheus for metrics
- Grafana for dashboards

## Troubleshooting

### Deployment Failed

**Problem**: Deployment fails with build errors.

**Solutions**:
1. Check build logs in Vercel dashboard
2. Verify all dependencies are installed
3. Check TypeScript compilation errors
4. Ensure environment variables are set

### Database Connection Failed

**Problem**: Application cannot connect to database.

**Solutions**:
1. Verify `DATABASE_URL` is correct
2. Check database is accessible from Vercel
3. Verify SSL configuration
4. Check database credentials

### AI API Errors

**Problem**: AI requests fail with 401 or 429 errors.

**Solutions**:
1. Verify API keys are valid
2. Check API quota limits
3. Verify rate limiting configuration
4. Check network connectivity

### CORS Errors

**Problem**: Frontend cannot access backend API.

**Solutions**:
1. Verify `CORS_ORIGIN` matches frontend domain
2. Check CORS middleware configuration
3. Verify preflight requests are handled
4. Check API Gateway configuration

### Rate Limit Exceeded

**Problem**: Users hit rate limits too quickly.

**Solutions**:
1. Adjust rate limit values
2. Implement user-specific limits
3. Add rate limit headers
4. Provide feedback to users

## Scaling

### Vertical Scaling

Increase function execution limits in Vercel:
- Memory: 1GB → 2GB → 4GB
- Timeout: 10s → 30s → 60s

### Horizontal Scaling

Vercel automatically scales based on traffic:
- Edge functions scale globally
- Serverless functions scale automatically
- No manual scaling required

### Database Scaling

For Vercel Postgres:
- Upgrade plan for more connections
- Use connection pooling
- Add read replicas for queries

## Security Checklist

- [ ] JWT_SECRET is strong and not committed
- [ ] API keys are not exposed in logs
- [ ] Database connection uses SSL
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Input validation is active
- [ ] Permission system is configured
- [ ] Audit logging is enabled
- [ ] HTTPS is enforced
- [ ] Environment variables are set in production

## Backup and Recovery

### Database Backups

**Vercel Postgres**:
- Automatic daily backups
- Point-in-time recovery available
- Manual backup before major changes

**External PostgreSQL**:
- Set up automated backups
- Regular backup verification
- Disaster recovery plan

### Configuration Backups

- Export environment variables
- Document custom configurations
- Version control deployment scripts

## Cost Optimization

### AI API Costs

- Use free models when possible (Gemini Flash, Llama 3.3)
- Implement caching for repeated queries
- Use rate limiting to control usage
- Monitor costs regularly

### Vercel Costs

- Optimize function execution time
- Use edge functions where possible
- Minimize database queries
- Use image optimization

### Database Costs

- Use connection pooling
- Optimize queries
- Archive old data
- Use appropriate instance size

## See Also

- [Environment Variables](ENVIRONMENT_VARIABLES.md)
- [AI Voice Assistant Guide](AI_VOICE_ASSISTANT.md)
- [API Documentation](API.md)
- [Implementation Progress](../IMPLEMENTATION_PROGRESS.md)

---

**Deployment Guide** - Production-ready deployment instructions for Hisab Kitab with AI voice assistant.
