# Hisab Kitab - Construction Management System

A comprehensive construction management system for tracking workers, projects, attendance, expenses, and payments. Built with React, Node.js, PostgreSQL, and now featuring an AI-powered voice assistant.

## 🎯 Features

- **Worker Management**: Track workers with nicknames, contact info, and daily wages
- **Project Management**: Manage construction projects with owners, locations, and progress
- **Attendance Tracking**: Mark attendance for workers on specific projects and dates
- **Expense Tracking**: Track material, labor, equipment, and other expenses
- **Payment Management**: Calculate and track worker payments based on attendance
- **🆕 AI Voice Assistant**: Natural language voice commands for hands-free operation
- **🆕 Multi-Provider AI**: Support for OpenRouter and Groq AI models
- **🆕 Smart Entity Resolution**: Automatic resolution of workers and projects by name or nickname
- **🆕 Role-Based Permissions**: Admin, owner, manager, and worker roles with granular permissions
- **🆕 Rate Limiting**: Configurable rate limiting for AI endpoints to control costs

## 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v22.x |
| Package Manager | pnpm (workspace monorepo) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Wouter |
| Backend | Express 5, TypeScript, Pino logging |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT + Google OAuth2 |
| AI Layer | OpenRouter API + Groq API (Llama 3.3 70B) |
| Voice | Web Speech API |
| Deployment | Vercel (@vercel/node for backend, Vercel/static for frontend) |

## 📁 Project Structure

```
Hisab-Kitab/
├── lib/                          # Shared workspace libraries
│   ├── db/                       # PostgreSQL + Drizzle schema
│   ├── api-zod/                  # Zod validation schemas
│   ├── database/                 # Repository pattern implementation
│   ├── ai-gateway/               # AI provider integration (OpenRouter, Groq)
│   ├── tools/                    # Business logic tools
│   ├── security/                 # Permission system, rate limiting, validation
│   └── api-client-react/         # React API client hooks
├── artifacts/                    # Application artifacts
│   ├── api-server/               # Express backend
│   └── hisab-kitab/              # React frontend
├── docs/                         # Documentation
│   ├── AI_VOICE_ASSISTANT.md     # AI voice assistant guide
│   ├── API.md                    # API documentation
│   └── DEPLOYMENT.md             # Deployment guide
└── pnpm-workspace.yaml           # pnpm workspace config
```

## 🚀 Quick Start

### Prerequisites

- Node.js v22.x
- pnpm v9+
- PostgreSQL v15+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Hisab-Kitab

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm --filter @workspace/db migrate

# Start development servers
pnpm dev
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hisab_kitab

# JWT Secret
JWT_SECRET=your-secret-key

# AI Configuration
OPENROUTER_API_KEY=your-openrouter-api-key
GROQ_API_KEY=your-groq-api-key

# OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## 🤖 AI Voice Assistant

The AI voice assistant allows you to interact with the system using natural language voice commands.

### Supported Commands

- **Attendance**: "Mark John as present for Project A"
- **Expenses**: "Add 5000 PKR for materials to Project A"
- **Workers**: "Create worker named Ali with daily wage 500"
- **Projects**: "Create project New House with code PRJ001"
- **Payments**: "Calculate payment for John on Project A this week"

### AI Endpoints

- `POST /api/ai/v2/intent` - Parse intent from transcript
- `POST /api/ai/v2/execute` - Execute validated tool
- `POST /api/ai/v2/clarify` - Handle disambiguation
- `GET /api/tools` - List available tools
- `GET /api/tools/:name` - Get tool schema

### AI Models

- **Primary**: OpenRouter (various models available)
- **Fallback**: Groq (Llama 3.3 70B)
- **Free Options**: Gemini Flash, Llama 3.3

### Rate Limiting

- AI endpoints: 10 requests per minute per user
- Tool execution: 30 requests per minute per user

## 🔒 Security

### Role-Based Permissions

| Role | Permissions |
|---|---|
| Admin | Full system access |
| Owner | All except AI configuration |
| Manager | Business operations (attendance, expenses, workers, projects, payments) |
| Worker | Read-only access |

### Security Features

- JWT authentication
- Role-based access control
- Input validation and sanitization
- Rate limiting
- Audit logging
- Permission checking for tool execution

## 📊 Database Schema

The application uses PostgreSQL with Drizzle ORM. Key tables include:

- `projects` - Construction projects
- `labour` - Worker information
- `attendance` - Attendance records
- `daily_expenses` - Expense tracking
- `project_labour` - Worker-project assignments
- `ai_audit_log` - AI action logging
- `ai_tool_execution_log` - Tool execution logging

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests for specific package
pnpm --filter @workspace/security test
pnpm --filter @workspace/tools test
```

### Test Coverage

- Permission system: 16 tests
- Input validation: 16 tests
- Rate limiting: 11 tests
- Tool registry: 12 tests
- Total: 55 tests passing

## 📚 Documentation

- [AI Voice Assistant Guide](docs/AI_VOICE_ASSISTANT.md) - Detailed guide for AI features
- [API Documentation](docs/API.md) - Complete API reference
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment instructions
- [Setup Guide](README-SETUP.md) - Full project setup guide

## 🚢 Deployment

### Production Deployment

The application is designed for deployment on Vercel:

1. Configure environment variables in Vercel dashboard
2. Deploy backend: `vercel deploy artifacts/api-server`
3. Deploy frontend: `vercel deploy artifacts/hisab-kitab`
4. Set up PostgreSQL database (Vercel Postgres or external)
5. Run database migrations
6. Configure AI API keys (OpenRouter, Groq)

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm test`
5. Run typecheck: `pnpm typecheck`
6. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with [OpenRouter](https://openrouter.ai/) for AI model access
- Voice recognition powered by Web Speech API
- UI components inspired by modern construction management systems

---

**Hisab Kitab** - Simplifying construction management with AI-powered voice assistance.