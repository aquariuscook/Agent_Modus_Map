import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { TemplateService } from '../services/template-service.js';

type Req = Request<Record<string, string>>;

export function createTemplateRoutes(db: Database.Database): Router {
  const router = Router();
  const templateService = new TemplateService(db);

  // GET /api/templates
  router.get('/', (_req: Req, res: Response) => {
    const templates = templateService.listTemplates();
    res.json({ data: templates });
  });

  // GET /api/templates/:id
  router.get('/:id', (req: Req, res: Response) => {
    const template = templateService.getTemplate(req.params.id);
    if (!template) {
      res.status(404).json({ error: 'not_found', message: 'Template not found.' });
      return;
    }
    res.json({ data: template });
  });

  // POST /api/templates/:id/instantiate
  router.post('/:id/instantiate', (req: Req, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'validation', message: 'Swarm name is required.' });
      return;
    }

    const swarm = templateService.instantiate(req.params.id, name);
    if (!swarm) {
      res.status(404).json({ error: 'not_found', message: 'Template not found.' });
      return;
    }
    res.status(201).json({ data: swarm });
  });

  return router;
}
