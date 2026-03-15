import { Router } from 'express';
import type { PanoramaDb } from '../db/index.js';
import { connections } from '../db/schema.js';
import type { SyncScheduler } from '../sync/index.js';

/** GET /api/sync-status — last sync time and error state per source. */
/** POST /api/sync-status/trigger — trigger an immediate sync of all connected sources. */
export function syncStatusRouter(db: PanoramaDb, syncEngine: SyncScheduler): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const allConnections = db.select().from(connections).all();

    const sources = allConnections.map((c) => ({
      source: c.source,
      lastSyncAt: c.lastSyncAt,
      lastError: c.lastError,
    }));

    res.json({ sources });
  });

  router.post('/trigger', async (_req, res) => {
    const allConnections = db.select().from(connections).all();

    if (allConnections.length === 0) {
      res.json({ message: 'No connected sources to sync' });
      return;
    }

    for (const conn of allConnections) {
      void syncEngine.syncSource(conn.source);
    }

    res.json({ message: `Sync triggered for ${allConnections.length} source(s)` });
  });

  return router;
}
