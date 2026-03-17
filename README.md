# Panorama

⚠️ This project is a WIP.

A local-first work tracking dashboard that aggregates GitHub issues, pull requests, and Jira tickets into a single view. Built as a learning experiment and exploration of spec-driven development.

## Features

- **Unified work view** — GitHub PRs, GitHub Issues, and Jira tickets in three organized panels
- **Personal todo list** — Simple, independent task list with auto-cleanup
- **AI summaries** — Optional LLM integration for work item summaries and daily greetings
- **Encrypted credentials** — OAuth tokens encrypted at rest with AES-256-GCM
- **Local-only** — All data stays in a local SQLite database. Nothing is sent externally (except optional LLM calls)

## Prereqs

- Node.js >= 20
- pnpm

## Setup

```bash
# Install dependencies
pnpm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your OAuth credentials
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 3000) |
| `GITHUB_CLIENT_ID` | For GitHub | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | For GitHub | GitHub OAuth App client secret |
| `JIRA_CLIENT_ID` | For Jira | Jira OAuth 2.0 (3LO) client ID |
| `JIRA_CLIENT_SECRET` | For Jira | Jira OAuth 2.0 (3LO) client secret |
| `LLM_ENDPOINT` | No | OpenAI-compatible chat completions URL |
| `LLM_MODEL` | No | Model name (default: gpt-4o-mini) |
| `LLM_API_KEY` | No | API key for the LLM endpoint |
| `ENCRYPTION_KEY` | No | 64-char hex key (auto-generated if not set) |
| `RETENTION_TODOS_DAYS` | No | Days to keep completed todos (default: 7) |
| `RETENTION_WORK_ITEMS_DAYS` | No | Days to keep resolved work items (default: 14) |

## Development

```bash
# Start the API server (with hot reload)
pnpm dev

# In another terminal, start the frontend dev server
pnpm dev:web

# Run tests
pnpm test
```

The frontend dev server runs on `http://localhost:5173` and proxies `/api` requests to the Express server on port 3000.

## Production

```bash
# Build everything
pnpm build

# Start the server (serves frontend as static files)
cd apps/api && pnpm start
```

## Data Storage

All data is stored locally at `~/.panorama/`:
- `data.db` — SQLite database
- `encryption.key` — Auto-generated encryption key (if `ENCRYPTION_KEY` env var is not set)

## Architecture

```
apps/
  api/       Express API server + sync engine + AI agent
  web/       React frontend (Vite + TailwindCSS)
packages/
  shared/    TypeScript types shared between API and frontend
```

The app uses a modular connector system. Each source (GitHub, Jira) implements a `Connector` interface with OAuth flow and data fetching. A cron-based sync engine polls every 5 minutes, with an immediate sync triggered when a source is first connected.
