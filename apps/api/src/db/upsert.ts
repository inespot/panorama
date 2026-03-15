import { eq } from 'drizzle-orm';
import type { PanoramaDb } from './connection.js';
import { githubPrs, githubIssues, jiraTickets } from './schema.js';
import type { TypedWorkItem } from '@panorama/shared';

type WorkItemTable = typeof githubPrs | typeof githubIssues | typeof jiraTickets;

const tableMap: Record<string, WorkItemTable> = {
  'github-pr': githubPrs,
  'github-issue': githubIssues,
  'jira-ticket': jiraTickets,
};

/**
 * Upserts a typed work item into the correct table based on its type tag.
 * Uses source_id as the unique key for conflict resolution.
 */
export function upsertWorkItem(db: PanoramaDb, item: TypedWorkItem): void {
  const table = tableMap[item.type];
  if (!table) {
    throw new Error(`Unknown work item type: ${item.type}`);
  }

  const now = new Date().toISOString();
  const row = { ...item.data, syncedAt: now };

  const existing = db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.sourceId, item.data.sourceId))
    .get();

  if (existing) {
    db.update(table).set(row).where(eq(table.id, existing.id)).run();
  } else {
    db.insert(table).values(row).run();
  }
}
