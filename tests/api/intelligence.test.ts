import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server.js';
import { getTestDb } from '../../src/api/db/database.js';
import { initKnowledgeBase, seedKnowledgeBase } from '../../src/api/db/knowledge-base.js';
import { v7 as uuidv7 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Express } from 'express';

let db: Database.Database;
let app: Express;

function seedSwarmForRAG(database: Database.Database) {
  const swarmId = 'rag-test';
  database.prepare("INSERT INTO swarms (id, name) VALUES (?, ?)").run(swarmId, 'RAG Test');
  database.prepare("INSERT INTO layers (id, swarm_id, name, color_theme, display_order) VALUES (?, ?, ?, ?, ?)").run('l1', swarmId, 'Layer', '#fff', 1);

  const agents = ['Catalog', 'Doorbell', 'Relay', 'Gavel', 'Domino', 'Courier'];
  for (const name of agents) {
    database.prepare(
      "INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(`agent-${name.toLowerCase()}`, swarmId, name, `Formal-${name}`, `The ${name}`, 'l1', '["AUTO"]');
  }

  // Catalog has dependents
  const insertRel = database.prepare(
    "INSERT INTO relationships (id, swarm_id, source_agent_id, target_agent_id, type) VALUES (?, ?, ?, ?, ?)"
  );
  insertRel.run(uuidv7(), swarmId, 'agent-doorbell', 'agent-catalog', 'dependsOn');
  insertRel.run(uuidv7(), swarmId, 'agent-gavel', 'agent-catalog', 'dependsOn');
  insertRel.run(uuidv7(), swarmId, 'agent-relay', 'agent-catalog', 'dependsOn');
  insertRel.run(uuidv7(), swarmId, 'agent-domino', 'agent-gavel', 'feedsInto');
  insertRel.run(uuidv7(), swarmId, 'agent-gavel', 'agent-courier', 'feedsInto');
}

beforeEach(() => {
  db = getTestDb();
  initKnowledgeBase(db);
  seedKnowledgeBase(db);
  seedSwarmForRAG(db);
  app = createApp(db);
});

afterEach(() => {
  db.close();
});

describe('Intelligence API', () => {
  describe('POST /api/intelligence/ask', () => {
    it('should answer blast radius queries (Graph RAG)', async () => {
      const res = await request(app)
        .post('/api/intelligence/ask')
        .send({ swarmId: 'rag-test', question: 'What happens if Catalog goes down?' });

      expect(res.status).toBe(200);
      expect(res.body.data.queryType).toMatch(/graph|both/);
      expect(res.body.data.answer).toContain('Catalog');
      expect(res.body.data.graphHighlights).toContain('Catalog');
      expect(res.body.data.graphHighlights.length).toBeGreaterThan(1);
    });

    it('should answer bottleneck queries (Graph RAG)', async () => {
      const res = await request(app)
        .post('/api/intelligence/ask')
        .send({ swarmId: 'rag-test', question: 'What are the bottlenecks?' });

      expect(res.status).toBe(200);
      expect(res.body.data.answer).toContain('Catalog');
    });

    it('should answer documentation queries (Doc RAG)', async () => {
      const res = await request(app)
        .post('/api/intelligence/ask')
        .send({ swarmId: 'rag-test', question: 'How should I handle agent failover?' });

      expect(res.status).toBe(200);
      expect(res.body.data.queryType).toBe('documentation');
      expect(res.body.data.sources.length).toBeGreaterThan(0);
    });

    it('should answer design pattern queries (Doc RAG)', async () => {
      const res = await request(app)
        .post('/api/intelligence/ask')
        .send({ swarmId: 'rag-test', question: 'What is the Motus naming convention?' });

      expect(res.status).toBe(200);
      expect(res.body.data.answer).toContain('nickname');
    });

    it('should answer path queries (Graph RAG)', async () => {
      const res = await request(app)
        .post('/api/intelligence/ask')
        .send({ swarmId: 'rag-test', question: 'Path from Domino to Courier' });

      expect(res.status).toBe(200);
      expect(res.body.data.queryType).toMatch(/graph|both/);
    });

    it('should reject requests without a question', async () => {
      const res = await request(app)
        .post('/api/intelligence/ask')
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
