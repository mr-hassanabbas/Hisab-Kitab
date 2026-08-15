# Hisab Kitab — Full Project Setup Guide (Cross-Platform)

This guide gets the Hisab Kitab monorepo running on a fresh machine.

## System Requirements

- **Node.js** v22.x (uses pnpm workspace)
- **pnpm** v9+ (comes bundled with recent Node)
- **PostgreSQL** v15+
- **Git**

Check versions:
```bash
node --version    # >= 22
pnpm --version    # >= 9
psql --version    # any recent PostgreSQL
```

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Package Manager | pnpm (workspace monorepo) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Wouter |
| Backend | Express 5, TypeScript, Pino logging |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT + Google OAuth2 |
| Voice AI | Groq API (Llama 3.3 70B) + Web Speech API |
| Deployment | Vercel (@vercel/node for backend), Vercel/static for frontend |

## Project Structure

```
Hisab-Kitab/
├── .replit              # Replit config
├── .gitignore
├── pnpm-workspace.yaml  # pnpm workspace config (security hardened)
├── package.json         # Workspace root package
├── setup.sh             # One-time setup script
├── start.sh             # Start both services
├── tsconfig.base.json   # Shared TypeScript config
├── lib/                 # Shared workspace libraries
│   ├── db/              # PostgreSQL + Drizzle schema
│   ├── api-zod/         # Zod validation schemas
│   └── api-client-react/ # React API client hooks
├── artifacts/           # Application artifacts
│   ├── api-server/      # Express backend
│   │   ├── src/
│   │   │   ├── index.ts  # entry point (has app.listen + export default app)
│   │   │   ├── app.ts    # Express app
│   │   │   ├── routes/   # API routes
│   │   │   └── lib/
│   │   ├── vercel.json   # Vercel serverless config
│   │   └── build.mjs     # esbuild bundler
│   └── hisab-kitab/     # React frontend
│       ├── src/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── components/
│       │   ├── pages/
│       │   ├── lib/
│       │   └── lib/api.ts
│       ├── .env.example # Environment template
│       ├── vite.config.ts
│       └── package.json
├── attached_assets/     # Runtime assets (uploads, etc.)
├── scripts/             # Utility scripts
└── .env.example         # Root-level env template (optional)
```

## Setup Steps

### 1. Install Node.js and pnpm

```bash
# Using nvm (Node Version Manager) — recommended
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

pnpm is bundled with Node 22 via corepack. Enable it:
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### 2. Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install postgresql postgresql-contrib

# macOS (Homebrew)
brew install postgresql

# Fedora/RHEL
sudo dnf install postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
```

Start PostgreSQL:
```bash
# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS
brew services start postgresql

# Or manually
pg_ctlcluster 15 main start  # Ubuntu
pg_ctl -D /usr/local/var/postgres start  # macOS
```

Create database:
```bash
sudo -u postgres psql -c "CREATE DATABASE hisabkitab;"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hisabkitab TO postgres;"
```

### 3. Clone and Install Dependencies

```bash
git clone git@github.com:mr-hassanabbas/Hisab-Kitab.git
cd Hisab-Kitab

# pnpm will be auto-enabled via corepack
pnpm install
```

### 4. Environment Variables

Create `.env` files:

#### Root-level (artifacts/hisab-kitab/.env)
```bash
cp artifacts/hisab-kitab/.env.example artifacts/hisab-kitab/.env
```

Fill in `artifacts/hisab-kitab/.env`:
```env
# VITE_GEMINI_API_KEY=no_longer_needed
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
VITE_GROQ_API_KEY=gsk_your_groq_api_key_here
VITE_GROQ_PRIMARY=true
```

> Get a free Groq API key at https://console.grok.com/

#### API Server (artifacts/api-server/.env)
```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
```

Fill in `artifacts/api-server/.env`:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/hisabkitab
JWT_SECRET=your_jwt_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 5. Push Database Schema

```bash
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/hisabkitab'

# Option A: Using the setup script (does everything)
bash setup.sh

# Option B: Manual schema push
pnpm --filter @workspace/db run push
```

