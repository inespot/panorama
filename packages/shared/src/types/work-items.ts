import type { ActionNeeded, WorkItemStatus } from './enums';

/** A cross-source reference stored in linked_items JSON. */
export interface LinkedItem {
  type: 'github-pr' | 'github-issue' | 'jira-ticket';
  identifier: string;
  url?: string;
}

/** Columns shared by all work-item tables. */
export interface BaseWorkItem {
  id: number;
  sourceId: string;
  sourceUrl: string;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  assignee: string | null;
  labels: string[] | null;
  group: string | null;
  linkedItems: LinkedItem[] | null;
  metadata: Record<string, unknown> | null;
  summary: string | null;
  summarizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

/** GitHub pull request — base + action_needed, no priority. */
export interface GitHubPR extends BaseWorkItem {
  actionNeeded: ActionNeeded | null;
}

/** GitHub issue — base + priority from labels. */
export interface GitHubIssue extends BaseWorkItem {
  priority: string | null;
}

/** Jira ticket — base + native Jira priority. */
export interface JiraTicket extends BaseWorkItem {
  priority: string | null;
}
