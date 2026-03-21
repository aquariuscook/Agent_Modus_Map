import type Database from 'better-sqlite3';
import { v7 as uuidv7 } from 'uuid';
import type { Swarm, Agent, Relationship, LayerDefinition, SwarmExport } from '../../shared/types/index.js';

export class SwarmService {
  constructor(private db: Database.Database) {}

  findAll(): Swarm[] {
    const swarms = this.db.prepare('SELECT * FROM swarms ORDER BY created_at DESC').all() as any[];
    return swarms.map(s => this.loadSwarm(s.id)!);
  }

  findById(id: string): Swarm | null {
    return this.loadSwarm(id);
  }

  create(data: { name: string; description?: string; layers?: Array<{ name: string; colorTheme: string; order: number }> }): Swarm {
    const id = uuidv7();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO swarms (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, data.name, data.description || '', now, now);

    // Seed default layers if none provided
    const layers = data.layers || [
      { name: 'Interface', colorTheme: '#00d9ff', order: 1 },
      { name: 'Processing', colorTheme: '#a855f7', order: 2 },
      { name: 'Intelligence', colorTheme: '#22c55e', order: 3 },
      { name: 'Operations', colorTheme: '#fbbf24', order: 4 },
    ];

    const insertLayer = this.db.prepare(
      'INSERT INTO layers (id, swarm_id, name, color_theme, display_order) VALUES (?, ?, ?, ?, ?)'
    );
    for (const layer of layers) {
      insertLayer.run(uuidv7(), id, layer.name, layer.colorTheme, layer.order);
    }

    return this.loadSwarm(id)!;
  }

