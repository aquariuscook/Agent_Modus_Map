import { Router } from 'express';
import type Database from 'better-sqlite3';
import { generateSwarmMarkdown, generateAgentMarkdown } from '../services/doc-generation-service.js';
import { generateStandaloneHTML } from '../services/html-export-service.js';
import { SwarmService } from '../services/swarm-service.js';

export function createDocGenerationRoutes(db: Database.Database): Router {
  const router = Router();
  const swarmService = new SwarmService(db);

  // GET /api/docs/:swarmId - full swarm documentation
  router.get('/:swarmId', (req, res) => {
    const swarm = swarmService.findById(req.params.swarmId);
    if (!swarm) return res.status(404).json({ error: 'Swarm not found' });

    const format = req.query.format || 'json';
    const markdown = generateSwarmMarkdown(swarm);

    if (format === 'markdown' || format === 'md') {
      res.setHeader('Content-Type', 'text/markdown');
      res.send(markdown);
    } else {
      res.json({ data: { markdown, swarmId: swarm.id, name: swarm.name, generatedAt: new Date().toISOString() } });
    }
  });

  // GET /api/docs/:swarmId/agents/:agentId
  router.get('/:swarmId/agents/:agentId', (req, res) => {
    const swarm = swarmService.findById(req.params.swarmId);
    if (!swarm) return res.status(404).json({ error: 'Swarm not found' });

    const agent = swarm.agents.find(a => a.id === req.params.agentId || a.nickname === req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const markdown = generateAgentMarkdown(agent, swarm);
    const format = req.query.format || 'json';

    if (format === 'markdown' || format === 'md') {
      res.setHeader('Content-Type', 'text/markdown');
      res.send(markdown);
    } else {
      res.json({ data: { markdown, agentId: agent.id, nickname: agent.nickname, generatedAt: new Date().toISOString() } });
    }
  });

  // GET /api/docs/:swarmId/html - standalone HTML export
  router.get('/:swarmId/html', (req, res) => {
    const swarm = swarmService.findById(req.params.swarmId);
    if (!swarm) return res.status(404).json({ error: 'Swarm not found' });

    const html = generateStandaloneHTML(swarm);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${swarm.name.replace(/[^a-zA-Z0-9]/g, '_')}_motus_map.html"`);
    res.send(html);
  });

  return router;
}
