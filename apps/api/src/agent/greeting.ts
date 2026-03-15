import { eq, count } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { githubPrs, githubIssues, jiraTickets, settings } from '../db/schema.js';
import type { LlmConfig } from './llm-client.js';
import { chatCompletion } from './llm-client.js';

const QUOTE_SYSTEM = `You are a friendly assistant. Generate a short, uplifting quote or thought for the day. Keep it to one sentence. No attribution needed.`;

const DIGEST_SYSTEM = `You are a concise work assistant. Given counts of open work items, write a 1-2 sentence friendly digest about the user's workload. Be concise.`;

/**
 * Generates (or reuses) a daily quote and refreshes the work digest.
 * Quote is cached per calendar day. Digest is refreshed each sync cycle.
 */
export async function generateGreeting(db: PanoramaDb, config: LlmConfig): Promise<void> {
  await ensureDailyQuote(db, config);
  await refreshDigest(db, config);
}

async function ensureDailyQuote(db: PanoramaDb, config: LlmConfig): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = loadSetting(db, 'greeting_quote_date') as string | null;

  if (lastDate === today) return;

  try {
    const quote = await chatCompletion(config, QUOTE_SYSTEM, `Today is ${today}. Generate a quote.`);
    if (quote) {
      saveSetting(db, 'greeting_quote', quote);
      saveSetting(db, 'greeting_quote_date', today);
    }
  } catch (err) {
    console.error('[agent] Failed to generate daily quote:', err);
  }
}

async function refreshDigest(db: PanoramaDb, config: LlmConfig): Promise<void> {
  const prCount = db.select({ c: count() }).from(githubPrs).get()?.c ?? 0;
  const issueCount = db.select({ c: count() }).from(githubIssues).get()?.c ?? 0;
  const jiraCount = db.select({ c: count() }).from(jiraTickets).get()?.c ?? 0;

  const total = prCount + issueCount + jiraCount;

  try {
    const userPrompt = `Open work items: ${prCount} GitHub PRs, ${issueCount} GitHub issues, ${jiraCount} Jira tickets. Total: ${total}.`;
    const digest = await chatCompletion(config, DIGEST_SYSTEM, userPrompt);
    if (digest) {
      saveSetting(db, 'greeting_digest', digest);
    }
  } catch (err) {
    console.error('[agent] Failed to generate work digest:', err);
  }
}

function loadSetting(db: PanoramaDb, key: string): unknown {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

function saveSetting(db: PanoramaDb, key: string, value: unknown): void {
  const existing = db.select({ id: settings.id }).from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings).set({ value }).where(eq(settings.id, existing.id)).run();
  } else {
    db.insert(settings).values({ key, value }).run();
  }
}
