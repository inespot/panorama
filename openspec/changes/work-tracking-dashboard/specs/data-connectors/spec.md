## ADDED Requirements

### Requirement: Connector plugin interface
The system SHALL expose a `Connector` interface that each source integration implements. The interface SHALL include methods for generating an OAuth authorization URL, handling the OAuth callback (returning tokens and the authenticated user's identity), refreshing tokens (where supported), and fetching + normalizing items. The system SHALL provide a connector registry for looking up connectors by source ID. Adding a new connector SHALL NOT require modifying core application code.

Each connector SHALL declare which work-item types it produces (e.g., `['github-pr', 'github-issue']`). The sync engine uses this to route normalized items to the correct database tables.

OAuth token encryption, storage, and retrieval are handled by the core application — connectors never access the database directly. The core passes a `FetchContext` (decrypted token, last sync timestamp, authenticated user identity, source site URL, connector-specific config) to the connector's `fetchItems` method.

#### Scenario: Registering a new connector
- **WHEN** a developer implements the `Connector` interface for a new source and registers it in the connector registry
- **THEN** the system makes that source available for the user to connect without changes to core application code

#### Scenario: Listing available connectors
- **WHEN** the settings UI requests the list of available sources
- **THEN** the registry SHALL return all registered connectors with their id and display name

### Requirement: FetchContext
The connector's `fetchItems` method SHALL receive a `FetchContext` object containing:
- `token` — the decrypted OAuth access token
- `since` — the timestamp of the last successful sync, or `null` on first sync
- `userId` — the authenticated user's identity (username or account ID) stored during OAuth callback
- `siteUrl` — the source instance base URL from the `connections` table (e.g., the Jira Cloud site URL); `null` for sources that don't need it (e.g., GitHub)
- `config` — a connector-specific configuration bag (`Record<string, unknown>`) populated by the sync engine from app settings (e.g., `{ githubOrgs: ['elastic'] }` for the GitHub connector)

This replaces positional parameters and is extensible for future needs.

#### Scenario: First sync
- **WHEN** `since` is null (first sync after connecting)
- **THEN** the connector SHALL fetch all open/active items regardless of date

#### Scenario: Incremental sync
- **WHEN** `since` is a valid timestamp
- **THEN** the connector SHALL only fetch items updated since that timestamp

### Requirement: Read-only data access
All connectors SHALL operate in read-only mode. No connector SHALL write, update, or delete data in the external source. The only outbound requests to source APIs SHALL be OAuth authorization flows and read-only data fetches.

### Requirement: GitHub connector
The system SHALL provide a connector for GitHub that produces two work-item types: `github-pr` and `github-issue`. It fetches issues, pull requests, and review data assigned to or authored by the authenticated user. By default, the connector SHALL fetch from repositories owned by the user. The user MAY configure additional organization names in settings to include repos from those orgs.

#### Scenario: Fetching from user-owned repos
- **WHEN** the sync engine triggers a fetch and no organizations are configured
- **THEN** the connector SHALL retrieve issues and PRs from repositories owned by the authenticated user

#### Scenario: Fetching from configured organizations
- **WHEN** the user has configured organizations (e.g., "elastic") in settings
- **THEN** the sync engine SHALL pass them via `FetchContext.config` (as `githubOrgs`) and the connector SHALL also fetch issues and PRs assigned to or authored by the user from repositories in those organizations

#### Scenario: Normalizing GitHub items
- **WHEN** the connector receives raw GitHub API responses
- **THEN** it SHALL normalize each item into its typed schema (`github-pr` or `github-issue`), setting `group` to the repository name, and tagging the item with its type so the sync engine routes it to the correct table

### Requirement: GitHub priority extraction from labels
The GitHub connector SHALL extract priority from issue labels matching common priority conventions (e.g., `P0`, `P1`, `P2`, `priority:high`, `priority:medium`, `priority:low`). If no recognizable priority label is found, `priority` SHALL be null. GitHub PRs have no priority column.

#### Scenario: Issue with priority label
- **WHEN** a GitHub issue has a label matching a priority pattern (e.g., `P0`, `priority:high`)
- **THEN** the connector SHALL extract and normalize the priority value

#### Scenario: Issue without priority label
- **WHEN** a GitHub issue has no recognizable priority label
- **THEN** `priority` SHALL be null

### Requirement: GitHub linked items extraction
The GitHub connector SHALL extract cross-references to other work items:
- For **PRs**: parse the PR title and description for Jira ticket keys (e.g., `ES-1456`, `PROJ-42`) using a regex pattern. Store them as linked items with type `jira-ticket` and the key as display identifier. The URL is omitted since the connector does not know the Jira Cloud base URL.
- For **issues**: extract linked/referenced pull requests (via GitHub's timeline events or cross-references) and store them as linked items with type `github-pr`, including the PR URL.

#### Scenario: PR referencing a Jira ticket in description
- **WHEN** a GitHub PR description contains "Fixes ES-1456"
- **THEN** the connector SHALL extract `ES-1456` and add a linked item with type `jira-ticket` and no URL

#### Scenario: Issue with linked PR
- **WHEN** a GitHub issue has a cross-referenced or linked pull request
- **THEN** the connector SHALL add a linked item with type `github-pr`, the PR number, and the PR URL

### Requirement: GitHub PR action detection
For each GitHub pull request, the connector SHALL determine the `action_needed` field based on the user's relationship to the PR (using `userId` from `FetchContext`) and its review/comment state. The connector SHOULD use the GitHub GraphQL API to fetch PR details, reviews, and review threads in a single query — this avoids the multiple REST API calls per PR that would otherwise be required and significantly reduces API usage:

- **`needs_review`**: The PR is assigned to the user for review and the user has not yet submitted a review.
- **`needs_response`**: The PR is authored by the user and has review comments or change requests that the user has not responded to.
- **`waiting_on_peer`**: The PR is authored by the user and is either awaiting review from others or the user has already responded to all comments.

#### Scenario: PR assigned for review, not yet reviewed
- **WHEN** a PR is requested for the user's review and the user has not submitted a review
- **THEN** `action_needed` SHALL be set to `needs_review`

#### Scenario: PR authored by user, unaddressed review comments
- **WHEN** the user authored a PR and there are open review threads where the last comment is not from the user
- **THEN** `action_needed` SHALL be set to `needs_response`

#### Scenario: PR authored by user, all comments addressed or awaiting review
- **WHEN** the user authored a PR and either no reviews have been submitted yet, or the user has responded to all review threads
- **THEN** `action_needed` SHALL be set to `waiting_on_peer`

#### Scenario: Non-PR items
- **WHEN** a work item is a GitHub issue
- **THEN** the `action_needed` field does not apply (the `github_issues` table has no such column)

### Requirement: GitHub authentication
The GitHub connector SHALL use GitHub's OAuth 2.0 flow. GitHub OAuth App tokens are long-lived and do not expire, so no token refresh is needed. The connector SHALL implement `getAuthUrl` and `handleCallback` but MAY leave `refreshToken` as a no-op.

#### Scenario: Connecting a GitHub account
- **WHEN** the user initiates the GitHub connection flow from settings
- **THEN** the system SHALL redirect to GitHub's OAuth authorization page with read-only scopes, exchange the returned code for an access token, fetch the user's GitHub username (via `/user`), and store the token encrypted alongside the username

#### Scenario: GitHub tokens do not expire
- **WHEN** the connector holds a GitHub OAuth token
- **THEN** the token SHALL remain valid indefinitely and no refresh flow is needed

### Requirement: Jira connector
The system SHALL provide a connector for Jira Cloud that produces one work-item type: `jira-ticket`. It fetches tickets assigned to the authenticated user.

#### Scenario: Fetching Jira tickets
- **WHEN** the sync engine triggers a fetch for the Jira connector
- **THEN** the connector SHALL retrieve only tickets assigned to the current user (using the account ID from `FetchContext.userId` in JQL: `assignee = <accountId>`), updated since the last sync timestamp (or all open tickets on first sync)

#### Scenario: Normalizing Jira items
- **WHEN** the connector receives raw Jira API responses
- **THEN** it SHALL normalize each ticket into the `jira-ticket` schema, preserving title, status, assignee, native Jira priority, timestamps, and extracting the parent epic name (or project name) into `group`

#### Scenario: Extracting epic and project grouping
- **WHEN** a Jira ticket belongs to an epic and/or a project
- **THEN** the connector SHALL store the epic name (if present, otherwise the project name) in `group`

### Requirement: Jira linked items extraction
The Jira connector SHALL extract linked GitHub pull request URLs from each ticket's description and comments by matching common GitHub PR URL patterns (e.g., `https://github.com/<owner>/<repo>/pull/<number>`). This avoids the complexity of the Jira Development Status API, which requires the GitHub for Jira app to be installed. Linked PRs SHALL be stored as linked items with type `github-pr`, including the PR URL and number extracted from the URL.

In V0, the connector SHALL include **all** matched GitHub PRs on a ticket — not just those authored by the authenticated user.

#### Scenario: Extracting linked GitHub PRs from description
- **WHEN** a Jira ticket description contains a GitHub PR URL (e.g., `https://github.com/elastic/elasticsearch/pull/42`)
- **THEN** the connector SHALL extract it and store a linked item with type `github-pr`, identifier `#42`, and the full URL

#### Scenario: Extracting linked GitHub PRs from comments
- **WHEN** a Jira ticket comment contains a GitHub PR URL
- **THEN** the connector SHALL extract it and store a linked item with type `github-pr`, identifier and URL

#### Scenario: No linked items
- **WHEN** a Jira ticket has no GitHub PR URLs in its description or comments
- **THEN** the `linked_items` column SHALL be null or an empty array

### Requirement: Jira authentication with token refresh
The Jira connector SHALL use Jira Cloud's OAuth 2.0 (3LO) authorization code flow. Jira access tokens expire and SHALL be refreshed using the refresh token before making API calls when the current token has expired.

#### Scenario: Connecting a Jira account
- **WHEN** the user initiates the Jira connection flow from settings
- **THEN** the system SHALL redirect to Jira's OAuth authorization page with read-only scopes, exchange the returned code for access and refresh tokens, and store them encrypted

#### Scenario: Jira Cloud site selection
- **WHEN** the OAuth callback completes and the system calls `GET /oauth/token/accessible-resources`
- **THEN** the connector SHALL select the first accessible Jira Cloud site and store its ID and base URL in the connection record; the sync engine SHALL pass this URL via `FetchContext.siteUrl` on subsequent fetches

#### Scenario: Token refresh
- **WHEN** a Jira access token has expired and a refresh token is available
- **THEN** the system SHALL automatically request a new access token before making API calls

### Requirement: Authenticated user identity
When a source is connected via OAuth, the system SHALL store the authenticated user's identity (username or account ID) alongside the encrypted tokens in the `connections` table. This identity is passed to the connector via `FetchContext.userId` during sync.

The `handleCallback` method SHALL return the user's identity along with the OAuth tokens.

#### Scenario: Storing GitHub user identity
- **WHEN** the GitHub OAuth callback succeeds
- **THEN** the system SHALL fetch the authenticated user's GitHub username (via `/user` endpoint) and store it in the `connections` table

#### Scenario: Storing Jira user identity
- **WHEN** the Jira OAuth callback succeeds
- **THEN** the system SHALL fetch the authenticated user's Jira account ID and store it in the `connections` table

### Requirement: OAuth callback redirects to dashboard
After the OAuth callback handler exchanges the authorization code for tokens and stores them, it SHALL redirect the user's browser back to the dashboard with the settings panel open (e.g., redirect to `/?settings=open`).

#### Scenario: Successful OAuth connection
- **WHEN** the OAuth callback handler successfully stores the encrypted tokens
- **THEN** the server SHALL trigger an immediate background sync for the newly connected source and redirect the browser to the dashboard URL with the settings panel open

#### Scenario: Failed OAuth connection
- **WHEN** the OAuth callback fails (invalid code, network error)
- **THEN** the browser SHALL be redirected to the dashboard with an error indicator

### Requirement: Revoking a connection
When the user disconnects a source, the system SHALL delete stored credentials from the database, remove all synced items from that source's tables, and stop syncing it.

#### Scenario: Disconnecting GitHub
- **WHEN** the user disconnects GitHub
- **THEN** the system SHALL delete stored credentials, clear the `github_prs` and `github_issues` tables, and stop syncing

#### Scenario: Disconnecting Jira
- **WHEN** the user disconnects Jira
- **THEN** the system SHALL delete stored credentials, clear the `jira_tickets` table, and stop syncing
