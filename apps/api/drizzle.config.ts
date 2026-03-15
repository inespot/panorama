import { defineConfig } from 'drizzle-kit';
import path from 'node:path';
import os from 'node:os';

const dbPath = path.join(os.homedir(), '.panorama', 'data.db');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
});
