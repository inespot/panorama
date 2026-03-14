## Context

This is a greenfield project for a single-user, local-only work-tracking dashboard. The user works across GitHub and Jira and wants a consolidated, glanceable view of all active work — enriched by AI summaries — without relying on another cloud service. All data stays local. The app only reads from external sources and never writes back.

Key constraints:
- Single user, no collaboration or multi-user auth.
- All data local. No telemetry, no data exfiltration.
- OAuth tokens encrypted at rest. No secrets in code.
- V0 prioritizes simplicity, good UX, and modularity over advanced features.
- Must be easy to extend with new connectors and new dashboard views.

## Goals / Non-Goals

**Goals:**
- Clean, scannable dashboard for work items across GitHub and Jira.
- AI-powered summaries inline on each work item, plus a friendly top-of-dashboard greeting panel with personalized message and daily quote — making the experience welcoming and glanceable.
- A personal todo view for tracking ad-hoc tasks alongside synced work.
- Pluggable connector and view architectures — adding a new source or a new view should not require modifying core code.
- Simple 5-minute polling sync that can be swapped for a more sophisticated engine later.
- Single self-hosted unit, easy to run locally.

**Non-Goals:**
- No write-back to sources — the dashboard is read-only.
- No multi-user support or user authentication.
- No real-time sync, webhooks, or push notifications in V0.
- No advanced charting or data visualization libraries (Recharts, TanStack Table) in V0.
- Keep the stack minimal.
- No mobile app — responsive web is sufficient for V0.

## Decisions

### 1. pnpm workspaces monorepo with shared types via path aliases

Use a flat pnpm workspace with `apps/web`, `apps/api`, and `packages/shared`. No Turborepo. The shared directory holds TypeScript types (work-item schemas, connector interface, enums) that both apps import via TypeScript path aliases — no separate build step or package publishing required. This keeps things simple for V0; promote to a proper built package later if needed.

**Alternatives considered:**
- Turborepo → adds complexity without enough benefit at this scale.
- Separate repos → too much overhead for a single-person project.
- `packages/shared` as a built npm package → unnecessary build pipeline overhead for V0.

### 2. React + Vite frontend with shadcn/ui and Tailwind

React + Vite for fast development. shadcn/ui for beautiful, accessible, copy-paste components styled with TailwindCSS. Light-mode only, with a GitHub-inspired aesthetic: neutral grays, whites, subtle borders, minimal warm colors, clean sans-serif typography. Settings are accessed via a gear icon in the header (with a status badge) that opens a slide-over panel — not a separate view.

In production, the Express backend serves the built React frontend as static files — single process, single port, no CORS issues. During development, Vite's dev server proxies API requests to Express.

**Alternatives considered:**
- TanStack Table + Recharts → overkill for V0; can add later if needed.
- Material UI → heavier bundle, harder to customize to match the GitHub-like feel.
- Dark mode → not in V0; light mode keeps the UI simple and consistent.

### 3. Node.js/Express backend

Express for the API server. Lightweight, familiar, and sufficient for serving the API, the built frontend, and running the cron-based sync in-process. A single Express process serves everything — API routes, static frontend files, and the sync cron. One process, one port.

**Alternatives considered:**
- Fastify → marginal benefit for a local single-user app.
- Next.js → the sync engine doesn't map well to a request/response framework.
- Separate frontend server → unnecessary for a local app; adds CORS complexity.

### 4. SQLite + Drizzle ORM

SQLite for local storage — no database server to run, single file, zero config. Drizzle ORM for type-safe queries and migrations that stay close to SQL. SQLite is more than sufficient for a single-user local app. The database file lives at `~/.panorama/data.db` (alongside the encryption key). For Docker, `~/.panorama/` is exposed as a volume mount so data persists across container restarts.

Work items are stored in **separate tables per type** (`github_prs`, `github_issues`, `jira_tickets`) rather than a single unified table. Each table has a common set of base columns (title, status, group, linked_items, summary, etc.) plus type-specific columns (e.g., `action_needed` on `github_prs`, `priority` on `github_issues` and `jira_tickets`). This avoids a one-size-fits-all schema that becomes a constraint as new types are added. Adding a new work-item type means creating a new table — existing tables are never altered.

The database enforces data retention: completed todos are deleted after 7 days from completion, and work items with terminal statuses (`done`, `closed`) are deleted after 14 days from last update across all work-item tables. A cleanup step runs after each sync cycle. These defaults can be overridden via environment variables (`RETENTION_TODOS_DAYS`, `RETENTION_WORK_ITEMS_DAYS`).

