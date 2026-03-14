## ADDED Requirements

### Requirement: Cron-based periodic polling
The system SHALL run a background cron job using node-cron that triggers a sync for each connected source at a configurable interval (default: every 5 minutes). Each cycle SHALL call the connector's `fetchItems` method with a `FetchContext` (decrypted token, last sync timestamp or null, authenticated user identity, source site URL, connector-specific config). The sync engine SHALL route each returned item to the correct database table based on the item's type tag.

#### Scenario: Scheduled poll triggers
- **WHEN** the cron interval fires
- **THEN** the sync engine SHALL fetch items from every connected source sequentially

#### Scenario: Incremental fetch
- **WHEN** a fetch runs for a connector that has synced before
- **THEN** it SHALL only request items updated since the previous successful sync, reducing API usage

#### Scenario: First sync for a newly connected source
- **WHEN** a connector has no previous sync timestamp (first sync after connecting)
- **THEN** the sync engine SHALL fetch all open/active items regardless of date (no `since` filter), so the dashboard is immediately populated with the user's current work

### Requirement: Immediate sync on source connection
When a new source is successfully connected (OAuth callback completes), the sync engine SHALL trigger an immediate sync for that source rather than waiting for the next scheduled cron tick. This ensures the user sees data promptly after connecting.

#### Scenario: User connects GitHub
- **WHEN** the GitHub OAuth callback succeeds and credentials are stored
- **THEN** the sync engine SHALL immediately run a sync cycle for GitHub (in the background) without waiting for the next cron tick

#### Scenario: Immediate sync does not disrupt scheduled sync
- **WHEN** an immediate sync is triggered for a newly connected source
- **THEN** the regular cron schedule SHALL continue unaffected; the next scheduled cycle will simply see an up-to-date `last_sync_at` and perform a normal incremental fetch

### Requirement: Sync lifecycle abstraction
The sync engine SHALL be behind an interface so the scheduling mechanism (node-cron) can be replaced with a more scalable solution (e.g., BullMQ, external scheduler) later without modifying connectors or the rest of the application.

#### Scenario: Swapping the scheduler
- **WHEN** a developer replaces node-cron with BullMQ in a future version
- **THEN** only the sync-engine implementation SHALL change; connectors and API routes SHALL remain untouched

### Requirement: Error handling and logging
When a connector fetch fails, the sync engine SHALL log the error, record the failure in the database, and continue syncing other sources. The failure SHALL be visible in the UI via the sync-status indicator.

#### Scenario: Transient API failure
- **WHEN** a fetch fails due to a network error or 5xx response
- **THEN** the sync engine SHALL log the error, skip that source for this cycle, and try again on the next cycle

#### Scenario: Failure does not block other sources
- **WHEN** the GitHub connector fails during a sync cycle
- **THEN** the Jira connector SHALL still run its fetch as scheduled

### Requirement: Rate-limit awareness
The sync engine SHALL respect source API rate limits. When a rate-limit response (HTTP 429) is received, the engine SHALL pause requests to that source until the next sync cycle or until the `Retry-After` window expires, whichever is later.

#### Scenario: Hitting GitHub rate limit
- **WHEN** the GitHub API returns HTTP 429
- **THEN** the sync engine SHALL skip GitHub for the remainder of this cycle and log the rate-limit event

### Requirement: Data retention cleanup
After each sync cycle, the sync engine SHALL run a cleanup step that deletes expired records according to the configured retention policies. Completed todos past their retention period and work items with terminal statuses (`done`, `closed`) past their retention period SHALL be removed from all work-item tables (`github_prs`, `github_issues`, `jira_tickets`).

#### Scenario: Cleanup runs after sync
- **WHEN** a sync cycle completes (regardless of success or failure of individual connectors)
- **THEN** the system SHALL delete all completed todos older than the todo retention period and all terminal work items older than the work-item retention period

#### Scenario: Cleanup does not affect active items
- **WHEN** the cleanup step runs
- **THEN** it SHALL only delete items matching the retention criteria and SHALL NOT modify or delete active work items or incomplete todos

### Requirement: AI agent post-processing
After each successful sync cycle, the sync engine SHALL optionally invoke the AI agent to generate or update summaries for new or changed work items. The agent step SHALL be skippable if no LLM is configured.

#### Scenario: Summarizing new items after sync
- **WHEN** a sync cycle completes and new or updated items are present and an LLM endpoint is configured
- **THEN** the sync engine SHALL pass those items to the AI agent for summary generation and store the summaries in the work-item records

#### Scenario: No LLM configured
- **WHEN** no LLM endpoint is configured (neither in settings nor via environment variables)
- **THEN** the sync engine SHALL skip the summarization step and the dashboard SHALL work normally without summaries
