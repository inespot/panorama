## Why

There is no single place to see all ongoing work across GitHub, Jira, and other project-management tools. Context-switching between dashboards wastes time and makes it easy to lose track of what matters. A local-first, single-user dashboard that pulls work items from connected sources, summarizes them with an AI agent, and presents them in a clean, modular UI would solve this without adding yet another cloud service to the mix.

## What Changes

- Introduce a full-stack web application (React frontend, Node.js backend) that aggregates work items from multiple sources — read-only, all data stays local.
- Add OAuth-based connectors for GitHub (issues, PRs, reviews) and Jira (tickets). GitHub fetches from user-owned repos by default, with configurable org scoping (e.g., add "elastic" to track work across that org). OAuth tokens are encrypted at rest with an auto-generated key; no secrets ever live in code.
- Provide a pluggable connector architecture so additional sources can be added or removed without touching core code.
- Normalize heterogeneous work items into per-type database tables stored in a local SQLite database.
- Plug in an AI agent that processes and summarizes fetched work items, making the dashboard scannable at a glance and providing a friendly, welcoming user experience (personalized greeting, daily quote, per-item summaries).
- Build a modular, pluggable view system — views can be registered, added, or removed independently. Ship with:
  - An Ongoing Work view with three separate panels (GitHub PRs, GitHub Issues, Jira Tickets), each showing source-specific fields, with filters, search, inline AI summaries, and clickable cross-source linked items.
  - A customizable personal todo view where the user can add, check off, and delete items.
- The AI agent powers a persistent top panel across the dashboard (greeting, quote, overall digest) rather than a standalone view.
- Enforce data retention: completed todos and resolved work items (merged PRs, closed tickets) are automatically cleaned up after a configurable period, keeping the dashboard focused on current, recent, and near-future work.
- Sync data from sources every 5 minutes via a simple cron job. Design the internals so the sync mechanism can be swapped for something more scalable later.
- This is a single-user, local-only tool. No multi-user auth, no collaboration features, no data sent to the web.

## Capabilities

### New Capabilities
- `data-connectors`: OAuth integration layer for GitHub and Jira, plus a plugin interface for future sources. Read-only — the app never writes back to sources.
- `data-model`: Per-type work-item tables, plus connections and settings tables — all stored locally in SQLite. New work-item types can be added as new tables without altering existing ones.
- `sync-engine`: Background cron-based synchronization that keeps local data fresh by polling every 5 minutes.
- `dashboard-ui`: Modular, pluggable view system with a clean UI. Ships with an Ongoing Work view (three source-specific panels) and a personal todo view.
- `ai-agent`: Agent that processes and summarizes work items, generates a friendly greeting and daily quote, and surfaces inline summaries — making the dashboard readable and welcoming.
- `settings-and-config`: Connector credential management (encrypted, auto-generated key), GitHub org scoping, LLM configuration, and display name. No user auth — single local user.

### Modified Capabilities
_(none — this is a greenfield project)_

## Impact

- **New codebase**: Full-stack TypeScript monorepo managed with pnpm workspaces.
- **External dependencies**: GitHub REST/GraphQL API (read-only), Jira Cloud REST API (read-only), OAuth 2.0 flows, an LLM provider for the AI agent.
- **Infrastructure**: Single self-hosted unit. SQLite database for local storage. No external services beyond the source APIs and LLM.
- **Security**: OAuth tokens encrypted at rest (AES-256-GCM, key auto-generated on first run or from env var). No auth tokens or personal data in code. No data ever sent to the web or written online — the tool only reads from external sources.
- **Privacy**: All data stays local on the user's machine.
