// Stage 3: Prompt-to-Swarm Auto-Generator
// Uses NVIDIA NIM (cheap) or Anthropic (high-quality fallback) via Vercel AI SDK
// to generate a Swarm JSON from a natural language prompt.
// Leverages the existing provider-router-service for model selection.

import { generateObject } from 'ai';
import { z } from 'zod';
import { getModelForTier, getCheapestModel } from './provider-router-service.js';
import type { Swarm, Agent, Relationship, LayerDefinition, Badge, RelationshipType } from '../../shared/types/index.js';
import { v7 as uuidv7 } from 'uuid';

// ── Zod schemas for structured LLM output ────────────────────────────────────

const AgentSchema = z.object({
  nickname: z.string().describe('Short memorable name, e.g. "Sentinel"'),
  formalName: z.string().describe('Full role name, e.g. "Content Moderation Agent"'),
  descriptor: z.string().describe('One-sentence description of what this agent does'),
  layerName: z.string().describe('Which layer: Interface, Processing, Intelligence, or Operations'),
  badges: z.array(z.string()).describe('Badges like HUB, CRITICAL, ENTRY, AUTO, HUMAN, ALWAYS_ON'),
  skills: z.array(z.string()).describe('Core capabilities, e.g. ["web-search", "summarization"]'),
  modelProvider: z.string().optional().describe('Provider: anthropic, nvidia, openai, google'),
  modelName: z.string().optional().describe('Specific model, e.g. claude-sonnet-4-6'),
});

const RelationshipSchema = z.object({
  sourceNickname: z.string().describe('Nickname of the source agent'),
  targetNickname: z.string().describe('Nickname of the target agent'),
  type: z.string().describe('Relationship type: dependsOn, feedsInto, collaboratesWith, canOverride'),
  description: z.string().optional().describe('Why this relationship exists'),
});

const GeneratedSwarmSchema = z.object({
  swarmName: z.string().describe('Descriptive name for the swarm, e.g. "Content Moderation Pipeline"'),
  description: z.string().describe('What this swarm does end-to-end'),
  agents: z.array(AgentSchema).min(1).max(8).describe('Agents in the swarm'),
  relationships: z.array(RelationshipSchema).describe('How agents connect to each other'),
  topology: z.string().describe('Recommended topology: hierarchical, mesh, ring, or star'),
});

export type GeneratedSwarmInput = z.infer<typeof GeneratedSwarmSchema>;

// ── Generation prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a swarm architect for the Agent Modus Map platform.
Given a user's natural language description of a task or workflow, design an
optimal multi-agent swarm configuration.

Rules:
- Create 2-8 agents, each with a distinct role and memorable nickname
- Assign each agent to one of 4 layers: Interface (user-facing), Processing (data transformation), Intelligence (reasoning/LLM), Operations (infrastructure/monitoring)
- Use appropriate badges: ENTRY for first-contact agents, HUB for high-connectivity, CRITICAL for must-not-fail, AUTO for autonomous, HUMAN for human-in-the-loop
- Connect agents with relationships: feedsInto (data flows A→B), dependsOn (B needs A's output), collaboratesWith (peer-to-peer), canOverride (supervisor pattern)
- Suggest a topology: hierarchical (supervision chains), mesh (peer collaboration), ring (pipeline), star (hub-and-spoke)
- Choose cost-effective models: use nvidia/meta/llama-3.3-70b-instruct for simple agents, anthropic/claude-sonnet for complex reasoning
- Be practical: only add agents that serve a clear purpose in the workflow`;

// ── Public API ───────────────────────────────────────────────────────────────

export interface GenerateSwarmOptions {
  prompt: string;
  maxAgents?: number;
  // Prefer Tier 2 (NVIDIA NIM) for cost — default true
  preferCheapest?: boolean;
}

export interface GenerateSwarmResult {
  generated: GeneratedSwarmInput;
  swarm: Swarm;
  modelUsed: { provider: string; model: string; tier: number };
  error?: string;
}

/**
 * Generate a Swarm from a natural language prompt using an LLM.
 * Uses the AI SDK's generateObject() with Zod schema for structured output.
 */
export async function generateSwarmFromPrompt(options: GenerateSwarmOptions): Promise<GenerateSwarmResult> {
  const { prompt, maxAgents = 8, preferCheapest = true } = options;

  // Select model: prefer cheapest (NVIDIA NIM Tier 2) for generation
  const { model, route } = preferCheapest
    ? getCheapestModel(0.2) // Low complexity → NIM preferred
    : getModelForTier(3);   // High quality → Anthropic

  if (!model) {
    // Build a fallback heuristic swarm when no LLM is available
    return generateHeuristicSwarm(prompt, route);
  }

  try {
    const result = await generateObject({
      model,
      schema: GeneratedSwarmSchema,
      system: SYSTEM_PROMPT,
      prompt: `Design a swarm for: ${prompt}\n\nUse at most ${maxAgents} agents. Be specific about each agent's role and how they connect.`,
    });

    const generated = result.object;
    const swarm = convertToSwarm(generated);

    return {
      generated,
      swarm,
      modelUsed: { provider: route.provider, model: route.model, tier: route.tier },
    };
  } catch (err: any) {
    // Fall back to heuristic generation if LLM fails
    const fallback = generateHeuristicSwarm(prompt, route);
    fallback.error = `LLM generation failed: ${err.message}. Using heuristic fallback.`;
    return fallback;
  }
}

