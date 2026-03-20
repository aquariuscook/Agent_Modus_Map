import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server.js';
import { getTestDb } from '../../src/api/db/database.js';
import { v7 as uuidv7 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Express } from 'express';

let db: Database.Database;
let app: Express;

function seedTestSwarm(database: Database.Database) {
  const swarmId = 'test-swarm-1';
  database.prepare(
    "INSERT INTO swarms (id, name, description) VALUES (?, ?, ?)"
  ).run(swarmId, 'Test Swarm', 'A test swarm');

  const layerId = 'test-layer-1';
  database.prepare(
    "INSERT INTO layers (id, swarm_id, name, color_theme, display_order) VALUES (?, ?, ?, ?, ?)"
  ).run(layerId, swarmId, 'Test Layer', '#00d9ff', 1);

  const agents = [
    { id: 'agent-a', nickname: 'Alpha', formalName: 'Test-Alpha', descriptor: 'The First' },
    { id: 'agent-b', nickname: 'Beta', formalName: 'Test-Beta', descriptor: 'The Second' },
    { id: 'agent-c', nickname: 'Gamma', formalName: 'Test-Gamma', descriptor: 'The Third' },
    { id: 'agent-d', nickname: 'Delta', formalName: 'Test-Delta', descriptor: 'The Fourth' },
  ];

  const insertAgent = database.prepare(
    "INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  for (const a of agents) {
    insertAgent.run(a.id, swarmId, a.nickname, a.formalName, a.descriptor, layerId, '["AUTO"]', 0, 0);
  }

  // Alpha -> Beta (feedsInto), Beta -> Gamma (feedsInto), Gamma depends on Alpha
  const insertRel = database.prepare(
    "INSERT INTO relationships (id, swarm_id, source_agent_id, target_agent_id, type) VALUES (?, ?, ?, ?, ?)"
  );
  insertRel.run(uuidv7(), swarmId, 'agent-a', 'agent-b', 'feedsInto');
  insertRel.run(uuidv7(), swarmId, 'agent-b', 'agent-c', 'feedsInto');
  insertRel.run(uuidv7(), swarmId, 'agent-c', 'agent-a', 'dependsOn');
  insertRel.run(uuidv7(), swarmId, 'agent-d', 'agent-a', 'dependsOn');
  insertRel.run(uuidv7(), swarmId, 'agent-b', 'agent-a', 'dependsOn');

  return swarmId;
}

beforeEach(() => {
  db = getTestDb();
  app = createApp(db);
});

afterEach(() => {
  db.close();
});

