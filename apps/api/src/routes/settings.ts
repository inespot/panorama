import { Router } from 'express';
import { eq } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { settings } from '../db/schema.js';

/** GET/PUT /api/settings — read and update display name, GitHub orgs, LLM config. */
export function settingsRouter(db: PanoramaDb): Router {
  const router = Router();

  const loadSetting = (key: string): unknown => {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  };

  const saveSetting = (key: string, value: unknown): void => {
    const existing = db.select({ id: settings.id }).from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      db.update(settings).set({ value }).where(eq(settings.id, existing.id)).run();
    } else {
      db.insert(settings).values({ key, value }).run();
    }
  };

  router.get('/', (_req, res) => {
    res.json({
      settings: {
        displayName: loadSetting('display_name') ?? null,
        githubOrgs: (loadSetting('github_orgs') as string[]) ?? [],
        llmEndpoint: loadSetting('llm_endpoint') ?? null,
        llmModel: loadSetting('llm_model') ?? null,
      },
    });
  });

  router.put('/', (req, res) => {
    const body = req.body as Record<string, unknown>;

    if (body.displayName !== undefined) saveSetting('display_name', body.displayName);
    if (body.githubOrgs !== undefined) saveSetting('github_orgs', body.githubOrgs);
    if (body.llmEndpoint !== undefined) saveSetting('llm_endpoint', body.llmEndpoint);
    if (body.llmModel !== undefined) saveSetting('llm_model', body.llmModel);

    res.json({ success: true });
  });

  return router;
}
