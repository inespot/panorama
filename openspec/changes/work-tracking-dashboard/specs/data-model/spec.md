## ADDED Requirements

### Requirement: Per-type work-item tables
The system SHALL store work items in **separate database tables per type** rather than a single unified table. Each table has columns specific to its work-item type alongside a common set of base columns. This avoids forcing a one-size-fits-all schema that becomes a constraint as new types are added. Adding a new work-item type means adding a new table — existing tables are never altered.

V0 ships with three tables:
- `github_prs` — GitHub pull requests
- `github_issues` — GitHub issues
- `jira_tickets` — Jira tickets

#### Scenario: Adding a new work-item type in the future
- **WHEN** a developer adds support for a new type (e.g., `gitlab_merge_requests`)
- **THEN** they create a new table with the base columns plus any type-specific columns, without modifying existing tables

### Requirement: Base work-item columns
All work-item tables SHALL share a common set of base columns:
- `id` — primary key (auto-generated)
- `source_id` — the item's ID in the external source (unique per table)
- `source_url` — clickable URL to the item in its source
- `title` — item title
- `description` — item description (nullable)
- `status` — normalized status enum
- `assignee` — assigned user (nullable)
- `labels` — JSON array of labels (nullable)
- `group` — grouping category (nullable): repo name for GitHub, epic/project for Jira
- `linked_items` — JSON array of cross-source references (nullable), each with type, display identifier, and URL (when available)
- `metadata` — JSON for source-specific data not in base columns (nullable)
- `summary` — AI-generated summary (nullable)
- `summarized_at` — timestamp of last summary generation (nullable)
- `created_at` — when the item was created in the source
- `updated_at` — when the item was last updated in the source
- `synced_at` — when the item was last synced locally

#### Scenario: Consistent base fields across types
- **WHEN** work items from different sources are stored
- **THEN** every table SHALL have all base columns, using null where a value is not applicable

### Requirement: GitHub PRs table — type-specific columns
The `github_prs` table SHALL include, in addition to all base columns:
- `action_needed` — nullable enum (`needs_review`, `needs_response`, `waiting_on_peer`)

PRs SHALL NOT have a `priority` column.

### Requirement: GitHub Issues table — type-specific columns
The `github_issues` table SHALL include, in addition to all base columns:
- `priority` — nullable string, extracted from labels

### Requirement: Jira Tickets table — type-specific columns
The `jira_tickets` table SHALL include, in addition to all base columns:
- `priority` — nullable string, native Jira priority

### Requirement: Normalized status mapping
The system SHALL map source-specific statuses to a normalized set: `open`, `in_progress`, `in_review`, `done`, `closed`. Each connector SHALL define its own status mapping table.

#### Scenario: GitHub status mapping
- **WHEN** a GitHub issue has state `open`
- **THEN** the normalized status SHALL be `open`

#### Scenario: Jira status mapping
- **WHEN** a Jira ticket has status `In Development`
- **THEN** the normalized status SHALL be `in_progress`

### Requirement: Per-table deduplication
Each work-item table SHALL have a unique constraint on `source_id`. If a fetched item matches an existing record in its table, the system SHALL update the existing record rather than creating a duplicate.

#### Scenario: Re-fetching an already-synced item
- **WHEN** the sync engine fetches an item whose `source_id` already exists in the relevant table
- **THEN** the system SHALL update the existing record's fields and set a new `synced_at` timestamp

### Requirement: Action-needed indicator (GitHub PRs only)
The `action_needed` column on the `github_prs` table SHALL capture what the user needs to do next. It is a nullable enum with values: `needs_review`, `needs_response`, `waiting_on_peer`. All other work-item types do not have this column.

#### Scenario: PR needing review
- **WHEN** a GitHub PR is assigned to the user for review
- **THEN** `action_needed` SHALL be `needs_review`

#### Scenario: PR needing response
- **WHEN** a GitHub PR authored by the user has unaddressed review comments
- **THEN** `action_needed` SHALL be `needs_response`

#### Scenario: PR waiting on peer
- **WHEN** a GitHub PR authored by the user is awaiting reviews or all comments are addressed
- **THEN** `action_needed` SHALL be `waiting_on_peer`

### Requirement: Work-item grouping
The `group` column SHALL allow work items to be grouped within each panel. For Jira tickets, this is the parent epic name (or project name if no epic). For GitHub items, this is the repository name.

