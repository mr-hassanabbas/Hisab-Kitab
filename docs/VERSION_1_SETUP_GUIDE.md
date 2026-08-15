# Version 1 Setup Guide

## Overview

Version 1 of Hisab Kitab AI Voice Assistant builds upon the MVP with advanced voice recognition, expanded tool coverage, enhanced AI integration, and robust security features. This guide will help you set up and deploy Version 1.

## What's New in Version 1

### Phase A: Advanced Voice Recognition
- **Whisper.cpp Integration**: Local speech recognition with better accuracy
- **Multi-Language Support**: Urdu, Hindi, English with auto-detection
- **Background Noise Handling**: Real-time noise cancellation
- **Voice Activity Detection**: Smart speech detection

### Phase B: Expanded Tool Coverage
- **Complete Attendance Operations**: Mark, query, update, delete, bulk operations
- **Payment Processing**: Create, query, update, delete payments
- **Project Management**: Full CRUD operations
- **Material Tracking**: Add, query, update, delete materials
- **Basic Reporting**: Attendance, expense, payment, project reports

### Phase C: Enhanced AI Integration
- **Multiple AI Model Support**: Cost-optimized routing (Gemini Flash, GPT-4o-mini, Claude 3.5 Haiku, Llama 3.3)
- **Context Awareness**: Session, project, worker, and entity context
- **Conversation Memory**: Multi-turn dialogue with reference resolution
- **Enhanced Entity Resolution**: Fuzzy matching, nicknames, phonetic matching

### Phase D: Advanced Security
- **Risk-Based Confirmation**: Dynamic confirmation based on context
- **Comprehensive Audit Logging**: 100% audit trail coverage
- **Anomaly Detection**: Unusual pattern detection
- **Rate Limiting**: Per-user, per-operation, and global limits

### Phase E: Enhanced User Experience
- **Rich Feedback UI**: Visual indicators, confidence scores, real-time feedback
- **Advanced Disambiguation**: Multi-select, filtering, search, voice selection
- **Settings Customization**: Language, voice, sensitivity, preferences
- **Persisted Command History**: Database storage with search and export

## Prerequisites

### System Requirements
- **Operating System**: Linux (tested on Zorin OS/Ubuntu)
- **Node.js**: v18 or higher
- **PostgreSQL**: v14 or higher
- **Browser**: Chrome/Edge (for Web Speech API)
- **Memory**: Minimum 8GB RAM (increased from MVP)
- **Storage**: Minimum 20GB free space
- **WASM Support**: Browser must support WebAssembly (for Whisper.cpp)

### API Keys Required
- **OpenRouter API Key**: Required for AI integration
  - Get your key at https://openrouter.ai/
  - Support for multiple models

### Additional Dependencies
- **WASM Support**: For Whisper.cpp local processing
- **Web Audio API**: For noise cancellation and VAD

## Installation Steps

### 1. Clone and Setup Repository

```bash
cd /home/hassanabbas/Hisab-Kitab
pnpm install
```

### 2. Install New Dependencies

```bash
# Install voice recognition library
cd lib/voice-recognition
pnpm install

# Install TypeScript for voice recognition
pnpm add -D typescript @types/node
```

### 3. Configure Environment Variables

Create `.env.production`:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hisabkitab_v1

# OpenRouter API Configuration
VITE_OPENROUTER_API_KEY=sk-or-production-api-key-here

# JWT Secret
JWT_SECRET=production-jwt-secret-min-32-chars

# Google OAuth (optional)
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
```

### 4. Run Database Migrations

```bash
# Run Version 1 migrations
pnpm --filter @workspace/db migrate

# This will run:
# - Performance optimization migrations (Phase 13)
# - Command history table migration (Version 1)
```

### 5. Build Voice Recognition Library

```bash
cd lib/voice-recognition
pnpm build
```

### 6. Start Development Server

```bash
# Start the development server
pnpm dev
```

The application will be available at `http://localhost:5173`

## Version 1 Configuration

### Enabling Version 1 Voice Assistant

To use the Version 1 voice assistant instead of MVP, update your main App component:

```tsx
// Replace VoiceAssistantMVP with VoiceAssistantV1
import VoiceAssistantV1 from '@/components/VoiceAssistantV1';

// In your component tree
<VoiceAssistantV1 />
```

### Voice Recognition Configuration

The Version 1 voice assistant supports multiple recognition modes:

**Whisper.cpp (Recommended)**:
- Better accuracy for Urdu/Hindi
- Local processing (no API calls)
- Offline capability
- Configured via `V1_ENABLE_WHISPER=true`

