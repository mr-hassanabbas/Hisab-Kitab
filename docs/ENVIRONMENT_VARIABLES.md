# Environment Variables Configuration

This document describes all environment variables required for the Hisab Kitab application, including the AI voice assistant features.

## Required Variables

### Database

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/hisab_kitab
```

**Description**: PostgreSQL connection string for the database.

**Required**: Yes

**Example**: `postgresql://postgres:password@localhost:5432/hisab_kitab`

### JWT Secret

```bash
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
```

**Description**: Secret key for JWT token generation and validation.

**Required**: Yes

**Security**: Keep this secret and do not commit to version control.

**Example**: `random-32-character-secret-key-here`

## AI Configuration

### OpenRouter API Key

```bash
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
```

**Description**: API key for OpenRouter AI provider (recommended).

**Required**: Optional (but recommended for production)

**Get it**: [OpenRouter Dashboard](https://openrouter.ai/keys)

**Cost**: Pay-per-use, with free models available

**Example**: `sk-or-v1-abc123xyz789`

### Groq API Key

```bash
GROQ_API_KEY=gsk_your-groq-api-key-here
```

**Description**: API key for Groq AI provider (fallback option).

**Required**: Optional (but recommended as fallback)

**Get it**: [Groq Console](https://console.groq.com/)

**Cost**: Free tier available for Llama models

**Example**: `gsk_abc123xyz789def456`

## OAuth Configuration (Optional)

### Google OAuth

```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Description**: Google OAuth credentials for social login.

**Required**: Optional (for Google login feature)

**Get it**: [Google Cloud Console](https://console.cloud.google.com/)

**Example**: 
- Client ID: `123456789-abc123def456.apps.googleusercontent.com`
- Client Secret: `GOCSPX-abc123def456`

## Server Configuration

### Port

```bash
PORT=3000
```

**Description**: Port for the API server.

**Required**: No (defaults to 3000)

**Example**: `3000`

### Environment

```bash
NODE_ENV=development
```

**Description**: Application environment (development, production, test).

**Required**: No (defaults to development)

**Values**: `development`, `production`, `test`

**Example**: `production`

## CORS Configuration

```bash
CORS_ORIGIN=http://localhost:5173
```

**Description**: Allowed CORS origin for frontend.

**Required**: No (defaults to localhost in development)

**Example**: `https://your-domain.com`

## Logging Configuration

```bash
LOG_LEVEL=info
```

**Description**: Logging level for the application.

**Required**: No (defaults to info)

**Values**: `error`, `warn`, `info`, `debug`

**Example**: `info`

## Example .env File

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/hisab_kitab

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-min-32-characters

# AI Configuration
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
GROQ_API_KEY=gsk_your-groq-api-key-here

# OAuth (Optional)
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=info
```

## Security Notes

1. **Never commit .env files**: Add `.env` to `.gitignore`
2. **Use strong secrets**: Use long, random strings for JWT_SECRET
3. **Rotate secrets**: Change secrets periodically in production
4. **Use different secrets**: Use different secrets for development and production
5. **Limit API keys**: Use API keys with appropriate permissions and rate limits

## Production Setup

For production deployment:

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET` (minimum 32 characters)
3. Configure `CORS_ORIGIN` to your production domain
4. Set `LOG_LEVEL=error` for production logs
5. Use production database with SSL
6. Configure OAuth with production credentials
7. Set up AI API keys with appropriate quotas

## Development Setup

For local development:

1. Set `NODE_ENV=development`
2. Use any `JWT_SECRET` for local testing
3. Use `CORS_ORIGIN=http://localhost:5173` (Vite dev server)
4. Set `LOG_LEVEL=debug` for detailed logs
5. Use local PostgreSQL database
6. Skip OAuth if not needed
7. Use free AI provider (Groq) for testing

## Testing

For testing:

1. Set `NODE_ENV=test`
2. Use test database (separate from development)
3. Use test JWT secret
4. Mock AI API keys or use free tier
5. Set `LOG_LEVEL=error` to reduce noise

## Additional Configuration

### Database Pool Size

```bash
DB_POOL_SIZE=10
```

**Description**: Maximum number of database connections in pool.

**Required**: No (defaults to 10)

### AI Model Selection

```bash
AI_MODEL=gpt-4
```

**Description**: Default AI model to use (optional, system selects automatically).

**Required**: No (auto-selected based on complexity)

### Rate Limiting

```bash
AI_RATE_LIMIT=10
TOOL_RATE_LIMIT=30
```

**Description**: Rate limits for AI and tool endpoints (requests per minute).

**Required**: No (defaults to 10 and 30)

## Troubleshooting

### Database Connection Failed

**Error**: `Error: DATABASE_URL must be set`

**Solution**: Ensure `DATABASE_URL` is set in environment variables.

### JWT Verification Failed

**Error**: `JsonWebTokenError: invalid signature`

**Solution**: Ensure `JWT_SECRET` is consistent across all services.

### AI API Key Invalid

**Error**: `401 Unauthorized` from AI provider

**Solution**: Verify API key is valid and has sufficient quota.

### CORS Errors

**Error**: `Access-Control-Allow-Origin` header missing

**Solution**: Ensure `CORS_ORIGIN` matches your frontend domain.

## See Also

- [AI Voice Assistant Guide](AI_VOICE_ASSISTANT.md)
- [Deployment Guide](DEPLOYMENT.md)
- [API Documentation](API.md)