#### Scenario: Jira ticket with epic
- **WHEN** a Jira ticket belongs to the epic "Platform Migration"
- **THEN** the `group` column SHALL be set to "Platform Migration"

#### Scenario: Jira ticket without epic
- **WHEN** a Jira ticket has no parent epic
- **THEN** the `group` column SHALL fall back to the Jira project name

#### Scenario: GitHub item grouping
- **WHEN** a GitHub issue or PR is stored
- **THEN** the `group` column SHALL be set to the repository name

### Requirement: Linked work items
The `linked_items` JSON column SHALL store references to related work items across sources. Each entry SHALL include the item type (e.g., `github-pr`, `github-issue`, `jira-ticket`), a display identifier (e.g., `ES-1456`, `#42`), and a URL when available. This enables cross-source traceability.

#### Scenario: Jira ticket with linked GitHub PR
- **WHEN** a Jira ticket has a linked GitHub pull request
- **THEN** the `linked_items` column SHALL contain an entry with type `github-pr`, the PR number, and the PR URL

#### Scenario: GitHub PR referencing a Jira ticket
- **WHEN** a GitHub PR title or description contains a Jira ticket key (e.g., `ES-1456`)
- **THEN** the `linked_items` column SHALL contain an entry with type `jira-ticket` and the ticket key as display identifier (URL omitted if the Jira base URL is unknown)

#### Scenario: No linked items
- **WHEN** a work item has no linked work items
- **THEN** the `linked_items` column SHALL be null or an empty array

### Requirement: Source-specific priority handling
Priority is a type-specific column, present only on tables where it applies:
- **`jira_tickets`**: `priority` column stores the native Jira priority (e.g., Highest, High, Medium, Low, Lowest).
- **`github_issues`**: `priority` column stores the value extracted from labels matching common conventions (e.g., `P0`, `P1`, `priority:high`). Null if no priority label is found.
- **`github_prs`**: No `priority` column — PRs do not have a meaningful priority.

### Requirement: Work-item metadata extensibility
Each table SHALL have a `metadata` JSON column for source-specific data that does not map to the table's defined columns (e.g., GitHub milestone, Jira sprint name, custom fields).

#### Scenario: Storing GitHub-specific metadata
- **WHEN** a GitHub issue includes milestone and project-board information
- **THEN** the connector SHALL store these in the `metadata` column without altering the table schema

---

### Requirement: Connections table
The system SHALL store source connection data in a `connections` table with the following columns:
- `id` — primary key (auto-generated)
- `source` — connector identifier (e.g., `github`, `jira`; unique — one connection per source)
- `encrypted_tokens` — encrypted JSON blob containing access token and refresh token (where applicable)
- `user_identity` — the authenticated user's identity in the source (GitHub username, Jira account ID)
- `site_url` — the source instance base URL (nullable; used by Jira Cloud to store the selected site URL, null for GitHub)
- `last_sync_at` — timestamp of the last successful sync for this source (nullable)
- `last_error` — description of the last sync error (nullable; cleared on successful sync)
- `created_at` — when the connection was established
- `updated_at` — when the connection record was last modified

#### Scenario: Storing a new connection
- **WHEN** the user completes an OAuth flow for a source
- **THEN** the system SHALL create a row in `connections` with the encrypted tokens, user identity, and site URL (if applicable)

#### Scenario: One connection per source
- **WHEN** the user reconnects a source that is already connected
- **THEN** the system SHALL update the existing row rather than creating a duplicate

#### Scenario: Recording sync state
- **WHEN** a sync cycle completes for a source
- **THEN** the system SHALL update `last_sync_at` (on success) or `last_error` (on failure) on the connection row

#### Scenario: Disconnecting a source
- **WHEN** the user disconnects a source
- **THEN** the system SHALL delete the connection row and clear all work-item data from that source's tables

### Requirement: Settings table
The system SHALL store application settings in a `settings` table. This is a **single-row** table (the app has one user) with the following columns:
- `id` — primary key (always 1)
- `display_name` — the user's display name for the greeting panel (nullable)
- `github_orgs` — JSON array of GitHub organization names to include in fetches (nullable, defaults to empty array)
- `llm_endpoint` — LLM API endpoint URL (nullable)
- `llm_model` — LLM model name (nullable)
- `greeting_quote` — cached daily AI-generated quote (nullable)
- `greeting_quote_date` — date the cached quote was generated (nullable; used to determine when to refresh)
- `greeting_digest` — cached AI-generated work digest (nullable)
- `updated_at` — when settings were last modified

