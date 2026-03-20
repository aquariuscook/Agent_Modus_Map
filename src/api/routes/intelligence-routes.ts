import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { RAGService } from '../services/rag-service.js';

type Req = Request<Record<string, string>>;

export function createIntelligenceRoutes(db: Database.Database): Router {
  const router = Router();
  const ragService = new RAGService(db);

  // POST /api/intelligence/ask
  router.post('/ask', (req: Req, res: Response) => {
    const { question, swarmId } = req.body;
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'validation', message: 'Question is required.' });
      return;
    }

    const sid = swarmId || 'ecommerce-standard-v1';
    const result = ragService.query(sid, question);
    res.json({ data: result });
  });

  return router;
}
