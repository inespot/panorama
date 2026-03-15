import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname2, '../../../.env') });
import express from 'express';
import cors from 'cors';
import { loadConfig } from './config.js';
import { getDb, runMigrations } from './db/index.js';
import { registerConnector, githubConnector, jiraConnector } from './connectors/index.js';
import { CronSyncEngine } from './sync/index.js';
import { runAgentCycle } from './agent/index.js';
import { workItemsRouter } from './routes/work-items.js';
import { connectionsRouter } from './routes/connections.js';
import { todosRouter } from './routes/todos.js';
import { settingsRouter } from './routes/settings.js';
import { syncStatusRouter } from './routes/sync-status.js';
import { greetingRouter } from './routes/greeting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = loadConfig();

runMigrations(config.dbPath);
const db = getDb(config.dbPath);

registerConnector(githubConnector);
registerConnector(jiraConnector);

const syncEngine = new CronSyncEngine(db, config, () => runAgentCycle(db));
syncEngine.start();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/work-items', workItemsRouter(db));
app.use('/api/connections', connectionsRouter(db, config, syncEngine));
app.use('/api/todos', todosRouter(db));
app.use('/api/settings', settingsRouter(db));
app.use('/api/sync-status', syncStatusRouter(db, syncEngine));
app.use('/api/greeting', greetingRouter(db));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const frontendDist = path.resolve(__dirname, '../../../apps/web/dist');
app.use(express.static(frontendDist));
app.get('{*splat}', (_req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.redirect('http://localhost:5173' + _req.originalUrl);
    }
  });
});

app.listen(config.port, () => {
  console.log(`Panorama listening on http://localhost:${config.port}`);
});