#### Scenario: First run — default settings
- **WHEN** the app starts for the first time
- **THEN** the system SHALL create the single settings row with all nullable fields set to null and `github_orgs` set to an empty array

#### Scenario: Updating display name
- **WHEN** the user sets their display name in the settings panel
- **THEN** the system SHALL update the `display_name` column and the greeting panel SHALL reflect the change

#### Scenario: Updating GitHub orgs
- **WHEN** the user adds or removes organizations in settings
- **THEN** the system SHALL update the `github_orgs` JSON array

#### Scenario: Persisting LLM config
- **WHEN** the user configures an LLM endpoint and model in settings
- **THEN** the system SHALL store them in `llm_endpoint` and `llm_model`, overriding env var defaults

#### Scenario: Caching greeting content
- **WHEN** the AI agent generates a new quote or digest
- **THEN** the system SHALL update `greeting_quote`, `greeting_quote_date`, and/or `greeting_digest` so they survive server restarts

#### Scenario: Quote staleness check
- **WHEN** the AI agent runs after a sync cycle
- **THEN** it SHALL compare `greeting_quote_date` to today's date; if different, generate a new quote

---

### Requirement: Personal todo items
The system SHALL store user-created todo items in a separate `todos` table with columns:
- `id` — primary key (auto-generated)
- `text` — the todo item text
- `completed` — boolean
- `completed_at` — nullable timestamp (set when completed, cleared when uncompleted)
- `created_at` — when the todo was created
- `updated_at` — when the todo was last modified

Todos are local-only and never synced to any external source.

#### Scenario: Creating a todo
- **WHEN** the user adds a new todo item
- **THEN** the system SHALL persist it with `completed` set to false and `completed_at` set to null

#### Scenario: Completing a todo
- **WHEN** the user checks off a todo item
- **THEN** the system SHALL set `completed` to true and `completed_at` to the current timestamp

#### Scenario: Uncompleting a todo
- **WHEN** the user unchecks a previously completed todo item
- **THEN** the system SHALL set `completed` to false and `completed_at` back to null

#### Scenario: Deleting a todo
- **WHEN** the user deletes a todo item
- **THEN** the system SHALL remove it from the database

### Requirement: Todo ordering
Todos SHALL be displayed with incomplete items first (ordered by creation date, oldest at top), followed by completed items (ordered by completion date, most recently completed first). This keeps the natural task-list feel where new items are added at the bottom and completed items sink below the active ones.

#### Scenario: Mixed incomplete and completed todos
- **WHEN** the todo list contains both incomplete and completed items
- **THEN** incomplete items SHALL appear first (oldest created at top), followed by completed items (most recently completed first)

### Requirement: Data retention for completed todos
The system SHALL automatically delete completed todo items after a configurable retention period (default: 7 days). The retention clock starts from `completed_at`. If a todo is uncompleted before the retention period expires, it SHALL be kept.

#### Scenario: Completed todo expires
- **WHEN** a todo has been completed for longer than the configured retention period
- **THEN** the system SHALL delete it during the next cleanup cycle

#### Scenario: Completed todo within retention window
- **WHEN** a todo was completed less than the retention period ago
- **THEN** the system SHALL keep it visible with its completed styling

### Requirement: Data retention for resolved work items
The system SHALL automatically delete work items with terminal statuses (`done`, `closed`) after a configurable retention period (default: 14 days) from all work-item tables. The retention clock starts from the item's `updated_at` timestamp.

#### Scenario: Merged PR expires
- **WHEN** a GitHub pull request was merged more than the retention period ago
- **THEN** the system SHALL delete it from the `github_prs` table during the next cleanup cycle

#### Scenario: Closed Jira ticket expires
- **WHEN** a Jira ticket has been closed for longer than the retention period
- **THEN** the system SHALL delete it from the `jira_tickets` table during the next cleanup cycle

#### Scenario: Active item is never auto-deleted
- **WHEN** a work item has a non-terminal status (open, in_progress, in_review)
- **THEN** the system SHALL never auto-delete it regardless of age

### Requirement: Local-only storage
All data SHALL be stored in a local SQLite database file at `~/.panorama/data.db`. No data SHALL ever be sent to external services, written to the web, or transmitted over the network (except for read-only API calls to connected sources and optional LLM calls the user explicitly configures).