  update(id: string, data: { name?: string; description?: string }): Swarm | null {
    const existing = this.db.prepare('SELECT id FROM swarms WHERE id = ?').get(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    updates.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE swarms SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.loadSwarm(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM swarms WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Agent CRUD
  addAgent(swarmId: string, data: Omit<Agent, 'id' | 'swarmId'>): Agent | null {
    const swarm = this.db.prepare('SELECT id FROM swarms WHERE id = ?').get(swarmId);
    if (!swarm) return null;

    const id = uuidv7();
    this.db.prepare(
      'INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id, swarmId, data.nickname, data.formalName, data.descriptor,
      data.layerId, JSON.stringify(data.badges), data.position.x, data.position.y,
      JSON.stringify(data.config || {})
    );

    this.touchSwarm(swarmId);
    return this.loadAgent(id);
  }

  getAgent(agentId: string): Agent | null {
    return this.loadAgent(agentId);
  }

  updateAgent(agentId: string, data: Partial<Omit<Agent, 'id' | 'swarmId'>>): Agent | null {
    const existing = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any;
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.nickname !== undefined) { updates.push('nickname = ?'); values.push(data.nickname); }
    if (data.formalName !== undefined) { updates.push('formal_name = ?'); values.push(data.formalName); }
    if (data.descriptor !== undefined) { updates.push('descriptor = ?'); values.push(data.descriptor); }
    if (data.layerId !== undefined) { updates.push('layer_id = ?'); values.push(data.layerId); }
    if (data.badges !== undefined) { updates.push('badges = ?'); values.push(JSON.stringify(data.badges)); }
    if (data.position !== undefined) {
      updates.push('position_x = ?', 'position_y = ?');
      values.push(data.position.x, data.position.y);
    }
    if (data.config !== undefined) { updates.push('config = ?'); values.push(JSON.stringify(data.config)); }

    if (updates.length === 0) return this.loadAgent(agentId);

    values.push(agentId);
    this.db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    this.touchSwarm(existing.swarm_id);
    return this.loadAgent(agentId);
  }

  deleteAgent(agentId: string): boolean {
    const agent = this.db.prepare('SELECT swarm_id FROM agents WHERE id = ?').get(agentId) as any;
    if (!agent) return false;
    const result = this.db.prepare('DELETE FROM agents WHERE id = ?').run(agentId);
    if (result.changes > 0) this.touchSwarm(agent.swarm_id);
    return result.changes > 0;
  }

  // Relationship CRUD
  addRelationship(swarmId: string, data: Omit<Relationship, 'id' | 'swarmId'>): Relationship | null {
    const id = uuidv7();
    try {
      this.db.prepare(
        'INSERT INTO relationships (id, swarm_id, source_agent_id, target_agent_id, type, metadata) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, swarmId, data.sourceAgentId, data.targetAgentId, data.type, JSON.stringify(data.metadata || {}));
      this.touchSwarm(swarmId);
      return this.loadRelationship(id);
    } catch {
      return null;
    }
  }

  deleteRelationship(relationshipId: string): boolean {
    const rel = this.db.prepare('SELECT swarm_id FROM relationships WHERE id = ?').get(relationshipId) as any;
    if (!rel) return false;
    const result = this.db.prepare('DELETE FROM relationships WHERE id = ?').run(relationshipId);
    if (result.changes > 0) this.touchSwarm(rel.swarm_id);
    return result.changes > 0;
  }

  // Export
  exportSwarm(swarmId: string): SwarmExport | null {
    const swarm = this.loadSwarm(swarmId);
    if (!swarm) return null;
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      swarm,
    };
  }

  // Import
  importSwarm(data: SwarmExport): Swarm {
    const newId = uuidv7();
    const now = new Date().toISOString();

    const transaction = this.db.transaction(() => {
      this.db.prepare(
        'INSERT INTO swarms (id, name, description, template_source, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(newId, data.swarm.name + ' (imported)', data.swarm.description, data.swarm.templateSource || null, 1, now, now);

      const layerIdMap = new Map<string, string>();
      for (const layer of data.swarm.layers) {
        const newLayerId = uuidv7();
        layerIdMap.set(layer.id, newLayerId);
        this.db.prepare(
          'INSERT INTO layers (id, swarm_id, name, color_theme, display_order) VALUES (?, ?, ?, ?, ?)'
        ).run(newLayerId, newId, layer.name, layer.colorTheme, layer.order);
      }

      const agentIdMap = new Map<string, string>();
      for (const agent of data.swarm.agents) {
        const newAgentId = uuidv7();
        agentIdMap.set(agent.id, newAgentId);
        const newLayerId = layerIdMap.get(agent.layerId) || agent.layerId;
        this.db.prepare(
          'INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(newAgentId, newId, agent.nickname, agent.formalName, agent.descriptor, newLayerId,
          JSON.stringify(agent.badges), agent.position.x, agent.position.y, JSON.stringify(agent.config));
      }

      for (const rel of data.swarm.relationships) {
        const newSourceId = agentIdMap.get(rel.sourceAgentId);
        const newTargetId = agentIdMap.get(rel.targetAgentId);
        if (newSourceId && newTargetId) {
          this.db.prepare(
            'INSERT INTO relationships (id, swarm_id, source_agent_id, target_agent_id, type, metadata) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(uuidv7(), newId, newSourceId, newTargetId, rel.type, JSON.stringify(rel.metadata));
        }
      }
    });

    transaction();
    return this.loadSwarm(newId)!;
  }

  // Private helpers
  private loadSwarm(id: string): Swarm | null {
    const row = this.db.prepare('SELECT * FROM swarms WHERE id = ?').get(id) as any;
    if (!row) return null;

    const layerRows = this.db.prepare('SELECT * FROM layers WHERE swarm_id = ? ORDER BY display_order').all(id) as any[];
    const agentRows = this.db.prepare('SELECT * FROM agents WHERE swarm_id = ?').all(id) as any[];
    const relRows = this.db.prepare('SELECT * FROM relationships WHERE swarm_id = ?').all(id) as any[];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      templateSource: row.template_source || undefined,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      layers: layerRows.map(l => ({
        id: l.id,
        name: l.name,
        colorTheme: l.color_theme,
        order: l.display_order,
      })),
      agents: agentRows.map(a => this.mapAgent(a)),
      relationships: relRows.map(r => this.mapRelationship(r)),
    };
  }

  private loadAgent(id: string): Agent | null {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapAgent(row);
  }

  private loadRelationship(id: string): Relationship | null {
    const row = this.db.prepare('SELECT * FROM relationships WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRelationship(row);
  }

  private mapAgent(row: any): Agent {
    return {
      id: row.id,
      swarmId: row.swarm_id,
      nickname: row.nickname,
      formalName: row.formal_name,
      descriptor: row.descriptor,
      layerId: row.layer_id,
      badges: JSON.parse(row.badges),
      position: { x: row.position_x, y: row.position_y },
      config: JSON.parse(row.config),
    };
  }

  private mapRelationship(row: any): Relationship {
    return {
      id: row.id,
      swarmId: row.swarm_id,
      sourceAgentId: row.source_agent_id,
      targetAgentId: row.target_agent_id,
      type: row.type,
      metadata: JSON.parse(row.metadata),
    };
  }

  private touchSwarm(swarmId: string): void {
    this.db.prepare("UPDATE swarms SET updated_at = datetime('now'), version = version + 1 WHERE id = ?").run(swarmId);
  }
}
