import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server.js';
import { getTestDb } from '../../src/api/db/database.js';
import type Database from 'better-sqlite3';
import type { Express } from 'express';

let db: Database.Database;
let app: Express;

beforeEach(() => {
  db = getTestDb();
  app = createApp(db);
});

afterEach(() => {
  db.close();
});

describe('Template API', () => {
  describe('GET /api/templates', () => {
    it('should list available templates', async () => {
      const res = await request(app).get('/api/templates');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const template = res.body.data[0];
      expect(template.name).toBeDefined();
      expect(template.domain).toBeDefined();
      expect(template.agentCount).toBeGreaterThan(0);
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should return a full template with agents and relationships', async () => {
      const res = await request(app).get('/api/templates/customer-service-v1');
      expect(res.status).toBe(200);
      expect(res.body.data.agents.length).toBe(18);
      expect(res.body.data.relationships.length).toBeGreaterThan(0);
      expect(res.body.data.layers.length).toBe(4);
    });

    it('should return 404 for unknown template', async () => {
      const res = await request(app).get('/api/templates/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/templates/:id/instantiate', () => {
    it('should create a swarm from a template', async () => {
      const res = await request(app)
        .post('/api/templates/customer-service-v1/instantiate')
        .send({ name: 'My Support Team' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('My Support Team');
      expect(res.body.data.agents.length).toBe(18);
      expect(res.body.data.layers.length).toBe(4);
      expect(res.body.data.relationships.length).toBeGreaterThan(0);
      expect(res.body.data.templateSource).toBe('customer-service-v1');
    });

    it('should create from content-ops template', async () => {
      const res = await request(app)
        .post('/api/templates/content-ops-v1/instantiate')
        .send({ name: 'Content Pipeline' });

      expect(res.status).toBe(201);
      expect(res.body.data.agents.length).toBe(15);
    });

    it('should reject instantiation without a name', async () => {
      const res = await request(app)
        .post('/api/templates/customer-service-v1/instantiate')
        .send({});
      expect(res.status).toBe(400);
    });

    it('the instantiated swarm should be queryable', async () => {
      const createRes = await request(app)
        .post('/api/templates/customer-service-v1/instantiate')
        .send({ name: 'Queryable Support' });

      const swarmId = createRes.body.data.id;
      const getRes = await request(app).get(`/api/swarms/${swarmId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.agents.length).toBe(18);
    });
  });
});