// ── Convert LLM output to Swarm typed object ─────────────────────────────────

const DEFAULT_LAYERS: Omit<LayerDefinition, 'id' | 'swarmId'>[] = [
  { name: 'Interface', colorTheme: '#00d9ff', order: 1 },
  { name: 'Processing', colorTheme: '#a855f7', order: 2 },
  { name: 'Intelligence', colorTheme: '#22c55e', order: 3 },
  { name: 'Operations', colorTheme: '#fbbf24', order: 4 },
];

function convertToSwarm(generated: GeneratedSwarmInput): Swarm {
  const swarmId = uuidv7();
  const now = new Date().toISOString();

  // Create layers
  const layers: LayerDefinition[] = DEFAULT_LAYERS.map(l => ({
    id: uuidv7(),
    swarmId,
    ...l,
  }));

  // Build a layer name → id map for agent assignment
  const layerMap = new Map(layers.map(l => [l.name.toLowerCase(), l.id]));

  // Create agents
  const agents: Agent[] = generated.agents.map(a => {
    const layerId = layerMap.get(a.layerName.toLowerCase()) || layers[1].id;
    return {
      id: uuidv7(),
      swarmId,
      nickname: a.nickname,
      formalName: a.formalName,
      descriptor: a.descriptor,
      layerId,
      badges: a.badges as Badge[],
      position: { x: 0, y: 0 }, // Canvas will auto-layout
      config: {
        skills: a.skills,
        modelConfig: {
          provider: a.modelProvider || 'nvidia',
          model: a.modelName || 'meta/llama-3.3-70b-instruct',
        },
      },
    };
  });

  // Build nickname → id map for relationships
  const agentMap = new Map(agents.map(a => [a.nickname.toLowerCase(), a.id]));

  // Create relationships
  const relationships: Relationship[] = generated.relationships
    .filter(r => agentMap.has(r.sourceNickname.toLowerCase()) && agentMap.has(r.targetNickname.toLowerCase()))
    .map(r => ({
      id: uuidv7(),
      swarmId,
      sourceAgentId: agentMap.get(r.sourceNickname.toLowerCase())!,
      targetAgentId: agentMap.get(r.targetNickname.toLowerCase())!,
      type: r.type as RelationshipType,
      metadata: r.description ? { description: r.description } : {},
    }));

  return {
    id: swarmId,
    name: generated.swarmName,
    description: generated.description,
    layers,
    agents,
    relationships,
    templateSource: 'prompt-generated',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Heuristic fallback (no LLM required) ─────────────────────────────────────

const TASK_AGENT_MAP: Array<{ keywords: string[]; agents: Array<{ nickname: string; formalName: string; descriptor: string; layerName: string; badges: string[] }> }> = [
  {
    keywords: ['moderate', 'moderation', 'content', 'review', 'filter', 'flag'],
    agents: [
      { nickname: 'Sentinel', formalName: 'Content Intake Agent', descriptor: 'Receives and normalizes incoming content', layerName: 'Interface', badges: ['ENTRY', 'AUTO'] },
      { nickname: 'Censor', formalName: 'Policy Check Agent', descriptor: 'Applies moderation rules and flags violations', layerName: 'Processing', badges: ['CRITICAL', 'AUTO'] },
      { nickname: 'Judge', formalName: 'Escalation Review Agent', descriptor: 'Human-in-the-loop for edge cases', layerName: 'Intelligence', badges: ['HUMAN', 'HUB'] },
      { nickname: 'Scribe', formalName: 'Audit Log Agent', descriptor: 'Records all moderation decisions', layerName: 'Operations', badges: ['ALWAYS_ON', 'LOGS_ALL'] },
    ],
  },
  {
    keywords: ['research', 'analyze', 'investigate', 'report', 'summarize'],
    agents: [
      { nickname: 'Scout', formalName: 'Research Intake Agent', descriptor: 'Parses research queries and scopes the search', layerName: 'Interface', badges: ['ENTRY', 'AUTO'] },
      { nickname: 'Scholar', formalName: 'Deep Research Agent', descriptor: 'Conducts multi-source research and synthesis', layerName: 'Intelligence', badges: ['CRITICAL', 'AUTO'] },
      { nickname: 'Critic', formalName: 'Fact-Check Agent', descriptor: 'Verifies claims and flags contradictions', layerName: 'Processing', badges: ['AUTO'] },
      { nickname: 'Herald', formalName: 'Report Generation Agent', descriptor: 'Formats findings into structured reports', layerName: 'Operations', badges: ['AUTO'] },
    ],
  },
  {
    keywords: ['deploy', 'ci/cd', 'pipeline', 'release', 'build'],
    agents: [
      { nickname: 'Foreman', formalName: 'Build Orchestrator Agent', descriptor: 'Coordinates the build and test pipeline', layerName: 'Interface', badges: ['ENTRY', 'HUB', 'CRITICAL'] },
      { nickname: 'Inspector', formalName: 'QA Gate Agent', descriptor: 'Runs tests and validates quality gates', layerName: 'Processing', badges: ['CRITICAL', 'AUTO'] },
      { nickname: 'Conductor', formalName: 'Deploy Agent', descriptor: 'Manages deployment to target environments', layerName: 'Operations', badges: ['AUTO'] },
      { nickname: 'Watchman', formalName: 'Monitoring Agent', descriptor: 'Watches post-deploy health and alerts on rollback', layerName: 'Operations', badges: ['ALWAYS_ON'] },
    ],
  },
];

function generateHeuristicSwarm(prompt: string, route: { provider: string; model: string; tier: number; available: boolean }): GenerateSwarmResult {
  const lower = prompt.toLowerCase();
  let bestMatch = TASK_AGENT_MAP[0]; // Default to moderation
  let bestScore = 0;

  for (const pattern of TASK_AGENT_MAP) {
    const score = pattern.keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }

  const generated: GeneratedSwarmInput = {
    swarmName: `${prompt.split(' ').slice(0, 4).join(' ')} Swarm`,
    description: `Auto-generated swarm for: ${prompt}`,
    agents: bestMatch.agents.map(a => ({
      ...a,
      badges: a.badges as string[],
      skills: ['task-handling'],
      modelProvider: 'nvidia',
      modelName: 'meta/llama-3.3-70b-instruct',
    })),
    relationships: bestMatch.agents.slice(0, -1).map((a, i) => ({
      sourceNickname: a.nickname,
      targetNickname: bestMatch.agents[i + 1].nickname,
      type: 'feedsInto' as const,
      description: `Sequential pipeline step`,
    })),
    topology: 'ring',
  };

  const swarm = convertToSwarm(generated);

  return {
    generated,
    swarm,
    modelUsed: { provider: route.provider, model: route.model, tier: route.tier },
    error: route.available ? undefined : 'No LLM API key configured — using heuristic fallback',
  };
}