**Alternatives considered:**
- PostgreSQL → requires a server process; overkill for local single-user use.
- Better-sqlite3 without ORM → loses type safety and migration tooling.

### 5. Pluggable connector interface (OAuth handled by core)

Each source implements a `Connector` interface focused on data fetching and normalization:
```
interface Connector {
  id: string;
  displayName: string;
  itemTypes: string[];
  getAuthUrl(redirectUri: string): string;
  handleCallback(code: string, redirectUri: string): Promise<OAuthResult>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  fetchItems(context: FetchContext): Promise<TypedWorkItem[]>;
}

type FetchContext = {
  token: string;
  since: Date | null;
  userId: string;
  siteUrl: string | null;
  config: Record<string, unknown>;
};
```
`itemTypes` declares which work-item types the connector produces (e.g., `['github-pr', 'github-issue']`). The sync engine uses this to route normalized items to the correct database tables.

`FetchContext` bundles the decrypted token, last sync timestamp (null on first sync), the authenticated user's identity, the source's site URL (from the `connections` table — used by Jira, null for GitHub), and a connector-specific config bag populated by the sync engine from app settings (e.g., `{ githubOrgs: ['elastic'] }` for GitHub). This replaces positional parameters and is extensible.

`OAuthResult` includes the tokens plus the user's identity (username or account ID), stored in the `connections` table. `TypedWorkItem` is a discriminated union — each item carries a `type` tag so the sync engine knows which table to write it to.

OAuth flow is initiated by the core app (API routes handle redirects and callbacks), but each connector provides its own `getAuthUrl` and `handleCallback` since auth details differ per source. Token encryption/storage is handled by the core — connectors never touch the database directly. After a successful callback, the server triggers an immediate background sync for the newly connected source (so the user sees data promptly) and redirects the browser back to the dashboard with the settings panel open.

Connectors are registered in a central registry. Adding a new source means implementing this interface and registering it — no changes to core code.

**Alternatives considered:**
- `authorize(credentials)` method → conflates OAuth redirect flow with the connector; OAuth is a multi-step browser redirect that the core app must orchestrate.
- Flat if/else per source → unmaintainable as sources grow.

### 6. Pluggable view system

The frontend uses a view registry pattern. Each view is a React component that registers itself with metadata (id, label, icon). The dashboard shell renders navigation from the registry and displays the active view. Adding a new view means creating a component and registering it.

The Ongoing Work view is split into three separate panels — GitHub PRs, GitHub Issues, and Jira Tickets — each backed by its own database table and API call. All items share common fields (title, created at, status, summary, linked items) but differ in others: PRs show action-needed indicators and no priority; issues show priority from labels; Jira tickets show native priority. Linked work items are displayed as clickable cross-source badges (e.g., `jira:ES-1456`, `github-pr:#42`). The API endpoint accepts a `type` parameter so each panel fetches only its data.

```
interface DashboardView {
  id: string;
  label: string;
  icon: ReactNode;
  component: ComponentType;
}
```

This makes it trivial to add, remove, or reorder views without touching the shell.

**Alternatives considered:**
- Hard-coded route/view mapping → works but doesn't meet the modularity goal.

### 7. node-cron for sync scheduling

Use node-cron for a simple in-process cron job that fires every 5 minutes and calls each connector's fetch method. No external job queue or Redis dependency. The sync module is behind an interface so it can be swapped for BullMQ or similar later without touching connectors.

**Alternatives considered:**
- BullMQ → requires Redis, too heavy for V0.
- setInterval → less expressive than cron syntax, harder to configure.

### 8. AI agent as a friendly dashboard companion

Integrate an LLM (via a configurable provider — OpenAI-compatible API) that serves two roles:

1. **Greeting panel**: A persistent top-of-dashboard panel that shows "Hello \<Name\>", a friendly/motivational quote, and a brief overall digest of the user's work (e.g., "You have 3 items in review and 5 open issues"). The quote refreshes once per day (not every sync cycle). The digest updates after each sync.
2. **Inline per-item summaries**: Each work item in the list view displays a short AI-generated summary below the title, making it scannable without clicking into each item.

