// Stage 2: Mock Simulation Engine
// Walks sample data through the agent graph, generating mock outputs per agent
import type { Swarm, Agent, Relationship } from '../../shared/types/index.js';

export interface SimulationStep {
  agentId: string;
  nickname: string;
  order: number;
  input: string;
  output: string;
  durationMs: number;
  tokensUsed: number;
  status: 'success' | 'filtered' | 'escalated';
  downstreamAgents: string[];
}

export interface SimulationResult {
  swarmId: string;
  swarmName: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  totalTokens: number;
  steps: SimulationStep[];
  dataFlow: Array<{ from: string; to: string; data: string }>;
}

export function runMockSimulation(swarm: Swarm, sampleInput: string): SimulationResult {
  const startedAt = new Date().toISOString();
  const steps: SimulationStep[] = [];
  const dataFlow: Array<{ from: string; to: string; data: string }> = [];

  // Find entry points (agents with ENTRY badge, or agents with no inbound dependencies)
  const entryAgents = findEntryPoints(swarm);

  // Build adjacency map: agentId -> downstream agents via feedsInto/dependsOn
  const downstream = buildDownstreamMap(swarm);

  // BFS through the graph starting from entry points
  const visited = new Set<string>();
  const queue: Array<{ agent: Agent; input: string; order: number }> = [];

  for (const agent of entryAgents) {
    queue.push({ agent, input: sampleInput, order: 0 });
  }

  let stepOrder = 0;
  while (queue.length > 0) {
    const { agent, input } = queue.shift()!;
    if (visited.has(agent.id)) continue;
    visited.add(agent.id);

    const config = agent.config as Record<string, any>;
    const mockOutput = generateMockOutput(agent, config, input);
    const modelConfig = config.modelConfig || {};
    const estimatedTokens = estimateTokens(input, mockOutput, modelConfig.maxTokens || 4096);
    const estimatedDuration = estimateDuration(modelConfig.provider || 'anthropic', modelConfig.model || 'claude-sonnet-4-6');

    // Check guardrails
    const guardrails = config.guardrails || {};
    const blockedTopics = (guardrails.blockedTopics as string[]) || [];
    const isFiltered = blockedTopics.some(topic => input.toLowerCase().includes(topic.toLowerCase()));

    // Check if this agent escalates
    const isEscalated = agent.badges.includes('HUMAN') && config.autonomyLevel === 'Human-in-Loop';

    const downstreamIds = downstream.get(agent.id) || [];

    const step: SimulationStep = {
      agentId: agent.id,
      nickname: agent.nickname,
      order: stepOrder++,
      input: input.slice(0, 200),
      output: isFiltered ? '[FILTERED: blocked topic detected]' : mockOutput,
      durationMs: estimatedDuration,
      tokensUsed: estimatedTokens,
      status: isFiltered ? 'filtered' : isEscalated ? 'escalated' : 'success',
      downstreamAgents: downstreamIds.map(id => swarm.agents.find(a => a.id === id)?.nickname || id),
    };
    steps.push(step);

    // Pass output to downstream agents
    if (!isFiltered) {
      for (const targetId of downstreamIds) {
        const targetAgent = swarm.agents.find(a => a.id === targetId);
        if (targetAgent && !visited.has(targetId)) {
          const flowSummary = `[${agent.nickname}] ${mockOutput.slice(0, 80)}`;
          queue.push({ agent: targetAgent, input: flowSummary, order: stepOrder });
          dataFlow.push({
            from: agent.nickname,
            to: targetAgent.nickname,
            data: mockOutput.slice(0, 120),
          });
        }
      }
    }
  }

  const completedAt = new Date().toISOString();
  const totalDurationMs = steps.reduce((sum, s) => sum + s.durationMs, 0);
  const totalTokens = steps.reduce((sum, s) => sum + s.tokensUsed, 0);

  return {
    swarmId: swarm.id,
    swarmName: swarm.name,
    startedAt,
    completedAt,
    totalDurationMs,
    totalTokens,
    steps,
    dataFlow,
  };
}

function findEntryPoints(swarm: Swarm): Agent[] {
  // Agents with ENTRY badge
  const entryBadged = swarm.agents.filter(a => a.badges.includes('ENTRY'));
  if (entryBadged.length > 0) return entryBadged;

  // Fallback: agents with no inbound feedsInto or dependsOn
  const hasInbound = new Set<string>();
  for (const rel of swarm.relationships) {
    if (rel.type === 'feedsInto' || rel.type === 'dependsOn') {
      hasInbound.add(rel.targetAgentId);
    }
  }
  const noInbound = swarm.agents.filter(a => !hasInbound.has(a.id));
  return noInbound.length > 0 ? noInbound : [swarm.agents[0]];
}

