// Core domain types for Agent Modus Map
// Aligned with DDD Design Context (docs/ddd/design-context.md)

export type SwarmId = string;
export type AgentId = string;
export type LayerId = string;
export type RelationshipId = string;

export type Badge =
  | 'HUB'
  | 'CRITICAL'
  | 'ENTRY'
  | 'AUTO'
  | 'HUMAN'
  | 'APPROVAL'
  | 'ALWAYS_ON'
  | 'ADVISORY'
  | 'CAN_OVERRIDE'
  | 'HIGH_PRIORITY'
  | 'MEDIUM'
  | 'LOGS_ALL';

export type RelationshipType =
  | 'dependsOn'
  | 'feedsInto'
  | 'collaboratesWith'
  | 'canOverride';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface Position {
  x: number;
  y: number;
}

export interface LayerDefinition {
  id: LayerId;
  name: string;
  colorTheme: string;
  order: number;
}

export interface Agent {
  id: AgentId;
  swarmId: SwarmId;
  nickname: string;
  formalName: string;
  descriptor: string;
  layerId: LayerId;
  badges: Badge[];
  position: Position;
  config: Record<string, unknown>;
}

export interface Relationship {
  id: RelationshipId;
  swarmId: SwarmId;
  sourceAgentId: AgentId;
  targetAgentId: AgentId;
  type: RelationshipType;
  metadata: Record<string, unknown>;
}

export interface Swarm {
  id: SwarmId;
  name: string;
  description: string;
  layers: LayerDefinition[];
  agents: Agent[];
  relationships: Relationship[];
  templateSource?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Validation result from the validation engine
export interface ValidationResult {
  rule: string;
  severity: 'error' | 'warning' | 'advisory';
  message: string;
  affectedAgents: AgentId[];
}

// Graph query types
export interface BlastRadiusResult {
  agentId: AgentId;
  nickname: string;
  hops: number;
  badges: Badge[];
}

export interface CriticalPathResult {
  path: string[];
  length: number;
}

// API response wrappers
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

// Export/Import format
export interface SwarmExport {
  version: '1.0';
  exportedAt: string;
  swarm: Swarm;
}
