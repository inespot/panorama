import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { todos } from '../db/schema.js';

/**
 * Todo CRUD routes.
 * GET returns items ordered: incomplete first (oldest created), then completed (most recently completed).
 */
export function todosRouter(db: PanoramaDb): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const items = db
      .select()
      .from(todos)
      .orderBy(
        sql`${todos.completed} ASC`,
        sql`CASE WHEN ${todos.completed} = 0 THEN ${todos.createdAt} END ASC`,
        sql`CASE WHEN ${todos.completed} = 1 THEN ${todos.completedAt} END DESC`,
      )
      .all();

    res.json({ todos: items });
  });

  router.post('/', (req, res) => {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const now = new Date().toISOString();
    const result = db
      .insert(todos)
      .values({ text: text.trim(), completed: false, createdAt: now, updatedAt: now })
      .returning()
      .get();

    res.status(201).json(result);
  });

  router.patch('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { text, completed } = req.body as { text?: string; completed?: boolean };

    const existing = db.select().from(todos).where(eq(todos.id, id)).get();
    if (!existing) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (text !== undefined) updates.text = text.trim();
    if (completed !== undefined) {
      updates.completed = completed;
      updates.completedAt = completed ? now : null;
    }

    db.update(todos).set(updates).where(eq(todos.id, id)).run();

    const updated = db.select().from(todos).where(eq(todos.id, id)).get();
    res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.delete(todos).where(eq(todos.id, id)).run();
    res.json({ success: true });
  });

  return router;
}
