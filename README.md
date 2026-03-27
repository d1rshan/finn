# finn

Finn is a mobile-first fintech app built in a Better T Stack monorepo. It starts as a manual expense tracker, but the product is shaped around continuous monitoring: you log the payment, Finn keeps the memory, watches for patterns, and produces insight messages plus weekly and monthly reports from your actual data.

## Stack
- `apps/native`: Expo + React Native app using Expo Router and Better Auth Expo client
- `apps/server`: Hono API with Better Auth and Finn domain routes
- `packages/db`: Drizzle ORM schema for auth, expenses, insights, and reports on Neon Postgres
- `packages/auth`: Better Auth server configuration
- `packages/env`: shared environment validation

## Current V1 Surface
- Email/password authentication with Better Auth
- Feed-first mobile UI in a black and white visual system
- Manual expense logging with amount, merchant, category, note, and timestamp
- Deterministic insight generation for:
  - spending spikes
  - recurring merchants
  - category increases
  - unusually large transactions
  - daily spend streaks
- Weekly and monthly report generation with structured metrics and summaries

## API
The Hono server exposes:
- `GET /api/feed`
- `GET /api/expenses`
- `POST /api/expenses`
- `DELETE /api/expenses/:expenseId`
- `GET /api/reports`
- `GET /api/reports/:reportId`
- Better Auth routes under `GET|POST /api/auth/*`

All Finn routes are authenticated and scoped to the signed-in user.

## Database Model
Auth tables come from Better Auth. Finn adds:
- `expense`
- `insight`
- `report`

See [packages/db/src/schema/finn.ts](/home/darsh/Desktop/dev/finn/packages/db/src/schema/finn.ts) for the current schema and [PLAN.md](/home/darsh/Desktop/dev/finn/PLAN.md) for the implementation plan.

## Local Setup
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Configure `apps/server/.env` with:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`
   - `CORS_ORIGIN`
3. Configure the Expo app with `EXPO_PUBLIC_SERVER_URL`.
4. Push the schema:
   ```bash
   pnpm run db:push
   ```
5. Start development:
   ```bash
   pnpm run dev
   ```

## Useful Commands
- `pnpm run dev`
- `pnpm run dev:server`
- `pnpm run dev:native`
- `pnpm run check-types`
- `pnpm run db:push`
- `pnpm run db:studio`

## Planning Docs
- [PLAN.md](/home/darsh/Desktop/dev/finn/PLAN.md)
- [FUTURE.md](/home/darsh/Desktop/dev/finn/FUTURE.md)
