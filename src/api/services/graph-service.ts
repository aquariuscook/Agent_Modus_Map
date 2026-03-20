// Graph query service implementing ADR-001 queries using SQLite
// In production, these would be Cypher queries against Neo4j.
// The SQLite implementation uses recursive CTEs for graph traversal.

import type Database from 'better-sqlite3';
import type { BlastRadiusResult, CriticalPathResult, Badge } from '../../shared/types/index.js';

export class GraphService {
  constructor(private db: Database.Database) {}

  blastRadius(swarmId: string, agentNickname: string, maxHops: number = 3): BlastRadiusResult[] {
    // BFS approach since SQLite recursive CTEs cannot self-reference in subqueries
    const rootAgent = this.db.prepare(
      'SELECT id, nickname, badges FROM agents WHERE swarm_id = ? AND nickname = ?'
    ).get(swarmId, agentNickname) as { id: string; nickname: string; badges: string } | undefined;

    if (!rootAgent) return [];

    const getDependents = this.db.prepare(
      "SELECT a.id, a.nickname, a.badges FROM relationships r JOIN agents a ON a.id = r.source_agent_id WHERE r.target_agent_id = ? AND r.type = 'dependsOn' AND r.swarm_id = ?"
    );

    const results: BlastRadiusResult[] = [];
    const visited = new Set<string>([rootAgent.id]);
    let frontier = [rootAgent.id];
    let hops = 0;

    while (frontier.length > 0 && hops < maxHops) {
      hops++;
      const nextFrontier: string[] = [];
      for (const nodeId of frontier) {
        const dependents = getDependents.all(nodeId, swarmId) as Array<{ id: string; nickname: string; badges: string }>;
        for (const dep of dependents) {
          if (!visited.has(dep.id)) {
            visited.add(dep.id);
            nextFrontier.push(dep.id);
            results.push({
              agentId: dep.id,
              nickname: dep.nickname,
              hops,
              badges: JSON.parse(dep.badges) as Badge[],
            });
          }
        }
      }
      frontier = nextFrontier;
    }

    return results.sort((a, b) => a.hops - b.hops || a.nickname.localeCompare(b.nickname));
  }

  criticalPath(swarmId: string, fromNickname: string, toNickname: string): CriticalPathResult | null {
    // BFS to find shortest path via feedsInto relationships
    const agents = this.db.prepare(
      'SELECT id, nickname FROM agents WHERE swarm_id = ?'
    ).all(swarmId) as Array<{ id: string; nickname: string }>;

    const agentMap = new Map(agents.map(a => [a.id, a.nickname]));
    const nicknameToId = new Map(agents.map(a => [a.nickname, a.id]));

    const rels = this.db.prepare(
      "SELECT source_agent_id, target_agent_id FROM relationships WHERE swarm_id = ? AND type = 'feedsInto'"
    ).all(swarmId) as Array<{ source_agent_id: string; target_agent_id: string }>;

    // Build adjacency list
    const adj = new Map<string, string[]>();
    for (const rel of rels) {
      const existing = adj.get(rel.source_agent_id) || [];
      existing.push(rel.target_agent_id);
      adj.set(rel.source_agent_id, existing);
    }

    const startId = nicknameToId.get(fromNickname);
    const endId = nicknameToId.get(toNickname);
    if (!startId || !endId) return null;

    // BFS
    const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [fromNickname] }];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.id === endId) {
        return { path: current.path, length: current.path.length };
      }

      const neighbors = adj.get(current.id) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const name = agentMap.get(neighbor) || neighbor;
          queue.push({ id: neighbor, path: [...current.path, name] });
        }
      }
    }

    return null;
  }

  singlePointsOfFailure(swarmId: string, threshold: number = 3): Array<{ nickname: string; dependents: number; badges: Badge[] }> {
    const stmt = this.db.prepare(`
      SELECT a.nickname, a.badges, COUNT(r.id) as dependents
      FROM agents a
      JOIN relationships r ON r.target_agent_id = a.id AND r.type = 'dependsOn'
      WHERE a.swarm_id = ?
      GROUP BY a.id
      HAVING dependents >= ?
      ORDER BY dependents DESC
    `);

    const rows = stmt.all(swarmId, threshold) as Array<{
      nickname: string;
      badges: string;
      dependents: number;
    }>;

    return rows.map(row => ({
      nickname: row.nickname,
      dependents: row.dependents,
      badges: JSON.parse(row.badges) as Badge[],
    }));
  }

  hubAgents(swarmId: string): Array<{ nickname: string; totalEdges: number; badges: Badge[] }> {
    const stmt = this.db.prepare(`
      SELECT a.nickname, a.badges,
        (SELECT COUNT(*) FROM relationships r WHERE r.source_agent_id = a.id AND r.swarm_id = ?) +
        (SELECT COUNT(*) FROM relationships r WHERE r.target_agent_id = a.id AND r.swarm_id = ?) as total_edges
      FROM agents a
      WHERE a.swarm_id = ?
      ORDER BY total_edges DESC
      LIMIT 10
    `);

    const rows = stmt.all(swarmId, swarmId, swarmId) as Array<{
      nickname: string;
      badges: string;
      total_edges: number;
    }>;

    return rows.map(row => ({
      nickname: row.nickname,
      totalEdges: row.total_edges,
      badges: JSON.parse(row.badges) as Badge[],
    }));
  }
}
