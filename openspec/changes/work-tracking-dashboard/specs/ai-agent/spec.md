## ADDED Requirements

### Requirement: Work-item summarization
The AI agent SHALL process work items and generate concise, human-readable summaries for each item. Summaries SHALL capture the essence of the work item (what it is, current state, key details) in 1-2 sentences. Summaries are displayed inline on each work item in the list view.

#### Scenario: Summarizing a GitHub issue
- **WHEN** the agent processes a GitHub issue with title "Refactor authentication module" and a lengthy description
- **THEN** the agent SHALL produce a short summary capturing the intent and scope of the issue

#### Scenario: Summarizing a Jira ticket
- **WHEN** the agent processes a Jira ticket with multiple comments and status changes
- **THEN** the agent SHALL produce a summary reflecting the current state and key context

### Requirement: LLM call batching
The AI agent SHALL process at most 20 work items per sync cycle, prioritizing items by newest `updatedAt` first. Items not summarized in a given cycle SHALL be queued for the next cycle. This prevents overwhelming the LLM on initial sync (when many items may be new) and keeps each cycle fast.

#### Scenario: Initial sync with many items
- **WHEN** a sync cycle completes and 50 new items need summarization
- **THEN** the agent SHALL summarize the 20 most recently updated items and leave the remaining 30 for subsequent cycles

#### Scenario: Steady state with few changes
- **WHEN** a sync cycle completes and only 3 items need summarization
- **THEN** the agent SHALL summarize all 3 items in that cycle

### Requirement: Greeting and digest generation
The AI agent SHALL generate content for the dashboard's top greeting panel: a friendly or motivational quote and a brief work digest summarizing the user's current work status across all sources (e.g., counts by status, items needing attention). The greeting panel uses the user's configured display name.

The **work digest** SHALL be regenerated after each sync cycle (it reflects current work-item counts). The **quote** SHALL be generated once per day and cached — not regenerated every sync cycle.

#### Scenario: Generating a greeting with digest
- **WHEN** a sync cycle completes and an LLM is configured
- **THEN** the agent SHALL update the work digest and reuse the cached daily quote

#### Scenario: Daily quote refresh
- **WHEN** a new day has started since the last quote was generated
- **THEN** the agent SHALL generate a fresh quote and cache it for the rest of the day

#### Scenario: Digest content
- **WHEN** the agent generates a work digest
- **THEN** the digest SHALL be a short, friendly summary (1-3 sentences) highlighting what's in progress, what needs attention, and any notable changes since the last sync

### Requirement: Configurable LLM provider
The AI agent SHALL support any OpenAI-compatible API endpoint. The API key SHALL be configured via the `LLM_API_KEY` environment variable (it is a secret and SHALL NOT be stored in the database). The endpoint URL and model name SHALL be configured in the settings panel (stored in the local database). Environment variables `LLM_ENDPOINT` and `LLM_MODEL` MAY be used as initial defaults that the settings panel overrides.

#### Scenario: Using a local Ollama instance
- **WHEN** `LLM_ENDPOINT` is set to `http://localhost:11434/v1`
- **THEN** the agent SHALL send requests to the local Ollama API and all data stays on the user's machine

#### Scenario: Using OpenAI API
- **WHEN** `LLM_ENDPOINT` is set to `https://api.openai.com/v1`
- **THEN** the agent SHALL send requests to OpenAI (the user accepts that work-item data is sent to the provider)

### Requirement: Greeting and digest persistence
The daily quote and work digest SHALL be persisted in the local database (in the `settings` table or a dedicated cache table) so they survive server restarts. The greeting API endpoint SHALL serve the cached values between sync cycles.

#### Scenario: Server restart
- **WHEN** the server restarts between sync cycles
- **THEN** the greeting panel SHALL display the previously cached quote and digest without waiting for a new sync

### Requirement: Summary caching
The agent SHALL cache generated summaries in the work-item's `summary` field. The agent SHALL only re-summarize items whose `updatedAt` has changed since the last summary was generated.

#### Scenario: Skipping unchanged items
- **WHEN** a work item has not been updated since its last summary
- **THEN** the agent SHALL skip it and retain the existing summary

#### Scenario: Re-summarizing updated items
- **WHEN** a work item's `updatedAt` is newer than its `summarizedAt`
- **THEN** the agent SHALL generate a new summary and update both `summary` and `summarizedAt`

### Requirement: Graceful degradation
The AI agent SHALL be fully optional. If no LLM endpoint is configured (neither in settings nor via the `LLM_ENDPOINT` environment variable), the dashboard SHALL function normally — summary fields will be null (items display without summaries), and the greeting panel SHALL fall back to a simple "Hello \<Name\>" without a quote or digest. No errors SHALL be thrown due to missing LLM configuration. The `LLM_API_KEY` environment variable MAY be empty when using local models (e.g., Ollama) that do not require authentication.

#### Scenario: Dashboard without AI
- **WHEN** no LLM endpoint is configured (neither in settings DB nor via environment variable)
- **THEN** the app SHALL start normally, per-item summaries SHALL be null, and the greeting panel SHALL show only the display name greeting

#### Scenario: Local model without API key
- **WHEN** the LLM endpoint is configured (e.g., pointing to Ollama) but no `LLM_API_KEY` is set
- **THEN** the agent SHALL call the endpoint without an API key and function normally
