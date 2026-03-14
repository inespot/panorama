## ADDED Requirements

### Requirement: Pluggable view system
The dashboard SHALL use a view registry pattern. Each view SHALL be a React component that registers itself with metadata (id, label, icon). The dashboard shell SHALL render navigation from the registry and display the active view. Adding or removing a view SHALL NOT require modifying the shell or navigation code.

#### Scenario: Registering a new view
- **WHEN** a developer creates a new view component and registers it in the view registry
- **THEN** the view SHALL automatically appear in the dashboard navigation without changes to the shell

#### Scenario: Removing a view
- **WHEN** a developer removes a view registration from the registry
- **THEN** the view SHALL no longer appear in navigation and the app SHALL continue to function

### Requirement: V0 ships with exactly two views
The V0 of the dashboard SHALL ship with exactly two views: an **Ongoing Work** view (synced items from external sources) and a **Todo List** view (personal tasks). The user SHALL be able to switch between them via clear navigation (e.g., tabs, sidebar, or toggle). Additional views can be added later through the pluggable view system.

#### Scenario: Switching between views
- **WHEN** the user clicks the navigation element for the other view
- **THEN** the dashboard SHALL switch to that view while keeping the greeting panel visible

#### Scenario: Only two views in V0
- **WHEN** the user looks at the navigation
- **THEN** exactly two options SHALL be visible: "Ongoing Work" and "Todo List"

### Requirement: Default to Ongoing Work view
The dashboard SHALL always default to the Ongoing Work view when opened.

#### Scenario: Opening the dashboard
- **WHEN** the user opens the app or navigates to the root URL
- **THEN** the dashboard SHALL display the greeting panel at the top and the Ongoing Work view below it

### Requirement: AI greeting panel
The dashboard shell SHALL display a persistent, friendly top panel above all views. When an LLM is configured and a user display name is set, the panel SHALL show a personalized greeting ("Hello \<Name\>"), a friendly or motivational quote (refreshed once per day), and a brief digest of the user's work status (e.g., "You have 3 items in review and 2 PRs waiting"). When no LLM is configured, the panel SHALL show a simple greeting using the display name (or a generic "Welcome") without the quote or digest. The tone SHALL be warm and encouraging.

#### Scenario: Greeting with AI configured
- **WHEN** the user opens the dashboard and an LLM endpoint and display name are configured
- **THEN** the top panel SHALL show "Hello \<Name\>", a daily quote, and a short work digest

#### Scenario: Greeting without AI configured
- **WHEN** the user opens the dashboard and no LLM endpoint is configured
- **THEN** the top panel SHALL show a simple "Hello \<Name\>" (or "Welcome" if no name is set) without a quote or digest

#### Scenario: Panel is persistent across views
- **WHEN** the user switches between the Ongoing Work and Todo List views
- **THEN** the greeting panel SHALL remain visible at the top of the dashboard

### Requirement: Ongoing Work view — three-panel layout
The Ongoing Work view SHALL display open work items in **three separate panels**, one for each work-item type: **GitHub Pull Requests**, **GitHub Issues**, and **Jira Tickets**. Each panel fetches its data from the API using a `type` parameter (e.g., `GET /api/work-items?type=github-pr`), backed by its own database table. Each panel has type-specific fields. All panels share these common fields: title (clickable — opens source URL in new tab), created at, status, inline AI summary (if available), and linked work items (clickable badges). The view SHALL focus on current, active work — items the user needs to act on now.

All work item titles SHALL be clickable, opening the source URL in a new browser tab. Linked-item badges SHALL be clickable when a URL is available, or display-only otherwise.

#### Scenario: Three panels visible
- **WHEN** the user is on the Ongoing Work view and has GitHub and Jira connected
- **THEN** three panels SHALL be displayed: "GitHub Pull Requests", "GitHub Issues", and "Jira Tickets"

#### Scenario: Panel hidden when source not connected
- **WHEN** a source is not connected (e.g., no Jira connection)
- **THEN** the corresponding panel SHALL be hidden

#### Scenario: Clicking a work item
- **WHEN** the user clicks on any work item title
- **THEN** the source URL SHALL open in a new browser tab

