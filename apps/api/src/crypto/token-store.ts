import { eq } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { connections } from '../db/schema.js';
import { encrypt, decrypt } from './encryption.js';

interface StoredConnection {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
  siteUrl: string | null;
}

/**
 * Stores encrypted OAuth credentials for a source.
 * Upserts — replaces any existing connection for the same source.
 */
export function storeConnection(
  db: PanoramaDb,
  encryptionKey: string,
  source: string,
  accessToken: string,
  userId: string,
  refreshToken?: string,
  siteUrl?: string,
): void {
  const now = new Date().toISOString();
  const existing = db.select({ id: connections.id }).from(connections).where(eq(connections.source, source)).get();

  const values = {
    source,
    accessTokenEncrypted: encrypt(accessToken, encryptionKey),
    refreshTokenEncrypted: refreshToken ? encrypt(refreshToken, encryptionKey) : null,
    userId,
    siteUrl: siteUrl ?? null,
    updatedAt: now,
  };

  if (existing) {
    db.update(connections).set(values).where(eq(connections.id, existing.id)).run();
  } else {
    db.insert(connections).values({ ...values, createdAt: now }).run();
  }
}

/**
 * Retrieves and decrypts OAuth credentials for a source.
 * Returns null if no connection exists.
 */
export function loadConnection(
  db: PanoramaDb,
  encryptionKey: string,
  source: string,
): StoredConnection | null {
  const row = db.select().from(connections).where(eq(connections.source, source)).get();
  if (!row) return null;

  return {
    accessToken: decrypt(row.accessTokenEncrypted, encryptionKey),
    refreshToken: row.refreshTokenEncrypted ? decrypt(row.refreshTokenEncrypted, encryptionKey) : null,
    userId: row.userId,
    siteUrl: row.siteUrl,
  };
}

/**
 * Removes a source connection and all its credentials.
 */
export function removeConnection(db: PanoramaDb, source: string): void {
  db.delete(connections).where(eq(connections.source, source)).run();
}
