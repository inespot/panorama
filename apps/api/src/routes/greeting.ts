import { Router } from 'express';
import { eq } from 'drizzle-orm';
import type { PanoramaDb } from '../db/index.js';
import { settings } from '../db/schema.js';

/** GET /api/greeting — latest AI-generated greeting for the top panel. */
export function greetingRouter(db: PanoramaDb): Router {
  const router = Router();

  const loadSetting = (key: string): unknown => {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  };

  router.get('/', (_req, res) => {
    res.json({
      displayName: loadSetting('display_name') ?? null,
      quote: loadSetting('greeting_quote') ?? null,
      digest: loadSetting('greeting_digest') ?? null,
    });
  });

  return router;
}
