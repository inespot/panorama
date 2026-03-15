import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const DATA_DIR = path.join(os.homedir(), '.panorama');
const KEY_FILE = path.join(DATA_DIR, 'encryption.key');
const DB_FILE = path.join(DATA_DIR, 'data.db');

/** Source availability — `false` when OAuth client vars are missing. */
export interface SourceAvailability {
  github: boolean;
  jira: boolean;
}

export interface AppConfig {
  port: number;
  dataDir: string;
  dbPath: string;
  github: { clientId: string; clientSecret: string } | null;
  jira: { clientId: string; clientSecret: string } | null;
  llm: { endpoint: string | null; model: string | null; apiKey: string | null };
  encryptionKey: string;
  retention: { todosDays: number; workItemsDays: number };
  sourceAvailability: SourceAvailability;
}

/**
 * Ensures the data directory exists. Returns the resolved path.
 */
function ensureDataDir(): string {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return DATA_DIR;
}

/**
 * Loads or generates the AES-256-GCM encryption key.
 * Priority: ENCRYPTION_KEY env var > file on disk > auto-generate.
 */
function resolveEncryptionKey(): string {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length > 0) {
    return envKey;
  }

  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE, 'utf-8').trim();
  }

  const generated = crypto.randomBytes(32).toString('hex');
  ensureDataDir();
  fs.writeFileSync(KEY_FILE, generated, { mode: 0o600 });
  console.log(`[config] Auto-generated encryption key at ${KEY_FILE}`);
  return generated;
}

/**
 * Loads and validates application configuration from environment variables.
 * Warns (does not crash) for missing OAuth credentials.
 */
export function loadConfig(): AppConfig {
  ensureDataDir();

  const githubId = process.env.GITHUB_CLIENT_ID;
  const githubSecret = process.env.GITHUB_CLIENT_SECRET;
  const jiraId = process.env.JIRA_CLIENT_ID;
  const jiraSecret = process.env.JIRA_CLIENT_SECRET;

  const github = githubId && githubSecret ? { clientId: githubId, clientSecret: githubSecret } : null;
  const jira = jiraId && jiraSecret ? { clientId: jiraId, clientSecret: jiraSecret } : null;

  if (!github) {
    console.warn('[config] GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set — GitHub source unavailable');
  }
  if (!jira) {
    console.warn('[config] JIRA_CLIENT_ID / JIRA_CLIENT_SECRET not set — Jira source unavailable');
  }

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    dataDir: DATA_DIR,
    dbPath: DB_FILE,
    github,
    jira,
    llm: {
      endpoint: process.env.LLM_ENDPOINT ?? null,
      model: process.env.LLM_MODEL ?? null,
      apiKey: process.env.LLM_API_KEY ?? null,
    },
    encryptionKey: resolveEncryptionKey(),
    retention: {
      todosDays: parseInt(process.env.RETENTION_TODOS_DAYS ?? '7', 10),
      workItemsDays: parseInt(process.env.RETENTION_WORK_ITEMS_DAYS ?? '14', 10),
    },
    sourceAvailability: {
      github: github !== null,
      jira: jira !== null,
    },
  };
}
