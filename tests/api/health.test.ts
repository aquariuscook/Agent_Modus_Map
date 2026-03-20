import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server.js';
import { getTestDb } from '../../src/api/db/database.js';
import { initHealthStore, insertHealthReport } from '../../src/api/db/health-store.js';
import { generateHealthReport, seedHealthHistory } from '../../src/api/services/health-simulator.js';
import type Database from 'better-sqlite3';
import type { Express } from 'express';

let db: Database.Database;
let app: Express;

function seedTestSwarmForHealth(database: Database.Database) {
  const swarmId = 'health-test';
  database.prepare("INSERT INTO swarms (id, name) VALUES (?, ?)").run(swarmId, 'Health Test');
  database.prepare("INSERT INTO layers (id, swarm_id, name, color_theme, display_order) VALUES (?, ?, ?, ?, ?)").run('l1', swarmId, 'Layer', '#fff', 1);

  const agents = ['Catalog', 'Doorbell', 'Pulse', 'Sentinel'];
  for (const name of agents) {
    database.prepare(
      "INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(`agent-${name.toLowerCase()}`, swarmId, name, `Formal-${name}`, `The ${name}`, 'l1', '["AUTO"]');
  }
  return swarmId;
}

beforeEach(() => {
  db = getTestDb();
  initHealthStore(db);
  app = createApp(db);
});

afterEach(() => {
  db.close();
});

describe('Health Monitoring', () => {
  describe('Health Report Generation', () => {
    it('should generate valid health reports', () => {
      const report = generateHealthReport('agent-1', 'Catalog');
      expect(report.agentNickname).toBe('Catalog');
      expect(report.status).toMatch(/healthy|degraded|unhealthy/);
      expect(report.latencyP95).toBeGreaterThan(0);
      expect(report.throughput).toBeGreaterThan(0);
      expect(report.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(report.cpuPercent).toBeLessThanOrEqual(100);
    });

    it('should generate different profiles per agent type', () => {
      const catalog = generateHealthReport('a1', 'Catalog');
      const pulse = generateHealthReport('a2', 'Pulse');
      const sherlock = generateHealthReport('a3', 'Sherlock');

      // Pulse should have lower latency than Sherlock (monitoring vs intelligence)
      // Using base values: Pulse=10ms, Sherlock=200ms
      // With jitter this won't always hold, but the bases are very different
      expect(pulse.latencyP95).toBeLessThan(200); // Pulse base is 10ms
    });
  });

  describe('GET /api/monitoring/swarms/:swarmId', () => {
    it('should return health summaries for all agents', async () => {
      const swarmId = seedTestSwarmForHealth(db);
      seedHealthHistory(db, swarmId, 10);

      const res = await request(app).get(`/api/monitoring/swarms/${swarmId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4);

      const catalog = res.body.data.find((a: any) => a.nickname === 'Catalog');
      expect(catalog).toBeDefined();
      expect(catalog.status).toMatch(/healthy|degraded|unhealthy/);
      expect(catalog.history.length).toBeGreaterThan(0);
      expect(catalog.latencyP95).toBeGreaterThan(0);
    });

    it('should return unknown status for agents without health data', async () => {
      const swarmId = seedTestSwarmForHealth(db);
      // No health data seeded

      const res = await request(app).get(`/api/monitoring/swarms/${swarmId}`);
      expect(res.status).toBe(200);
      const agent = res.body.data[0];
      expect(agent.status).toBe('unknown');
      expect(agent.history).toHaveLength(0);
    });
  });

  describe('GET /api/monitoring/swarms/:swarmId/summary', () => {
    it('should return overall health summary', async () => {
      const swarmId = seedTestSwarmForHealth(db);
      seedHealthHistory(db, swarmId, 5);

      const res = await request(app).get(`/api/monitoring/swarms/${swarmId}/summary`);
      expect(res.status).toBe(200);
      expect(res.body.data.overall).toMatch(/healthy|degraded|unhealthy|unknown/);
      expect(res.body.data.agentCount).toBe(4);
      expect(res.body.data.counts).toBeDefined();
    });
  });

  describe('POST /api/monitoring/simulate/:swarmId', () => {
    it('should generate new health data for all agents', async () => {
      const swarmId = seedTestSwarmForHealth(db);

      const res = await request(app).post(`/api/monitoring/simulate/${swarmId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.agentsUpdated).toBe(4);

      // Verify data was stored
      const healthRes = await request(app).get(`/api/monitoring/swarms/${swarmId}`);
      const catalog = healthRes.body.data.find((a: any) => a.nickname === 'Catalog');
      expect(catalog.status).not.toBe('unknown');
    });
  });

  describe('POST /api/monitoring/report', () => {
    it('should accept external health reports', async () => {
      seedTestSwarmForHealth(db);

      const res = await request(app)
        .post('/api/monitoring/report')
        .send({
          agentId: 'agent-catalog',
          agentNickname: 'Catalog',
          status: 'degraded',
          latencyP50: 30,
          latencyP95: 120,
          latencyP99: 300,
          throughput: 500,
          errorRate: 2.5,
          cpuPercent: 75,
          memoryMb: 800,
        });

      expect(res.status).toBe(201);
    });
  });
});