### Requirement: GitHub Pull Requests panel
The GitHub PRs panel SHALL display open pull requests assigned to or authored by the user. Each PR SHALL show: title (clickable), created at, status, action-needed indicator (color-coded: "Needs review", "Needs response", "Waiting on peer"), inline AI summary, and linked work items (e.g., `jira:ES-1456`). PRs SHALL NOT display a priority field. Items SHALL be grouped by repository name (`group` field).

#### Scenario: PR with action-needed indicator
- **WHEN** a GitHub PR has an `actionNeeded` value
- **THEN** the item SHALL display a clear, color-coded label: "Needs review", "Needs response", or "Waiting on peer"

#### Scenario: PR with linked Jira ticket
- **WHEN** a GitHub PR has a linked Jira ticket in its `linkedItems`
- **THEN** a badge (e.g., `jira:ES-1456`) SHALL be displayed; it SHALL be clickable if a URL is available, or display-only otherwise

#### Scenario: Grouped by repository
- **WHEN** the panel renders PRs from multiple repositories
- **THEN** PRs SHALL be grouped under their repository name

### Requirement: GitHub Issues panel
The GitHub Issues panel SHALL display open issues assigned to or authored by the user. Each issue SHALL show: title (clickable), created at, status, priority (extracted from labels, if available), inline AI summary, and linked work items (e.g., linked PRs). Issues SHALL be grouped by repository name (`group` field).

#### Scenario: Issue with priority from labels
- **WHEN** a GitHub issue has a recognized priority label (e.g., `P0`, `priority:high`)
- **THEN** the priority SHALL be displayed on the issue

#### Scenario: Issue without priority
- **WHEN** a GitHub issue has no recognized priority label
- **THEN** no priority SHALL be displayed

#### Scenario: Issue with linked PR
- **WHEN** a GitHub issue has a linked pull request in its `linkedItems`
- **THEN** a clickable badge (e.g., `github-pr:#42`) SHALL be displayed, linking to the PR URL

### Requirement: Jira Tickets panel
The Jira Tickets panel SHALL display open tickets assigned to the user. Each ticket SHALL show: title (clickable), created at, status, priority (native Jira priority), inline AI summary, and linked work items (e.g., `github-pr:#42`). Tickets SHALL be grouped by epic name or project name (`group` field).

#### Scenario: Ticket with priority
- **WHEN** a Jira ticket has a native priority (e.g., "High")
- **THEN** the priority SHALL be displayed on the ticket

#### Scenario: Ticket with linked GitHub PR
- **WHEN** a Jira ticket has a linked GitHub PR in its `linkedItems`
- **THEN** a clickable badge (e.g., `github-pr:#42`) SHALL be displayed, linking to the PR URL

#### Scenario: Grouped by epic/project
- **WHEN** the panel renders tickets from multiple epics or projects
- **THEN** tickets SHALL be grouped under their epic name (or project name if no epic)

### Requirement: Shared Ongoing Work behaviors
The following behaviors apply across all three panels:

#### Scenario: Inline AI summary on each item
- **WHEN** a work item has an AI-generated summary
- **THEN** the summary SHALL be displayed inline below the item's title

#### Scenario: No summary available
- **WHEN** a work item does not have an AI-generated summary
- **THEN** the item SHALL display normally without a summary line

#### Scenario: Linked items as badges
- **WHEN** a work item has entries in its `linkedItems` field
- **THEN** each linked item SHALL be displayed as a badge showing the type and identifier (e.g., `jira:ES-1456`, `github-pr:#42`, `github-issue:#123`); the badge SHALL be clickable (opening the URL in a new tab) when a URL is available, or display-only otherwise

#### Scenario: Items shown are active
- **WHEN** the Ongoing Work view loads
- **THEN** all panels SHALL default to showing only active statuses (open, in_progress, in_review), with recently resolved items available via a filter toggle

#### Scenario: Searching by text
- **WHEN** the user types a keyword in the search bar
- **THEN** all three panels SHALL filter to items whose title or description contains the keyword (case-insensitive)

#### Scenario: Filtering by status
- **WHEN** the user selects a status filter (e.g., "In Review")
- **THEN** all panels SHALL show only work items with that normalized status

### Requirement: Todo List view
The Todo List view SHALL be a customizable personal todo list where the user can add new items, check them off as complete, and delete items. This view is entirely independent of synced work items — it is for the user's own ad-hoc tasks.

#### Scenario: Adding a todo
- **WHEN** the user types a todo item and submits it
- **THEN** the item SHALL appear in the todo list as unchecked

