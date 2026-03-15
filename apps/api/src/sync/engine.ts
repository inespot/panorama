import cron, { type ScheduledTask } from 'node-cron';
import { eq, and, lt, inArray } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { connections, githubPrs, githubIssues, jiraTickets, todos, settings } from '../db/schema.js';
import { getConnectorById } from '../connectors/registry.js';
import { decrypt, encrypt } from '../crypto/index.js';
import { upsertWorkItem } from '../db/upsert.js';
import type { AppConfig } from '../config.js';
import type { FetchContext } from '@panorama/shared';
import type { SyncScheduler } from './types.js';

const TERMINAL_STATUSES = ['done', 'closed'];

export class CronSyncEngine implements SyncScheduler {
  private task: ScheduledTask | null = null;
  private running = false;

  constructor(
    private db: PanoramaDb,
    private config: AppConfig,
    private onCycleComplete?: () => Promise<void>,
  ) {}

  start(): void {
    this.task = cron.schedule('*/5 * * * *', () => {
      void this.runFullCycle();
    });
    console.log('[sync] Scheduler started — every 5 minutes');
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
    console.log('[sync] Scheduler stopped');
  }

  async syncSource(sourceId: string): Promise<void> {
    try {
      await this.syncSingle(sourceId);
    } catch (err) {
      console.error(`[sync] Immediate sync for ${sourceId} failed:`, err);
    }
  }

  private async runFullCycle(): Promise<void> {
    if (this.running) {
      console.log('[sync] Previous cycle still running, skipping');
      return;
    }

    this.running = true;
    console.log('[sync] Starting sync cycle');

    const allConnections = this.db.select().from(connections).all();

    for (const conn of allConnections) {
      try {
        await this.syncSingle(conn.source);
      } catch (err) {
        console.error(`[sync] Error syncing ${conn.source}:`, err);
      }
    }

    this.runRetentionCleanup();

    if (this.onCycleComplete) {
      try {
        await this.onCycleComplete();
      } catch (err) {
        console.error('[sync] Post-cycle hook error:', err);
      }
    }

    this.running = false;
    console.log('[sync] Sync cycle complete');
  }

  private async syncSingle(sourceId: string): Promise<void> {
    const connector = getConnectorById(sourceId);
    if (!connector) {
      console.warn(`[sync] No connector registered for source: ${sourceId}`);
      return;
    }

    const conn = this.db
      .select()
      .from(connections)
      .where(eq(connections.source, sourceId))
      .get();

    if (!conn) {
      console.warn(`[sync] No connection found for source: ${sourceId}`);
      return;
    }

    let token: string;
    try {
      token = decrypt(conn.accessTokenEncrypted, this.config.encryptionKey);
    } catch {
      this.recordError(sourceId, 'Failed to decrypt access token');
      return;
    }

    if (conn.refreshTokenEncrypted && sourceId === 'jira') {
      try {
        const refreshToken = decrypt(conn.refreshTokenEncrypted, this.config.encryptionKey);
        const newTokens = await connector.refreshToken(refreshToken);
        token = newTokens.accessToken;

        this.db
          .update(connections)
          .set({
            accessTokenEncrypted: encrypt(newTokens.accessToken, this.config.encryptionKey),
            refreshTokenEncrypted: newTokens.refreshToken
              ? encrypt(newTokens.refreshToken, this.config.encryptionKey)
              : conn.refreshTokenEncrypted,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(connections.id, conn.id))
          .run();
      } catch (err) {
        console.warn(`[sync] Token refresh failed for ${sourceId}, using existing token:`, err);
      }
    }

    const githubOrgs = this.loadSetting('github_orgs') as string[] | null;

    const fetchContext: FetchContext = {
      token,
      since: conn.lastSyncAt ? new Date(conn.lastSyncAt) : null,
      userId: conn.userId,
      siteUrl: conn.siteUrl,
      config: { githubOrgs: githubOrgs ?? [] },
    };

    try {
      const items = await connector.fetchItems(fetchContext);

      for (const item of items) {
        upsertWorkItem(this.db, item);
      }

      this.db
        .update(connections)
        .set({
          lastSyncAt: new Date().toISOString(),
          lastError: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(connections.id, conn.id))
        .run();

      console.log(`[sync] ${sourceId}: synced ${items.length} items`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if ((err as NodeJS.ErrnoException).code === 'RATE_LIMITED') {
        console.warn(`[sync] ${sourceId}: rate limited, will retry next cycle`);
      }

      this.recordError(sourceId, message);
    }
  }

  private recordError(sourceId: string, message: string): void {
    this.db
      .update(connections)
      .set({ lastError: message, updatedAt: new Date().toISOString() })
      .where(eq(connections.source, sourceId))
      .run();
  }

  private loadSetting(key: string): unknown {
    const row = this.db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  }

  private runRetentionCleanup(): void {
    const now = Date.now();
    const todosCutoff = new Date(now - this.config.retention.todosDays * 86400000).toISOString();
    const workItemsCutoff = new Date(
      now - this.config.retention.workItemsDays * 86400000,
    ).toISOString();

    const deletedTodos = this.db
      .delete(todos)
      .where(and(eq(todos.completed, true), lt(todos.completedAt, todosCutoff)))
      .run();

    for (const table of [githubPrs, githubIssues, jiraTickets]) {
      this.db
        .delete(table)
        .where(and(inArray(table.status, TERMINAL_STATUSES), lt(table.updatedAt, workItemsCutoff)))
        .run();
    }

    if (deletedTodos.changes > 0) {
      console.log(`[sync] Retention: cleaned up ${deletedTodos.changes} completed todos`);
    }
  }
}
