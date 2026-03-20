import { Router } from 'express';
import type { Request, Response } from 'express';

type Req = Request<Record<string, string>>;
import { SwarmService } from '../services/swarm-service.js';
import { GraphService } from '../services/graph-service.js';
import type Database from 'better-sqlite3';

function paramStr(val: unknown): string {
  return typeof val === 'string' ? val : String(val ?? '');
}

export function createSwarmRoutes(db: Database.Database): Router {
  const router = Router();
  const swarmService = new SwarmService(db);
  const graphService = new GraphService(db);

  // GET /api/swarms
  router.get('/', (_req: Request, res: Response) => {
    const swarms = swarmService.findAll();
    res.json({ data: swarms });
  });

  // POST /api/swarms
  router.post('/', (req: Req, res: Response) => {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'validation', message: 'Name is required.' });
      return;
    }
    const swarm = swarmService.create({ name, description });
    res.status(201).json({ data: swarm });
  });

  // GET /api/swarms/:id
  router.get('/:id', (req: Req, res: Response) => {
    const swarm = swarmService.findById(req.params.id);
    if (!swarm) {
      res.status(404).json({ error: 'not_found', message: 'Swarm not found.' });
      return;
    }
    res.json({ data: swarm });
  });

  // PUT /api/swarms/:id
  router.put('/:id', (req: Req, res: Response) => {
    const swarm = swarmService.update(req.params.id, req.body);
    if (!swarm) {
      res.status(404).json({ error: 'not_found', message: 'Swarm not found.' });
      return;
    }
    res.json({ data: swarm });
  });

  // DELETE /api/swarms/:id
  router.delete('/:id', (req: Req, res: Response) => {
    const deleted = swarmService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'not_found', message: 'Swarm not found.' });
      return;
    }
    res.status(204).send();
  });

  // POST /api/swarms/:id/agents
  router.post('/:id/agents', (req: Req, res: Response) => {
    const agent = swarmService.addAgent(req.params.id, req.body);
    if (!agent) {
      res.status(400).json({ error: 'bad_request', message: 'Could not create agent. Check swarm ID and data.' });
      return;
    }
    res.status(201).json({ data: agent });
  });

  // PUT /api/swarms/:swarmId/agents/:agentId
  router.put('/:swarmId/agents/:agentId', (req: Req, res: Response) => {
    const agent = swarmService.updateAgent(req.params.agentId, req.body);
    if (!agent) {
      res.status(404).json({ error: 'not_found', message: 'Agent not found.' });
      return;
    }
    res.json({ data: agent });
  });

  // DELETE /api/swarms/:swarmId/agents/:agentId
  router.delete('/:swarmId/agents/:agentId', (req: Req, res: Response) => {
    const deleted = swarmService.deleteAgent(req.params.agentId);
    if (!deleted) {
      res.status(404).json({ error: 'not_found', message: 'Agent not found.' });
      return;
    }
    res.status(204).send();
  });

  // POST /api/swarms/:id/relationships
  router.post('/:id/relationships', (req: Req, res: Response) => {
    const rel = swarmService.addRelationship(req.params.id, req.body);
    if (!rel) {
      res.status(400).json({ error: 'bad_request', message: 'Could not create relationship. Check agent IDs and type.' });
      return;
    }
    res.status(201).json({ data: rel });
  });

  // DELETE /api/swarms/:swarmId/relationships/:relId
  router.delete('/:swarmId/relationships/:relId', (req: Req, res: Response) => {
    const deleted = swarmService.deleteRelationship(req.params.relId);
    if (!deleted) {
      res.status(404).json({ error: 'not_found', message: 'Relationship not found.' });
      return;
    }
    res.status(204).send();
  });

  // GET /api/swarms/:id/export
  router.get('/:id/export', (req: Req, res: Response) => {
    const exported = swarmService.exportSwarm(req.params.id);
    if (!exported) {
      res.status(404).json({ error: 'not_found', message: 'Swarm not found.' });
      return;
    }
    res.json(exported);
  });

  // POST /api/swarms/import
  router.post('/import', (req: Req, res: Response) => {
    try {
      const swarm = swarmService.importSwarm(req.body);
      res.status(201).json({ data: swarm });
    } catch (err: any) {
      res.status(400).json({ error: 'import_failed', message: err.message || 'Import failed.' });
    }
  });

  // Graph queries
  // GET /api/swarms/:id/graph/blast-radius?agent=Catalog&hops=3
  router.get('/:id/graph/blast-radius', (req: Req, res: Response) => {
    const agent = paramStr(req.query.agent);
    const hops = parseInt(paramStr(req.query.hops)) || 3;
    if (!agent) {
      res.status(400).json({ error: 'validation', message: 'Agent nickname is required (query param: agent).' });
      return;
    }
    const results = graphService.blastRadius(req.params.id, agent, hops);
    res.json({ data: results });
  });

  // GET /api/swarms/:id/graph/critical-path?from=Domino&to=Courier
  router.get('/:id/graph/critical-path', (req: Req, res: Response) => {
    const from = paramStr(req.query.from);
    const to = paramStr(req.query.to);
    if (!from || !to) {
      res.status(400).json({ error: 'validation', message: 'Both "from" and "to" agent nicknames are required.' });
      return;
    }
    const result = graphService.criticalPath(req.params.id, from, to);
    if (!result) {
      res.json({ data: null, message: 'No path found.' });
      return;
    }
    res.json({ data: result });
  });

  // GET /api/swarms/:id/graph/single-points-of-failure?threshold=3
  router.get('/:id/graph/single-points-of-failure', (req: Req, res: Response) => {
    const threshold = parseInt(paramStr(req.query.threshold)) || 3;
    const results = graphService.singlePointsOfFailure(req.params.id, threshold);
    res.json({ data: results });
  });

  // GET /api/swarms/:id/graph/hubs
  router.get('/:id/graph/hubs', (req: Req, res: Response) => {
    const results = graphService.hubAgents(req.params.id);
    res.json({ data: results });
  });

  return router;
}