The agent runs after each sync cycle. To avoid hammering the LLM on initial sync (when many items are new), the agent processes at most 20 items per cycle, prioritizing newest first. Remaining items are summarized in subsequent cycles. Summaries are cached — only re-generated when an item's `updatedAt` changes. The daily quote and work digest are persisted in the database so they survive server restarts.

LLM endpoint URL and model name are configured in the settings panel (stored in the database). The API key is kept in an environment variable (`LLM_API_KEY`) since it's a secret. `LLM_ENDPOINT` and `LLM_MODEL` env vars serve as initial defaults that the settings panel overrides. The user's display name is configured in settings.

**Alternatives considered:**
- Standalone summary view → rejected; summaries are more useful inline alongside the items they describe, and the greeting is more welcoming as a persistent panel.
- No AI → loses a key differentiator of the dashboard.
- Hard-coded to OpenAI → too rigid; user may want local models for privacy.
- Regenerate quote every sync cycle → wasteful LLM calls; once per day is sufficient.

### 9. No user authentication

Since this is a single-user local app, there is no login, no sessions, no user table. The app assumes the person running it is the sole user. Source credentials are managed in settings and encrypted at rest.

**Alternatives considered:**
- Basic auth → unnecessary friction for a local tool with no network exposure.

### 10. Encrypted token storage (AES-256-GCM) with auto-generated key

OAuth tokens are encrypted at rest in SQLite using AES-256-GCM. On first run, if no encryption key exists, the app automatically generates a cryptographically secure key and stores it in a local key file (`~/.panorama/encryption.key`). The key can also be provided via the `ENCRYPTION_KEY` environment variable (takes precedence over the key file). The key is never stored in the database or code.

**Alternatives considered:**
- Require `ENCRYPTION_KEY` env var on first run → hostile first-time experience for a local tool.
- No encryption → unacceptable; OAuth tokens are sensitive.

### 11. GitHub repo/org scoping

By default, the GitHub connector fetches items from all repositories owned by the authenticated user. The user can additionally configure organization names in the settings panel (e.g., "elastic") to include repos from those orgs. This keeps the default simple while allowing power users to track work across organizations.

**Alternatives considered:**
- Fetch from all repos the user has access to → too broad, could pull thousands of items from large orgs.
- Require explicit repo list → too tedious to configure.

### 12. Code quality standards

The codebase SHALL be simple, concise, and easy to read and navigate. Modules are self-contained with clear boundaries. Language and framework best practices are followed (TypeScript strict mode, functional React, thin Express handlers). All exported functions and public APIs are documented with JSDoc. REST API request/response shapes are defined as shared TypeScript types. Naming is consistent: `kebab-case` files, `camelCase` variables, `PascalCase` types, `snake_case` DB columns. Core logic (status mapping, parsing, encryption, ordering) has property-based tests using `fast-check`. See the [code-standards spec](specs/code-standards/spec.md) for full requirements.

**Alternatives considered:**
- No formal standards → leads to inconsistent code that's harder to extend; explicit standards cost nothing and pay off immediately.

### 13. Strict read-only and local-only data policy

The app never writes data to external services. No telemetry, no analytics, no outbound data. The only outbound requests are OAuth flows and read-only API calls to fetch work items (plus LLM calls if using a remote model, which the user opts into explicitly).

## Risks / Trade-offs

- **[SQLite concurrency]** → SQLite handles one writer at a time. Mitigation: the sync job and API server are in the same process; WAL mode gives good read concurrency. Sufficient for single-user.
- **[API rate limits]** → GitHub and Jira impose rate limits. Mitigation: 5-minute polling is conservative; use conditional requests (ETags/If-Modified-Since) to minimize calls.
- **[Token security]** → Storing OAuth tokens locally is a liability. Mitigation: AES-256-GCM encryption, key auto-generated or from env var, never in code.
- **[LLM dependency]** → AI summaries depend on an LLM being available. Mitigation: the agent is optional; the dashboard works fully without it. Summaries are cached and batched (max 20 per cycle) so the LLM is not overwhelmed.
- **[Schema drift]** → GitHub/Jira APIs evolve. Mitigation: version the connector interface; connectors are isolated so one breaking doesn't affect others.
- **[Scalability ceiling]** → node-cron and SQLite won't scale to large teams. Mitigation: the sync and storage layers are behind interfaces; swap to BullMQ + PostgreSQL later without rewriting connectors or views.
- **[GitHub org scope]** → User must manually add org names. Mitigation: the default (user's own repos) works out of the box; orgs are additive.