**Web Speech API (Fallback)**:
- Browser-native speech recognition
- Used if Whisper.cpp not available
- Configured via `V1_ENABLE_WHISPER=false`

### AI Model Configuration

Version 1 uses intelligent model routing:

**Default Models**:
- Gemini 2.5 Flash (fast, free)
- GPT-4o-mini (balanced, low cost)
- Claude 3.5 Haiku (high accuracy)
- Llama 3.3 70B (local, free)

**Routing Strategy**:
- Cost optimization (prioritizes free/low-cost models)
- Task complexity (simple tasks → fast models)
- Performance tracking (learns from history)

**Configuration**:
```env
V1_PRIORITIZE_COST=true
V1_PRIORITIZE_SPEED=false
V1_PRIORITIZE_QUALITY=true
V1_MAX_COST_PER_REQUEST=0.10
```

### Security Configuration

**Risk-Based Confirmation**:
- Dynamic confirmation based on context
- Configured via security settings

**Rate Limiting**:
- Per-user: 30 commands/minute
- Per-operation: Operation-specific limits
- Global: 1000 commands/minute
- Configured via environment variables

### Context and Memory Configuration

**Context Memory**:
- Session duration: 30 minutes
- Max workers in context: 5
- Max dates in context: 3
- Max conversation turns: 10

**Conversation Memory**:
- Max turns per session: 10
- Memory retention: 1 hour
- Auto-cleanup: Every 10 minutes

## Voice Commands (Version 1)

### Attendance Commands

**Mark Attendance**:
- Urdu: "احمد کو آج پریزنٹ کر دو"
- Roman Urdu: "Ahmed ko aaj present kar do"
- English: "Mark Ahmed present today"

**Update Attendance**:
- Urdu: "احمد کی حاضری تبدیل کرو"
- Roman Urdu: "Ahmed ki attendance badlo"
- English: "Update Ahmed's attendance"

**Bulk Mark Attendance**:
- Urdu: "تمام مزدوروں کو آج پریزنٹ کر دو"
- Roman Urdu: "Sab workers ko aaj present kar do"
- English: "Mark all workers present today"

**Attendance Summary**:
- Urdu: "حاضری کا خلاصہ دکھاؤ"
- Roman Urdu: "Attendance summary dikhao"
- English: "Show attendance summary"

### Payment Commands

**Create Payment**:
- Urdu: "احمد کو 5000 تنخواہ دو"
- Roman Urdu: "Ahmed ko 5000 tanwaha do"
- English: "Pay Ahmed 5000"

**Query Payments**:
- Urdu: "احمد کی ادائیگیاں دکھاؤ"
- Roman Urdu: "Ahmed ki payments dikhao"
- English: "Show Ahmed's payments"

**Payment Summary**:
- Urdu: "ادائیگی کا خلاصہ دکھاؤ"
- Roman Urdu: "Payment summary dikhao"
- English: "Show payment summary"

### Project Commands

**Create Project**:
- Urdu: "نیا پروجیکٹ بناؤ"
- Roman Urdu: "Naya project banayein"
- English: "Create new project"

**Query Projects**:
- Urdu: "تمام پروجیکٹس دکھاؤ"
- Roman Urdu: "Sab projects dikhao"
- English: "Show all projects"

**Project Status**:
- Urdu: "پروجیکٹ کا حال دکھاؤ"
- Roman Urdu: "Project ka haal dikhao"
- English: "Show project status"

### Material Commands

**Add Material**:
- Urdu: "100 بگیٹ سیمنٹ شامل کرو"
- Roman Urdu: "100 bags cement shamil karo"
- English: "Add 100 bags of cement"

**Query Materials**:
- Urdu: "سامان کا خلاصہ دکھاؤ"
- Roman Urdu: "Material summary dikhao"
- English: "Show material summary"

### Reporting Commands

**Attendance Report**:
- Urdu: "حاضری کی رپورٹ بناؤ"
- Roman Urdu: "Attendance report banayein"
- English: "Generate attendance report"

**Expense Report**:
- Urdu: "اخراجات کی رپورٹ بناؤ"
- Roman Urdu: "Expense report banayein"
- English: "Generate expense report"

## Troubleshooting

### Whisper.cpp Not Loading

**Problem**: Whisper.cpp WASM fails to load

**Solutions**:
1. Check browser supports WebAssembly
2. Check network connectivity (for initial load)
3. Fallback to Web Speech API automatically
4. Check console for specific error messages

