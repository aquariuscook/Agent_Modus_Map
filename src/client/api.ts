import type { Swarm, Agent, Relationship, BlastRadiusResult, RelationshipType } from '../shared/types/index.js';

const BASE = '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(BASE + url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || `API error: ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

async function deleteReq(url: string): Promise<void> {
  const res = await fetch(BASE + url, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`API error: ${res.status}`);
}

export async function getSwarms(): Promise<Swarm[]> {
  return fetchJson('/swarms');
}

export async function getSwarm(id: string): Promise<Swarm> {
  return fetchJson(`/swarms/${id}`);
}

export async function getBlastRadius(swarmId: string, agentNickname: string, hops = 3): Promise<BlastRadiusResult[]> {
  return fetchJson(`/swarms/${swarmId}/graph/blast-radius?agent=${encodeURIComponent(agentNickname)}&hops=${hops}`);
}

export async function getCriticalPath(swarmId: string, from: string, to: string) {
  return fetchJson<{ path: string[]; length: number } | null>(
    `/swarms/${swarmId}/graph/critical-path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
}

export async function getHubAgents(swarmId: string) {
  return fetchJson<Array<{ nickname: string; totalEdges: number }>>(
    `/swarms/${swarmId}/graph/hubs`
  );
}

export async function getSinglePointsOfFailure(swarmId: string, threshold = 3) {
  return fetchJson<Array<{ nickname: string; dependents: number }>>(
    `/swarms/${swarmId}/graph/single-points-of-failure?threshold=${threshold}`
  );
}

// Mutations
export async function createAgent(swarmId: string, data: Omit<Agent, 'id' | 'swarmId'>): Promise<Agent> {
  return postJson(`/swarms/${swarmId}/agents`, data);
}

export async function updateAgent(swarmId: string, agentId: string, data: Partial<Agent>): Promise<Agent> {
  return putJson(`/swarms/${swarmId}/agents/${agentId}`, data);
}

export async function deleteAgent(swarmId: string, agentId: string): Promise<void> {
  return deleteReq(`/swarms/${swarmId}/agents/${agentId}`);
}

export async function createRelationship(swarmId: string, data: {
  sourceAgentId: string;
  targetAgentId: string;
  type: RelationshipType;
  metadata?: Record<string, unknown>;
}): Promise<Relationship> {
  return postJson(`/swarms/${swarmId}/relationships`, data);
}

export async function deleteRelationship(swarmId: string, relId: string): Promise<void> {
  return deleteReq(`/swarms/${swarmId}/relationships/${relId}`);
}

// Intelligence / RAG
export interface RAGResponse {
  answer: string;
  sources: Array<{ title: string; category: string; snippet: string }>;
  graphHighlights: string[];
  queryType: 'graph' | 'documentation' | 'both';
}

export async function askQuestion(swarmId: string, question: string): Promise<RAGResponse> {
  return postJson('/intelligence/ask', { swarmId, question });
}

// Templates
export interface TemplateInfo {
  id: string;
  name: string;
  domain: string;
  description: string;
  agentCount: number;
  layerCount: number;
  tags: string[];
}

export async function getTemplates(): Promise<TemplateInfo[]> {
  return fetchJson('/templates');
}

export async function instantiateTemplate(templateId: string, name: string): Promise<Swarm> {
  return postJson(`/templates/${templateId}/instantiate`, { name });
}

// Monitoring / Health
export interface AgentHealthSummary {
  agentId: string;
  nickname: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyP95: number;
  throughput: number;
  errorRate: number;
  cpuPercent: number;
  memoryMb: number;
  lastReportAt: string;
  history: Array<{ timestamp: string; latencyP95: number; throughput: number; errorRate: number; status: string }>;
}

export interface SwarmHealthSummary {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  counts: { healthy: number; degraded: number; unhealthy: number; unknown: number };
  agentCount: number;
}

export async function getSwarmHealth(swarmId: string): Promise<AgentHealthSummary[]> {
  return fetchJson(`/monitoring/swarms/${swarmId}`);
}

export async function getSwarmHealthSummary(swarmId: string): Promise<SwarmHealthSummary> {
  return fetchJson(`/monitoring/swarms/${swarmId}/summary`);
}

export async function simulateHealth(swarmId: string): Promise<void> {
  await postJson(`/monitoring/simulate/${swarmId}`, {});
}

// Export
export async function exportSwarm(swarmId: string): Promise<unknown> {
  return fetchJson(`/swarms/${swarmId}/export`);
}

// Import
export async function importSwarm(data: unknown): Promise<Swarm> {
  return postJson('/swarms/import', data);
}
