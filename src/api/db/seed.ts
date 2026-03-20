// Seed script: loads the 24-agent e-commerce swarm into the database
// Run with: npm run seed

import { v7 as uuidv7 } from 'uuid';
import { getDb, closeDb } from './database.js';
import { SWARM_ID, layers, agentSeeds, relationshipSeeds } from '../../shared/data/seed-agents.js';
import path from 'path';
import fs from 'fs';

function seed(): void {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = getDb();

  // Check if already seeded
  const existing = db.prepare('SELECT id FROM swarms WHERE id = ?').get(SWARM_ID);
  if (existing) {
    console.log('Seed data already exists. Skipping.');
    closeDb();
    return;
  }

  const insertSwarm = db.prepare(
    'INSERT INTO swarms (id, name, description, template_source, version) VALUES (?, ?, ?, ?, ?)'
  );

  const insertLayer = db.prepare(
    'INSERT INTO layers (id, swarm_id, name, color_theme, display_order) VALUES (?, ?, ?, ?, ?)'
  );

  const insertAgent = db.prepare(
    'INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const insertRelationship = db.prepare(
    'INSERT INTO relationships (id, swarm_id, source_agent_id, target_agent_id, type) VALUES (?, ?, ?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    // Insert swarm
    insertSwarm.run(
      SWARM_ID,
      'E-Commerce AI Agent Swarm',
      'Complete 24-agent architecture for e-commerce operations across 5 layers.',
      null,
      1
    );

    // Insert layers
    for (const layer of layers) {
      insertLayer.run(layer.id, SWARM_ID, layer.name, layer.colorTheme, layer.order);
    }

    // Insert agents with grid positions based on layer
    const agentIdMap = new Map<string, string>();
    const agentsPerLayer = new Map<string, number>();

    for (const agent of agentSeeds) {
      const agentId = uuidv7();
      agentIdMap.set(agent.nickname, agentId);

      const layerIndex = layers.findIndex(l => l.id === agent.layerId);
      const countInLayer = agentsPerLayer.get(agent.layerId) || 0;
      agentsPerLayer.set(agent.layerId, countInLayer + 1);

      const posX = 150 + countInLayer * 320;
      const posY = 150 + layerIndex * 250;

      insertAgent.run(
        agentId,
        SWARM_ID,
        agent.nickname,
        agent.formalName,
        agent.descriptor,
        agent.layerId,
        JSON.stringify(agent.badges),
        posX,
        posY
      );
    }

    // Insert relationships
    let relCount = 0;
    for (const [sourceNickname, targetNickname, type] of relationshipSeeds) {
      const sourceId = agentIdMap.get(sourceNickname);
      const targetId = agentIdMap.get(targetNickname);

      if (!sourceId || !targetId) {
        console.warn(`Skipping relationship: ${sourceNickname} -> ${targetNickname} (agent not found)`);
        continue;
      }

      insertRelationship.run(uuidv7(), SWARM_ID, sourceId, targetId, type);
      relCount++;
    }

    console.log(`Seeded: 1 swarm, ${layers.length} layers, ${agentSeeds.length} agents, ${relCount} relationships`);
  });

  transaction();
  closeDb();
}

seed();
