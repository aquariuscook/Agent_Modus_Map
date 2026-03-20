// Generates realistic health data for the seeded swarm
// Each agent has a personality that affects its baseline metrics

import type Database from 'better-sqlite3';
import { insertHealthReport, type HealthReport } from '../db/health-store.js';

interface AgentProfile {
  baseLatency: number;
  baseThroughput: number;
  baseErrorRate: number;
  baseCpu: number;
  baseMemory: number;
  volatility: number; // 0-1, how much metrics fluctuate
}

const agentProfiles: Record<string, Partial<AgentProfile>> = {
  // High-traffic agents
  'Doorbell': { baseLatency: 35, baseThroughput: 1200, volatility: 0.3 },
  'Catalog': { baseLatency: 45, baseThroughput: 900, baseCpu: 40, baseMemory: 512, volatility: 0.2 },
  'Echo': { baseLatency: 25, baseThroughput: 800, volatility: 0.2 },
  // Critical path
  'Domino': { baseLatency: 50, baseThroughput: 600, baseCpu: 35, volatility: 0.15 },
  'Gavel': { baseLatency: 120, baseThroughput: 500, baseCpu: 45, volatility: 0.25 },
  'Knot': { baseLatency: 80, baseThroughput: 550, volatility: 0.2 },
  'Relay': { baseLatency: 60, baseThroughput: 700, baseCpu: 30, volatility: 0.3 },
  // Monitoring (always-on, low latency)
  'Pulse': { baseLatency: 10, baseThroughput: 2000, baseCpu: 15, volatility: 0.1 },
  'Sentinel': { baseLatency: 15, baseThroughput: 1500, baseCpu: 20, volatility: 0.1 },
  // Intelligence (higher latency, lower throughput)
  'Sherlock': { baseLatency: 200, baseThroughput: 100, baseCpu: 60, baseMemory: 1024, volatility: 0.3 },
  'Mosaic': { baseLatency: 150, baseThroughput: 150, baseCpu: 50, baseMemory: 768, volatility: 0.25 },
};

function getProfile(nickname: string): AgentProfile {
  const override = agentProfiles[nickname] || {};
  return {
    baseLatency: override.baseLatency ?? 50,
    baseThroughput: override.baseThroughput ?? 400,
    baseErrorRate: override.baseErrorRate ?? 0.2,
    baseCpu: override.baseCpu ?? 25,
    baseMemory: override.baseMemory ?? 256,
    volatility: override.volatility ?? 0.2,
  };
}

function jitter(base: number, volatility: number): number {
  const factor = 1 + (Math.random() - 0.5) * 2 * volatility;
  return Math.max(0, base * factor);
}

function determineStatus(latencyP95: number, baseLatency: number, errorRate: number): 'healthy' | 'degraded' | 'unhealthy' {
  if (errorRate > 5 || latencyP95 > baseLatency * 4) return 'unhealthy';
  if (errorRate > 1 || latencyP95 > baseLatency * 2.5) return 'degraded';
  return 'healthy';
}

export function generateHealthReport(agentId: string, nickname: string, timestamp?: string): HealthReport {
  const profile = getProfile(nickname);
  const ts = timestamp || new Date().toISOString();

  const latencyP50 = jitter(profile.baseLatency * 0.6, profile.volatility);
  const latencyP95 = jitter(profile.baseLatency, profile.volatility);
  const latencyP99 = jitter(profile.baseLatency * 2, profile.volatility);
  const throughput = jitter(profile.baseThroughput, profile.volatility * 0.5);
  const errorRate = jitter(profile.baseErrorRate, profile.volatility * 2);
  const cpuPercent = Math.min(100, jitter(profile.baseCpu, profile.volatility));
  const memoryMb = jitter(profile.baseMemory, profile.volatility * 0.3);

  const status = determineStatus(latencyP95, profile.baseLatency, errorRate);

  return {
    agentId,
    agentNickname: nickname,
    timestamp: ts,
    status,
    latencyP50: Math.round(latencyP50 * 10) / 10,
    latencyP95: Math.round(latencyP95 * 10) / 10,
    latencyP99: Math.round(latencyP99 * 10) / 10,
    throughput: Math.round(throughput),
    errorRate: Math.round(errorRate * 100) / 100,
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    memoryMb: Math.round(memoryMb),
  };
}

export function seedHealthHistory(db: Database.Database, swarmId: string, points: number = 30): void {
  const agents = db.prepare('SELECT id, nickname FROM agents WHERE swarm_id = ?')
    .all(swarmId) as Array<{ id: string; nickname: string }>;

  const now = Date.now();
  const interval = 60_000; // 1 minute between points

  const transaction = db.transaction(() => {
    for (const agent of agents) {
      for (let i = points - 1; i >= 0; i--) {
        const ts = new Date(now - i * interval).toISOString();
        const report = generateHealthReport(agent.id, agent.nickname, ts);
        insertHealthReport(db, report);
      }
    }
  });

  transaction();
  console.log(`Seeded health data: ${agents.length} agents x ${points} data points = ${agents.length * points} records`);
}
