# Hisab Kitab MVP - Setup Guide

## Overview

The Hisab Kitab MVP (Minimum Viable Product) provides core voice functionality for construction business management with basic AI integration. This guide will help you set up and deploy the MVP.

## MVP Features

### Core Capabilities
- **Voice Input**: Web Speech API with Urdu/English/mixed language support
- **AI Integration**: OpenRouter with Google Gemini 2.5 Flash (free tier)
- **Core Tools**: 
  - Mark attendance (حاضری لگانا)
  - Query attendance (حاضری دیکھانا)
  - Create workers (مزدور بنانا)
  - Query workers (مزدور دیکھانا)
  - Add expenses (خرچہ لگانا)
  - Query expenses (اخراجات دیکھانا)
- **Security**: Basic permission checking and input validation
- **Error Handling**: Retry logic with user-friendly error messages
- **Command History**: Track and review voice commands

### Excluded from MVP (Future Versions)
- Advanced speech recognition (Whisper.cpp)
- Multiple model routing
- Complex conversation context
- Advanced analytics
- Multi-language TTS
- Performance optimization (available but not MVP core)
- Cost optimization features (available but not MVP core)

## Prerequisites

### System Requirements
- **Operating System**: Linux (tested on Zorin OS/Ubuntu)
- **Node.js**: v18 or higher
- **PostgreSQL**: v14 or higher
- **Browser**: Chrome/Edge (for Web Speech API support)
- **Memory**: Minimum 4GB RAM
- **Storage**: Minimum 10GB free space

### API Keys Required
- **OpenRouter API Key**: Required for AI functionality
  - Get your key at https://openrouter.ai/
  - Free tier available with Google Gemini 2.5 Flash

## Installation Steps

### 1. Clone and Setup Repository

```bash
cd /home/hassanabbas/Hisab-Kitab
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hisabkitab

# OpenRouter API Configuration
VITE_OPENROUTER_API_KEY=sk-or-your-openrouter-api-key-here

# JWT Secret (for authentication)
JWT_SECRET=your-jwt-secret-here

# Google OAuth (optional, for OAuth login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Run Database Migrations

```bash
# Install Drizzle ORM
pnpm add drizzle-orm drizzle-kit postgres

# Run database setup
pnpm --filter @workspace/db run setup

# Run performance optimization migrations (Phase 13)
pnpm --filter @workspace/db migrate
```

### 4. Start Development Server

```bash
# Start the development server
pnpm dev
```

The application will be available at `http://localhost:5173`

## MVP Configuration

### Enabling MVP Voice Assistant

To use the MVP voice assistant instead of the regular one, update your main App component:

```tsx
// Replace VoiceAssistant with VoiceAssistantMVP
import VoiceAssistantMVP from '@/components/VoiceAssistantMVP';

// In your component tree
<VoiceAssistantMVP />
```

### MVP-Specific Settings

The MVP uses these default configurations:

**AI Model**: Google Gemini 2.5 Flash (free tier)
**Daily Budget**: $5.00 USD
**Monthly Budget**: $150.00 USD
**Cache TTL**: 5 minutes
**Max Cache Size**: 25MB
**Retry Attempts**: 3 with exponential backoff

You can adjust these in the `VoiceAssistantMVP.tsx` component.

## Voice Commands

### Attendance Commands

**Mark Attendance**
- Urdu: "احمد کو آج پریزنٹ کر دو"
- Roman Urdu: "Ahmed ko aaj present kar do"
- English: "Mark Ahmed present today"

**Query Attendance**
- Urdu: "آج کی حاضری دکھاؤ"
- Roman Urdu: "Aaj ki attendance dikhao"
- English: "Show today's attendance"

### Worker Commands

**Create Worker**
- Urdu: "نیا مزدور بناؤ"
- Roman Urdu: "Naya worker banayein"
- English: "Create new worker"

**Query Worker**
- Urdu: "مزدور کی تفصیلات دکھاؤ"
- Roman Urdu: "Worker ki details dikhao"
- English: "Show worker details"

