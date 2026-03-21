import { Router } from 'express';
import type Database from 'better-sqlite3';
import { SwarmService } from '../services/swarm-service.js';
import { runMockSimulation } from '../services/simulation-service.js';
import { estimateSwarmCost } from '../services/cost-estimation-service.js';

export function createSimulationRoutes(db: Database.Database): Router {
  const router = Router();
  const swarmService = new SwarmService(db);

  // POST /api/simulate/:swarmId - run mock simulation
  router.post('/:swarmId', (req, res) => {
    const swarm = swarmService.findById(req.params.swarmId);
    if (!swarm) return res.status(404).json({ error: 'Swarm not found' });

    const sampleInput = req.body.input || 'Sample customer request: I need help with my recent order #12345. The item arrived damaged and I would like a replacement or refund.';
    const result = runMockSimulation(swarm, sampleInput);
    res.json({ data: result });
  });

  // GET /api/simulate/:swarmId/cost - get cost estimation
  router.get('/:swarmId/cost', (req, res) => {
    const swarm = swarmService.findById(req.params.swarmId);
    if (!swarm) return res.status(404).json({ error: 'Swarm not found' });

    const callsPerDay = req.query.callsPerDay ? Number(req.query.callsPerDay) : undefined;
    const result = estimateSwarmCost(swarm, callsPerDay);
    res.json({ data: result });
  });

  return router;
}
