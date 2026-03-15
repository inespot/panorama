import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const githubPrs = sqliteTable(
  'github_prs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: text('source_id').notNull(),
    sourceUrl: text('source_url').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    actionNeeded: text('action_needed'),
    assignee: text('assignee'),
    labels: text('labels', { mode: 'json' }).$type<string[]>(),
    group: text('group'),
    linkedItems: text('linked_items', { mode: 'json' }).$type<
      Array<{ type: string; identifier: string; url?: string }>
    >(),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    summary: text('summary'),
    summarizedAt: text('summarized_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    syncedAt: text('synced_at').notNull(),
  },
  (table) => [uniqueIndex('github_prs_source_id_idx').on(table.sourceId)],
);

export const githubIssues = sqliteTable(
  'github_issues',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: text('source_id').notNull(),
    sourceUrl: text('source_url').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    priority: text('priority'),
    assignee: text('assignee'),
    labels: text('labels', { mode: 'json' }).$type<string[]>(),
    group: text('group'),
    linkedItems: text('linked_items', { mode: 'json' }).$type<
      Array<{ type: string; identifier: string; url?: string }>
    >(),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    summary: text('summary'),
    summarizedAt: text('summarized_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    syncedAt: text('synced_at').notNull(),
  },
  (table) => [uniqueIndex('github_issues_source_id_idx').on(table.sourceId)],
);

export const jiraTickets = sqliteTable(
  'jira_tickets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: text('source_id').notNull(),
    sourceUrl: text('source_url').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    priority: text('priority'),
    assignee: text('assignee'),
    labels: text('labels', { mode: 'json' }).$type<string[]>(),
    group: text('group'),
    linkedItems: text('linked_items', { mode: 'json' }).$type<
      Array<{ type: string; identifier: string; url?: string }>
    >(),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    summary: text('summary'),
    summarizedAt: text('summarized_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    syncedAt: text('synced_at').notNull(),
  },
  (table) => [uniqueIndex('jira_tickets_source_id_idx').on(table.sourceId)],
);

export const connections = sqliteTable('connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source').notNull().unique(),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  userId: text('user_id').notNull(),
  siteUrl: text('site_url'),
  lastSyncAt: text('last_sync_at'),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value', { mode: 'json' }).$type<unknown>(),
});