function buildDownstreamMap(swarm: Swarm): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const agent of swarm.agents) map.set(agent.id, []);

  for (const rel of swarm.relationships) {
    if (rel.type === 'feedsInto') {
      map.get(rel.sourceAgentId)?.push(rel.targetAgentId);
    }
    if (rel.type === 'dependsOn') {
      // Reverse: if A depends on B, B feeds into A
      map.get(rel.targetAgentId)?.push(rel.sourceAgentId);
    }
  }

  // Deduplicate
  for (const [key, val] of map) {
    map.set(key, [...new Set(val)]);
  }
  return map;
}

function generateMockOutput(agent: Agent, config: Record<string, any>, input: string): string {
  const coreTask = (config.coreTask as string) || '';
  const nickname = agent.nickname;
  const outputFormat = config.systemPrompt?.outputFormat || '';

  // Generate realistic mock output based on agent type
  if (outputFormat && outputFormat.includes('{')) {
    // Has a JSON output format, generate a mock JSON response
    return outputFormat
      .replace(/"approve\|reject\|flag"/g, '"approve"')
      .replace(/0\.92/g, String((Math.random() * 0.3 + 0.7).toFixed(2)))
      .replace(/"\.\.\."/g, `"Processed by ${nickname}"`);
  }

  // Generate based on core task keywords
  const lower = coreTask.toLowerCase();
  if (lower.includes('classify') || lower.includes('categorize') || lower.includes('triage')) {
    return `Classification: Category-A (confidence: ${(Math.random() * 0.3 + 0.7).toFixed(2)}). Input routed to appropriate handler.`;
  }
  if (lower.includes('moderate') || lower.includes('review') || lower.includes('filter')) {
    return `Review complete. Decision: APPROVED. No policy violations detected. Confidence: ${(Math.random() * 0.2 + 0.8).toFixed(2)}.`;
  }
  if (lower.includes('generate') || lower.includes('write') || lower.includes('draft') || lower.includes('compose')) {
    return `[Generated content based on input context. ${Math.floor(Math.random() * 200 + 100)} words produced. Tone: professional. Readability: Grade 8.]`;
  }
  if (lower.includes('analyze') || lower.includes('detect') || lower.includes('monitor')) {
    return `Analysis complete. 3 patterns detected. Risk level: LOW. Metrics within normal range. Next check scheduled.`;
  }
  if (lower.includes('search') || lower.includes('find') || lower.includes('lookup') || lower.includes('query')) {
    return `Found 12 relevant results. Top match confidence: ${(Math.random() * 0.2 + 0.8).toFixed(2)}. Results ranked by relevance.`;
  }
  if (lower.includes('score') || lower.includes('qualify') || lower.includes('rank') || lower.includes('prioritize')) {
    return `Score: ${Math.floor(Math.random() * 40 + 60)}/100. Qualification: ${Math.random() > 0.5 ? 'QUALIFIED' : 'NEEDS_REVIEW'}. Key factors: engagement, fit, timing.`;
  }
  if (lower.includes('notify') || lower.includes('alert') || lower.includes('send') || lower.includes('email')) {
    return `Notification dispatched. Channel: email. Recipient confirmed. Delivery status: sent. Tracking ID: ${Math.random().toString(36).slice(2, 8)}.`;
  }
  if (lower.includes('transform') || lower.includes('convert') || lower.includes('format') || lower.includes('clean')) {
    return `Data transformed. Input records: 1. Output records: 1. Schema validated. No data loss.`;
  }
  if (lower.includes('propose') || lower.includes('recommend') || lower.includes('suggest')) {
    return `Recommendation generated. 3 options provided, ranked by fit. Primary recommendation: Option A (${(Math.random() * 0.2 + 0.8).toFixed(0)}% confidence).`;
  }

  return `[${nickname}] Processed input successfully. Output ready for downstream agents. Task: ${coreTask.slice(0, 60) || 'general processing'}.`;
}

function estimateTokens(input: string, output: string, maxTokens: number): number {
  // Rough estimate: 1 token per 4 characters
  const inputTokens = Math.ceil(input.length / 4);
  const outputTokens = Math.ceil(output.length / 4);
  return Math.min(inputTokens + outputTokens, maxTokens);
}

function estimateDuration(provider: string, model: string): number {
  // Estimated latency in ms based on provider/model
  const lower = model.toLowerCase();
  if (lower.includes('haiku') || lower.includes('mini') || lower.includes('flash')) return 200 + Math.random() * 300;
  if (lower.includes('sonnet') || lower.includes('gpt-4o')) return 500 + Math.random() * 1500;
  if (lower.includes('opus') || lower.includes('gpt-4')) return 2000 + Math.random() * 3000;
  return 500 + Math.random() * 1000;
}