describe('Swarm API', () => {
  describe('GET /api/health', () => {
    it('should return ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /api/swarms', () => {
    it('should create a new swarm', async () => {
      const res = await request(app)
        .post('/api/swarms')
        .send({ name: 'My Swarm', description: 'Test description' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('My Swarm');
      expect(res.body.data.id).toBeDefined();
    });

    it('should reject swarm without name', async () => {
      const res = await request(app).post('/api/swarms').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/swarms', () => {
    it('should return all swarms', async () => {
      seedTestSwarm(db);
      const res = await request(app).get('/api/swarms');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/swarms/:id', () => {
    it('should return a swarm with agents and relationships', async () => {
      const swarmId = seedTestSwarm(db);
      const res = await request(app).get(`/api/swarms/${swarmId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.agents).toHaveLength(4);
      expect(res.body.data.relationships).toHaveLength(5);
      expect(res.body.data.layers).toHaveLength(1);
    });

    it('should return 404 for non-existent swarm', async () => {
      const res = await request(app).get('/api/swarms/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/swarms/:id', () => {
    it('should update swarm name', async () => {
      const swarmId = seedTestSwarm(db);
      const res = await request(app)
        .put(`/api/swarms/${swarmId}`)
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/swarms/:id', () => {
    it('should delete a swarm and cascade', async () => {
      const swarmId = seedTestSwarm(db);
      const res = await request(app).delete(`/api/swarms/${swarmId}`);
      expect(res.status).toBe(204);

      const check = await request(app).get(`/api/swarms/${swarmId}`);
      expect(check.status).toBe(404);
    });
  });

  describe('Agent CRUD', () => {
    it('should add an agent to a swarm', async () => {
      const swarmId = seedTestSwarm(db);
      const res = await request(app)
        .post(`/api/swarms/${swarmId}/agents`)
        .send({
          nickname: 'Epsilon',
          formalName: 'Test-Epsilon',
          descriptor: 'The Fifth',
          layerId: 'test-layer-1',
          badges: ['CRITICAL'],
          position: { x: 100, y: 200 },
          config: {},
        });
      expect(res.status).toBe(201);
      expect(res.body.data.nickname).toBe('Epsilon');
    });

    it('should update an agent', async () => {
      seedTestSwarm(db);
      const res = await request(app)
        .put('/api/swarms/test-swarm-1/agents/agent-a')
        .send({ nickname: 'AlphaRenamed' });
      expect(res.status).toBe(200);
      expect(res.body.data.nickname).toBe('AlphaRenamed');
    });

    it('should delete an agent and its relationships', async () => {
      seedTestSwarm(db);
      const res = await request(app).delete('/api/swarms/test-swarm-1/agents/agent-a');
      expect(res.status).toBe(204);

      // Relationships involving agent-a should be gone
      const swarm = await request(app).get('/api/swarms/test-swarm-1');
      const rels = swarm.body.data.relationships;
      const involvesA = rels.filter(
        (r: any) => r.sourceAgentId === 'agent-a' || r.targetAgentId === 'agent-a'
      );
      expect(involvesA).toHaveLength(0);
    });
  });

  describe('Relationship CRUD', () => {
    it('should add a relationship', async () => {
      seedTestSwarm(db);
      const res = await request(app)
        .post('/api/swarms/test-swarm-1/relationships')
        .send({
          sourceAgentId: 'agent-c',
          targetAgentId: 'agent-d',
          type: 'collaboratesWith',
          metadata: {},
        });
      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('collaboratesWith');
    });

    it('should reject duplicate relationship', async () => {
      seedTestSwarm(db);
      const res = await request(app)
        .post('/api/swarms/test-swarm-1/relationships')
        .send({
          sourceAgentId: 'agent-a',
          targetAgentId: 'agent-b',
          type: 'feedsInto',
          metadata: {},
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Export/Import', () => {
    it('should export and re-import a swarm', async () => {
      const swarmId = seedTestSwarm(db);

      // Export
      const exportRes = await request(app).get(`/api/swarms/${swarmId}/export`);
      expect(exportRes.status).toBe(200);
      expect(exportRes.body.version).toBe('1.0');
      expect(exportRes.body.swarm.agents).toHaveLength(4);

      // Import
      const importRes = await request(app)
        .post('/api/swarms/import')
        .send(exportRes.body);
      expect(importRes.status).toBe(201);
      expect(importRes.body.data.agents).toHaveLength(4);
      expect(importRes.body.data.relationships).toHaveLength(5);
      expect(importRes.body.data.name).toContain('(imported)');
    });
  });

  describe('Graph Queries', () => {
    it('should calculate blast radius', async () => {
      const swarmId = seedTestSwarm(db);
      const res = await request(app)
        .get(`/api/swarms/${swarmId}/graph/blast-radius?agent=Alpha`);
      expect(res.status).toBe(200);
      // Beta and Delta depend on Alpha
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should find critical path', async () => {
      const swarmId = seedTestSwarm(db);
      const res = await request(app)
        .get(`/api/swarms/${swarmId}/graph/critical-path?from=Alpha&to=Gamma`);
      expect(res.status).toBe(200);
      expect(res.body.data).not.toBeNull();
      expect(res.body.data.path).toContain('Alpha');
      expect(res.body.data.path).toContain('Gamma');
    });

    it('should find single points of failure', async () => {
      const swarmId = seedTestSwarm(db);
      const res = await request(app)
        .get(`/api/swarms/${swarmId}/graph/single-points-of-failure?threshold=2`);
      expect(res.status).toBe(200);
      // Alpha has 2+ dependents
      const alpha = res.body.data.find((a: any) => a.nickname === 'Alpha');
      expect(alpha).toBeDefined();
    });

    it('should find hub agents', async () => {
      const swarmId = seedTestSwarm(db);
      const res = await request(app)
        .get(`/api/swarms/${swarmId}/graph/hubs`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
