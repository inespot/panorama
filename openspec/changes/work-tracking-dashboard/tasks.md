## 1. Project Scaffolding

- [ ] 1.1 Initialize pnpm workspace with `apps/web`, `apps/api`, and `packages/shared` directories; configure shared types via TypeScript path aliases (no separate build step)
- [ ] 1.2 Configure TypeScript (strict mode), ESLint, and Prettier across all workspaces
- [ ] 1.3 Create `.env.example` documenting all required and optional environment variables (PORT (default 3000), GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, LLM_ENDPOINT, LLM_MODEL, LLM_API_KEY, ENCRYPTION_KEY (optional), RETENTION_TODOS_DAYS, RETENTION_WORK_ITEMS_DAYS)
- [ ] 1.4 Add config loader in `apps/api` that validates env vars — warn (do not crash) for missing OAuth client IDs; mark affected sources as "not configured" so the settings panel can indicate they are unavailable; auto-generate encryption key on first run
- [ ] 1.5 Create Dockerfile that builds the React frontend and serves it from Express as static files — single process, single port

## 2. Database and Data Model

- [ ] 2.1 Add Drizzle ORM to `apps/api` and configure SQLite connection (WAL mode) at `~/.panorama/data.db`
- [ ] 2.2 Define base work-item columns in `packages/shared` (id, source_id, source_url, title, description, status, assignee, labels, group, linked_items JSON, metadata JSON, summary, summarized_at, created_at, updated_at, synced_at)
- [ ] 2.3 Define per-type schemas in `packages/shared`: `GitHubPR` (base + action_needed), `GitHubIssue` (base + priority), `JiraTicket` (base + priority)
- [ ] 2.4 Define normalized status enum (open, in_progress, in_review, done, closed) and action_needed enum (needs_review, needs_response, waiting_on_peer) in `packages/shared`
- [ ] 2.5 Create database tables: `github_prs`, `github_issues`, `jira_tickets` (each with base + type-specific columns), `connections` (source credentials encrypted, authenticated user identity, Jira cloud site URL, last sync timestamp, last error), `todos` (with completed_at timestamp), `settings` (display_name, github orgs list, LLM config, cached greeting quote/digest)
- [ ] 2.6 Write and run initial Drizzle migrations
- [ ] 2.7 Add unique constraint on `source_id` per work-item table and implement upsert logic

## 3. Encrypted Credential Storage

- [ ] 3.1 Implement AES-256-GCM encrypt/decrypt utilities — load key from ENCRYPTION_KEY env var, or auto-generate and store at `~/.panorama/encryption.key` on first run
- [ ] 3.2 Add helper functions for storing and retrieving encrypted OAuth tokens from the connections table
- [ ] 3.3 Verify that no tokens or secrets are ever logged or stored in plaintext

## 4. Connector Plugin Interface

- [ ] 4.1 Define the `Connector` interface in `packages/shared` (id, displayName, itemTypes, getAuthUrl, handleCallback returning OAuthResult with tokens + user identity, refreshToken, fetchItems accepting FetchContext returning TypedWorkItem[])
- [ ] 4.2 Define `FetchContext` type in `packages/shared` (token: string, since: Date | null, userId: string, siteUrl: string | null, config: Record<string, unknown>)
- [ ] 4.3 Define `TypedWorkItem` discriminated union in `packages/shared` — each variant carries a `type` tag and type-specific data
- [ ] 4.4 Create the connector registry module (register, getById, getAll)

## 5. GitHub Connector

- [ ] 5.1 Implement GitHub OAuth flow — `getAuthUrl` (read-only scopes) and `handleCallback` (exchange code for token, fetch username via `/user`); no refresh needed (GitHub OAuth tokens are long-lived)
- [ ] 5.2 Implement `fetchItems` — accept FetchContext; use GitHub GraphQL API to fetch issues and PRs assigned to / authored by the user (including review and comment data for action detection); use `since` for incremental sync (null = fetch all open items); scope to user-owned repos by default, plus configured organizations from `FetchContext.config`
- [ ] 5.3 Normalize GitHub PRs — map to `github-pr` typed items; set `group` to repository name; set `action_needed`; no priority
- [ ] 5.4 Normalize GitHub Issues — map to `github-issue` typed items; set `group` to repository name; extract `priority` from labels
- [ ] 5.5 Implement PR action detection — use GitHub GraphQL API to fetch PR details, reviews, and review threads in a single query; use `userId` from FetchContext to determine `action_needed`: `needs_review`, `needs_response`, `waiting_on_peer`
- [ ] 5.6 Implement priority extraction from labels — match labels like `P0`, `P1`, `priority:high`, etc.; null if no match
- [ ] 5.7 Implement linked items extraction — parse PR title/description for Jira ticket keys (e.g., `ES-1456`) with regex, store as linked items without URL; extract linked PRs for issues via GitHub cross-references, store with URL
- [ ] 5.8 Register the GitHub connector in the connector registry (itemTypes: ['github-pr', 'github-issue'])