### 6. Run the Application

#### Option A: Using the startup script (recommended)
```bash
bash start.sh
# Services run on:
#   API:  http://localhost:8080
#   Frontend: http://localhost:5173
```

#### Option B: Run services manually

**Terminal 1 — Backend API:**
```bash
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/hisabkitab'
export JWT_SECRET='your_jwt_secret_here'
cd artifacts/api-server
PORT=8080 pnpm run dev
# Or: PORT=8080 node dist/index.mjs  (if already built)
```

**Terminal 2 — Frontend Dev Server:**
```bash
export PORT=5173
export BASE_PATH=/
cd artifacts/hisab-kitab
pnpm run dev
# Or: npx vite --config vite.config.ts --host 0.0.0.0 --port 5173
```

### 7. Create Initial User

After the API server is running:
```bash
curl -s -X POST http://localhost:8080/api/auth/setup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Your Name","mobile":"03XXXXXXXXX","pin":"1234","confirmPin":"1234"}'
```

### 8. Access the Application

- **Frontend**: http://localhost:5173
- **API Health Check**: http://localhost:8080/api/healthz
- **API Docs**: http://localhost:8080/api/

## Production Build

```bash
# Build all packages
pnpm run build

# Or build individually
pnpm --filter @workspace/db run push      # Push DB schema
pnpm --filter @workspace/api-server run build  # Build backend
pnpm --filter @workspace/hisab-kitab run build # Build frontend

# Start production backend
cd artifacts/api-server
pnpm run start

# Preview frontend
cd artifacts/hisab-kitab
pnpm run serve
```

## Verification Checklist

```bash
# 1. Check PostgreSQL is running
pg_isready

# 2. Check database connection
psql -h localhost -U postgres -d hisabkitab -c "SELECT 1;"

# 3. Check API is running
curl http://localhost:8080/api/healthz

# 4. Check Frontend is running
curl http://localhost:5173/

# 5. Run TypeScript typecheck
pnpm --filter @workspace/hisab-kitab run typecheck

# 6. Verify Groq API key is set
node -e "console.log(process.env.VITE_GROQ_API_KEY ? 'Groq key: SET' : 'Groq key: MISSING')"
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `ECONNREFUSED` to PostgreSQL | Run `sudo service postgresql start` |
| `DATABASE_URL must be set` | Create `.env` file in `artifacts/api-server/` |
| `Port 8081 already in use` | Run `lsof -ti tcp:8081 \| xargs kill -9` |
| `pnpm: command not found` | Run `corepack enable` or install pnpm globally |
| `Groq API key not found` | Set `VITE_GROQ_API_KEY` in `artifacts/hisab-kitab/.env` |
| `JWT_SECRET` warning | Set `JWT_SECRET` environment variable |

## Vercel Deployment

The project is already configured for Vercel:
- `artifacts/api-server/vercel.json` — defines `@vercel/node` build
- `src/index.ts` exports `default app` for serverless handler
- `src/index.ts` gates `app.listen()` and cron jobs behind `!process.env.VERCEL`

To deploy:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy backend
cd artifacts/api-server
vercel

# Deploy frontend
cd ../hisab-kitab
vercel
```

Or link both to a single Vercel project with a root-level `vercel.json`.

## Environment Variables Reference

| Variable | Location | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | api-server/.env | Yes | PostgreSQL connection string |
| `JWT_SECRET` | api-server/.env | Yes | JWT signing secret |
| `GROQ_API_KEY` | api-server/.env, hisab-kitab/.env | Yes | Groq API key for LLM |
| `VITE_GROQ_API_KEY` | hisab-kitab/.env | Yes | Exposed to frontend for VoiceAssistant |
| `VITE_GOOGLE_CLIENT_ID` | hisab-kitab/.env | Yes | Google OAuth2 client ID |
| `GEMINI_API_KEY` | api-server/.env | No | Fallback LLM (optional) |
| `PORT` | Both | Yes | Server port |
| `VITE_GROQ_PRIMARY` | hisab-kitab/.env | Yes | Set to `true` |
