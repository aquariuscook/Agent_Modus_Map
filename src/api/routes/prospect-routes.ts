import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  initProspectDb,
  saveProspect,
  saveProspectsFromRun,
  getProspect,
  listProspects,
  updateProspectStatus,
  updateProspectNotes,
  bulkUpdateStatus,
  deleteProspect,
  getStats,
  exportCSV,
} from '../services/prospect-service.js';

type ProspectStatus =
  | 'new'
  | 'contacted'
  | 'responded'
  | 'meeting'
  | 'qualified'
  | 'proposal'
  | 'won'
  | 'lost'
  | 'archived';

const VALID_STATUSES: Set<string> = new Set([
  'new', 'contacted', 'responded', 'meeting',
  'qualified', 'proposal', 'won', 'lost', 'archived',
]);

function isValidStatus(value: unknown): value is ProspectStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value);
}

export function createProspectRoutes(): Router {
  const router = Router();

  initProspectDb().catch((err) => {
    console.error('Failed to initialize prospect database:', err);
  });

  // GET /api/prospects - list with filters
  router.get('/', async (req: Request, res: Response) => {
    try {
      const filters: Record<string, unknown> = {};
      const { status, minScore, maxScore, industry, search, limit, offset } = req.query;

      if (status) filters.status = status;
      if (minScore) filters.minScore = Number(minScore);
      if (maxScore) filters.maxScore = Number(maxScore);
      if (industry) filters.industry = industry;
      if (search) filters.search = search;
      if (limit) filters.limit = Number(limit);
      if (offset) filters.offset = Number(offset);

      const prospects = await listProspects(filters);
      res.json({ data: prospects });
    } catch (err) {
      console.error('Error listing prospects:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to list prospects.' });
    }
  });

  // GET /api/prospects/stats - aggregate stats
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await getStats();
      res.json({ data: stats });
    } catch (err) {
      console.error('Error fetching prospect stats:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to fetch stats.' });
    }
  });

  // GET /api/prospects/export - download CSV
  router.get('/export', async (_req: Request, res: Response) => {
    try {
      const csv = await exportCSV();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
      res.send(csv);
    } catch (err) {
      console.error('Error exporting prospects:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to export prospects.' });
    }
  });

  // GET /api/prospects/:id - single prospect
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const prospect = await getProspect(String(req.params.id));
      if (!prospect) {
        res.status(404).json({ error: 'not_found', message: 'Prospect not found.' });
        return;
      }
      res.json({ data: prospect });
    } catch (err) {
      console.error('Error fetching prospect:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to fetch prospect.' });
    }
  });

  // PUT /api/prospects/:id/status - update status
  router.put('/:id/status', async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!isValidStatus(status)) {
        res.status(400).json({ error: 'validation', message: 'Invalid or missing status.' });
        return;
      }
      const prospect = await updateProspectStatus(String(req.params.id), status);
      res.json({ data: prospect });
    } catch (err) {
      console.error('Error updating prospect status:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to update status.' });
    }
  });

  // PUT /api/prospects/:id/notes - update notes
  router.put('/:id/notes', async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;
      if (typeof notes !== 'string') {
        res.status(400).json({ error: 'validation', message: 'notes must be a string.' });
        return;
      }
      const prospect = await updateProspectNotes(String(req.params.id), notes);
      res.json({ data: prospect });
    } catch (err) {
      console.error('Error updating prospect notes:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to update notes.' });
    }
  });

  // DELETE /api/prospects/:id - delete prospect
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await deleteProspect(String(req.params.id));
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting prospect:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to delete prospect.' });
    }
  });

  // POST /api/prospects/bulk-status - bulk update status
  router.post('/bulk-status', async (req: Request, res: Response) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'validation', message: 'ids must be a non-empty array.' });
        return;
      }
      if (!isValidStatus(status)) {
        res.status(400).json({ error: 'validation', message: 'Invalid or missing status.' });
        return;
      }
      const result = await bulkUpdateStatus(ids, status);
      res.json({ data: result });
    } catch (err) {
      console.error('Error bulk updating status:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to bulk update status.' });
    }
  });

  // POST /api/prospects/save-from-run - save prospects from a deploy run's Command output
  router.post('/save-from-run', async (req: Request, res: Response) => {
    try {
      const { runId, commandOutput } = req.body;
      if (!runId || !commandOutput) {
        res.status(400).json({ error: 'validation', message: 'runId and commandOutput are required.' });
        return;
      }
      const result = await saveProspectsFromRun(runId, commandOutput);
      res.json({ data: result });
    } catch (err) {
      console.error('Error saving prospects from run:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to save prospects from run.' });
    }
  });

  return router;
}
