# Finn

Finn is a mobile-first personal finance app built in a Turborepo monorepo. You log expenses manually; Finn watches for patterns in your spending and surfaces insights and weekly/monthly reports from your actual data. An AI chat interface (powered by Google Gemini) lets you ask questions about your finances in natural language.

## Features

- **Email/password authentication** via Better Auth
- **Manual expense logging** — amount, merchant, category, note, and timestamp
- **Deterministic insight engine** — detects spending spikes, recurring merchants, category increases, unusually large transactions, and daily spend streaks
- **Weekly & monthly reports** — structured metrics and plain-language summaries
- **AI chat** — ask questions about your money, powered by Google Gemini
- **Analytics tab** — visual breakdown of spending patterns
- **Feed-first mobile UI** — clean black-and-white design

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) ≥ 10 (`npm install -g pnpm`)
- A [Neon](https://neon.tech/) PostgreSQL database (or any PostgreSQL instance)
- (Optional) A [Google Gemini API key](https://aistudio.google.com/app/apikey) for AI chat

## Installation

```bash
# Clone the repository
git clone https://github.com/d1rshan/finn.git
cd finn

# Install all workspace dependencies
pnpm install
```

## Configuration

### Server (`apps/server/.env`)

Create `apps/server/.env` with the following variables:

```dotenv
# PostgreSQL connection string (required)
DATABASE_URL=postgresql://user:password@host/dbname

# Better Auth secret — must be at least 32 characters (required)
BETTER_AUTH_SECRET=your-secret-here

# Public URL where the server is running (required)
BETTER_AUTH_URL=http://localhost:3000

# URL of the Expo/web client, used for CORS (required)
CORS_ORIGIN=http://localhost:8081

# Google Gemini credentials (optional — AI chat is disabled without these)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-2.5-flash

# Runtime environment
NODE_ENV=development
```

### Native app (`apps/native/.env`)

Create `apps/native/.env` with:

```dotenv
# Full URL of the running server (required)
EXPO_PUBLIC_SERVER_URL=http://localhost:3000
```

## Local Development

### 1. Push the database schema

```bash
pnpm run db:push
```

### 2. Start everything (server + Expo)

```bash
pnpm run dev
```

Or start each part individually:

```bash
pnpm run dev:server   # Hono API only (hot-reloads with tsx)
pnpm run dev:native   # Expo app only (opens Expo Go / simulator)
```

The server runs on `http://localhost:3000` by default. Scan the QR code from `expo start` to open the app on a device or simulator.

### Running on a specific platform

```bash
cd apps/native
pnpm run ios       # iOS simulator
pnpm run android   # Android emulator
pnpm run web       # Browser
```

## Build

```bash
# Build all packages and apps
pnpm run build

# Type-check all packages
pnpm run check-types
```

The server build produces `apps/server/dist/index.mjs`, which can be started with:

```bash
node apps/server/dist/index.mjs
```

For mobile distribution, use [Expo EAS Build](https://docs.expo.dev/build/introduction/).

## Database Commands

```bash
pnpm run db:push       # Apply schema changes directly to the database
pnpm run db:generate   # Generate migration files from schema changes
pnpm run db:migrate    # Run pending migrations
pnpm run db:studio     # Open Drizzle Studio (visual DB browser)
```

## API Reference

All routes under `/api/feed`, `/api/expenses`, and `/api/reports` require an active session.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/feed` | Insight feed for the signed-in user |
| `GET` | `/api/expenses` | List all expenses |
| `POST` | `/api/expenses` | Create a new expense |
| `DELETE` | `/api/expenses/:expenseId` | Delete an expense |
| `GET` | `/api/reports` | List all reports |
| `GET` | `/api/reports/:reportId` | Get a specific report |
| `GET\|POST` | `/api/auth/*` | Better Auth authentication routes |

## Project Structure

```
finn/
├── apps/
│   ├── native/          # Expo + React Native app (Expo Router)
│   │   ├── app/         # File-based routes: (auth)/*, (app)/(tabs)/*
│   │   ├── components/  # Shared UI components
│   │   └── lib/         # API clients and utilities
│   └── server/          # Hono REST API
│       └── src/
│           ├── index.ts  # Server entry point
│           └── lib/      # Domain logic (expenses, insights, reports, AI)
├── packages/
│   ├── auth/            # Better Auth server configuration
│   ├── config/          # Shared TypeScript config
│   ├── db/              # Drizzle ORM schema and migrations
│   └── env/             # Environment variable validation (Zod)
├── turbo.json           # Turborepo pipeline config
└── pnpm-workspace.yaml  # pnpm monorepo config
```

### Database schema

Better Auth provides its own auth tables. Finn adds:

| Table | Purpose |
|-------|---------|
| `expense` | User-logged transactions |
| `insight` | Generated insight messages |
| `report` | Weekly/monthly summary reports |

See [`packages/db/src/schema/finn.ts`](packages/db/src/schema/finn.ts) for the full schema.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo, Expo Router |
| API | Hono, Node.js |
| Auth | Better Auth |
| Database | PostgreSQL (Neon), Drizzle ORM |
| AI | Google Gemini via Vercel AI SDK |
| Monorepo | Turborepo, pnpm workspaces |
| Language | TypeScript |

## Contributing

1. Fork the repository and create a feature branch.
2. Run `pnpm install` to set up dependencies.
3. Make your changes, then run `pnpm run check-types` to verify types before opening a pull request.
4. Open a PR describing what you changed and why.

## License

No license file is currently present in this repository. All rights reserved by the author unless otherwise stated.
