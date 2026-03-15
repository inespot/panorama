import { Router } from 'express';
import { eq } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { connections, githubPrs, githubIssues, jiraTickets } from '../db/schema.js';
import { getAllConnectors, getConnectorById } from '../connectors/index.js';
import { storeConnection } from '../crypto/index.js';
import type { AppConfig } from '../config.js';
import type { SyncScheduler } from '../sync/index.js';

const workItemTables: Record<string, typeof githubPrs | typeof githubIssues | typeof jiraTickets> = {
  github: githubPrs,
  jira: jiraTickets,
};

/** Connection management routes: list, auth-url, callback, disconnect. */
export function connectionsRouter(
  db: PanoramaDb,
  config: AppConfig,
  syncEngine: SyncScheduler,
): Router {
  const router = Router();

  const getRedirectUri = (source: string, req: { protocol: string; get: (h: string) => string | undefined }) => {
    const host = req.get('host') ?? `localhost:${config.port}`;
    return `${req.protocol}://${host}/api/connections/${source}/callback`;
  };

  router.get('/', (_req, res) => {
    const allConnectors = getAllConnectors();
    const stored = db.select().from(connections).all();
    const storedMap = new Map(stored.map((c) => [c.source, c]));

    const result = allConnectors.map((connector) => {
      const conn = storedMap.get(connector.id);
      const isConfigured =
        (connector.id === 'github' && config.sourceAvailability.github) ||
        (connector.id === 'jira' && config.sourceAvailability.jira);

      return {
        source: connector.id,
        displayName: connector.displayName,
        connected: !!conn,
        configured: isConfigured,
        userIdentity: conn?.userId ?? null,
        lastSyncAt: conn?.lastSyncAt ?? null,
        lastError: conn?.lastError ?? null,
      };
    });

    res.json({ connections: result });
  });

  router.get('/:source/auth-url', (req, res) => {
    const { source } = req.params;
    const connector = getConnectorById(source);
    if (!connector) {
      res.status(404).json({ error: `Unknown source: ${source}` });
      return;
    }

    try {
      const url = connector.getAuthUrl(getRedirectUri(source, req));
      res.json({ url });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate auth URL' });
    }
  });

  router.get('/:source/callback', async (req, res) => {
    const { source } = req.params;
    const code = req.query.code as string | undefined;

    if (!code) {
      res.status(400).json({ error: 'Missing OAuth code' });
      return;
    }

    const connector = getConnectorById(source);
    if (!connector) {
      res.status(404).json({ error: `Unknown source: ${source}` });
      return;
    }

    try {
      const result = await connector.handleCallback(code, getRedirectUri(source, req));

      storeConnection(
        db,
        config.encryptionKey,
        source,
        result.tokens.accessToken,
        result.userIdentity,
        result.tokens.refreshToken,
        result.siteUrl,
      );

      void syncEngine.syncSource(source);

      res.redirect('/?settings=open');
    } catch (err) {
      console.error(`[connections] OAuth callback failed for ${source}:`, err);
      res.redirect('/?settings=open&error=auth_failed');
    }
  });

  router.delete('/:source', (req, res) => {
    const { source } = req.params;

    db.delete(connections).where(eq(connections.source, source)).run();

    if (source === 'github') {
      db.delete(githubPrs).run();
      db.delete(githubIssues).run();
    } else if (source === 'jira') {
      db.delete(jiraTickets).run();
    }

    res.json({ success: true });
  });

  return router;
}
