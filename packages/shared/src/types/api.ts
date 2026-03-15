import type { GitHubIssue, GitHubPR, JiraTicket } from './work-items';

/** Standard error response shape for all API endpoints. */
export interface ApiError {
  error: string;
}

/** GET /api/work-items?type=<type> response. */
export interface WorkItemsResponse {
  items: GitHubPR[] | GitHubIssue[] | JiraTicket[];
  total: number;
}

/** Connection status for a single source. */
export interface ConnectionStatus {
  source: string;
  displayName: string;
  connected: boolean;
  configured: boolean;
  userIdentity: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

/** GET /api/connections response. */
export interface ConnectionsResponse {
  connections: ConnectionStatus[];
}

/** Todo item shape. */
export interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/todos request body. */
export interface CreateTodoRequest {
  text: string;
}

/** PATCH /api/todos/:id request body. */
export interface UpdateTodoRequest {
  text?: string;
  completed?: boolean;
}

/** GET /api/todos response. */
export interface TodosResponse {
  todos: TodoItem[];
}

/** Application settings. */
export interface AppSettings {
  displayName: string | null;
  githubOrgs: string[];
  llmEndpoint: string | null;
  llmModel: string | null;
}

/** PUT /api/settings request body. */
export type UpdateSettingsRequest = Partial<AppSettings>;

/** GET /api/settings response. */
export interface SettingsResponse {
  settings: AppSettings;
}

/** GET /api/sync-status response. */
export interface SyncStatusResponse {
  sources: Array<{
    source: string;
    lastSyncAt: string | null;
    lastError: string | null;
  }>;
}

/** GET /api/greeting response. */
export interface GreetingResponse {
  displayName: string | null;
  quote: string | null;
  digest: string | null;
}
