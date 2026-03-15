import { Router } from 'express';
import { like, eq, or, sql, count } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { githubPrs, githubIssues, jiraTickets } from '../db/schema.js';

const tableMap = {
  'github-pr': githubPrs,
  'github-issue': githubIssues,
  'jira-ticket': jiraTickets,
} as const;

type ItemType = keyof typeof tableMap;

/** GET /api/work-items?type=<type>&status=<status>&search=<text>&page=1&limit=50 */
export function workItemsRouter(db: PanoramaDb): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const type = req.query.type as string | undefined;

    if (!type || !(type in tableMap)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(tableMap).join(', ')}` });
      return;
    }

    const table = tableMap[type as ItemType];
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const conditions = [];
    const status = req.query.status as string | undefined;
    if (status) {
      conditions.push(eq(table.status, status));
    }

    const search = req.query.search as string | undefined;
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(or(like(table.title, pattern), like(table.description, pattern))!);
    }

    const where = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`) : undefined;

    const totalResult = db.select({ c: count() }).from(table).where(where).get();
    const total = totalResult?.c ?? 0;

    const items = db
      .select()
      .from(table)
      .where(where)
      .orderBy(sql`${table.createdAt} DESC`)
      .limit(limit)
      .offset(offset)
      .all();

    res.json({ items, total });
  });

  return router;
}