### Context Memory Not Working

**Problem**: Context not being retained across turns

**Solutions**:
1. Check session ID is consistent
2. Verify context manager is initialized
3. Check context cleanup interval
4. Review context configuration

### Rate Limiting Too Strict

**Problem**: Legitimate commands being blocked

**Solutions**:
1. Adjust `V1_RATE_LIMIT_PER_USER` in environment
2. Adjust operation-specific limits in code
3. Check if user is blocked temporarily
4. Review rate limiting logs

### Anomaly Detection False Positives

**Problem**: Normal operations flagged as anomalies

**Solutions**:
1. Adjust anomaly detection thresholds
2. Disable specific rules if needed
3. Add user to whitelist
4. Review historical data accuracy

## Performance Optimization

Version 1 includes Phase 13 optimizations plus additional enhancements:

- **Database Indexes**: Strategic indexes for all new tables
- **Multi-Level Caching**: Memory + Redis (optional)
- **Cost Optimization**: Intelligent model routing
- **Token Optimization**: Reduced token usage
- **Local Processing**: Whisper.cpp reduces API calls

## Security Features

### Risk-Based Confirmation

**Confirmation Levels**:
- **None**: Low-risk operations for trusted users
- **Simple**: Yes/No for medium-risk operations
- **Detailed**: Full information for high-risk operations
- **Two-Factor**: Critical operations requiring authentication

**Risk Factors**:
- User role
- Operation type
- Amount/value
- Time of day
- Historical patterns

### Audit Logging

**Logged Events**:
- All voice commands with metadata
- Intent classification results
- Entity resolution results
- Tool execution attempts
- Security decisions
- Errors and failures

**Storage**:
- Database (command_history table)
- Structured format (JSON)
- Searchable indexes
- Retention policy (90 days, configurable)

### Anomaly Detection

**Detection Types**:
- Command frequency anomalies
- Time pattern anomalies
- Amount pattern anomalies
- Error pattern anomalies
- Behavioral anomalies

**Alert Types**:
- Low severity: Informational
- Medium severity: Warning
- High severity: Action required
- Critical severity: Immediate action

## Monitoring and Debugging

### Version 1-Specific Monitoring

**Voice Recognition Metrics**:
- Recognition accuracy (per language)
- Processing time (Whisper vs Web Speech)
- Noise reduction effectiveness
- VAD accuracy

**AI Routing Metrics**:
- Model selection distribution
- Cost per model
- Performance per model
- Fallback rate

**Context Metrics**:
- Context hit rate
- Memory usage
- Resolution success rate
- Conversation turn success rate

**Security Metrics**:
- Anomaly detection rate
- Rate limit violations
- Audit log volume
- Confirmation rate

## Migration from MVP

### Database Migration

Run the new migration:

```bash
pnpm --filter @workspace/db migrate
```

This will add the `command_history` table with indexes.

### Component Migration

Replace MVP components with Version 1 components:

```tsx
// Before (MVP)
import VoiceAssistantMVP from '@/components/VoiceAssistantMVP';

// After (Version 1)
import VoiceAssistantV1 from '@/components/VoiceAssistantV1';
```

### Configuration Migration

Update environment variables with Version 1-specific settings.

### Data Migration

MVP command history (memory-based) will be lost. Consider exporting MVP history before migration if needed.

## Next Steps

After successful Version 1 setup:

1. **Test Core Functionality**: Try all new voice commands
2. **Verify Advanced Features**: Test context memory, multi-turn dialogue
3. **Check Security**: Verify risk-based confirmation works
4. **Monitor Performance**: Check new metrics and dashboards
5. **Collect Feedback**: Get user feedback on new features

## Support

For Version 1-specific issues:

1. Check this documentation first
2. Review command history for error patterns
3. Check browser console for error messages
4. Review the main project documentation

## Version 1 Limitations

These are intentional for Version 1 and will be enhanced in Version 2:

- **Whisper.cpp WASM**: Requires initial network load
- **Local Processing**: Limited by device performance
- **Context Memory**: Limited to 10 turns per session
- **Advanced TTS**: Still uses browser defaults
- **Full Analytics**: Basic analytics only (enhanced in Version 2)
- **Multi-Factor Auth**: Two-factor confirmation only (full MFA in Version 2)

---

**Version 1 Status**: Ready for Deployment
**Target**: Production-ready voice assistant with advanced features
**Next Phase**: Version 2 (After Version 1 completion and user feedback)
