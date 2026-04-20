// Interview Engine: State machine + LLM-powered conversational swarm builder
// Implements ADR-004-A: State machine governs phases, LLM governs language
import Anthropic from '@anthropic-ai/sdk';

export type InterviewPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface InterviewState {
  id: string;
  phase: InterviewPhase;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  extracted: {
    goal?: string;
    successCriteria?: string;
    industries?: string[];
    dataSources?: string[];
    systems?: string[];
    volume?: string;
    frequency?: string;
    autonomyPreferences?: Record<string, string>;
    humanApprovalTriggers?: string[];
    complianceContext?: string;
    riskTolerance?: string;
    auditNeeds?: string;
    apiKeysNeeded?: string[];
    apiKeysConfigured?: string[];
    swarmConfig?: GeneratedSwarmConfig;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedSwarmConfig {
  name: string;
  description: string;
  goal: string;
  layers: Array<{ name: string; colorTheme: string; order: number }>;
  agents: Array<{
    nickname: string;
    formalName: string;
    descriptor: string;
    layerIndex: number;
    badges: string[];
    coreTask: string;
    autonomyLevel: string;
    positionIndex: number;
  }>;
  relationships: Array<{
    sourceNickname: string;
    targetNickname: string;
    type: 'feedsInto' | 'dependsOn' | 'collaboratesWith' | 'canOverride';
  }>;
}

// Phase definitions
const PHASE_CONFIG: Record<InterviewPhase, {
  name: string;
  description: string;
  systemContext: string;
  completionCheck: (state: InterviewState) => boolean;
}> = {
  0: {
    name: 'Prompt Intake',
    description: 'Understanding what the user wants their agents to do',
    systemContext: `You are starting a conversation to understand what kind of AI agent swarm the user needs. Your job in this phase is to understand their goal clearly.

Ask them to describe what they want their agents to do. If they give a clear answer, summarize what you understood and confirm. If vague, ask one clarifying question.

Be conversational and direct. No corporate speak. Think of yourself as a smart consultant in a first meeting.

At the end of your response, include a JSON block:
\`\`\`phase_data
{"goal": "their stated goal", "ready_to_advance": true/false}
\`\`\``,
    completionCheck: (state) => !!state.extracted.goal,
  },
  1: {
    name: 'Goal Refinement',
    description: 'Defining what success looks like',
    systemContext: `You are refining the user's goal. You already know what they want to build (it's in the conversation history).

Now ask: What does success look like? How will they know the swarm is working? What's the measurable outcome?

Keep it to 1-2 questions max. If they already described success criteria in their initial prompt, acknowledge that and confirm rather than asking again.

At the end, include:
\`\`\`phase_data
{"successCriteria": "what success looks like", "ready_to_advance": true/false}
\`\`\``,
    completionCheck: (state) => !!state.extracted.successCriteria,
  },
  2: {
    name: 'Scope & Boundaries',
    description: 'Understanding data sources, systems, scale',
    systemContext: `You are scoping the swarm. You know the goal and success criteria.

Ask about:
- What data sources or systems does this involve? (email, CRM, databases, APIs, spreadsheets, websites)
- How much volume? (10 items/day or 10,000/day)
- How often should it run? (real-time, daily, weekly, on-demand)

If they already mentioned these in earlier answers, confirm rather than re-asking. Max 2 questions.

At the end, include:
\`\`\`phase_data
{"dataSources": ["list"], "systems": ["list"], "volume": "description", "frequency": "description", "ready_to_advance": true/false}
\`\`\``,
    completionCheck: (state) => !!(state.extracted.dataSources?.length || state.extracted.systems?.length),
  },
  3: {
    name: 'Decision Authority',
    description: 'What the swarm can decide alone vs. needs human approval',
    systemContext: `You are establishing decision authority for the swarm. This is critical for governance.

Ask:
- What decisions should the agents be able to make on their own? (e.g., categorize data, draft emails, score leads)
- What decisions MUST have a human approve them first? (e.g., send emails, make purchases, delete data, contact customers)
- Is there anything the agents should NEVER do?

This directly sets autonomy levels and human-in-loop triggers. Be specific. One question at a time.

At the end, include:
\`\`\`phase_data
{"autonomyPreferences": {"autonomous": "what agents can do alone", "humanApproval": "what needs human sign-off", "never": "what agents must never do"}, "humanApprovalTriggers": ["list of specific triggers"], "ready_to_advance": true/false}
\`\`\``,
    completionCheck: (state) => !!(state.extracted.autonomyPreferences && Object.keys(state.extracted.autonomyPreferences).length > 0),
  },
  4: {
    name: 'Compliance & Risk',
    description: 'Regulatory context, error tolerance, audit needs',
    systemContext: `You are assessing compliance and risk requirements. Adapt based on what you know about their industry.

If they mentioned healthcare, ask about HIPAA. Finance, ask about SOX/PCI. Legal, ask about client confidentiality. If no specific industry, ask generally:
- Are there any regulations or compliance requirements that apply?
- How bad is it if the swarm makes a mistake? (annoying vs. costly vs. catastrophic)
- Do you need an audit trail of every decision the agents make?

If the user's use case is low-risk (personal productivity, content creation), keep this brief. Don't manufacture compliance concerns for a todo list app.

At the end, include:
\`\`\`phase_data
{"complianceContext": "relevant regulations or 'none'", "riskTolerance": "low/medium/high", "auditNeeds": "description", "ready_to_advance": true/false}
\`\`\``,
    completionCheck: (state) => !!state.extracted.riskTolerance,
  },
  5: {
    name: 'API & Integrations',
    description: 'What services are needed and which keys are configured',
    systemContext: `You are identifying which API keys and integrations the swarm needs.

Based on the conversation so far, you should know what tools and services are required. Tell the user:
1. Which API keys are needed for their swarm to work
2. Which keys are already configured (this info is provided to you)
3. For any missing keys, briefly explain what they do and that they can add them in Settings

Be practical. Every swarm needs an Anthropic key at minimum. If their use case involves web search, mention Tavily. If email finding, mention Hunter.io.

Don't make this feel like a setup wizard. Keep it conversational: "For your lead gen swarm, we'll need your Claude API key (already set up) and Tavily for web search (also set). You're good to go."

At the end, include:
\`\`\`phase_data
{"apiKeysNeeded": ["anthropic", "tavily", etc], "ready_to_advance": true/false}
\`\`\``,
    completionCheck: (state) => !!(state.extracted.apiKeysNeeded?.length),
  },
  6: {
    name: 'Swarm Review',
    description: 'Review and tune the generated swarm before deploy',
    systemContext: `You are presenting the generated swarm configuration to the user for review.

The swarm config has been generated (it will be provided to you). Present it clearly:
- Name each agent with its role
- Explain what each agent does in plain language
- Highlight the autonomy settings (what needs human approval)
- Mention the relationships between agents

Ask if they want to change anything: rename agents, adjust autonomy, add/remove agents, change relationships.

If they're happy, tell them to click "Deploy Swarm" to launch it.

At the end, include:
\`\`\`phase_data
{"approved": true/false, "changes": ["list of requested changes if any"]}
\`\`\``,
    completionCheck: (state) => !!state.extracted.swarmConfig,
  },
};

// SQLite-backed interview store
import { getDb } from '../db/database.js';

function ensureTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      phase INTEGER NOT NULL DEFAULT 0,
      messages TEXT NOT NULL DEFAULT '[]',
      extracted TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

let tableReady = false;
function getTable() {
  if (!tableReady) { ensureTable(); tableReady = true; }
}

function saveState(state: InterviewState): void {
  getTable();
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO interviews (id, phase, messages, extracted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(state.id, state.phase, JSON.stringify(state.messages), JSON.stringify(state.extracted), state.createdAt, state.updatedAt);
}

function loadState(id: string): InterviewState | null {
  getTable();
  const db = getDb();
  const row = db.prepare('SELECT * FROM interviews WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    phase: row.phase as InterviewPhase,
    messages: JSON.parse(row.messages),
    extracted: JSON.parse(row.extracted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateId(): string {
  return `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createInterview(): InterviewState {
  const state: InterviewState = {
    id: generateId(),
    phase: 0,
    messages: [],
    extracted: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveState(state);
  return state;
}

export function getInterview(id: string): InterviewState | null {
  return loadState(id);
}

export function listInterviews(): Array<{ id: string; phase: InterviewPhase; goal: string; updatedAt: string }> {
  getTable();
  const db = getDb();
  const rows = db.prepare('SELECT id, phase, extracted, updated_at FROM interviews ORDER BY updated_at DESC LIMIT 10').all() as any[];
  return rows.map(r => {
    const extracted = JSON.parse(r.extracted);
    return {
      id: r.id,
      phase: r.phase as InterviewPhase,
      goal: extracted.goal || 'In progress...',
      updatedAt: r.updated_at,
    };
  });
}

export async function processInterviewMessage(
  interviewId: string,
  userMessage: string,
): Promise<{ response: string; state: InterviewState; phaseAdvanced: boolean }> {
  const state = loadState(interviewId);
  if (!state) throw new Error('Interview not found. It may have been deleted.');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key not configured. Add it in Settings.');

  // Add user message to history
  state.messages.push({ role: 'user', content: userMessage });

  const phaseConfig = PHASE_CONFIG[state.phase];
  const previousPhase = state.phase;

  // Build the system prompt for this phase
  const configuredKeys: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) configuredKeys.push('anthropic');
  if (process.env.TAVILY_API_KEY) configuredKeys.push('tavily');
  if (process.env.HUNTER_API_KEY) configuredKeys.push('hunter');

  let systemPrompt = `You are the Agent Modus interview engine. You are helping a user design a custom AI agent swarm through conversation.

Current phase: ${state.phase} - ${phaseConfig.name}
Phase description: ${phaseConfig.description}

${phaseConfig.systemContext}

Already configured API keys: ${configuredKeys.join(', ') || 'none'}

Previously extracted information:
${JSON.stringify(state.extracted, null, 2)}

RULES:
- Never ask more than 2 questions at a time
- Never ask a question you can infer from previous answers
- If the user answers multiple phases worth of questions in one message, extract all the info and advance accordingly
- Be direct and conversational. No corporate speak.
- Always include the phase_data JSON block at the end of your response`;

  // For Phase 6, generate the swarm config first
  if (state.phase === 6 && !state.extracted.swarmConfig) {
    const config = await generateSwarmConfig(state, apiKey);
    state.extracted.swarmConfig = config;
    systemPrompt += `\n\nGenerated swarm configuration:\n${JSON.stringify(config, null, 2)}`;
  } else if (state.phase === 6 && state.extracted.swarmConfig) {
    systemPrompt += `\n\nCurrent swarm configuration:\n${JSON.stringify(state.extracted.swarmConfig, null, 2)}`;
  }

  // Call Claude
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: systemPrompt,
    messages: state.messages.map(m => ({ role: m.role, content: m.content })),
  });

  const assistantMessage = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('');

  // Extract phase data from the response
  const phaseDataMatch = assistantMessage.match(/```phase_data\s*([\s\S]*?)```/);
  if (phaseDataMatch) {
    try {
      const phaseData = JSON.parse(phaseDataMatch[1].trim());
      // Merge extracted data
      if (phaseData.goal) state.extracted.goal = phaseData.goal;
      if (phaseData.successCriteria) state.extracted.successCriteria = phaseData.successCriteria;
      if (phaseData.dataSources) state.extracted.dataSources = phaseData.dataSources;
      if (phaseData.systems) state.extracted.systems = phaseData.systems;
      if (phaseData.volume) state.extracted.volume = phaseData.volume;
      if (phaseData.frequency) state.extracted.frequency = phaseData.frequency;
      if (phaseData.autonomyPreferences) state.extracted.autonomyPreferences = phaseData.autonomyPreferences;
      if (phaseData.humanApprovalTriggers) state.extracted.humanApprovalTriggers = phaseData.humanApprovalTriggers;
      if (phaseData.complianceContext) state.extracted.complianceContext = phaseData.complianceContext;
      if (phaseData.riskTolerance) state.extracted.riskTolerance = phaseData.riskTolerance;
      if (phaseData.auditNeeds) state.extracted.auditNeeds = phaseData.auditNeeds;
      if (phaseData.apiKeysNeeded) state.extracted.apiKeysNeeded = phaseData.apiKeysNeeded;

      // State machine: advance phase if ready
      if (phaseData.ready_to_advance && state.phase < 6) {
        const nextPhase = (state.phase + 1) as InterviewPhase;
        state.phase = nextPhase;
      }
    } catch { /* phase data parse failed, stay in current phase */ }
  }

  // Clean the response (remove the phase_data block before showing to user)
  const cleanResponse = assistantMessage.replace(/```phase_data[\s\S]*?```/g, '').trim();

  state.messages.push({ role: 'assistant', content: cleanResponse });
  state.updatedAt = new Date().toISOString();

  // Persist to database after every message
  saveState(state);

  return {
    response: cleanResponse,
    state,
    phaseAdvanced: state.phase !== previousPhase,
  };
}

async function generateSwarmConfig(state: InterviewState, apiKey: string): Promise<GeneratedSwarmConfig> {
  const client = new Anthropic({ apiKey });

  const prompt = `Based on this interview, generate a complete swarm configuration as JSON.

Interview data:
${JSON.stringify(state.extracted, null, 2)}

Full conversation:
${state.messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

Generate a swarm with:
- A clear, short name (2-4 words)
- A one-line description
- 3-4 layers organized by function (use colors: #00d9ff, #a855f7, #22c55e, #fbbf24)
- 6-15 agents, each with:
  - nickname (short, memorable, descriptive)
  - formalName (hyphenated formal name like Research-Prospect-Identify)
  - descriptor (2-3 word description like "The Opportunity Finder")
  - coreTask (2-3 sentences describing what this agent does)
  - autonomyLevel: "Fully Automated", "Human-in-Loop", "Hybrid", or "Advisory Only"
  - badges: from ENTRY, CRITICAL, APPROVAL, HUMAN, AUTO, HUB, ALWAYS_ON, HIGH_PRIORITY, ADVISORY, LOGS_ALL
- Relationships between agents: feedsInto, dependsOn, collaboratesWith, canOverride

The autonomy levels should reflect what the user said about decision authority.
Agents that handle things the user said need human approval should be "Human-in-Loop" with APPROVAL badge.
Agents that do things the user said should never happen should not exist.

Output ONLY valid JSON matching this schema:
{
  "name": "string",
  "description": "string",
  "goal": "string",
  "layers": [{"name": "string", "colorTheme": "#hex", "order": number}],
  "agents": [{"nickname": "string", "formalName": "string", "descriptor": "string", "layerIndex": number, "badges": ["string"], "coreTask": "string", "autonomyLevel": "string", "positionIndex": number}],
  "relationships": [{"sourceNickname": "string", "targetNickname": "string", "type": "feedsInto|dependsOn|collaboratesWith|canOverride"}]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 4000,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Find the JSON object
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('No JSON in config generation response');

  let depth = 0;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    if (cleaned[i] === '}') depth--;
    if (depth === 0) { end = i; break; }
  }

  if (end === -1) {
    // Truncated, try to repair
    let truncated = cleaned.slice(start);
    let openBraces = 0, openBrackets = 0;
    for (const ch of truncated) {
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }
    truncated += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
    return JSON.parse(truncated);
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

export function deployInterviewSwarm(interviewId: string): GeneratedSwarmConfig | null {
  const state = loadState(interviewId);
  if (!state?.extracted.swarmConfig) return null;
  return state.extracted.swarmConfig;
}
