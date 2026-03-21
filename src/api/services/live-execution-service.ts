// Stage 4: Live Test Execution
// Runs real LLM calls through the agent graph, one request at a time
import Anthropic from '@anthropic-ai/sdk';
import type { Swarm, Agent } from '../../shared/types/index.js';

export interface LiveExecutionStep {
  agentId: string;
  nickname: string;
  order: number;
  model: string;
  input: string;
  output: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  downstreamAgents: string[];
}

export interface LiveExecutionResult {
  swarmId: string;
  swarmName: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  steps: LiveExecutionStep[];
  dataFlow: Array<{ from: string; to: string; data: string }>;
  status: 'completed' | 'partial' | 'failed';
  agentsProcessed: number;
  agentsTotal: number;
}

// Pricing per 1M tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-sonnet-4-5-20250514': { input: 3.0, output: 15.0 },
  default: { input: 3.0, output: 15.0 },
};

export async function runLiveExecution(swarm: Swarm, userInput: string): Promise<LiveExecutionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured. Set it in your environment to run live tests.');
  }

  const client = new Anthropic({ apiKey });
  const startedAt = new Date().toISOString();
  const steps: LiveExecutionStep[] = [];
  const dataFlow: Array<{ from: string; to: string; data: string }> = [];

  // Find entry points and build graph
  const entryAgents = findEntryPoints(swarm);
  const downstream = buildDownstreamMap(swarm);

  // BFS through agents
  const visited = new Set<string>();
  const queue: Array<{ agent: Agent; input: string }> = [];
  for (const agent of entryAgents) {
    queue.push({ agent, input: userInput });
  }

  let stepOrder = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;

  const maxAgents = Math.min(swarm.agents.length, 15);
  while (queue.length > 0 && stepOrder < maxAgents) {
    const { agent, input } = queue.shift()!;
    if (visited.has(agent.id)) continue;
    visited.add(agent.id);

    const config = agent.config as Record<string, any>;
    const modelConfig = config.modelConfig || {};
    // Use Haiku for live tests to keep them fast and cheap
    const model = 'claude-haiku-4-5-20251001';
    const temperature = modelConfig.temperature ?? 0.7;
    const maxTokens = 512;

    // Build system prompt from agent config
    const systemPrompt = buildSystemPrompt(agent, config);
    const downstreamIds = downstream.get(agent.id) || [];
    const downstreamNames = downstreamIds.map(id => swarm.agents.find(a => a.id === id)?.nickname || id);

    const stepStart = Date.now();
    let step: LiveExecutionStep;
    console.log(`[LIVE] Agent ${stepOrder + 1}: ${agent.nickname} (${model}, max ${Math.min(maxTokens, 1024)} tokens)...`);

    try {
      // Limit input length to prevent token overflow
      const truncatedInput = input.slice(0, 2000);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await client.messages.create({
        model,
        max_tokens: Math.min(maxTokens, 1024),
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: truncatedInput }],
      });
      clearTimeout(timeout);

      const output = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('\n');

      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      const pricing = PRICING[model] || PRICING.default;
      const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalCost += cost;

      step = {
        agentId: agent.id,
        nickname: agent.nickname,
        order: stepOrder++,
        model,
        input: input.slice(0, 500),
        output,
        durationMs: Date.now() - stepStart,
        inputTokens,
        outputTokens,
        cost: Math.round(cost * 10000) / 10000,
        status: 'success',
        downstreamAgents: downstreamNames,
      };

      // Pass output to downstream agents
      for (const targetId of downstreamIds) {
        const targetAgent = swarm.agents.find(a => a.id === targetId);
        if (targetAgent && !visited.has(targetId)) {
          const contextInput = `Previous agent "${agent.nickname}" produced this output:\n\n${output.slice(0, 800)}\n\nProcess this according to your role.`;
          queue.push({ agent: targetAgent, input: contextInput });
          dataFlow.push({
            from: agent.nickname,
            to: targetAgent.nickname,
            data: output.slice(0, 150),
          });
        }
      }
    } catch (err: any) {
      step = {
        agentId: agent.id,
        nickname: agent.nickname,
        order: stepOrder++,
        model,
        input: input.slice(0, 500),
        output: '',
        durationMs: Date.now() - stepStart,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        status: 'error',
        error: err.message || 'Unknown error',
        downstreamAgents: downstreamNames,
      };
    }

    steps.push(step);
  }

  const completedAt = new Date().toISOString();
  const totalDurationMs = steps.reduce((sum, s) => sum + s.durationMs, 0);
  const hasErrors = steps.some(s => s.status === 'error');

  return {
    swarmId: swarm.id,
    swarmName: swarm.name,
    startedAt,
    completedAt,
    totalDurationMs,
    totalInputTokens,
    totalOutputTokens,
    totalCost: Math.round(totalCost * 10000) / 10000,
    steps,
    dataFlow,
    status: hasErrors ? (steps.some(s => s.status === 'success') ? 'partial' : 'failed') : 'completed',
    agentsProcessed: steps.filter(s => s.status === 'success').length,
    agentsTotal: swarm.agents.length,
  };
}

function buildSystemPrompt(agent: Agent, config: Record<string, any>): string {
  const parts: string[] = [];

  parts.push(`You are "${agent.nickname}" (${agent.formalName}), ${agent.descriptor}.`);

  const prompt = config.systemPrompt as Record<string, string> | undefined;
  if (prompt?.persona) parts.push(`\nPersona: ${prompt.persona}`);
  if (config.coreTask) parts.push(`\nCore Task: ${config.coreTask}`);
  if (prompt?.instructions) parts.push(`\nInstructions: ${prompt.instructions}`);
  if (prompt?.constraints) parts.push(`\nConstraints: ${prompt.constraints}`);

  const guardrails = config.guardrails as Record<string, any> | undefined;
  if (guardrails?.blockedTopics?.length) {
    parts.push(`\nBlocked Topics (never discuss): ${(guardrails.blockedTopics as string[]).join(', ')}`);
  }
  if (guardrails?.contentFilters?.length) {
    parts.push(`\nContent Filters: ${(guardrails.contentFilters as string[]).join(', ')}`);
  }

  if (prompt?.outputFormat) parts.push(`\nOutput Format: ${prompt.outputFormat}`);

  if (config.autonomyLevel) parts.push(`\nAutonomy Level: ${config.autonomyLevel}`);

  // If no detailed config, provide a sensible default
  if (parts.length <= 1) {
    parts.push('\nProcess the input according to your role and provide a clear, actionable response.');
  }

  return parts.join('\n');
}

function findEntryPoints(swarm: Swarm): Agent[] {
  const entryBadged = swarm.agents.filter(a => a.badges.includes('ENTRY'));
  if (entryBadged.length > 0) return entryBadged;

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
    if (rel.type === 'feedsInto') map.get(rel.sourceAgentId)?.push(rel.targetAgentId);
    if (rel.type === 'dependsOn') map.get(rel.targetAgentId)?.push(rel.sourceAgentId);
  }
  for (const [key, val] of map) map.set(key, [...new Set(val)]);
  return map;
}
