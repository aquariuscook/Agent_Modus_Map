import { describe, it, expect } from 'vitest';
import type { Agent, Relationship, Swarm, Badge, RelationshipType } from '../../src/shared/types/index.js';
import { agentSeeds, relationshipSeeds, layers } from '../../src/shared/data/seed-agents.js';

describe('Shared Types and Seed Data', () => {
  it('should have 25 agent seeds', () => {
    // The prototype says "24 agents" but actually defines 25 (6+5+5+6+3)
    expect(agentSeeds).toHaveLength(25);
  });

  it('should have 5 layers', () => {
    expect(layers).toHaveLength(5);
  });

  it('should have agents in every layer', () => {
    const layerIds = new Set(layers.map(l => l.id));
    const usedLayers = new Set(agentSeeds.map(a => a.layerId));
    for (const id of layerIds) {
      expect(usedLayers.has(id)).toBe(true);
    }
  });

  it('should have unique nicknames', () => {
    const nicknames = agentSeeds.map(a => a.nickname);
    const unique = new Set(nicknames);
    expect(unique.size).toBe(nicknames.length);
  });

  it('should have valid relationship types', () => {
    const validTypes: RelationshipType[] = ['dependsOn', 'feedsInto', 'collaboratesWith', 'canOverride'];
    for (const [, , type] of relationshipSeeds) {
      expect(validTypes).toContain(type);
    }
  });

  it('should reference only existing agent nicknames in relationships', () => {
    const nicknames = new Set(agentSeeds.map(a => a.nickname));
    for (const [source, target] of relationshipSeeds) {
      expect(nicknames.has(source)).toBe(true);
      expect(nicknames.has(target)).toBe(true);
    }
  });

  it('should have the critical path agents', () => {
    const criticalPath = ['Domino', 'Gavel', 'Knot', 'Relay', 'Courier'];
    const nicknames = new Set(agentSeeds.map(a => a.nickname));
    for (const name of criticalPath) {
      expect(nicknames.has(name)).toBe(true);
    }
  });

  it('should have hub agents with HUB badge', () => {
    const hubs = agentSeeds.filter(a => a.badges.includes('HUB'));
    expect(hubs.length).toBe(3); // Catalog, Scribe, Howler
    const hubNames = hubs.map(h => h.nickname).sort();
    expect(hubNames).toEqual(['Catalog', 'Howler', 'Scribe']);
  });

  it('should have correct layer distribution', () => {
    const layerCounts = new Map<string, number>();
    for (const agent of agentSeeds) {
      layerCounts.set(agent.layerId, (layerCounts.get(agent.layerId) || 0) + 1);
    }
    expect(layerCounts.get('layer-customer')).toBe(6);
    expect(layerCounts.get('layer-product')).toBe(5);
    expect(layerCounts.get('layer-order')).toBe(5);
    expect(layerCounts.get('layer-operations')).toBe(6);
    expect(layerCounts.get('layer-intelligence')).toBe(3);
  });
});
