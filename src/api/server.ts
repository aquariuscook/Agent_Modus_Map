import express from 'express';
import cors from 'cors';
import { getDb } from './db/database.js';
import { createSwarmRoutes } from './routes/swarm-routes.js';
import { createIntelligenceRoutes } from './routes/intelligence-routes.js';
import { createTemplateRoutes } from './routes/template-routes.js';
import { createHealthRoutes } from './routes/health-routes.js';
import { initKnowledgeBase, seedKnowledgeBase } from './db/knowledge-base.js';
import { initHealthStore } from './db/health-store.js';

export function createApp(db?: ReturnType<typeof getDb>) {
  const app = express();
  const database = db || getDb();

  initKnowledgeBase(database);
  initHealthStore(database);

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/swarms', createSwarmRoutes(database));
  app.use('/api/intelligence', createIntelligenceRoutes(database));
  app.use('/api/templates', createTemplateRoutes(database));
  app.use('/api/monitoring', createHealthRoutes(database));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

// Start server if run directly
const isMain = process.argv[1]?.includes('server');
if (isMain) {
  const database = getDb();
  initKnowledgeBase(database);
  seedKnowledgeBase(database);
  initHealthStore(database);

  // Seed health history if empty
  const count = (database.prepare('SELECT COUNT(*) as c FROM health_reports').get() as any)?.c || 0;
  if (count === 0) {
    import('./services/health-simulator.js').then(({ seedHealthHistory }) => {
      seedHealthHistory(database, 'ecommerce-standard-v1', 30);
    });
  }

  const app = createApp(database);
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`Agent Modus Map API running on port ${port}`);
  });
}
