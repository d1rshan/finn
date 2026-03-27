# Finn V1 Foundation Plan

## Summary
Build Finn as a feed-first mobile fintech app on top of the existing Better T Stack scaffold: Expo native app, Hono API, Better Auth, Neon Postgres, and Drizzle ORM.

V1 will focus on:
- Manual expense logging inside the mobile app
- A black/white, modern, minimal mobile UI
- A chat-like insight inbox where Finn proactively surfaces observations
- Deterministic monitoring and summary generation now, with backend interfaces shaped so AI-generated answers/reports can be added later
- Weekly and monthly reports

## Key Changes

### Product and UX
- Replace the scaffold drawer/tabs experience with a feed-first authenticated app shell.
- Keep Better Auth email/password for v1, but redesign auth screens to match Finn’s visual system.
- Main app information architecture:
  - `Home`: chat-like Finn inbox showing insight cards/messages, recent activity highlights, and report prompts
  - `Log`: primary manual expense entry flow with a fast, lean form
  - `Reports`: weekly/monthly summary views and drill-down detail
- Visual direction:
  - strict black/white palette with restrained gray scale
  - editorial/minimal typography and generous spacing
  - high-contrast cards, subtle dividers, minimal icon use
  - no bright dashboard styling; the product should feel quiet, premium, and operational

### Backend and Data Model
Add domain tables in `packages/db` for the core finance model:
- `expenses`
  - `id`, `userId`, `amountMinor`, `currency`, `merchantName`, `category`, `occurredAt`, `note`, timestamps
- `insights`
  - `id`, `userId`, `type`, `title`, `body`, `status`, `severity`, `metadata/json`, `createdAt`
- `reports`
  - `id`, `userId`, `periodType` (`weekly`/`monthly`), `periodStart`, `periodEnd`, `title`, `summary`, `metadata/json`, `createdAt`
- Optional enum/constants layer for categories, insight types, report period types, and insight status

Add Hono routes for:
- authenticated expense CRUD needed by the app
- home feed query returning ordered insights plus recent expenses/report prompts
- report list/detail query for weekly/monthly reports
- internal/service-level insight generation entrypoint used after writes and for scheduled recalculation later

Keep the initial insight engine deterministic:
- spending spike versus prior comparable period
- recurring merchant detection
- category trend increases
- unusual single transaction size
- streaks/frequency patterns
- simple weekly/monthly summary rollups

Shape response payloads so a future AI layer can reuse them:
- reports should expose both structured metrics and human-readable summary text
- insights should store structured metadata alongside rendered copy
- inbox items should already look like “messages from Finn” even though they are rule-generated

### Mobile App Architecture
- Add an authenticated app boundary that redirects unauthenticated users to the redesigned auth flow.
- Introduce React Query hooks for expenses, feed, and reports.
- Expense logging flow:
  - lean form with amount, merchant/payee, category, timestamp, optional note
  - INR-only formatting and copy
  - optimistic refresh or immediate invalidation of feed/report queries after save
- Home feed behavior:
  - show Finn messages first
  - mix in recent expenses and report entry points only where useful
  - empty state explains Finn’s monitoring model and pushes toward first transaction
- Reports behavior:
  - list weekly and monthly reports
  - detail screen shows totals, category split, merchant highlights, and Finn-written summary text
- Chat-led surface in v1 means an inbox/thread metaphor only:
  - no freeform user questions yet
  - no open-ended LLM chat input yet
  - UI should still leave room for later “Ask Finn” entry

## Public APIs and Interfaces
Add typed server contracts for:
- `GET /api/feed`
  - returns `insights`, `recentExpenses`, `reportPrompts`
- `GET /api/expenses`
- `POST /api/expenses`
- `GET /api/reports`
- `GET /api/reports/:id`

Add shared types for:
- `ExpenseCategory`
- `InsightType`
- `InboxItem`
- `ReportPeriodType`
- report summary metrics payload

Keep currency fixed to INR in v1, but still store a `currency` field with default `"INR"` to avoid a future migration for multi-currency support.

## Test Plan
- DB/schema checks for new tables, relations, and auth-linked ownership
- API tests for authenticated access control on expenses, feed, and reports
- Expense creation test verifies downstream insight/report refresh behavior
- Insight engine tests for:
  - spike detection
  - recurring merchant detection
  - category increase detection
  - no duplicate insight generation for the same condition/window
- Mobile tests for:
  - auth gating and session-aware routing
  - successful expense creation flow
  - feed rendering for empty, populated, and report-heavy states
  - report list/detail rendering
- Typecheck across monorepo and at least one end-to-end manual smoke pass on Expo + server

## Assumptions and Defaults
- Existing Better Auth email/password remains the only auth method in v1.
- V1 is India-first and INR-only in UX, with UPI-oriented copy but manual entry only.
- “Chat-led” means a Finn inbox/message feed, not freeform conversational querying yet.
- Scheduled/background generation can start as server-side functions invoked on expense writes; actual cron/cloud scheduling can be added after core flows are stable.
- The current README should be rewritten after implementation to document the real Finn architecture, routes, DB model, and local setup.