### Expense Commands

**Add Expense**
- Urdu: "5000 کا خرچہ لگاؤ"
- Roman Urdu: "5000 ka expense lagao"
- English: "Add 5000 expense"

**Query Expenses**
- Urdu: "اخراجات دکھاؤ"
- Roman Urdu: "Expenses dikhao"
- English: "Show expenses"

## Troubleshooting

### Voice Recognition Not Working

**Problem**: Voice assistant says "آواز سہولت نہیں"

**Solutions**:
1. Use Chrome or Edge browser (Web Speech API support)
2. Check microphone permissions in browser settings
3. Ensure microphone is not blocked by system settings
4. Try refreshing the page

### AI Not Responding

**Problem**: Voice assistant gets stuck on "سوچ رہی ہوں" (thinking)

**Solutions**:
1. Check OpenRouter API key is correct
2. Verify internet connection
3. Check API quota limits at https://openrouter.ai/
4. Check browser console for error messages

### Commands Not Recognized

**Problem**: Assistant says "معاف کریں، سمجھ نہیں آیا"

**Solutions**:
1. Speak clearly and close to microphone
2. Use simpler commands
3. Try using the exact command patterns from the guide
4. Check if you're using supported language (Urdu/English/mixed)

### Permission Errors

**Problem**: "آپ کے پاس اجازت نہیں ہے"

**Solutions**:
1. Check your user role in the system
2. Ensure you're logged in with appropriate permissions
3. Contact administrator if you need elevated permissions

## Performance Optimization

The MVP includes Phase 13 performance optimizations:

- **Database Indexes**: Strategic indexes for fast queries
- **Caching**: Multi-level caching for AI responses
- **Cost Optimization**: Budget-aware model selection
- **Token Optimization**: Reduced token usage for cost savings

These work automatically in the background.

## Security Features

### MVP Security Implementation

- **Input Validation**: SQL injection and XSS prevention
- **Permission Checking**: Role-based access control
- **Risk Assessment**: Automatic risk classification
- **Confirmation Prompts**: For high-risk operations
- **Audit Logging**: Command history and error tracking

### Security Best Practices

1. Never share your OpenRouter API key
2. Use strong JWT secrets in production
3. Regularly review command history for suspicious activity
4. Keep your system and dependencies updated
5. Use HTTPS in production deployments

## Monitoring and Debugging

### Check MVP Status

The MVP includes built-in monitoring:

1. **Command History**: Click the history button to see recent commands
2. **Console Logs**: Check browser console for detailed logs
3. **Network Tab**: Monitor API calls in browser dev tools
4. **Performance**: Response times are logged to console

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Microphone not detected | Check browser permissions |
| AI responses slow | Check internet connection, reduce context size |
| Commands misunderstood | Speak clearly, use simpler phrases |
| Database errors | Check database connection, run migrations |
| Permission denied | Check user role and permissions |

## Next Steps

After successful MVP setup:

1. **Test Core Functionality**: Try all voice commands
2. **Verify Language Support**: Test Urdu, English, and mixed commands
3. **Check Security**: Verify permission system works
4. **Monitor Performance**: Check response times and costs
5. **Collect Feedback**: Get user feedback on voice accuracy

## Support

For issues or questions:

1. Check this documentation first
2. Review command history for error patterns
3. Check browser console for error messages
4. Review the main project documentation

## MVP Limitations

The MVP has some intentional limitations:

- **Single AI Model**: Uses only Gemini Flash for simplicity
- **Basic Context**: Limited conversation memory
- **Simple Security**: Basic permission checking (no advanced features)
- **Fallback Only**: Text input fallback (no advanced TTS)
- **Manual Testing**: No automated testing suite in MVP

These will be addressed in Version 1 and Version 2.

## Upgrading from MVP

When ready to upgrade to full version:

1. Backup your data
2. Run full migration scripts
3. Enable advanced features
4. Configure additional AI models
5. Set up production monitoring
6. Deploy with enhanced security

See the main implementation plan for Version 1 features.
