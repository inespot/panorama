import { eq } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { settings } from '../db/schema.js';

export interface LlmConfig {
  endpoint: string;
  model: string;
  apiKey: string | null;
}

/**
 * Resolves LLM configuration from DB settings (preferred) with env var fallbacks.
 * Returns null if no endpoint is configured anywhere.
 */
export function resolveLlmConfig(db: PanoramaDb): LlmConfig | null {
  const loadSetting = (key: string): unknown => {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  };

  const endpoint = (loadSetting('llm_endpoint') as string) ?? process.env.LLM_ENDPOINT ?? null;
  const model = (loadSetting('llm_model') as string) ?? process.env.LLM_MODEL ?? 'gpt-4o-mini';
  const apiKey = process.env.LLM_API_KEY ?? null;

  if (!endpoint) return null;

  return { endpoint, model, apiKey };
}

/**
 * Sends a chat completion request to an OpenAI-compatible LLM endpoint.
 */
export async function chatCompletion(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 256,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() ?? '';
}
