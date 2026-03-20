import { describe, it, expect } from 'vitest';
import { validateSwarm } from '../../src/client/components/ValidationPanel.js';
import type { Swarm, Agent, Relationship, LayerDefinition } from '../../src/shared/types/index.js';

function makeSwarm(agents: Partial<Agent>[], relationships: Partial<Relationship>[] = []): Swarm {
  const layers: LayerDefinition[] = [
    { id: 'layer-1', name: 'Test Layer', colorTheme: '#00d9ff', order: 1 },
  ];

  return {
    id: 'test-swarm',
    name: 'Test',
    description: '',
    layers,
    agents: agents.map((a, i) => ({
      id: a.id || `agent-${i}`,
      swarmId: 'test-swarm',
      nickname: a.nickname || `Agent${i}`,
      formalName: a.formalName || `Formal-${i}`,
      descriptor: a.descriptor || `Desc ${i}`,
      layerId: a.layerId || 'layer-1',
      badges: a.badges || ['AUTO'],
      position: a.position || { x: 0, y: 0 },
      config: {},
    })),
    relationships: relationships.map((r, i) => ({
      id: r.id || `rel-${i}`,
      swarmId: 'test-swarm',
      sourceAgentId: r.sourceAgentId || '',
      targetAgentId: r.targetAgentId || '',
      type: r.type || 'dependsOn',
      metadata: {},
    })),
    version: 1,
    createdAt: '',
    updatedAt: '',
  };
}

describe('Validation Engine', () => {
  it('should detect orphan agents', () => {
    const swarm = makeSwarm([
      { id: 'a1', nickname: 'Connected' },
      { id: 'a2', nickname: 'Orphan' },
    ], [
      { sourceAgentId: 'a1', targetAgentId: 'a1', type: 'feedsInto' },
    ]);

    const msgs = validateSwarm(swarm);
    const orphanMsg = msgs.find(m => m.rule === 'no_orphan_agents');
    expect(orphanMsg).toBeDefined();
    expect(orphanMsg!.affectedAgents).toContain('Orphan');
  });

  it('should warn about HUB agents with many dependents', () => {
    const swarm = makeSwarm([
      { id: 'hub', nickname: 'BigHub', badges: ['HUB'] },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `dep-${i}`, nickname: `Dep${i}` })),
    ], [
      ...Array.from({ length: 6 }, (_, i) => ({
        sourceAgentId: `dep-${i}`,
        targetAgentId: 'hub',
        type: 'dependsOn' as const,
      })),
    ]);

    const msgs = validateSwarm(swarm);
    const hubMsg = msgs.find(m => m.rule === 'hub_needs_backup');
    expect(hubMsg).toBeDefined();
    expect(hubMsg!.message).toContain('BigHub');
    expect(hubMsg!.message).toContain('6 agents');
  });

  it('should flag ENTRY agents without downstream connections', () => {
    const swarm = makeSwarm([
      { id: 'entry', nickname: 'DeadEnd', badges: ['ENTRY'] },
    ]);

    const msgs = validateSwarm(swarm);
    const entryMsg = msgs.find(m => m.rule === 'entry_needs_downstream');
    expect(entryMsg).toBeDefined();
    expect(entryMsg!.severity).toBe('error');
    expect(entryMsg!.message).toContain('DeadEnd');
  });

  it('should flag canOverride without CAN_OVERRIDE badge', () => {
    const swarm = makeSwarm([
      { id: 'a1', nickname: 'Overrider', badges: ['AUTO'] },
      { id: 'a2', nickname: 'Target', badges: ['AUTO'] },
    ], [
      { sourceAgentId: 'a1', targetAgentId: 'a2', type: 'canOverride' },
    ]);

    const msgs = validateSwarm(swarm);
    const overrideMsg = msgs.find(m => m.rule === 'override_needs_badge');
    expect(overrideMsg).toBeDefined();
    expect(overrideMsg!.message).toContain('Overrider');
  });

  it('should report no issues for a well-formed minimal swarm', () => {
    const swarm = makeSwarm([
      { id: 'a1', nickname: 'Source', badges: ['ENTRY'] },
      { id: 'a2', nickname: 'Target', badges: ['AUTO'] },
    ], [
      { sourceAgentId: 'a1', targetAgentId: 'a2', type: 'feedsInto' },
    ]);

    const msgs = validateSwarm(swarm);
    // Should have no errors or warnings (only possible advisory about CRITICAL)
    const errors = msgs.filter(m => m.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('should sort errors before warnings before advisories', () => {
    const swarm = makeSwarm([
      { id: 'a1', nickname: 'EntryDead', badges: ['ENTRY'] },
      { id: 'a2', nickname: 'CriticalAlone', badges: ['CRITICAL'] },
      { id: 'hub', nickname: 'BigHub', badges: ['HUB'] },
      ...Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, nickname: `Dep${i}` })),
    ], [
      ...Array.from({ length: 5 }, (_, i) => ({
        sourceAgentId: `d${i}`,
        targetAgentId: 'hub',
        type: 'dependsOn' as const,
      })),
    ]);

    const msgs = validateSwarm(swarm);
    expect(msgs.length).toBeGreaterThan(0);
    // Errors should come first
    for (let i = 1; i < msgs.length; i++) {
      const order = { error: 0, warning: 1, advisory: 2 };
      expect(order[msgs[i - 1].severity]).toBeLessThanOrEqual(order[msgs[i].severity]);
    }
  });
});
