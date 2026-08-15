# PROJECT-ANALYSIS.md

Comprehensive, engineering-level analysis of the **Hisab Kitab** monorepo.

---

## 1. Executive Summary

Hisab Kitab is a bilingual (Urdu/English, Roman-Urdu aware) construction management web app for Pakistani contractors. It tracks projects, labour, masons, attendance, materials, equipment, expenses, payments, daily diaries, and photos. It includes a voice/AI assistant (Marenii) driven by Groq (Llama 3.3 70B), a Gemini fallback, WhatsApp reminder automation for the manager, offline-first queuing, Google Drive chat-history sync, and one-tap restore/export backups.

It is a **pnpm workspace monorepo** with a TypeScript/Express 5 backend (`@workspace/api-server`), a React 19 + Vite + Tailwind 4 + wouter frontend (`@workspace/hisab-kitab`), and shared libraries (`@workspace/db`, `@workspace/api-zod`, stale `@workspace/api-client-react`).

**Work state:** Evidence gathering is 100% complete across the entire repo. This document is the final deliverable. No code has been modified and no packages installed.

**Key verdicts (flagged throughout):**
- `routes/weekly-payments.ts` **does not exist** — labour weekly payments live inside `payments.ts`.
- `src/lib/ai.ts` in the frontend **does not exist** — AI helper logic lives in `gemini.ts`, `guide.ts`, `stats.ts`.
- Vercel entry is `artifacts/api-server/api/index.js` (a 1-line re-export); the root `api/` dir does not exist.
- `pnpm --filter db push` (post-merge.sh) vs `pnpm --filter @workspace/db run push` (setup.sh) — different filter syntaxes.
- setup.sh runs API on **8081**, while start.sh/.replit/README-SETUP use **8080**.
- `actions.test.ts` exists (341 lines) but **never runs** — no test script anywhere.
- Reports endpoint interpolates `start_date`/`end_date` raw into SQL (injection risk).
- Backup covers 17 tables; `reminders` and `audit_log` are excluded.
- "Google OAuth2" in docs = **Drive sync only**, not login.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js (>= 20; README says 22) | Backend `type: module`, ESM |
| Package manager | pnpm workspace monorepo | `minimumReleaseAge: 1440` supply-chain guard |
| Frontend | React **19.1.0** (exact), TypeScript ~5.9.3, Vite **7.3.2**, Tailwind **4.1.14**, **wouter** 3.3.5 | Radix UI primitives, lucide-react, sonner, react-hook-form, zod |
| State/data | @tanstack/react-query (catalog ^5.90.21) | `QueryClientProvider` in App |
| Backend | Express **5.2.1**, cors, pino/pino-http logging | `express.json({limit:"50mb"})` for photos |
| Database | PostgreSQL + Drizzle ORM (drizzle-orm catalog ^0.45.2, drizzle-kit ^0.31.10) | 19 tables; `Asia/Karachi` timezone helpers |
| Validation | zod (`import { z } from "zod/v4"` in schemas) + `@workspace/api-zod` (orval-generated) | api-zod used only by health.ts |
| Auth | jsonwebtoken 9, bcryptjs 3, PIN-based login | JWT 7-day expiry; `requireRole(["admin"])` on reports |
| AI | Groq SDK (browser-direct in VoiceAssistant; server-proxied in GuideChat); Gemini via proxy for TTS + fallback | `l16ToWav` wraps Gemini TTS PCM → WAV |
| Scheduling | node-cron (reminders: 21:00 morning-attendance, Thursday summary) | gated behind `VERCEL !== "1"` |
| File upload | multer 2 | `/api/uploads` static mount |
| Offline | IndexedDB (`hk_offline_db`) + SW (`registerServiceWorker`) | queued writes replay via react-query mutation |
| Backup | JSON export/restore/clear (`backup.ts`) | version "1.0", `hisab-kitab-backup-{ts}.json` |
| Sync | Google Drive (GIS OAuth2, `drive.file` scope) | token key `hk_drive_token`, file `hisab-kitab-chat-history.json` |
| Deployment | Replit (.replit, workflows) + Vercel (`@vercel/node`) | `vercel.json` rewrites all → `/api/index` |
| Charts | recharts 2.15.2 | dashboard/reports |
| Docs/reporting | exceljs, jspdf, jspdf-autotable | Excel/PDF export (frontend) |