## 6. Jira Connector

- [ ] 6.1 Implement Jira Cloud OAuth 2.0 (3LO) flow — `getAuthUrl`, `handleCallback` (exchange code, fetch accessible resources via `GET /oauth/token/accessible-resources`, select first site, fetch user account ID), and `refreshToken`
- [ ] 6.2 Implement `fetchItems` — accept FetchContext; fetch only tickets assigned to the current user (using account ID from `FetchContext.userId` in JQL: `assignee = <accountId>`); use `since` for incremental sync (null = fetch all open tickets)
- [ ] 6.3 Normalize Jira tickets — map to `jira-ticket` typed items; set `group` to epic name (or project name); preserve native Jira priority
- [ ] 6.4 Implement linked items extraction — parse ticket description and comments for GitHub PR URLs (regex matching `https://github.com/<owner>/<repo>/pull/<number>`); store in `linked_items` with type `github-pr`, PR number, and URL
- [ ] 6.5 Register the Jira connector in the connector registry (itemTypes: ['jira-ticket'])

## 7. Sync Engine

- [ ] 7.1 Define a sync-engine interface so the scheduler implementation can be swapped later
- [ ] 7.2 Implement node-cron scheduler that fires every 5 minutes (configurable)
- [ ] 7.2.1 Expose a method to trigger an immediate sync for a single source (used by the OAuth callback handler after connecting a new source)
- [ ] 7.3 Implement sync-cycle logic: iterate connected sources, build FetchContext (decrypt token, load userId, load last sync timestamp, load siteUrl from connection, load connector-specific config from settings), call fetchItems, route each TypedWorkItem to the correct table, upsert
- [ ] 7.4 Add error handling — log failures, record last error per source, continue with remaining sources
- [ ] 7.5 Add rate-limit handling — skip source on HTTP 429, log event, resume next cycle
- [ ] 7.6 Record last sync timestamp and error state per source in the database
- [ ] 7.7 Implement data retention cleanup step — after each sync cycle, delete completed todos past retention period (default 7 days, override via RETENTION_TODOS_DAYS) and work items with terminal status past retention period (default 14 days, override via RETENTION_WORK_ITEMS_DAYS) from all work-item tables

## 8. AI Agent

- [ ] 8.1 Create agent module with configurable LLM provider — API key from `LLM_API_KEY` env var, endpoint/model from settings DB (with `LLM_ENDPOINT` / `LLM_MODEL` env vars as initial defaults)
- [ ] 8.2 Implement per-item summarization — query all work-item tables for items needing summaries (updated_at > summarized_at or summary is null); batch max 20 items per cycle, prioritize newest first; store result in each item's summary column
- [ ] 8.3 Implement greeting generation — generate a friendly quote (cached per day, not per cycle) and a short work digest (updated each cycle) using current work-item counts from all tables; persist both in the database so they survive server restarts
- [ ] 8.4 Add summary caching — only re-summarize items whose updated_at is newer than summarized_at
- [ ] 8.5 Hook agent into sync engine — run summarization and greeting generation after each sync cycle (skip if no LLM endpoint configured in settings or env vars)

## 9. API Endpoints

- [ ] 9.1 GET /api/work-items?type=\<type\> — paginated, sortable, filterable list of work items from the specified table (github-pr, github-issue, jira-ticket); includes type-specific fields
- [ ] 9.2 GET /api/connections — list available sources and their connection status
- [ ] 9.3 GET /api/connections/:source/auth-url — get OAuth redirect URL for a source
- [ ] 9.4 GET /api/connections/:source/callback — OAuth callback handler (exchanges code, encrypts and stores tokens + user identity, triggers immediate background sync for the newly connected source, redirects browser back to dashboard with settings panel open)
- [ ] 9.5 DELETE /api/connections/:source — disconnect, delete credentials, clear that source's work-item tables
- [ ] 9.6 GET/POST/PATCH/DELETE /api/todos — CRUD for personal todo items (PATCH for toggling completion); GET returns items ordered by incomplete first (oldest created), then completed (most recently completed)
- [ ] 9.7 GET/PUT /api/settings — read and update display name, GitHub orgs list, and LLM config
- [ ] 9.8 GET /api/sync-status — last sync time and error state per source
- [ ] 9.9 GET /api/greeting — latest AI-generated greeting (daily quote + work digest) for the top panel
- [ ] 9.10 Configure Vite dev server to proxy /api requests to Express; in production, Express serves the built frontend as static files

## 10. Frontend — Pluggable View System and Shell

