# AI Voice Assistant Guide

The Hisab Kitab AI Voice Assistant allows you to interact with the construction management system using natural language voice commands. This guide covers setup, usage, and available commands.

## Table of Contents

- [Setup](#setup)
- [Configuration](#configuration)
- [Available Commands](#available-commands)
- [Examples](#examples)
- [Entity Resolution](#entity-resolution)
- [Permissions](#permissions)
- [Troubleshooting](#troubleshooting)

## Setup

### Prerequisites

1. **API Keys**: You need API keys for at least one AI provider:
   - [OpenRouter](https://openrouter.ai/) (recommended)
   - [Groq](https://groq.com/) (free tier available)

2. **Environment Variables**: Set the following in your `.env` file:
   ```bash
   OPENROUTER_API_KEY=your-openrouter-api-key
   GROQ_API_KEY=your-groq-api-key
   ```

3. **Browser Support**: Voice recognition requires a browser that supports Web Speech API:
   - Chrome/Edge (full support)
   - Safari (partial support)
   - Firefox (limited support)

## Configuration

### AI Model Selection

The system automatically selects the best AI model based on task complexity and cost:

- **High Complexity**: GPT-4, Claude 3.5 Sonnet (via OpenRouter)
- **Medium Complexity**: Claude 3 Haiku, Llama 3.3 70B (via OpenRouter/Groq)
- **Low Complexity**: Gemini Flash, Llama 3.3 8B (free options)

### Rate Limiting

To control costs and prevent abuse, the following rate limits apply:

- **AI Endpoints**: 10 requests per minute per user
- **Tool Execution**: 30 requests per minute per user

Rate limit headers are included in API responses:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets

## Available Commands

### Attendance Commands

Mark attendance for workers:

- "Mark [worker name] as [status] for [project name]"
- "Mark attendance for [worker name] on [project name]"

**Status options**: present, absent, half_day

**Examples**:
- "Mark John as present for Project A"
- "Mark attendance for Ali on New House project"
- "Mark Ahmed as half day for Project B"

### Expense Commands

Add expenses to projects:

- "Add [amount] PKR for [category] to [project name]"
- "Record expense of [amount] for [category] on [project name]"

**Category options**: materials, labor, equipment, transport, food, other

**Examples**:
- "Add 5000 PKR for materials to Project A"
- "Record expense of 2000 PKR for labor on New House"
- "Add 1500 PKR for transport to Project B"

### Worker Commands

Create and manage workers:

- "Create worker named [name] with daily wage [amount]"
- "Add worker [name] with phone [number]"

**Examples**:
- "Create worker named Ali with daily wage 500"
- "Add worker John with phone 03001234567"
- "Create worker named Ahmed with daily wage 600 and village Lahore"

### Project Commands

Create and manage projects:

- "Create project [name] with code [code]"
- "Add project [name] owned by [owner] at [location]"

**Examples**:
- "Create project New House with code PRJ001"
- "Add project Commercial Plaza owned by Mr. Khan at Faisalabad"
- "Create project Residential Complex with code PRJ002 owned by Ali at Lahore"

### Payment Commands

Calculate worker payments:

- "Calculate payment for [worker name] on [project name]"
- "Show payment for [worker name] this week"

**Examples**:
- "Calculate payment for John on Project A"
- "Show payment for Ali this week"
- "Calculate payment for Ahmed on New House project"

## Examples

### Complete Workflow Example

```
User: "Create worker named Ali with daily wage 500"
AI: Worker Ali created successfully with daily wage 500 PKR

User: "Create project New House with code PRJ001"
AI: Project New House created with code PRJ001

User: "Mark Ali as present for New House"
AI: Marked Ali as present for New House on 2024-01-15

User: "Add 5000 PKR for materials to New House"
AI: Added expense of 5000 PKR for materials to New House

User: "Calculate payment for Ali on New House"
AI: Calculated payment for Ali on New House:
- Days worked: 5
- Total earned: 2500 PKR
- Net payment: 2500 PKR
```

## Entity Resolution

The AI assistant uses smart entity resolution to handle variations in names:

### Worker Resolution

- **Exact Match**: "John" → Finds worker named "John"
- **Nickname Match**: "Johnny" → Finds worker with nickname "Johnny"
- **Fuzzy Match**: "Jhn" → Finds closest matching worker
- **Ambiguous**: "Ali" → Returns multiple Ali workers for clarification

### Project Resolution

- **Exact Match**: "Project A" → Finds project named "Project A"
- **Code Match**: "PRJ001" → Finds project with code "PRJ001"
- **Fuzzy Match**: "Project B" → Finds closest matching project
- **Ambiguous**: "House" → Returns multiple house projects for clarification

### Disambiguation

When multiple matches are found, the AI will ask for clarification:

```
User: "Mark Ali as present for House"
AI: I found 3 projects named "House". Which one do you mean?
    1. House on Main Street
    2. House on Garden Road
    3. House on Lake View

User: "Main Street"
AI: Marked Ali as present for House on Main Street
```

## Permissions

The AI assistant respects role-based permissions:

### Admin
- Full access to all AI features
- Can configure AI settings
- Can execute all tools

### Owner
- Full access to AI features except configuration
- Can execute all tools
- Cannot modify AI settings

### Manager
- Can use AI for business operations
- Can execute attendance, expense, worker, project, and payment tools
- Cannot create projects or modify AI settings

### Worker
- Read-only access via AI
- Can query information only
- Cannot execute write operations

## Troubleshooting

### Voice Recognition Not Working

**Problem**: Voice input not responding or microphone not detected.

**Solutions**:
1. Check browser compatibility (Chrome/Edge recommended)
2. Ensure microphone permissions are granted
3. Check if microphone is being used by another application
4. Try refreshing the page

### AI Responses Are Slow

**Problem**: AI responses take too long.

**Solutions**:
1. Check network connection
2. Verify API keys are valid
3. Try switching AI provider (OpenRouter vs Groq)
4. Check rate limit status in response headers

### Entity Resolution Fails

**Problem**: AI cannot find worker or project by name.

**Solutions**:
1. Check if entity exists in database
2. Try using exact name or code
3. Add nicknames to workers for better resolution
4. Use project code instead of name

### Permission Denied

**Problem**: AI returns "Permission denied" error.

**Solutions**:
1. Check your user role
2. Verify you have required permissions
3. Contact admin for permission upgrade
4. Check if tool requires confirmation

### Rate Limit Exceeded

**Problem**: API returns 429 error (rate limit exceeded).

**Solutions**:
1. Wait for rate limit to reset (check `X-RateLimit-Reset` header)
2. Reduce request frequency
3. Contact admin to increase limits
4. Use batch operations instead of individual requests

## Best Practices

1. **Use Specific Names**: Use exact worker names and project codes for better accuracy
2. **Add Nicknames**: Add nicknames to workers for flexible voice commands
3. **Check Results**: Verify AI results before accepting
4. **Use Confirmations**: Enable confirmations for high-risk operations
5. **Monitor Costs**: Track AI usage and costs via audit logs
6. **Test Commands**: Test voice commands in quiet environment for better recognition

## API Integration

For programmatic access to AI features, use the following endpoints:

### Parse Intent
```bash
POST /api/ai/v2/intent
{
  "transcript": "Mark John as present for Project A"
}
```

### Execute Tool
```bash
POST /api/ai/v2/execute
{
  "tool": "mark_attendance",
  "parameters": {
    "worker_name": "John",
    "project_name": "Project A",
    "status": "present"
  }
}
```

### List Tools
```bash
GET /api/tools
```

## Support

For issues or questions:
- Check the [API Documentation](API.md)
- Review the [Deployment Guide](DEPLOYMENT.md)
- Check implementation progress in [IMPLEMENTATION_PROGRESS.md](../IMPLEMENTATION_PROGRESS.md)

---

**AI Voice Assistant** - Making construction management hands-free and efficient.
