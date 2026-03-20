import { describe, it, expect } from 'vitest';
import { detectBottlenecks, whatIfRemoveAgent, estimateCost } from '../../src/api/services/optimization-service.js';
import type { Swarm } from '../../src/shared/types/index.js';

function makeSwarm(overrides: Partial<Swarm> = {}): Swarm {
  return {
    id: 'test-swarm',
    name: 'Test Swarm',
    description: '',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    layers: [
      { id: 'core', name: 'Core', colorTheme: '#00d9ff', order: 1 },
      { id: 'support', name: 'Support', colorTheme: '#8b5cf6', order: 2 },
    ],
    agents: [
      { id: 'a1', swarmId: 'test-swarm', nickname: 'Orchestrator', formalName: 'Orch', descriptor: '', layerId: 'core', badges: ['HUB', 'CRITICAL'], position: { x: 0, y: 0 }, config: {} },
      { id: 'a2', swarmId: 'test-swarm', nickname: 'Router', formalName: 'Router', descriptor: '', layerId: 'core', badges: [], position: { x: 100, y: 0 }, config: {} },
      { id: 'a3', swarmId: 'test-swarm', nickname: 'Logger', formalName: 'Logger', descriptor: '', layerId: 'support', badges: [], position: { x: 200, y: 0 }, config: {} },
      { id: 'a4', swarmId: 'test-swarm', nickname: 'Billing', formalName: 'Billing', descriptor: '', layerId: 'support', badges: [], position: { x: 300, y: 0 }, config: {} },
    ],
    relationships: [
      { id: 'r1', swarmId: 'test-swarm', sourceAgentId: 'a2', targetAgentId: 'a1', type: 'dependsOn', metadata: {} },
      { id: 'r2', swarmId: 'test-swarm', sourceAgentId: 'a3', targetAgentId: 'a1', type: 'dependsOn', metadata: {} },
      { id: 'r3', swarmId: 'test-swarm', sourceAgentId: 'a4', targetAgentId: 'a1', type: 'dependsOn', metadata: {} },
      { id: 'r4', swarmId: 'test-swarm', sourceAgentId: 'a1', targetAgentId: 'a2', type: 'feedsInto', metadata: {} },
      { id: 'r5', swarmId: 'test-swarm', sourceAgentId: 'a1', targetAgentId: 'a3', type: 'feedsInto', metadata: {} },
    ],
    ...overrides,
  };
}

describe('Optimization Service', () => {
  describe('detectBottlenecks', () => {
    it('should identify high-dependency agents as bottlenecks', () => {
      const swarm = makeSwarm();
      const bottlenecks = detectBottlenecks(swarm);

      expect(bottlenecks.length).toBeGreaterThan(0);
      const orch = bottlenecks.find(b => b.nickname === 'Orchestrator');
      expect(orch).toBeDefined();
      expect(orch!.score).toBeGreaterThanOrEqual(40);
      expect(orch!.dependents).toBe(3);
    });

    it('should return empty array for well-distributed swarm', () => {
      const swarm = makeSwarm({
        relationships: [
          { id: 'r1', swarmId: 'test-swarm', sourceAgentId: 'a1', targetAgentId: 'a2', type: 'collaboratesWith', metadata: {} },
        ],
      });
      const bottlenecks = detectBottlenecks(swarm);
      expect(bottlenecks.length).toBe(0);
    });
  });

  describe('whatIfRemoveAgent', () => {
    it('should show high risk for removing a hub agent', () => {
      const swarm = makeSwarm();
      const result = whatIfRemoveAgent(swarm, 'Orchestrator');

      expect(result.riskScore).toBeGreaterThanOrEqual(70);
      expect(result.impactedAgents.length).toBeGreaterThan(0);
      expect(result.recommendation).toContain('high-risk');
    });

    it('should show low risk for removing a leaf agent', () => {
      const swarm = makeSwarm();
      const result = whatIfRemoveAgent(swarm, 'Billing');

      expect(result.riskScore).toBeLessThan(40);
    });

    it('should handle non-existent agent', () => {
      const swarm = makeSwarm();
      const result = whatIfRemoveAgent(swarm, 'NonExistent');

      expect(result.riskScore).toBe(0);
      expect(result.recommendation).toContain('not found');
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost breakdown by layer', () => {
      const swarm = makeSwarm();
      const cost = estimateCost(swarm);

      expect(cost.totalAgents).toBe(4);
      expect(cost.totalRelationships).toBe(5);
      expect(cost.estimatedMonthlyCost).toBeGreaterThan(0);
      expect(cost.breakdown).toHaveLength(2); // core + support
    });

    it('should apply premiums for critical and hub agents', () => {
      const swarm = makeSwarm();
      const cost = estimateCost(swarm);

      const coreCost = cost.breakdown.find(b => b.layer === 'Core');
      const supportCost = cost.breakdown.find(b => b.layer === 'Support');
      expect(coreCost).toBeDefined();
      expect(supportCost).toBeDefined();
      // Core has critical+hub agent, should cost more per agent
      expect(coreCost!.estimatedCost / coreCost!.agents).toBeGreaterThan(supportCost!.estimatedCost / supportCost!.agents);
    });
  });
});
