import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getLatestHealth, getSwarmHealthSummary, insertHealthReport } from '../db/health-store.js';
import { generateHealthReport } from '../services/health-simulator.js';

type Req = Request<Record<string, string>>;

export function createHealthRoutes(db: Database.Database): Router {
  const router = Router();

  // GET /api/health/swarms/:swarmId
  router.get('/swarms/:swarmId', (req: Req, res: Response) => {
    const agents = getLatestHealth(db, req.params.swarmId);
    res.json({ data: agents });
  });

  // GET /api/health/swarms/:swarmId/summary
  router.get('/swarms/:swarmId/summary', (req: Req, res: Response) => {
    const summary = getSwarmHealthSummary(db, req.params.swarmId);
    res.json({ data: summary });
  });

  // POST /api/health/report - receive a health report (from agent runtime or simulator)
  router.post('/report', (req: Req, res: Response) => {
    const { agentId, agentNickname, timestamp, status, latencyP50, latencyP95, latencyP99, throughput, errorRate, cpuPercent, memoryMb } = req.body;
    if (!agentId || !agentNickname) {
      res.status(400).json({ error: 'validation', message: 'agentId and agentNickname are required.' });
      return;
    }
    insertHealthReport(db, {
      agentId, agentNickname,
      timestamp: timestamp || new Date().toISOString(),
      status: status || 'healthy',
      latencyP50: latencyP50 ?? 0,
      latencyP95: latencyP95 ?? 0,
      latencyP99: latencyP99 ?? 0,
      throughput: throughput ?? 0,
      errorRate: errorRate ?? 0,
      cpuPercent: cpuPercent ?? 0,
      memoryMb: memoryMb ?? 0,
    });
    res.status(201).json({ ok: true });
  });

  // POST /api/health/simulate/:swarmId - generate a new round of simulated data
  router.post('/simulate/:swarmId', (req: Req, res: Response) => {
    const agents = db.prepare('SELECT id, nickname FROM agents WHERE swarm_id = ?')
      .all(req.params.swarmId) as Array<{ id: string; nickname: string }>;

    const ts = new Date().toISOString();
    for (const agent of agents) {
      const report = generateHealthReport(agent.id, agent.nickname, ts);
      insertHealthReport(db, report);
    }

    res.json({ data: { agentsUpdated: agents.length, timestamp: ts } });
  });

  return router;
}
