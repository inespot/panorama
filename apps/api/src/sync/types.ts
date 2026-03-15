/** Abstraction over the sync scheduler so the cron implementation can be swapped later. */
export interface SyncScheduler {
  /** Starts the periodic sync schedule. */
  start(): void;

  /** Stops the scheduler. */
  stop(): void;

  /** Triggers an immediate sync for a single source (e.g. after OAuth connect). */
  syncSource(sourceId: string): Promise<void>;
}