#### Scenario: Completing a todo
- **WHEN** the user clicks the checkbox on a todo item
- **THEN** the item SHALL be visually marked as complete (e.g., strikethrough)

#### Scenario: Deleting a todo
- **WHEN** the user clicks the delete button on a todo item
- **THEN** the item SHALL be removed from the list

#### Scenario: Persistence across sessions
- **WHEN** the user reloads the page
- **THEN** all todo items and their completion state SHALL be preserved

#### Scenario: Todo ordering
- **WHEN** the todo list contains both incomplete and completed items
- **THEN** incomplete items SHALL appear first (ordered by creation date, oldest at top), followed by completed items (most recently completed first)

#### Scenario: Completed todos fade out over time
- **WHEN** a todo has been completed and is within the retention period
- **THEN** it SHALL remain visible with completed styling until the retention period expires, after which it disappears automatically

### Requirement: Settings panel via gear icon
The dashboard header SHALL include a gear icon that opens a settings panel (slide-over or modal). The settings panel is NOT a view — it lives outside the view system and is accessible from any view. The gear icon SHALL display a small status badge indicating the overall health of connected sources (e.g., green dot when all healthy, orange/red when there are errors or no sources connected).

#### Scenario: Opening the settings panel
- **WHEN** the user clicks the gear icon in the header
- **THEN** a settings panel SHALL open, showing source connections, GitHub orgs, display name, LLM config, and sync status

#### Scenario: Closing the settings panel
- **WHEN** the user closes the settings panel (via close button, clicking outside, or pressing Escape)
- **THEN** the panel SHALL close and the user returns to their current view

#### Scenario: Gear icon status badge — all healthy
- **WHEN** all connected sources have synced successfully and at least one source is connected
- **THEN** the gear icon SHALL show a small green status dot

#### Scenario: Gear icon status badge — errors
- **WHEN** one or more connected sources have sync errors
- **THEN** the gear icon SHALL show a small orange or red status dot

#### Scenario: Gear icon status badge — no sources connected
- **WHEN** no sources are connected
- **THEN** the gear icon SHALL show a small neutral or attention-drawing indicator to prompt the user to set up connections

### Requirement: First-run empty state
When the dashboard has no connected sources and no work items, it SHALL display a friendly empty state that guides the user to set up their first connection. The empty state SHALL include a clear call to action (e.g., a "Connect your first source" button that opens the settings panel).

#### Scenario: First-time user with no sources
- **WHEN** the user opens the app for the first time with no connected sources
- **THEN** the Ongoing Work view SHALL display a welcoming empty state with a prompt to connect a source, and optionally auto-open the settings panel

#### Scenario: Sources connected but no items yet
- **WHEN** sources are connected but the first sync has not completed
- **THEN** the Ongoing Work view SHALL show a loading or "syncing..." state

### Requirement: Light mode, GitHub-inspired visual design
The dashboard SHALL use a light-mode design with minimal warm colors, inspired by the GitHub UI aesthetic. The color palette SHALL rely on neutral grays, whites, and subtle borders with restrained use of color for status indicators, source icons, and interactive elements. Typography SHALL be clean and sans-serif. The overall feel SHALL be professional, calm, and uncluttered — similar to how GitHub's interface feels.

#### Scenario: Visual consistency
- **WHEN** the user views any part of the dashboard (views, greeting panel, settings panel)
- **THEN** the visual style SHALL be consistently light-mode with a GitHub-like aesthetic — no dark mode in V0

#### Scenario: Color usage
- **WHEN** color is used in the UI
- **THEN** it SHALL be minimal and purposeful — status badges, source icons, action buttons — not decorative backgrounds or gradients

### Requirement: Clean, minimal, friendly UI
The dashboard UI SHALL prioritize ease of use, visual clarity, and a friendly feel. The layout SHALL use ample whitespace, readable typography, and intuitive navigation. The user should feel welcomed — not overwhelmed — when opening the app. Fancy features SHALL NOT be added at the expense of simplicity.

#### Scenario: First-time user experience
- **WHEN** a user opens the dashboard for the first time
- **THEN** the UI SHALL be immediately understandable without a tutorial, with a friendly greeting at the top, clear navigation between the two views, a gear icon for settings, and a welcoming empty state guiding them to connect their first source
