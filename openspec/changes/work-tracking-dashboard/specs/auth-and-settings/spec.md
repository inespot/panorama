## ADDED Requirements

### Requirement: No user authentication
The system SHALL NOT implement user authentication, login, registration, or session management. The app is designed for a single local user and SHALL assume the person running it is the sole user.

#### Scenario: Accessing the dashboard
- **WHEN** a user opens the app in their browser
- **THEN** the dashboard SHALL load immediately without a login screen

### Requirement: Source connection management
The settings panel (opened via the gear icon) SHALL allow the user to connect and disconnect source integrations. Each connected source SHALL display its connection status and the associated account identity.

#### Scenario: Viewing connected sources
- **WHEN** the user opens the settings panel
- **THEN** the system SHALL list all available sources (from the connector registry) with their connection status

#### Scenario: Connecting a new source
- **WHEN** the user clicks "Connect" on an available source
- **THEN** the system SHALL initiate the OAuth flow for that source with read-only scopes

#### Scenario: Disconnecting a source
- **WHEN** the user clicks "Disconnect" on a connected source
- **THEN** the system SHALL delete stored credentials, remove synced items from that source, and stop syncing it

### Requirement: GitHub organization scoping
The settings panel SHALL allow the user to configure a list of GitHub organization names to include when fetching work items. By default, only the user's own repositories are scoped. Adding an org name (e.g., "elastic") includes repos from that org in the fetch.

#### Scenario: Adding an organization
- **WHEN** the user adds "elastic" to the GitHub organizations list in settings
- **THEN** the GitHub connector SHALL include issues and PRs from the "elastic" organization in subsequent syncs

#### Scenario: Removing an organization
- **WHEN** the user removes an organization from the list
- **THEN** the GitHub connector SHALL stop fetching from that organization on subsequent syncs; existing items from that org will age out naturally via data retention

#### Scenario: Default — no organizations configured
- **WHEN** no organizations are configured
- **THEN** the GitHub connector SHALL only fetch from repositories owned by the authenticated user

### Requirement: Encrypted credential storage with auto-generated key
All OAuth tokens and refresh tokens SHALL be encrypted at rest using AES-256-GCM. On first run, if no encryption key exists, the app SHALL automatically generate a cryptographically secure key and store it in a local key file (`~/.panorama/encryption.key`). The key can also be provided via the `ENCRYPTION_KEY` environment variable (takes precedence over the key file). The key SHALL NOT be stored in the database or in code. No auth tokens, secrets, or personal data SHALL ever appear in source code.

#### Scenario: First run — auto-generating key
- **WHEN** the app starts for the first time and no key file or `ENCRYPTION_KEY` env var exists
- **THEN** the app SHALL generate a key, write it to `~/.panorama/encryption.key`, and use it for encryption

#### Scenario: Key provided via env var
- **WHEN** the `ENCRYPTION_KEY` environment variable is set
- **THEN** the app SHALL use that key (ignoring the key file)

#### Scenario: Storing a new token
- **WHEN** the system receives OAuth tokens after a successful authorization
- **THEN** the tokens SHALL be encrypted before being written to the SQLite database

#### Scenario: Reading a token for API calls
- **WHEN** a connector needs to make an authenticated API request
- **THEN** the system SHALL decrypt the stored token in memory and pass it to the connector without persisting the plaintext

### Requirement: App configuration via environment variables
Sensitive configuration (OAuth client IDs/secrets, LLM endpoint) SHALL be loaded from environment variables. The app SHALL provide a `.env.example` file documenting all required and optional variables. The encryption key is auto-generated if not provided (see above).

#### Scenario: Missing OAuth client credentials
- **WHEN** a user tries to connect a source but the corresponding OAuth client ID/secret env vars are not set
- **THEN** the settings panel SHALL indicate that the source is not configured and connecting is unavailable

### Requirement: User display name
The settings panel SHALL allow the user to set their display name. This name SHALL be used in the dashboard greeting panel ("Hello \<Name\>"). If no name is set, the greeting SHALL fall back to "Welcome".

#### Scenario: Setting a display name
- **WHEN** the user enters a display name in settings
- **THEN** the greeting panel SHALL use that name in its greeting

#### Scenario: No display name set
- **WHEN** the display name is empty
- **THEN** the greeting panel SHALL show "Welcome" instead of a personalized greeting

### Requirement: Data retention via environment variables
Data retention periods for completed todos and resolved work items SHALL use hardcoded defaults (7 days for todos, 14 days for work items). These defaults MAY be overridden via environment variables (`RETENTION_TODOS_DAYS`, `RETENTION_WORK_ITEMS_DAYS`). There is no retention settings UI in V0.

#### Scenario: Default retention periods
- **WHEN** no retention environment variables are set
- **THEN** the system SHALL use defaults of 7 days for completed todos and 14 days for resolved work items

#### Scenario: Custom retention via env var
- **WHEN** `RETENTION_WORK_ITEMS_DAYS` is set to 30
- **THEN** resolved work items SHALL be retained for 30 days before deletion

### Requirement: AI agent configuration
The settings panel SHALL allow the user to configure the LLM endpoint URL and model name for AI summaries and greeting content. The LLM configuration SHALL be stored locally and SHALL be optional — the app SHALL function fully without it.

#### Scenario: Configuring an LLM endpoint
- **WHEN** the user enters an LLM endpoint URL and model name in settings
- **THEN** the AI agent SHALL use that endpoint for generating work-item summaries, greeting quotes, and work digests

#### Scenario: No LLM configured
- **WHEN** the LLM configuration is empty
- **THEN** the app SHALL skip AI summarization, the greeting panel SHALL show a simple greeting without a quote or digest, and the dashboard SHALL work normally
