import type { PanoramaDb } from '../db/index.js';
import { resolveLlmConfig } from './llm-client.js';
import { runSummarization } from './summarizer.js';
import { generateGreeting } from './greeting.js';

/**
 * Runs the AI agent post-sync cycle: summarization + greeting generation.
 * Skips silently if no LLM endpoint is configured.
 */
export async function runAgentCycle(db: PanoramaDb): Promise<void> {
  const config = resolveLlmConfig(db);
  if (!config) return;

  const summarized = await runSummarization(db, config);
  if (summarized > 0) {
    console.log(`[agent] Summarized ${summarized} items`);
  }

  await generateGreeting(db, config);
}
