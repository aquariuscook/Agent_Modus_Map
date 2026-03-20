import { describe, it, expect } from 'vitest';
import { generateSwarmMarkdown, generateAgentMarkdown } from '../../src/api/services/doc-generation-service.js';
import type { Swarm, Agent } from '../../src/shared/types/index.js';

const testSwarm: Swarm = {
  id: 'test-swarm',
  name: 'E-Commerce Swarm',
  description: 'A multi-agent swarm for handling e-commerce operations.',
  version: 1,
  createdAt: '2026-03-15T00:00:00Z',
  updatedAt: '2026-03-20T00:00:00Z',
  layers: [
    { id: 'core', name: 'Core Layer', colorTheme: '#00d9ff', order: 1 },
    { id: 'support', name: 'Support Layer', colorTheme: '#8b5cf6', order: 2 },
  ],
  agents: [
    { id: 'a1', swarmId: 'test-swarm', nickname: 'Orchestrator', formalName: 'Central Orchestrator', descriptor: 'Routes all incoming requests.', layerId: 'core', badges: ['HUB', 'CRITICAL'], position: { x: 0, y: 0 }, config: {} },
    { id: 'a2', swarmId: 'test-swarm', nickname: 'Logger', formalName: 'Event Logger', descriptor: 'Logs all events.', layerId: 'support', badges: ['LOGS_ALL'], position: { x: 100, y: 0 }, config: {} },
  ],
  relationships: [
    { id: 'r1', swarmId: 'test-swarm', sourceAgentId: 'a1', targetAgentId: 'a2', type: 'feedsInto', metadata: {} },
  ],
};

describe('Doc Generation Service', () => {
  it('should generate complete swarm markdown', () => {
    const md = generateSwarmMarkdown(testSwarm);

    expect(md).toContain('# E-Commerce Swarm');
    expect(md).toContain('A multi-agent swarm');
    expect(md).toContain('**Agents**: 2');
    expect(md).toContain('**Relationships**: 1');
    expect(md).toContain('## Layers');
    expect(md).toContain('Core Layer');
    expect(md).toContain('Support Layer');
    expect(md).toContain('## Agents');
    expect(md).toContain('#### Orchestrator');
    expect(md).toContain('#### Logger');
    expect(md).toContain('## Relationships');
    expect(md).toContain('Data Flows');
    expect(md).toContain('**Hub Agents**: Orchestrator');
    expect(md).toContain('**Critical Agents**: Orchestrator');
  });

  it('should generate individual agent markdown', () => {
    const md = generateAgentMarkdown(testSwarm.agents[0], testSwarm);

    expect(md).toContain('# Orchestrator');
    expect(md).toContain('Central Orchestrator');
    expect(md).toContain('Routes all incoming requests');
    expect(md).toContain('HUB');
    expect(md).toContain('**Feeds into**: Logger');
  });

  it('should handle empty swarm', () => {
    const emptySwarm: Swarm = {
      ...testSwarm,
      agents: [],
      relationships: [],
      layers: [],
    };
    const md = generateSwarmMarkdown(emptySwarm);
    expect(md).toContain('# E-Commerce Swarm');
    expect(md).toContain('**Agents**: 0');
  });

  it('should show dependency relationships in agent docs', () => {
    const swarmWithDeps: Swarm = {
      ...testSwarm,
      relationships: [
        { id: 'r1', swarmId: 'test-swarm', sourceAgentId: 'a2', targetAgentId: 'a1', type: 'dependsOn', metadata: {} },
      ],
    };

    const md = generateAgentMarkdown(swarmWithDeps.agents[0], swarmWithDeps);
    expect(md).toContain('**Depended on by**: Logger');
  });
});