**Catalog** (`pnpm-workspace.yaml`): react/react-dom pinned `19.1.0` ("exact version because expo requires it" — legacy note), zod ^3.25.76, tsx, etc. `overrides` strips all non-linux-x64 esbuild/lightningcss/oxide/rollup binaries; esbuild pinned `0.27.3`.

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  @workspace/hisab-kitab  (React 19 SPA, vite dev :5173)            │
│  App.tsx → wouter <Switch> routes to 25 pages + Layout shell        │
│  - VoiceAssistant (Groq direct in browser, "Marenii")               │
│  - GuideChat (server-proxied Gemini/Groq + Drive sync + usage stats)│
│  - lib/api.ts fetchApi → /api/*   (offline queue → IndexedDB)       │
│  - lib/actions.ts (Marenii NLU: regex parse → typed actions)        │
└───────────────▲─────────────────────────────────────────────────────┘
                │ HTTP /api  (vite proxy → 127.0.0.1:8080)
┌───────────────┴─────────────────────────────────────────────────────┐
│  @workspace/api-server  (Express 5, dist/index.mjs)                 │
│  app.ts: pino-http, cors, json 50mb, /api/uploads static, router    │
│  routes/index.ts:                                                   │
│    public:  /health, /healthz, /ai/*, /auth/*                       │
│    auth:    /projects /labour /mason /attendance /mason-attendance  │
│             /expenses /materials /equipment /payments               │
│             /mason-payments /diary /photos /reports /backup         │
│             /settings /reminders                                    │
│  reminders.ts: cron scheduler (21:00 daily, Thursday)               │
└───────────────▲─────────────────────────────────────────────────────┘
                │ postgres (pool via @workspace/db)
┌───────────────┴─────────────────────────────────────────────────────┐
│  PostgreSQL  (hisabkitab db) — 19 Drizzle tables                     │
└─────────────────────────────────────────────────────────────────────┘
```

- **Serverless dual-mode**: `src/index.ts` dynamic-imports `./reminders.js` only when `VERCEL !== "1"`; default-exports `app` for `@vercel/node`; calls `app.listen` only when VERCEL is unset; throws when `PORT` missing/invalid. `dist/index.mjs` (esbuild bundle) is the deploy artifact.
- **Offline flow**: `fetchApi` on write (WRITE_METHODS) with no network → enqueues into IndexedDB `action_queue` and returns synthetic `{success:true, queued:true, offline:true}`; network-failure writes are also queued. OfflineBanner shows status.
- **AI dual-path**: VoiceAssistant uses Groq SDK **directly in the browser** (`dangerouslyAllowBrowser`); GuideChat uses server proxy endpoints `/api/ai/gemini` + `/api/ai/groq` (no auth required).

---

## 4. Directory Structure

```
/home/hassanabbas/Hisab-Kitab/
├── .replit                  # Replit config (workflows, postMerge, deployment)
├── .npmrc                   # auto-install-peers=false; strict-peer-dependencies=false
├── pnpm-workspace.yaml      # packages: artifacts/*, lib/*, lib/integrations/*, scripts
├── package.json             # root: build / typecheck / typecheck:libs scripts
├── tsconfig.base.json       # shared TS config (bundler resolution, es2022)
├── setup.sh                 # one-time setup (PORT 8081, JWT test-secret, seeds user)
├── start.sh                 # both services on 8080 + 5173
├── README-SETUP.md          # cross-platform setup guide (de-facto doc)
├── replit.md                # Replit stack/run notes (claims Replit managed PG)
├── lib/
│   ├── db/                  # @workspace/db — Drizzle pool + 19 table schemas
│   │   ├── src/index.ts     # pool factory (requires DATABASE_URL)
│   │   ├── src/schema/index.ts  # re-exports 19 tables in FK order
│   │   ├── src/schema/*.ts  # table definitions
│   │   ├── package.json     # push / push-force (drizzle-kit)
│   │   └── drizzle.config.ts
│   ├── api-zod/             # @workspace/api-zod (orval-generated; used by health.ts)
│   ├── api-client-react/    # @workspace/api-client-react — STALE orval output, unused
│   └── api-spec/            # openapi.yaml (only /healthz) + orval.config.ts
├── scripts/
│   └── post-merge.sh        # pnpm install --frozen-lockfile + pnpm --filter db push
├── artifacts/
│   ├── api-server/          # @workspace/api-server (Express backend)
│   │   ├── src/             # app.ts, index.ts, reminders.ts, routes/, lib/, middlewares/
│   │   ├── vercel.json      # @vercel/node serverless config
│   │   ├── api/index.js     # Vercel entry: re-export of ../dist/index.mjs
│   │   ├── build.mjs        # esbuild ESM bundle (+ esbuild-plugin-pino)
│   │   ├── .env             # ⚠ COMMITTED — DATABASE_URL, JWT_SECRET, GROQ key (see §18)
│   │   ├── test/health.test.mjs  # only backend test (node:test, port 4100)
│   │   └── tsconfig.json
│   └── hisab-kitab/         # @workspace/hisab-kitab (React frontend)
│       ├── src/
│       │   ├── App.tsx, main.tsx
│       │   ├── pages/       # 25 page components
│       │   ├── components/  # VoiceAssistant, GuideChat, Layout, OfflineBanner, ReminderCall, ui/
│       │   ├── lib/         # api, actions, i18n, gemini, guide, drive-sync, offlineSync, stats, notifications
│       │   ├── hooks/       # use-auth, use-language, use-theme
│       │   └── index.css, ...
│       ├── vite.config.ts
│       ├── index.html
│       ├── .env.example
│       └── package.json
├── attached_assets/         # legacy SQLite db + old JS/HTML/CSS; @assets alias target
└── PROJECT-ANALYSIS.md      # ← this document
```

**Note:** No root `api/` directory exists. Vercel entry lives at `artifacts/api-server/api/index.js`.

---

## 5. Frontend (`artifacts/hisab-kitab`)

### 5.1 Routing & shell
- **wouter** (`App.tsx`): `<WouterRouter><Providers><Layout><Switch>` with routes: `/login`, `/setup`, `/` (dashboard), `/projects`, `/projects/:id`, `/labour`, `/labour/:id`, `/mason`, `/mason/:id`, `/attendance`, `/mason-attendance`, `/weekly-payment`, `/mason-payments`, `/materials`, `/equipment`, `/expenses`, `/payments`, `/diary`, `/photos`, `/reports`, `/settings`, `/guide`, `/kb-editor`, `/lock-screen`, `*` → not-found. `Redirect` handles auth gating.
- `App.tsx` also mounts `ReminderCall`, `OfflineBanner`, `QueryClientProvider`, `Toaster`, `TooltipProvider`, `AuthProvider`, `ThemeProvider`, and calls `useLanguage()`.
- **Layout.tsx**: sidebar with **17 NAV_ITEMS** (dashboard, projects, labour, mason, labour_attendance, mason_attendance, labour_weekly_payments_title, mason_payments, materials, equipment, expenses, payments, diary, photos, reports, guide, settings) each with lucide icon + i18n key.

### 5.2 Hooks & persistence keys
- `use-auth.tsx`: `sessionStorage hk_unlocked`; role defaults to `"admin"`; exposes login/lock.
- `use-language.ts`: `localStorage hk_lang`; `?lang=ur|en` URL override; module-level listeners (no provider needed).
- `use-theme.tsx`: `localStorage hk_theme` (system/light/dark); toggles `document.documentElement.classList` `dark`.
- `lib/api.ts`: `fetchApi` — BASE_URL `/api`, in-memory token, `WRITE_METHODS` set, offline queuing (IndexedDB `hk_offline_db` / `action_queue`, keyPath id autoIncrement), synthetic offline responses.

### 5.3 lib modules
| File | Purpose |
|---|---|
| `actions.ts` (1745 lines) | Marenii NLU: `MareniiAction` union (navigate, create_project, create_labour, assign_labour, create_mason, assign_mason, add_material, add_expense, add_equipment, mark_attendance, mark_all_attendance, add_diary, add_payment, add_weekly_payment, fetch_report, respond, clarify). Regex parsers incl. Urdu/Roman-Urdu synonyms, number-words → digits, relative dates (`aaj`/`kal`/`parso`/`pichla juma`), cross-script name folding (`foldName`, `romanizeUrdu`, consonant skeleton), `resolveLabourId`/`resolveMasonId`/`resolveProjectId` with `(suffix)` disambiguation + same-name ambiguity → clarification candidates, `buildEntityContext` (Urdu context block for Gemini), `resolveClarifiedActions`, `mapExpenseCategory`, `mapAttendanceStatus`. `findBestMatch` used throughout. |
| `i18n.ts` (1162 lines) | en + ur dictionaries; keys include auth, nav, settings (change_pin, language, theme, backup_restore, export_all, restore_backup, about, danger_zone, clear_all_data, whatsapp_reminders, reminder_morning/thursday label+desc, drive_not_configured, drive_synced, usage_stats, export_chat), plus all page labels. `useI18n`/`t()` exposed. |
| `gemini.ts` | Gemini client helpers: `callGeminiProxy`, `callGeminiStream`, `getGeminiApiKey` (env `VITE_GEMINI_API_KEY` then file fallback `../hisab-kitab/.env` → `VITE_GEMINI_API_KEY`/`GEMINI_API_KEY`), `l16ToWav` (RIFF wrapper for Gemini TTS L16 24kHz mono PCM), streaming proxy for GuideChat. |
| `guide.ts` | Guide KB (`GUIDE_KB`, Urdu first section `/dashboard`), `hk_kb_overrides` overrides, `getAttendanceGapSuggestion`, `streamGuideAnswer`, `findCannedAnswer` fallback, `getProactiveSuggestions`, `recordUsage`. |
| `drive-sync.ts` | Google Drive sync via GIS OAuth2: token key `hk_drive_token`, script id `gsi-script`, scope `drive.file`, file `hisab-kitab-chat-history.json`. |
| `offlineSync.ts` | IndexedDB helpers + offline queue replay. |
| `stats.ts` | Usage stats keyed `hk_usage_stats`; guides GuideChat monitoring. |
| `notifications.ts` | Push/notif permission; key `hk_push_enabled`; icon `/icon-192.png`. |

### 5.4 main.tsx
`registerServiceWorker()` + `initAttendanceReminderScheduler()` (5 PM attendance reminder alerts) before `createRoot(...).render()`.

### 5.5 Build tooling
`vite.config.ts`: `PORT` env default 5173 (strictPort), host 0.0.0.0, `BASE_PATH` env, outDir `dist/public`, aliases `@` → `src`, `@assets` → `../../attached_assets`; dev proxy `/api` → `http://127.0.0.1:8080`; `@replit/vite-plugin-cartographer` + `dev-banner` only when `REPL_ID` set; `vite-plugin-pwa`. Scripts: `dev`, `build`, `serve`, `typecheck` — **no test script** (actions.test.ts unrun). Deps: `groq-sdk`, `exceljs`, `jspdf`, `jspdf-autotable` (runtime); `@workspace/api-client-react` is a devDependency but imported nowhere.

---

## 6. Backend (`artifacts/api-server`)

### 6.1 app & entry
- `app.ts`: pino-http (logs URL without query), cors, `express.json({limit:"50mb"})` + urlencoded, static `/api/uploads` → `process.cwd()/uploads`, router mounted at `/api`.
- `index.ts`: as described in §3 dual-mode serverless/local.
- `lib/logger.ts`: pino, `LOG_LEVEL` env, redacts `authorization`/`cookie` headers, pino-pretty in non-prod.
- `lib/validate.ts`: `import { z } from "zod/v4"`; on failure → 400 `{success:false, error, details:[{path,message}]}`.
- `lib/db.ts`: `toPgParams` rewrites `?` → `$n`; `getPKT`/`getPKTDate` use `Asia/Karachi`; helpers `queryGet`/`queryAll`/`dbExec`/`dbInsert`.

### 6.2 Route inventory (`routes/index.ts` mount)
| Mount path | Router | Auth |
|---|---|---|
| `/health`, `/healthz` | health.ts | public |
| `/ai` | ai.ts (gemini/groq proxies) | **public** |
| `/auth` | auth.ts (status/setup) | public |
| `/projects` | projects.ts | auth |
| `/labour` | labour.ts | auth |
| `/mason` | mason.ts | auth |
| `/attendance` | attendance.ts | auth |
| `/mason-attendance` | mason-attendance.ts | auth |
| `/expenses` | expenses.ts | auth |
| `/materials` | materials.ts | auth |
| `/equipment` | equipment.ts | auth |
| `/payments` | payments.ts (owner + **labour weekly**) | auth |
| `/mason-payments` | mason-payments.ts | auth |
| `/diary` | diary.ts | auth |
| `/photos` | photos.ts | auth |
| `/reports` | reports.ts | auth + `requireRole(["admin"])` |
| `/backup` | backup.ts | auth |
| `/settings` | settings.ts | auth |
| `/reminders` | reminders.ts | auth |

### 6.3 Key endpoint behaviors
- **projects.ts**: `generateProjectCode` → `HK-{year}-{NNN}` (padStart 3); GET `/` supports `status` filter, search (ILIKE name/owner_name/location/project_code), `limit=50`, `offset`.
- **auth.ts**: GET `/status` → `{hasUser, isAuthenticated, user, needsSetup}`; POST `/setup` requires name, mobile (`^03[0-9]{9}$`), pin/confirmPin (`^[0-9]{4}$`), optional language ("en")/theme ("system").
- **middlewares/auth.ts**: `generateToken` (7d expiry), `verifyToken`, `authenticate`, `requireRole`. **Line 5 hardcodes a JWT fallback secret** (see §18).
- **mason-payments.ts**: GET `/weekly` parses JSON `breakdown`; POST `/weekly/generate` requires `project_id/week_start/week_end`.
- **mason-attendance.ts**: includes GET `/today`.
- **reports.ts**: GET `/project/:id` — labour aggregation (present/half/absent days, total_wages, total_advance) + expenses by category. `start_date`/`end_date` interpolated **raw** into SQL → injection risk.
- **backup.ts**: `/export`, `/restore`, `/clear`, `/status`; TABLES = 17 (see §8; `reminders`, `audit_log` excluded); `settings` ordered by key, `NO_ID_TABLES` handled; filename `hisab-kitab-backup-{ts}.json`, version "1.0".
- **reminders route**: GET `/pending` (last 10 min, `opened=0`, maps `whatsapp_url`→`whatsappUrl`, `created_at`→`createdAt`, `opened===1`); PUT `/:id/opened` (400 on NaN id).
- **src/reminders.ts** (scheduler): cron `0 21 * * *` morning-attendance reminder + Thursday summary; wa.me links to manager; keys `reminder_morning`/`reminder_thursday`/`reminder_evening`/`reminder_phone` (fallback `MANAGER_PHONE = "923104900363"` — hardcoded).
- **ai.ts**: POST `/gemini`, POST `/groq` proxies (no auth). Frontend `l16ToWav` used for Gemini TTS.
- **settings.ts**: `DEFAULT_SETTINGS` (`app_name` "Hisab Kitab", `app_version` "1.0.0", `auto_backup` "1", `sync_interval` "30", empty `last_backup`/`last_sync`, `default_language` "en", `default_theme` "system"); GET `/`, GET `/:key` (falls back to default), POST `/` bulk upsert.

### 6.4 Route/shape shims (DB → API naming)
- expenses: `toFrontend` (description/paid_to = custom_name, notes = remarks)
- materials: `toFrontend` (description = custom_name, rate_per_unit = rate, supplier, notes = remarks)
- equipment: `toFrontend` (equipment_name = name, operator_name = custom_name, rental_days = quantity, daily_rate = condition_note, total_cost = price, date = purchase_date)
- diary: `SELECT_COLS` aliases (`extra_notes as notes`, `COALESCE(work_summary, note)`)
- photos: GET `/:id/data` → `{success:true, data_url: file_path}`

### 6.5 Schema validation shims
`insertExpenseSchema` (omits custom_name/remarks; extends amount positive + description/paid_to), `insertMaterialSchema` (omits rate/custom_name/remarks; extends rate_per_unit positive + description/supplier/notes), `insertDiarySchema` (omits note; extends work_summary/weather/notes), `insertEquipmentSchema` (price positive), `insertOwnerPaymentSchema` (amount positive), attendance schemas (coerce ids, omit wage_for_day, date-not-in-future refine).

---

## 7. Database (`lib/db`, Drizzle + Postgres)

Pool factory `lib/db/src/index.ts` requires `DATABASE_URL`; `schema/index.ts` re-exports **19 tables** in FK-safe order: `users, projects, labour, mason, project-labour, project-mason, attendance, mason-attendance, weekly-payments, mason-weekly-payments, daily-expenses, materials, equipment, owner-payments, daily-diary, photos, audit-log, settings, reminders`.

| Table | Notable columns/constraints |
|---|---|
| users | id, name, mobile (unique), password_hash, role, language, theme |
| projects | project_code (HK-YYYY-NNN), name, owner_name, owner_phone, location, start_date, end_date, status (planning/active/completed/on_hold), advance, estimated_cost, notes |
| labour | name, phone, daily_wage, advance, notes |
| mason | name, phone, daily_wage, advance, notes (parallel to labour) |
| project_labour | unique `(project_id, labour_id)`; daily_wage, assigned_at, removed_at |
| project_mason | unique `(project_id, mason_id)`; daily_wage, assigned_at, removed_at |
| attendance | unique `(project_id, labour_id, date)`; status (present/half_day/absent), wage_for_day |
| mason_attendance | unique `(project_id, mason_id, date)`; status, wage_for_day |
| weekly_payments | week_start/week_end, days_worked, half_days, total_earned, advance_total, previous_balance, amount_paid, remaining, is_paid, paid_at, remarks, breakdown (JSON) |
| mason_weekly_payments | same shape as weekly_payments (mason domain) |
| daily_expenses | project_id, date, category (10 enum list), amount, custom_name, remarks |
| materials | project_id, date, material (11 enum), quantity, rate, rate_per_unit, custom_name, supplier, notes |
| equipment | project_id, name, quantity, condition_note, price, custom_name, purchase_date, category (13 enum) |
| owner_payments | project_id, amount, date, note |
| daily_diary | project_id, date, weather, work_summary, extra_notes, note (legacy) |
| photos | project_id, file_path, category (7 enum), date, note |
| audit_log | action, entity, entity_id, details, created_at |
| settings | `key` + `value` only (name/value pairs) |
| reminders | phone, message, send_at, whatsapp_url, opened, created_at |

`drizzle.config.ts`: dialect postgresql, schema `./src/schema/index.ts`, requires DATABASE_URL. Scripts: `push` / `push-force` (`drizzle-kit push`). **No drizzle migrations** — schema is pushed directly.

Constants (frontend + backend): expenses `["Food","Transport","Tools","Fuel","Labour (Extra)","Repair","Safety","Office","Utility","Other"]`; materials `["cement","sand","steel","bricks","crush","paint","tiles","electric_wire","pvc_pipe","marble","other"]`; equipment `["Excavator","Crane","Concrete Mixer","Concrete Pump","Compactor","Generator","Scaffolding","Bulldozer","Loader","Truck","Water Pump","Drill","Other"]`; photos `["Progress","Receipt","Labour","Owner","Before","After","Other"]`.

---

## 8. Backup Coverage

**TABLES (17):** users, projects, labour, mason, project_labour, project_mason, attendance, mason_attendance, weekly_payments, mason_weekly_payments, daily_expenses, materials, equipment, owner_payments, daily_diary, photos, settings.

**Excluded:** `reminders` (transient push queue) and `audit_log` (history) — a documented gap: audit history is not restored.

---

## 9. Auth & Security

- **Authentication**: PIN-based setup + login (`POST /auth/setup`, `POST /auth/login`), bcryptjs hashed password, JWT returned, stored in-memory by frontend `fetchApi`; 7-day expiry.
- **Authorization**: `authenticate` middleware on all data routers; `requireRole(["admin"])` on `/reports`.
- **Public endpoints**: `/health`, `/healthz`, `/ai/*`, `/auth/*` — **AI proxies are unauthenticated** (cost/exposure risk).
- **JWT secret**: hardcoded fallback `hk-super-secret-jwt-key-change-in-production-2026` in `middlewares/auth.ts:5` when `process.env.JWT_SECRET` is absent; setup.sh exports `JWT_SECRET='test-secret'`. **Production risk.**
- **Hardcoded manager phone** `923104900363` in `src/reminders.ts` (fallback for reminder routing).
- **Committed `.env`** in `artifacts/api-server/.env` contains `DATABASE_URL`, `JWT_SECRET=change-this-to-a-long-random-secret`, and a real `GROQ_API_KEY` (value not reproduced here) — **secrets are in the repo**.
- **SQL injection**: `reports.ts` interpolates `start_date`/`end_date` directly into SQL string. Everything else uses parameterized `?` → `$n` via `toPgParams`.
- **PIN policy**: 4-digit PIN only; mobile `^03[0-9]{9}$`.
- **Supply-chain hardening**: `minimumReleaseAge: 1440` + `minimumReleaseAgeExclude` for `@replit/*`, `stripe-replit-sync`; `overrides` strip non-linux-x64 platform binaries.
- **XSS/CSRF**: no CSRF protection; PIN-in-body auth; cookie-parser installed but no signed cookies used for auth (JWT in header).

---

## 10. AI Integration

### Two distinct consumers:
1. **VoiceAssistant.tsx (880 lines, read-only constraint)** — browser-native speech (`listenOnce` with silence-timer think window; ur-PK first with en-US fallback; `quickFinal`), uses **Groq SDK directly in the browser** (`new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true })`), assistant persona **"Marenii"** with `MARENII_SYSTEM_PROMPT`; speaks via `speakError("no_input")` / `speakError("network")` on failures. **This file must not be modified.**
2. **GuideChat.tsx** — text chat guide using server proxies (`callGeminiProxy`/`callGroqProxy`/`callGeminiStream`/`callModelWithFallback`/`extractAnswerProgress`); 45s AbortController timeouts; default Groq model `llama-3.3-70b-versatile`; stores `hk_guide_chat` + history `hk_guide_chat_hi*`; Drive-syncs chat history; records usage via `recordUsage`/stats.

- **Backend**: `routes/ai.ts` exposes `/api/ai/gemini` and `/api/ai/groq` (both public, no auth). Keys come from server env (`GEMINI_API_KEY`, `GROQ_API_KEY`).
- **Keys**: frontend uses `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY` (`.env.example`: `VITE_GROQ_PRIMARY=true`); server uses `GROQ_API_KEY`, `GEMINI_API_KEY`.
- **TTS**: `l16ToWav` wraps Gemini TTS L16 24kHz mono PCM into a RIFF WAV for playback.

---

## 11. Voice Assistant (Marenii)

- **Browser audio**: mic capture + `speechSynthesis`; Groq STT (`whisper-large-v3`-style) via `transcriptions.create`; model `llama-3.3-70b-versatile` for the assistant loop.
- **NLU layer** (`lib/actions.ts`): maps free-form Urdu/English/Roman-Urdu commands to typed `MareniiAction`s — creation, assignment, attendance marking (incl. "all"), material/expense/equipment entry, diary, owner + weekly payments, report fetch, navigation, clarification.
- **Parsing features**: `normalizeText` (synonym map: bana do→banao, mazdur→mazdoor, ghayab→absent, kharchay→kharcha…), `numberWordsToDigits` (guarded by `AMOUNT_MARKER` so entity names like "Do Hazar Road" survive), relative dates (`lastWeekday`, "pichla juma"→last Thursday, aaj/kal/parso), `foldName`/`romanizeUrdu`/`consonantSkeleton` for cross-script name matching, `findBestMatch` fuzzy resolution, disambiguation via `(phone|project)` suffixes, clarification flow (`ClarifyRequest` → `resolveClarifiedActions`).
- **Constraints**: never modify `VoiceAssistant.tsx`; client-side Groq key exposure is inherent (VITE_ key is public by design — flagged as a cost/abuse risk).

---

## 12. Feature Matrix

| Feature | Status | Evidence |
|---|---|---|
| Projects CRUD + status/search/code | **Implemented** | projects.ts, projects.tsx |
| Labour & Mason CRUD + assignment | **Implemented** | labour.ts, mason.ts, project_labour/project_mason |
| Attendance (labour + mason) | **Implemented** | attendance.ts (+/today), mason-attendance.ts |
| Weekly payments (labour + mason) | **Implemented** | payments.ts (owner+labour weekly), mason-payments.ts |
| `routes/weekly-payments.ts` | **Does NOT exist** | confirmed in routes/ listing |
| Materials / Equipment / Expenses | **Implemented** | routes + pages, enum constants |
| Owner payments | **Implemented** | payments.ts |
| Daily diary | **Implemented** | diary.ts (with COALESCE legacy `note`) |
| Photos upload | **Implemented** | photos.ts + multer + `/api/uploads` |
| Reports (labour/expense) | **Implemented (admin-only)** | reports.ts `requireRole(["admin"])` |
| Backup export/restore/clear | **Implemented (17 tables)** | backup.ts |
| Settings | **Implemented** | settings.ts + settings.tsx |
| Reminders (WhatsApp) | **Implemented** | src/reminders.ts cron + route |
| Voice assistant (Marenii) | **Implemented (client-side Groq)** | VoiceAssistant.tsx |
| Guide chat | **Implemented** | GuideChat.tsx + guide.ts + /api/ai proxies |
| Gemini TTS | **Implemented (PCM→WAV)** | gemini.ts l16ToWav |
| Google Drive chat sync | **Implemented (Drive-only OAuth)** | drive-sync.ts |
| Offline queue | **Implemented** | api.ts + offlineSync.ts + SW |
| Push notifications | **Partial** | notifications.ts (`hk_push_enabled`), SW; relies on browser support |
| `@workspace/api-client-react` | **Unused (stale orval output)** | imported nowhere |
| `@workspace/api-zod` | **Used only by health.ts** | health.ts parses `HealthCheckResponse` |
| `lib/api-spec/openapi.yaml` | **Stale (only /healthz)** | orval regeneration needed |
| `actions.test.ts` | **Exists but never runs** | no test script in any package.json |
| Vercel deploy | **Config present** | vercel.json + api/index.js re-export |
| Replit deploy | **Config present** | .replit workflows + start.sh |

---

## 13. Data Flows

1. **Attendance**: page → `POST /api/attendance` (or `/today`) → `dbInsert` with PKT date → unique (project, labour, date) prevents duplicates; voice path `mark_attendance` resolves names then posts same endpoint.
2. **Weekly payment (labour)**: computed days_worked/half_days from attendance in that week; POST generates/updates record; `breakdown` JSON stores per-day detail; `remaining = total_earned - advance_total - previous_balance - amount_paid`.
3. **Mason parallel flow**: identical to labour but against `mason`, `project_mason`, `mason_attendance`, `mason_weekly_payments`, `mason-payments` routes.
4. **Backup**: `/export` SELECTs 17 tables (settings ordered by key), writes `hisab-kitab-backup-{ts}.json`; `/restore` wipes + re-inserts in table order; `/clear` deletes all rows (with NO_ID_TABLES handling).
5. **Offline write**: `fetchApi` fails → IndexedDB `action_queue` push → synthetic `{success, queued, offline}` → later `offlineSync` replay via react-query mutation to same endpoint.
6. **AI flow (voice)**: mic → Groq STT (browser) → `MARENII_SYSTEM_PROMPT` + entity context (`buildEntityContext`) → actions parse → optional clarification loop → CRUD calls → spoken response.
7. **AI flow (chat)**: GuideChat → `callModelWithFallback` (Groq primary unless `VITE_GROQ_PRIMARY=false` → Gemini) → `/api/ai/groq` or `/api/ai/gemini` → streamed answer; history saved locally + optionally Drive-synced; usage recorded.
8. **Reminders**: cron 21:00 → builds attendance reminder → inserts `reminders` row with `whatsapp_url` → frontend polls `/pending` (10-min window) → `ReminderCall` shows banner → `PUT /:id/opened`.

---

## 14. Environment Variables

| Variable | Location | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | api-server/.env | Yes | `postgres://postgres:postgres@localhost:5432/hisabkitab` (setup.sh); Vercel needs a real one |
| `JWT_SECRET` | api-server/.env | Yes* | setup.sh uses `test-secret`; code has hardcoded fallback |
| `GROQ_API_KEY` | api-server/.env | Yes | server-side proxy key |
| `GEMINI_API_KEY` | api-server/.env | No | fallback LLM / TTS |
| `VITE_GROQ_API_KEY` | hisab-kitab/.env | Yes | exposed to browser (VoiceAssistant) |
| `VITE_GEMINI_API_KEY` | hisab-kitab/.env | No | frontend Gemini fallback |
| `VITE_GOOGLE_CLIENT_ID` | hisab-kitab/.env | Yes | Drive OAuth2 (scope drive.file) |
| `VITE_GROQ_PRIMARY` | hisab-kitab/.env | No | `true` → Groq default |
| `PORT` | both | Yes | 8080/8081 API, 5173 frontend |
| `BASE_PATH` | frontend | No | `/` (Replit) |
| `VERCEL` | api-server | No | `"1"` disables listen + cron + reminders import |
| `LOG_LEVEL` | api-server | No | pino level |

Frontend `.env.example`: `VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com`, `VITE_GROQ_API_KEY`, `VITE_GROQ_PRIMARY=true`, commented `VITE_GEMINI_API_KEY`. **api-server has NO `.env.example`** — a committed `.env` serves as the template (secrets risk).

---

## 15. Local Setup

**Documented path (README-SETUP.md):**
1. Node 22 + pnpm (corepack) + PostgreSQL 15.
2. `CREATE DATABASE hisabkitab` + postgres/postgres user.
3. `pnpm install`.
4. Create `artifacts/hisab-kitab/.env` from `.env.example`; create `artifacts/api-server/.env` manually.
5. `export DATABASE_URL='postgres://postgres:postgres@localhost:5432/hisabkitab'`.
6. `bash setup.sh` **or** `pnpm --filter @workspace/db run push`.
7. `bash start.sh` → API :8080, frontend :5173.
8. `curl POST /api/auth/setup` with `{"name","mobile","pin":"1234","confirmPin":"1234"}`.

**Discrepancies:** setup.sh starts API on **8081** and seeds user "Muhammad Arshad / 03104900363 / PIN 1234" (a real-ish phone); start.sh/.replit/README use **8080**. `scripts/post-merge.sh` uses `pnpm --filter db push` while setup.sh uses `pnpm --filter @workspace/db run push` (both resolve, but inconsistent). vite proxy targets `127.0.0.1:8080`, so running via setup.sh (8081) without the proxy env breaks dev proxying.

---

## 16. Deployment

### Replit
- `.replit`: `modules = web, nodejs-20, bash`; `[deployment] run = bash start.sh` (router=application, autoscale); postBuild `pnpm store prune`; workflows run "API Server" (PORT=8080 `pnpm --filter @workspace/api-server run dev`, waitForPort 8080) + "Hisab Kitab" (PORT=5173 BASE_PATH=/ `pnpm --filter @workspace/hisab-kitab run dev`, waitForPort 5173) in parallel; postMerge `scripts/post-merge.sh` (20s); nix stable-25_05.
- **replit.md claims Replit's managed PostgreSQL**, but setup.sh/README use local `localhost:5432/hisabkitab` — docs vs reality gap.

### Vercel
- `artifacts/api-server/vercel.json`: installCommand `cd ../.. && pnpm install --frozen-lockfile=false`; function `api/index.js` maxDuration 10; rewrites `/(.*)` → `/api/index`.
- Entry: `artifacts/api-server/api/index.js` = `export { default } from '../dist/index.mjs';` (built by `build.mjs` esbuild ESM + esbuild-plugin-pino; external list includes sharp, better-sqlite3, bcrypt, pg-native, etc.).
- `build.mjs` output → `dist/index.mjs`; backend package `build` = `node ./build.mjs`, `start` = `node --enable-source-maps ./dist/index.mjs`, `dev` = build + start.
- Frontend `outDir: dist/public` (served statically).
- **Caveat**: cron reminders are disabled on Vercel (`VERCEL` gate); `app.listen` is skipped; DB must be reachable (no DATABASE_URL committed for prod).

---

## 17. Code Quality

**Strengths:**
- Clean layered structure: routes → lib helpers → db, consistent error envelope `{success:false, error, details}`.
- Consistent DB→API field mapping shims (single `toFrontend` per router).
- Strong i18n discipline (en+ur keys centralized in i18n.ts) and bilingual NLU effort.
- Parameterized SQL everywhere except reports.
- Supply-chain hardening (pnpm minimumReleaseAge, platform-binary overrides).
- Dual-mode server (Vercel + local) handled cleanly.
- ESLint/prettier configured at root; typecheck wired into root `build`.

**Weaknesses / gaps:**
- `zod/v4` import specifier is unusual and diverges from the `zod` catalog (^3.25.76) — version-coupling risk.
- Stale generated clients (api-spec only `/healthz`; api-zod/api-client-react orval output) — health.ts depends on api-zod types that may drift from the real API.
- Reports SQL injection; unauthenticated AI proxies; committed `.env` with a real GROQ key; hardcoded JWT fallback + test-secret in setup.sh; hardcoded manager phone.
- No backend test suite beyond `test/health.test.mjs` (node:test, spawns dist on port 4100 against default `postgresql://postgres:postgres@127.0.0.1:5432/postgres`); `actions.test.ts` never executes.
- Backup omits `reminders` + `audit_log`; no migrations (schema push only) — schema drift risk across envs.
- Docs drift: README says "Google OAuth2" (Drive-only), 8080 vs 8081, `weekly-payments.ts` referenced but absent, "VITE_GEMINI_API_KEY no longer needed" comment in README vs fallback support.

---

## 18. Problems & Risks

1. **Secrets in repo** (HIGH): `artifacts/api-server/.env` committed with `DATABASE_URL`, `JWT_SECRET=change-this-to-a-long-random-secret`, and a real `GROQ_API_KEY`. Value not reproduced here; flag presence only. Rotate key + gitignore.
2. **Hardcoded JWT fallback** (`middlewares/auth.ts:5`): if `JWT_SECRET` unset, auth silently uses a known string → anyone can forge tokens.
3. **Test secret in setup.sh** (`JWT_SECRET='test-secret'`) — same forgery concern in any env that runs setup.sh.
4. **Unauthenticated AI proxies** (`/api/ai/*`): open endpoint → abuse/cost exposure (Groq/Gemini billed calls).
5. **SQL injection in reports.ts** (`start_date`/`end_date` string interpolation).
6. **Client-side Groq key** (`VITE_GROQ_API_KEY`): exposed in bundle by design; rate-limit/cost risk if the app goes public.
7. **Hardcoded manager phone** `923104900363` in `src/reminders.ts` (falls back when `reminder_phone` unset).
8. **No migrations** — `drizzle-kit push` only; team envs can drift.
9. **Schema/API drift** — stale orval-generated api-zod types only checked against `/healthz`.
10. **`actions.test.ts` dead code** — significant NLU logic untested in CI (no test script).
11. **Port inconsistency** 8080 (start.sh/.replit/vite proxy/README) vs 8081 (setup.sh) — one-click setup breaks dev proxying.
12. **Docs vs reality** — "Google OAuth2 login", "Replit managed PostgreSQL", `weekly-payments.ts`, "VITE_GEMINI_API_KEY no longer needed" all inaccurate.
13. **Backup gap** — audit_log/reminders not exported; restore won't recover history.
14. **`minimumReleaseAge: 1440`** — blocks installing brand-new packages <1 day old (intended hardening, but a workflow constraint).
15. **catalog version coupling** — react pinned `19.1.0` for legacy "expo requires it" comment; zod catalog ^3.25.76 but code imports `zod/v4`.

---

## 19. Docs vs Reality

| Claim (README-SETUP / replit.md / README.md) | Reality |
|---|---|
| "Google OAuth2" auth | Drive sync only (`drive.file`); login is PIN+JWT |
| "Replit's managed PostgreSQL" | setup.sh/README use local `localhost:5432/hisabkitab` |
| API on port 8081 (setup) / 8080 (start) | Both exist; setup.sh = 8081, everything else = 8080 |
| `pnpm --filter db push` vs `--filter @workspace/db run push` | Both in different scripts; inconsistent |
| `weekly-payments.ts` route implied | Does not exist; labour weekly in `payments.ts` |
| `# VITE_GEMINI_API_KEY=no_longer_needed` | Gemini fallback + TTS still supported via proxy/file fallback |
| `api-server/.env.example` | **Does not exist**; committed `.env` used as de-facto template |
| Backend tests | Only `test/health.test.mjs`; frontend `actions.test.ts` unrun |
| `src/lib/ai.ts` (frontend) | Does not exist; AI helpers in gemini/guide/stats |
| Vercel entry `api/index.js` at repo root | Entry is `artifacts/api-server/api/index.js` |

---

## 20. What Works (Verified)

- Full project/labour/mason/attendance/material/equipment/expense/payment/diary/photos CRUD with consistent validation and error envelopes.
- Unique constraints prevent duplicate attendance/payments; JSON `breakdown` weekly payment detail.
- Bilingual UI + Roman-Urdu/Urdu NLU voice commands with name folding and disambiguation.
- Offline write-queue + service worker + offline banner.
- WhatsApp reminder pipeline (cron → pending → banner → open).
- JSON backup export/restore/clear (17 tables) with ordered settings.
- Dual-mode Express (Vercel + local) build via esbuild; root typecheck + build chain.
- Drive OAuth2 chat-history sync and usage stats.
- Health endpoints (`/health`, `/healthz`) used by setup/start scripts and the only integration test.

---

## 21. Developer Learning Guide

**New to this repo? Start here:**
1. **Frontend entry**: `artifacts/hisab-kitab/src/main.tsx` → `App.tsx` (routes) → `components/Layout.tsx` (nav) → pages in `src/pages/`.
2. **API layer**: `lib/api.ts` (`fetchApi`), then any `pages/*.tsx` page to see a resource's lifecycle.
3. **Backend entry**: `artifacts/api-server/src/index.ts` → `app.ts` → `routes/index.ts` (mount table). Pick one router (e.g. `materials.ts`) to learn the pattern: zod validation → `dbInsert`/`queryAll` → `toFrontend`.
4. **Schema**: all in `lib/db/src/schema/*.ts`; `schema/index.ts` is the export order (FK-safe); change schema → `pnpm --filter @workspace/db run push`.
5. **AI**: `src/lib/actions.ts` (NLU) + `VoiceAssistant.tsx` (read-only) + `GuideChat.tsx` + `src/routes/ai.ts` (proxies). Voice = browser-direct Groq; Chat = server proxies.
6. **Run**: `bash start.sh` (or follow README-SETUP §5-§8). Remember 8080 vs 8081.

**Mental model (30 seconds):** a bilingual construction ledger where every resource has a DB table (Drizzle/Postgres), an Express router (mounted behind `authenticate`), and a React page (wouter route); a voice assistant turns Urdu/Roman-Urdu speech into the same CRUD calls; reminders and Drive sync are the automation layer; Vercel/Replit are the two deployment targets with a `VERCEL` gate on the scheduler.

---

## 22. Most Important Files

| File | Why |
|---|---|
| `artifacts/api-server/src/routes/index.ts` | The entire API surface + auth boundary in one file |
| `artifacts/api-server/src/routes/payments.ts` | Owner + labour weekly payment logic |
| `artifacts/api-server/src/routes/backup.ts` | 17-table export/restore/clear |
| `artifacts/api-server/src/routes/reports.ts` | Admin reports (and SQL injection risk) |
| `artifacts/api-server/src/index.ts` | Vercel/local dual-mode + cron gate |
| `artifacts/api-server/src/reminders.ts` | WhatsApp reminder scheduler |
| `lib/db/src/schema/index.ts` + `lib/db/src/schema/*.ts` | All 19 tables (source of truth) |
| `artifacts/hisab-kitab/src/App.tsx` | Routes + providers + shell |
| `artifacts/hisab-kitab/src/lib/api.ts` | fetch layer + offline queue |
| `artifacts/hisab-kitab/src/lib/actions.ts` | Marenii NLU engine (1745 lines) |
| `artifacts/hisab-kitab/src/lib/i18n.ts` | All UI strings, en+ur |
| `artifacts/hisab-kitab/src/components/VoiceAssistant.tsx` | **Read-only** — voice assistant |
| `artifacts/hisab-kitab/src/components/GuideChat.tsx` | Guide chat + Drive sync + stats |
| `artifacts/api-server/api/index.js` | Vercel entry (re-export of dist) |
| `vercel.json`, `.replit`, `setup.sh`, `start.sh` | Deployment orchestration |
| `artifacts/hisab-kitab/vite.config.ts` | Build/proxy/alias config |
| `pnpm-workspace.yaml` | Workspace/catalog/security config |

---

*Analysis complete. Evidence verified against source on 2026-08-15. No files were modified.`*
