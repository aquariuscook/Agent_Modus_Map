import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { SwarmService } from '../services/swarm-service.js';
import {
  createInterview,
  getInterview,
  listInterviews,
  processInterviewMessage,
  deployInterviewSwarm,
} from '../services/interview-service.js';

export function createInterviewRoutes(db: Database.Database): Router {
  const router = Router();
  const swarmService = new SwarmService(db);

  // GET /api/interview/list - list recent interviews
  router.get('/list', (_req: Request, res: Response) => {
    res.json({ data: listInterviews() });
  });

  // POST /api/interview/start - start a new interview
  router.post('/start', (_req: Request, res: Response) => {
    const state = createInterview();
    res.json({
      data: {
        interviewId: state.id,
        phase: state.phase,
        welcomeMessage: "Tell me what you want your AI agents to do. Describe the problem you're trying to solve, the process you want to automate, or the outcome you're looking for. Be as specific or as vague as you want. I'll ask the right questions to fill in the gaps.",
      },
    });
  });

  // POST /api/interview/:id/message - send a message in an interview
  router.post('/:id/message', async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message?.trim()) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const result = await processInterviewMessage(req.params.id as string, message.trim());
      res.json({
        data: {
          response: result.response,
          phase: result.state.phase,
          phaseAdvanced: result.phaseAdvanced,
          extracted: result.state.extracted,
          swarmConfig: result.state.extracted.swarmConfig || null,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/interview/:id - get interview state
  router.get('/:id', (req: Request, res: Response) => {
    const state = getInterview(req.params.id as string);
    if (!state) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }
    res.json({ data: state });
  });

  // POST /api/interview/:id/deploy - deploy the swarm from interview
  router.post('/:id/deploy', async (req: Request, res: Response) => {
    try {
      const config = deployInterviewSwarm(req.params.id as string);
      if (!config) {
        res.status(400).json({ error: 'Interview not complete or no swarm config generated' });
        return;
      }

      const { name } = req.body;
      const swarmName = name?.trim() || config.name;

      // Use the template service's instantiation logic but with our generated config
      // Create the swarm directly in the database
      const { v7: uuidv7 } = await import('uuid');
      const now = new Date().toISOString();
      const swarmId = uuidv7();

      const insertSwarm = db.prepare(
        "INSERT INTO swarms (id, name, description, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)"
      );
      const insertLayer = db.prepare(
        'INSERT INTO layers (id, swarm_id, name, color_theme, display_order) VALUES (?, ?, ?, ?, ?)'
      );
      const insertAgent = db.prepare(
        'INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const insertRel = db.prepare(
        'INSERT INTO relationships (id, swarm_id, source_agent_id, target_agent_id, type) VALUES (?, ?, ?, ?, ?)'
      );

      const transaction = db.transaction(() => {
        insertSwarm.run(swarmId, swarmName, config.description, now, now);

        // Create layers
        const layerIds: string[] = [];
        for (const layer of config.layers) {
          const layerId = uuidv7();
          layerIds.push(layerId);
          insertLayer.run(layerId, swarmId, layer.name, layer.colorTheme, layer.order);
        }

        // Create agents
        const agentIdMap = new Map<string, string>();
        for (const agent of config.agents) {
          const agentId = uuidv7();
          agentIdMap.set(agent.nickname, agentId);
          const layerId = layerIds[agent.layerIndex] || layerIds[0];
          const posX = 150 + agent.positionIndex * 300;
          const posY = 150 + agent.layerIndex * 250;
          const agentConfig = {
            coreTask: agent.coreTask,
            autonomyLevel: agent.autonomyLevel,
          };
          insertAgent.run(
            agentId, swarmId, agent.nickname, agent.formalName, agent.descriptor,
            layerId, JSON.stringify(agent.badges), posX, posY, JSON.stringify(agentConfig)
          );
        }

        // Create relationships
        for (const rel of config.relationships) {
          const sourceId = agentIdMap.get(rel.sourceNickname);
          const targetId = agentIdMap.get(rel.targetNickname);
          if (sourceId && targetId) {
            insertRel.run(uuidv7(), swarmId, sourceId, targetId, rel.type);
          }
        }
      });

      transaction();

      // Load the created swarm
      const swarm = swarmService.findById(swarmId);

      res.json({
        data: {
          swarmId,
          swarm,
          message: `Swarm "${swarmName}" deployed with ${config.agents.length} agents.`,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
