// Stage 3: Prompt-to-Swarm Auto-Generator
// Uses NVIDIA NIM (cheap) or Anthropic (high-quality fallback) via Vercel AI SDK
// to generate a Swarm JSON from a natural language prompt.
// Leverages the existing provider-router-service for model selection.

import { z } from 'zod';
import type { LanguageModel } from 'ai';
import { getModelForTier, getCheapestModel, NoProviderAvailableError, callGenerateObject } from './provider-router-service.js';
import type { ModelRoute } from './provider-router-service.js';
import type { Swarm, Agent, Relationship, LayerDefinition, Badge, RelationshipType, SwarmConfigRequirement } from '../../shared/types/index.js';
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
- Connect agents with relationships: feedsInto (data flows A->B), dependsOn (B needs A's output), collaboratesWith (peer-to-peer), canOverride (supervisor pattern)
- Suggest a topology: hierarchical (supervision chains), mesh (peer collaboration), ring (pipeline), star (hub-and-spoke)
- Choose cost-effective models: use nvidia/meta/llama-3.3-70b-instruct for simple agents, anthropic/claude-sonnet for complex reasoning
- Be practical: only add agents that serve a clear purpose in the workflow`;

// ── Public API ───────────────────────────────────────────────────────────────

export interface GenerateSwarmOptions {
  prompt: string;
  maxAgents?: number;
  // Prefer Tier 2 (NVIDIA NIM) for cost -- default true
  preferCheapest?: boolean;
}

export interface GenerateSwarmResult {
  generated: GeneratedSwarmInput;
  swarm: Swarm;
  modelUsed: { provider: string; model: string; tier: number };
  /** Set when the result is a heuristic fallback rather than LLM-generated */
  heuristicFallback?: 'no-provider' | 'tier-unavailable' | 'no-keyword-match' | 'llm-failed';
  error?: string;
}

/**
 * Generate a Swarm from a natural language prompt using an LLM.
 * Uses the AI SDK's generateObject() with Zod schema for structured output.
 */
export async function generateSwarmFromPrompt(options: GenerateSwarmOptions): Promise<GenerateSwarmResult> {
  const { prompt, maxAgents = 8, preferCheapest = true } = options;

  // Select model: prefer cheapest (NVIDIA NIM) for generation
  let model: LanguageModel | null;
  let route: ModelRoute;

  try {
    const selected = preferCheapest
      ? getCheapestModel(0.2) // Low complexity -> NIM preferred
      : getModelForTier(3); // High quality -> Anthropic
    model = selected.model;
    route = selected.route;
  } catch (err) {
    if (err instanceof NoProviderAvailableError) {
      // No API key configured at all -- fall back to heuristic
      return generateHeuristicSwarm(prompt, { provider: 'none', model: 'heuristic', tier: 0, available: false }, 'no-provider');
    }
    throw err;
  }

  const promptWithSystem = SYSTEM_PROMPT + `\n\nUser request: ${prompt}`;

  try {
    const result = await callGenerateObject({
      model,
      schema: GeneratedSwarmSchema,
      system: promptWithSystem,
      maxTokens: 2048,
    });

    // Build the swarm from the generated data
    const now = new Date().toISOString();
    const swarmId = uuidv7();

    // Create layers (if not already in generated)
    const layers: LayerDefinition[] = [
      { id: uuidv7(), name: 'Interface', colorTheme: '#00d9ff', order: 1 },
      { id: uuidv7(), name: 'Processing', colorTheme: '#a855f7', order: 2 },
      { id: uuidv7(), name: 'Intelligence', colorTheme: '#22c55e', order: 3 },
      { id: uuidv7(), name: 'Operations', colorTheme: '#fbbf24', order: 4 },
    ];

    // Build a layer name -> id map for agent assignment
    const layerMap = new Map(layers.map(l => [l.name.toLowerCase(), l.id]));

    // Create agents
    const agents: Agent[] = result.object.agents.map(a => {
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

    // Build nickname -> id map for relationships
    const agentMap = new Map(agents.map(a => [a.nickname.toLowerCase(), a.id]));

    // Create relationships
    const relationships: Relationship[] = result.object.relationships.map(r => ({
      id: uuidv7(),
      swarmId,
      sourceAgentId: agentMap.get(r.sourceNickname.toLowerCase()) || agents[0].id,
      targetAgentId: agentMap.get(r.targetNickname.toLowerCase()) || agents[0].id,
      type: r.type as RelationshipType,
      metadata: { description: r.description },
    }));

    // Detect configuration requirements
    const configRequirements = detectConfigurationRequirements({
      id: swarmId,
      name: result.object.swarmName,
      description: result.object.description,
      templateSource: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      layers,
      agents,
      relationships,
    }, prompt);

    const swarm: Swarm = {
      id: swarmId,
      name: result.object.swarmName,
      description: result.object.description,
      templateSource: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      layers,
      agents,
      relationships,
      configRequirements: configRequirements
    };

    return {
      generated: result.object,
      swarm,
      modelUsed: {
        provider: route.provider,
        model: route.model,
        tier: route.tier,
      },
    };
  } catch (err) {
    // Fall back to heuristic if LLM fails
    console.error('[SWARM-GEN] LLM generation failed:', err);
    return generateHeuristicSwarm(prompt, { provider: 'none', model: 'llm-failed', tier: 0, available: false }, 'llm-failed');
  }
}

// ── Heuristic fallback (no LLM required) ─────────────────────────────────────

const TASK_AGENT_MAP: Array<{ keywords: string[]; agents: Array<{ nickname: string; formalName: string; descriptor: string; layerName: string; badges: string[] }> }> = [
  {
    keywords: ['moderate', 'moderation', 'content', 'review', 'filter', 'flag'],
    agents: [
      { nickname: 'Sentinel', formalName: 'Content Intake Agent', descriptor: 'Receives and normalizes incoming content', layerName: 'Interface', badges: ['ENTRY', 'AUTO'] },
      { nickname: 'Censor', formalName: 'Policy Check Agent', descriptor: 'Applies moderation rules and flags violations', layerName: 'Processing', badges: ['CRITICAL', 'AUTO'] },
      { nickname: 'Judge', formalName: 'Escalation Review Agent', descriptor: 'Human-in-the-loop for edge cases', layerName: 'Intelligence', badges: ['HUMAN', 'HUB'] },
      { nickname: 'Scribe', formalName: 'Audit Log Agent', descriptor: 'Records all moderation decisions', layerName: 'Operations', badges: ['ALWAYS_ON'] },
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
      { nickname: 'Builder', formalName: 'Build Agent', descriptor: 'Compiles and packages source code', layerName: 'Processing', badges: ['CRITICAL', 'AUTO'] },
      { nickname: 'Tester', formalName: 'Test Agent', descriptor: 'Runs automated tests on builds', layerName: 'Intelligence', badges: ['CRITICAL', 'AUTO'] },
      { nickname: 'Deployer', formalName: 'Deployment Agent', descriptor: 'Pushes artifacts to production environments', layerName: 'Operations', badges: ['CRITICAL', 'AUTO'] },
      { nickname: 'Monitor', formalName: 'Post-Deployment Monitor', descriptor: 'Tracks deployment health and metrics', layerName: 'Operations', badges: ['ALWAYS_ON'] },
    ],
  },
  {
    keywords: ['email', 'mail', 'message'],
    agents: [
      { nickname: 'Inbox', formalName: 'Email Inbox Agent', descriptor: 'Receives and categorizes incoming emails', layerName: 'Interface', badges: ['ENTRY', 'AUTO'] },
      { nickname: 'Filter', formalName: 'Email Filter Agent', descriptor: 'Applies rules to sort and route emails', layerName: 'Processing', badges: ['CRITICAL', 'AUTO'] },
      { nickname: 'Respond', formalName: 'Auto-Response Agent', descriptor: 'Generates and sends automated replies', layerName: 'Intelligence', badges: ['AUTO'] },
      { nickname: 'Archive', formalName: 'Email Archive Agent', descriptor: 'Stores and organizes email records', layerName: 'Operations', badges: ['ALWAYS_ON'] },
    ],
  }
];

function generateHeuristicSwarm(prompt: string, route: ModelRoute, fallbackReason: GenerateSwarmResult['heuristicFallback']): GenerateSwarmResult {
  const now = new Date().toISOString();
  const swarmId = uuidv7();

  // Look for keywords that indicate email services
  const emailKeywords = ['email', 'mail', 'message', 'smtp', 'imap'];
  const hasEmailKeyword = emailKeywords.some(keyword => prompt.toLowerCase().includes(keyword));

  let agents: Agent[] = [];
  let layers: LayerDefinition[] = [
    { id: uuidv7(), name: 'Interface', colorTheme: '#00d9ff', order: 1 },
    { id: uuidv7(), name: 'Processing', colorTheme: '#a855f7', order: 2 },
    { id: uuidv7(), name: 'Intelligence', colorTheme: '#22c55e', order: 3 },
    { id: uuidv7(), name: 'Operations', colorTheme: '#fbbf24', order: 4 },
  ];

  // Select appropriate agent set
  let agentSet = TASK_AGENT_MAP[0]; // Default to moderation
  for (const task of TASK_AGENT_MAP) {
    if (task.keywords.some(keyword => prompt.toLowerCase().includes(keyword))) {
      agentSet = task;
      break;
    }
  }

  // If email-related, add email-specific configuration requirements
  const isEmailRelated = hasEmailKeyword || agentSet.keywords.includes('email');

  // Create agents from the selected set
  agents = agentSet.agents.map(a => {
    const layerId = layers.find(l => l.name === a.layerName)?.id || layers[1].id;
    return {
      id: uuidv7(),
      swarmId,
      nickname: a.nickname,
      formalName: a.formalName,
      descriptor: a.descriptor,
      layerId,
      badges: a.badges as Badge[],
      position: { x: 0, y: 0 },
      config: {
        skills: [],
        modelConfig: {
          provider: 'nvidia',
          model: 'meta/llama-3.3-70b-instruct',
        },
      },
    };
  });

  // For email-related swarms, add configuration requirements
  if (isEmailRelated) {
    // We'll add email configuration to the first agent that might need it
    for (const agent of agents) {
      if (agent.nickname === 'Inbox' || agent.nickname === 'Filter' || agent.nickname === 'Respond') {
        agent.config = {
          ...agent.config,
          emailConfig: {
            host: '',
            port: 587,
            username: '',
            password: '',
          }
        };
      }
    }
  }

  const swarm: Swarm = {
    id: swarmId,
    name: `Auto-generated swarm for: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`,
    description: `Heuristic swarm generated from prompt: "${prompt}"`,
    templateSource: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    layers,
    agents,
    relationships: [],
  };

  return {
    generated: {
      swarmName: swarm.name,
      description: swarm.description,
      agents: agentSet.agents.map(a => ({
        nickname: a.nickname,
        formalName: a.formalName,
        descriptor: a.descriptor,
        layerName: a.layerName,
        badges: a.badges,
        skills: [],
        modelProvider: 'nvidia',
        modelName: 'meta/llama-3.3-70b-instruct',
      })),
      relationships: [],
      topology: 'hierarchical',
    },
    swarm,
    modelUsed: {
      provider: route.provider,
      model: route.model,
      tier: route.tier,
    },
    heuristicFallback: fallbackReason,
  };
}

// ── New function to detect service requirements ────────────────────────

export function checkForEmailService(swarm: Swarm): boolean {
  if (!swarm || !swarm.agents) return false;

  // Check for email-related agents or keywords in agent names/descriptions
  return swarm.agents.some(agent =>
    agent.nickname?.toLowerCase().includes('email') ||
    agent.formalName?.toLowerCase().includes('email') ||
    agent.descriptor?.toLowerCase().includes('email') ||
    agent.config?.skills?.some(skill => skill.includes('email')) ||
    agent.config?.emailConfig
  );
}

// ── New function to get required configuration parameters ───────────────────

export function getEmailServiceConfigParams(swarm: Swarm): string[] {
  if (!checkForEmailService(swarm)) return [];

  // Return standard email configuration parameters needed
  return ['email_host', 'email_port', 'email_username', 'email_password'];
}

// ── New function to detect configuration requirements ────────────────────────

export function detectConfigurationRequirements(swarm: Swarm, prompt: string): SwarmConfigRequirement[] {
  const requirements: SwarmConfigRequirement[] = [];

  // Check for email services
  if (checkForEmailService(swarm)) {
    requirements.push(
      {
        id: 'email-host',
        parameterName: 'email_host',
        type: 'string',
        label: 'Email Host',
        description: 'SMTP server hostname or IP address',
        required: true,
        validationRegex: '^[a-zA-Z0-9.-]+$',
        validationMessage: 'Please enter a valid email host name'
      },
      {
        id: 'email-port',
        parameterName: 'email_port',
        type: 'number',
        label: 'Email Port',
        description: 'SMTP server port number (typically 587 or 465)',
        required: true,
        defaultValue: 587
      },
      {
        id: 'email-username',
        parameterName: 'email_username',
        type: 'string',
        label: 'Email Username',
        description: 'Email account username for authentication',
        required: true
      },
      {
        id: 'email-password',
        parameterName: 'email_password',
        type: 'password',
        label: 'Email Password',
        description: 'Email account password for authentication',
        required: true
      }
    );
  }

  // Check for database services (simplified for test)
  if (prompt.toLowerCase().includes('database') || prompt.toLowerCase().includes('db')) {
    requirements.push(
      {
        id: 'db-host',
        parameterName: 'db_host',
        type: 'string',
        label: 'Database Host',
        description: 'Database server hostname or IP address',
        required: true
      },
      {
        id: 'db-port',
        parameterName: 'db_port',
        type: 'number',
        label: 'Database Port',
        description: 'Database server port number',
        required: true,
        defaultValue: 5432
      }
    );
  }

  // Check for API services (simplified for test)
  if (prompt.toLowerCase().includes('api') || prompt.toLowerCase().includes('key')) {
    requirements.push({
      id: 'api-key',
      parameterName: 'api_key',
      type: 'password',
      label: 'API Key',
      description: 'Authentication key for external API service',
      required: true
    });
  }

  return requirements;
}