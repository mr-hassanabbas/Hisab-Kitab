# Hisab Kitab — Construction Site Management System

A full-stack construction site management system for Pakistani contractors ("thekedar"). Tracks labour, attendance, expenses, materials, equipment, diary entries, and generates reports.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS + shadcn/ui (`artifacts/hisab-kitab/`)
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL (`artifacts/api-server/`)
- **Auth**: JWT (with bcrypt password hashing)
- **Shared libs** (`lib/`): `api-spec`, `api-zod`, `api-client-react`, `db`
- **Package manager**: pnpm (monorepo workspace)

## How to Run

Two workflows must be running:

| Workflow | Command | Port |
|----------|---------|------|
| **API Server** | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| **Hisab Kitab** | `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/hisab-kitab run dev` | 5173 |

The frontend is visible in the preview pane (port 5173). The API is at `/api` on port 8080.

## Database

Uses Replit's managed PostgreSQL (`DATABASE_URL` is auto-injected). To push schema changes:

```bash
pnpm --filter @workspace/db run push
```

## Installing Dependencies

```bash
pnpm install
```

## Key Pages

- `/` — Dashboard
- `/projects` — Project list
- `/labour` — Labour management
- `/attendance` — Daily attendance
- `/expenses` — Expenses
- `/materials` — Materials tracking
- `/equipment` — Equipment log
- `/diary` — Site diary
- `/reports` — Reports & exports

## User Preferences

- Language: Urdu/English bilingual app targeting Pakistani construction contractors
