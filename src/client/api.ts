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

export async function createBlankSwarm(name: string, description?: string): Promise<Swarm> {
  return postJson('/swarms', { name, description: description || '' });
}

export async function listSwarms(): Promise<Swarm[]> {
  return fetchJson('/swarms');
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

// Decision Traces
export interface DecisionTrace {
  id: string;
  swarmId: string;
  agentId: string;
  agentNickname: string;
  title: string;
  timestamp: string;
  stages: Array<{ stage: string; content: string; data?: Record<string, unknown>; timestamp: string }>;
  tags: string[];
  confidence: number;
  durationMs: number;
}

export interface TracePattern {
  pattern: string;
  occurrences: number;
  agents: string[];
  avgConfidence: number;
  avgDurationMs: number;
}

export async function getDecisionTraces(swarmId: string, opts?: { agentId?: string; tag?: string }): Promise<DecisionTrace[]> {
  let url = `/traces/${swarmId}?limit=50`;
  if (opts?.agentId) url += `&agentId=${encodeURIComponent(opts.agentId)}`;
  if (opts?.tag) url += `&tag=${encodeURIComponent(opts.tag)}`;
  return fetchJson(url);
}

export async function getTracePatterns(swarmId: string): Promise<TracePattern[]> {
  return fetchJson(`/traces/${swarmId}/patterns`);
}

// Governance
export interface AuditEntry {
  id: string;
  swarmId: string;
  action: string;
  userId: string;
  userName: string;
  details: Record<string, unknown>;
  timestamp: string;
  checksum: string;
}

export interface ComplianceReport {
  status: 'compliant' | 'partial' | 'non-compliant';
  checks: Array<{ name: string; status: string; description: string }>;
  auditEntryCount: number;
}

export async function getAuditLog(swarmId: string, opts?: { action?: string; limit?: number }): Promise<AuditEntry[]> {
  let url = `/governance/${swarmId}/audit?limit=${opts?.limit || 100}`;
  if (opts?.action) url += `&action=${encodeURIComponent(opts.action)}`;
  return fetchJson(url);
}

export async function getComplianceReport(swarmId: string): Promise<ComplianceReport> {
  return fetchJson(`/governance/${swarmId}/compliance`);
}

// Collaboration
export interface SwarmVersionInfo {
  id: string;
  swarmId: string;
  version: number;
  changeDescription: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface VersionDiff {
  added: { agents: string[]; relationships: string[] };
  removed: { agents: string[]; relationships: string[] };
  modified: string[];
}

export interface SwarmComment {
  id: string;
  swarmId: string;
  agentId?: string;
  userId: string;
  userName: string;
  content: string;
  resolved: boolean;
  timestamp: string;
}

export async function getVersionHistory(swarmId: string): Promise<SwarmVersionInfo[]> {
  return fetchJson(`/collaboration/${swarmId}/versions`);
}

export async function saveVersion(swarmId: string, snapshot: unknown, description: string): Promise<SwarmVersionInfo> {
  return postJson(`/collaboration/${swarmId}/versions`, { snapshot, changeDescription: description });
}

export async function getVersionDiff(swarmId: string, v1: number, v2: number): Promise<VersionDiff> {
  return fetchJson(`/collaboration/${swarmId}/diff?v1=${v1}&v2=${v2}`);
}

export async function getComments(swarmId: string, agentId?: string): Promise<SwarmComment[]> {
  let url = `/collaboration/${swarmId}/comments`;
  if (agentId) url += `?agentId=${encodeURIComponent(agentId)}`;
  return fetchJson(url);
}

export async function addComment(swarmId: string, content: string, agentId?: string): Promise<SwarmComment> {
  return postJson(`/collaboration/${swarmId}/comments`, { content, agentId, userName: 'Designer' });
}

export async function resolveComment(swarmId: string, commentId: string): Promise<void> {
  await putJson(`/collaboration/${swarmId}/comments/${commentId}/resolve`, {});
}

// Optimization
export interface BottleneckResult {
  agentId: string;
  nickname: string;
  score: number;
  inDegree: number;
  outDegree: number;
  dependents: number;
  reason: string;
}

export interface WhatIfResult {
  scenario: string;
  impactedAgents: Array<{ nickname: string; impact: 'high' | 'medium' | 'low' }>;
  riskScore: number;
  recommendation: string;
}

export interface CostEstimate {
  totalAgents: number;
  totalRelationships: number;
  estimatedMonthlyCost: number;
  breakdown: Array<{ layer: string; agents: number; estimatedCost: number }>;
  optimizationSuggestions: string[];
}

export async function getBottlenecks(swarmId: string): Promise<BottleneckResult[]> {
  return fetchJson(`/optimization/${swarmId}/bottlenecks`);
}

export async function getWhatIf(swarmId: string, agentNickname: string): Promise<WhatIfResult> {
  return fetchJson(`/optimization/${swarmId}/what-if?remove=${encodeURIComponent(agentNickname)}`);
}

export async function getCostEstimate(swarmId: string): Promise<CostEstimate> {
  return fetchJson(`/optimization/${swarmId}/cost`);
}

// Doc Generation
export interface GeneratedDoc {
  markdown: string;
  swarmId: string;
  name: string;
  generatedAt: string;
}

export async function generateSwarmDocs(swarmId: string): Promise<GeneratedDoc> {
  return fetchJson(`/docs/${swarmId}`);
}

// Auth
export interface AuthToken {
  token: string;
  user: { id: string; email: string; name: string; role: string };
  expiresAt: string;
}

export async function loginApi(email: string, password: string): Promise<AuthToken> {
  return postJson('/auth/login', { email, password });
}

export async function getMe(): Promise<{ user: AuthToken['user']; permissions: string[] }> {
  return fetchJson('/auth/me');
}

// Auth token management
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem('agentModusMap_token', token);
  } else {
    localStorage.removeItem('agentModusMap_token');
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('agentModusMap_token');
  }
  return authToken;
}

// MCP Runtime
export interface McpToolResult {
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
}

export async function startMcpServerApi(name: string, url: string, transport: string): Promise<{ status: string }> {
  return postJson('/mcp/servers/start', { name, url, transport });
}

export async function stopMcpServerApi(name: string): Promise<{ status: string }> {
  return postJson('/mcp/servers/stop', { name });
}

export async function getRunningMcpServers(): Promise<string[]> {
  return fetchJson('/mcp/servers');
}

export async function listMcpToolsApi(serverName: string): Promise<Array<{ name: string; description: string }>> {
  return fetchJson(`/mcp/servers/${serverName}/tools`);
}

export async function callMcpToolApi(serverName: string, toolName: string, args: Record<string, unknown>): Promise<McpToolResult> {
  return postJson('/mcp/tools/call', { serverName, toolName, arguments: args });
}

export async function executeApiCallApi(config: { name: string; method: string; url: string; headers: Record<string, string>; authType: string; authToken?: string }, body?: unknown): Promise<{ success: boolean; status: number; data: unknown; error?: string; durationMs: number }> {
  return postJson('/mcp/api/call', { config, body });
}

// CSV Import
export async function importFromCSV(csvData: string, swarmName: string): Promise<{ swarmId: string; agentsImported: number; relationshipsCreated: number }> {
  return postJson('/import/csv', { csvData, swarmName });
}

export function getCSVTemplateUrl(): string {
  return `${BASE}/import/template`;
}

// HTML Export
export function getHTMLExportUrl(swarmId: string): string {
  return `${BASE}/docs/${swarmId}/html`;
}

// Health check with LLM status
export async function getApiHealth(): Promise<{ status: string; llmAvailable: boolean }> {
  return fetchJson('/health');
}
