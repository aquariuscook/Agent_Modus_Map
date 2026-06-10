import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  getDecisionTraces, getDecisionTrace, insertDecisionTrace, detectTracePatterns,
} from '../db/decision-trace-store.js';
import { requireCapability } from '../services/license-service.js';

export function createDecisionTraceRoutes(db: Database.Database): Router {
  const router = Router();

  // GET /api/traces/:swarmId
  router.get('/:swarmId', requireCapability('traces.view'), (req, res) => {
    const swarmId = String(req.params.swarmId);
    const { agentId, tag, limit, offset } = req.query;
    const traces = getDecisionTraces(db, swarmId, {
      agentId: agentId as string,
      tag: tag as string,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    res.json({ data: traces });
  });

  // GET /api/traces/:swarmId/patterns
  router.get('/:swarmId/patterns', requireCapability('traces.patterns'), (req, res) => {
    const patterns = detectTracePatterns(db, String(req.params.swarmId));
    res.json({ data: patterns });
  });

  // GET /api/traces/:swarmId/:traceId
  router.get('/:swarmId/:traceId', requireCapability('traces.view'), (req, res) => {
    const trace = getDecisionTrace(db, String(req.params.traceId));
    if (!trace) return res.status(404).json({ error: 'Trace not found' });
    res.json({ data: trace });
  });

  // POST /api/traces/:swarmId
  router.post('/:swarmId', requireCapability('traces.capture'), (req, res) => {
    const { agentId, agentNickname, title, stages, tags, confidence, durationMs } = req.body;
    if (!agentId || !title || !stages) {
      return res.status(400).json({ error: 'agentId, title, and stages are required' });
    }

    const trace = {
      id: randomUUID(),
      swarmId: String(req.params.swarmId),
      agentId,
      agentNickname: agentNickname || 'unknown',
      title,
      timestamp: new Date().toISOString(),
      stages: stages || [],
      tags: tags || [],
      confidence: confidence ?? 0,
      durationMs: durationMs ?? 0,
    };

    insertDecisionTrace(db, trace);
    res.status(201).json({ data: trace });
  });

  return router;
}