- [ ] 10.1 Set up React + Vite project in `apps/web` with TailwindCSS and shadcn/ui, configured for light-mode GitHub-inspired theme (neutral grays, whites, subtle borders, minimal warm colors)
- [ ] 10.2 Implement the view registry (register view with id, label, icon, component)
- [ ] 10.3 Build the dashboard shell — header with gear icon, navigation between the two V0 views (Ongoing Work, Todo List) generated from registry, main content area renders active view, defaults to Ongoing Work on open
- [ ] 10.4 Build the AI greeting panel at the top of the shell (persistent across both views) — "Hello \<Name\>", daily quote, work digest; falls back to simple warm greeting when no LLM is configured
- [ ] 10.5 Add gear icon in header with small status badge (green = healthy, orange/red = errors, neutral = no sources connected)

## 11. Frontend — Ongoing Work View (three-panel layout)

- [ ] 11.1 Build the Ongoing Work view with three separate panels: GitHub Pull Requests, GitHub Issues, and Jira Tickets; each panel fetches its data via `GET /api/work-items?type=<type>`; hide panels for sources that are not connected
- [ ] 11.2 Build the GitHub PRs panel — display title (clickable), created at, status, action-needed indicator (color-coded: "Needs review", "Needs response", "Waiting on peer"), inline AI summary, and linked items badges; NO priority field; group by repository name
- [ ] 11.3 Build the GitHub Issues panel — display title (clickable), created at, status, priority (from labels, if available), inline AI summary, and linked items badges; group by repository name
- [ ] 11.4 Build the Jira Tickets panel — display title (clickable), created at, status, priority (native Jira priority), inline AI summary, and linked items badges; group by epic/project name
- [ ] 11.5 Implement linked items as clickable badges showing type and identifier (e.g., `jira:ES-1456`, `github-pr:#42`, `github-issue:#123`); clickable when URL is available, display-only otherwise
- [ ] 11.6 Clicking any work item title opens its source URL in a new browser tab
- [ ] 11.7 Default to active statuses (open, in_progress, in_review) with a toggle to show recently resolved items
- [ ] 11.8 Display inline AI summary below each work item's title (hidden gracefully when no summary is available)
- [ ] 11.9 Add text search bar that filters across all three panels by title and description
- [ ] 11.10 Add status filter that applies across all three panels
- [ ] 11.11 Build friendly empty state for first-run — welcoming message and "Connect your first source" button that opens settings panel
- [ ] 11.12 Register the Ongoing Work view in the view registry

## 12. Frontend — Todo List View

- [ ] 12.1 Build the Todo List view with an input field for adding items
- [ ] 12.2 Add checkbox toggling for marking items complete (with strikethrough styling)
- [ ] 12.3 Add delete button for removing items
- [ ] 12.4 Display todos ordered: incomplete first (oldest created at top), then completed (most recently completed first)
- [ ] 12.5 Register the Todo List view in the view registry

## 13. Frontend — Settings Panel

- [ ] 13.1 Build settings slide-over panel that opens from the gear icon (not a view — lives outside the view system)
- [ ] 13.2 Add connected-sources section with connection status, connect/disconnect actions per source; show "not configured" for sources missing OAuth env vars
- [ ] 13.3 Add GitHub organizations input — list of org names to include (e.g., "elastic")
- [ ] 13.4 Add display name input field
- [ ] 13.5 Add LLM configuration form (endpoint URL, model name)
- [ ] 13.6 Display sync-error details per source with last sync timestamp

## 14. Code Standards (cross-cutting)

- [ ] 14.1 Enable TypeScript strict mode in all `tsconfig.json` files; eliminate any use of `any` (or add a justifying comment if unavoidable)
- [ ] 14.2 Add JSDoc comments to all exported functions and public interfaces across `apps/api`, `apps/web`, and `packages/shared`
- [ ] 14.3 Define shared TypeScript types for all API request/response shapes in `packages/shared`
- [ ] 14.4 Enforce consistent naming conventions — `kebab-case` files, `camelCase` variables/functions, `PascalCase` types, `snake_case` DB columns, `UPPER_SNAKE_CASE` env vars
- [ ] 14.5 Configure ESLint rules to enforce no-`any`, consistent imports, and max file length (~200 lines guideline)
- [ ] 14.6 Add `fast-check` and a test runner (e.g., Vitest) to `apps/api`; write property-based tests for: status mapping, priority extraction from labels, linked-item URL/key parsing (GitHub PR URLs, Jira ticket keys), encryption round-trips, and todo ordering logic

## 15. Integration and Polish

- [ ] 15.1 Add error boundaries and loading states throughout the UI
- [ ] 15.2 Ensure responsive layout works well on different screen sizes
- [ ] 15.3 Write README with setup instructions, .env reference, and Docker usage
