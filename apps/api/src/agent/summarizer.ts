import { sql, lt, isNull, or } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { githubPrs, githubIssues, jiraTickets } from '../db/schema.js';
import type { LlmConfig } from './llm-client.js';
import { chatCompletion } from './llm-client.js';

const BATCH_SIZE = 20;

const SYSTEM_PROMPT = `You are a concise work-item summarizer. Given a work item's title and description, produce a 1-2 sentence summary that captures the key intent. Be direct and brief.`;

type WorkItemTableName = 'github_prs' | 'github_issues' | 'jira_tickets';

interface ItemToSummarize {
  table: WorkItemTableName;
  id: number;
  title: string;
  description: string | null;
}

/**
 * Finds items needing summaries across all work-item tables,
 * batches up to 20 per cycle, and updates each with an AI summary.
 */
export async function runSummarization(db: PanoramaDb, config: LlmConfig): Promise<number> {
  const candidates = collectCandidates(db);

  const batch = candidates.slice(0, BATCH_SIZE);
  let summarized = 0;

  for (const item of batch) {
    try {
      const userPrompt = item.description
        ? `Title: ${item.title}\nDescription: ${item.description}`
        : `Title: ${item.title}`;

      const summary = await chatCompletion(config, SYSTEM_PROMPT, userPrompt);
      if (!summary) continue;

      const now = new Date().toISOString();

      db.run(sql`UPDATE ${sql.raw(item.table)} SET summary = ${summary}, summarized_at = ${now} WHERE id = ${item.id}`);

      summarized++;
    } catch (err) {
      console.error(`[agent] Failed to summarize ${item.table}#${item.id}:`, err);
    }
  }

  return summarized;
}

function queryTable(
  db: PanoramaDb,
  table: typeof githubPrs | typeof githubIssues | typeof jiraTickets,
): Array<{ id: number; title: string; description: string | null }> {
  return db
    .select({
      id: table.id,
      title: table.title,
      description: table.description,
    })
    .from(table)
    .where(or(isNull(table.summarizedAt), lt(table.summarizedAt, table.updatedAt)))
    .orderBy(sql`${table.updatedAt} DESC`)
    .limit(BATCH_SIZE)
    .all();
}

function collectCandidates(db: PanoramaDb): ItemToSummarize[] {
  const candidates: ItemToSummarize[] = [];

  const sources: Array<[WorkItemTableName, typeof githubPrs | typeof githubIssues | typeof jiraTickets]> = [
    ['github_prs', githubPrs],
    ['github_issues', githubIssues],
    ['jira_tickets', jiraTickets],
  ];

  for (const [tableName, table] of sources) {
    for (const row of queryTable(db, table)) {
      candidates.push({ table: tableName, id: row.id, title: row.title, description: row.description });
    }
  }

  candidates.sort((a, b) => b.id - a.id);
  return candidates;
}
