import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { RAGService } from '../services/rag-service.js';
import { SwarmService } from '../services/swarm-service.js';
import {
  getCheapestModel,
  callGenerateText,
  NoProviderAvailableError,
  listProviders,
} from '../services/provider-router-service.js';
import type { StatusCallback } from '../services/provider-router-service.js';

type Req = Request<Record<string, string>>;

/** Build the copilot system prompt with current context. */
function buildCopilotSystemPrompt(swarmId: string | undefined, swarmService: SwarmService): string {
  const providers = listProviders();
  const hasAnthropicKey = providers.find(p => p.id === 'anthropic')?.available ?? false;
  const hasTavilyKey = !!process.env.TAVILY_API_KEY;
  const hasHunterKey = !!process.env.HUNTER_API_KEY;

  let swarmContext = '';
  if (swarmId) {
    const swarm = swarmService.findById(swarmId);
    if (swarm) {
      swarmContext = `\n\nCurrent swarm: "${swarm.name}" with ${swarm.agents.length} agents and ${swarm.relationships.length} relationships.
Agents: ${swarm.agents.map(a => `${a.nickname} (${a.descriptor})`).join(', ')}
Layers: ${swarm.layers.map(l => l.name).join(', ')}`;
    }
  }

  return `You are the Agent Modus copilot. You help users design, test, and deploy AI agent swarms. You live inside the Agent Modus app.

About Agent Modus:
- A visual, no-code tool for designing multi-agent AI systems
- Users create swarms of AI agents on a canvas, connect them with relationships, configure each agent's autonomy/guardrails, test with mock and live runs, and deploy
- Each agent has: nickname, formal name, descriptor, badges (ENTRY, CRITICAL, APPROVAL, HUMAN, AUTO, HUB), autonomy level, core task, and guardrails
- Relationships: feedsInto (data flow), dependsOn (prerequisite), collaboratesWith (parallel work), canOverride (exception handling)
- 4 modes: Build (design), Watch (monitor), Test (simulate/live test), Ship (deploy/export)
- Templates available: Customer Service, Content Operations, Research Assistant, Sales & CRM, HR Onboarding, Consulting Lead Gen, Personal Assistant, Social Media Manager

Current API key status:
- Claude API: ${hasAnthropicKey ? 'Connected' : 'NOT SET (required for live tests and deploy)'}
- Tavily (web search): ${hasTavilyKey ? 'Connected' : 'NOT SET (needed for prospect research)'}
- Hunter.io (email finder): ${hasHunterKey ? 'Connected' : 'NOT SET (needed for verified email addresses)'}
${swarmContext}

How to help users:
- If they want to find leads/prospects: Guide them to use the Lead Gen template, write a specific query (include industry, location, company size), and deploy
- If they need API keys: Walk them through getting each key step by step. Anthropic: anthropic.com, Tavily: tavily.com, Hunter: hunter.io
- If they want to build a custom swarm: Help them think through what agents they need, what each one does, and how they connect
- If something isn't working: Ask what they see, diagnose the issue, suggest fixes
- If they want to understand what an agent does: Explain based on the swarm context

Be direct, helpful, and concise. Don't use corporate speak. Talk like a smart colleague helping them get things done. If you don't know something, say so.`;
}

export function createIntelligenceRoutes(db: Database.Database): Router {
  const router = Router();
  const ragService = new RAGService(db);
  const swarmService = new SwarmService(db);

  // POST /api/intelligence/ask
  router.post('/ask', async (req: Req, res: Response) => {
    const { question, swarmId } = req.body;
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'validation', message: 'Question is required.' });
      return;
    }

    const sid = swarmId || 'ecommerce-standard-v1';
    try {
      const result = await ragService.queryWithLLM(sid, question);
      res.json({ data: result });
    } catch {
      // Fall back to non-LLM query
      const result = ragService.query(sid, question);
      res.json({ data: result });
    }
  });

  // POST /api/intelligence/copilot - AI copilot (non-streaming, routes through provider-router)
  router.post('/copilot', async (req: Req, res: Response) => {
    const { messages, swarmId } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'validation', message: 'Messages array required.' });
      return;
    }

    try {
      const { model, route } = getCheapestModel(0.4); // Low complexity — copilot chat
      const systemPrompt = buildCopilotSystemPrompt(swarmId, swarmService);

      const result = await callGenerateText(
        { caller: 'copilot', route, model },
        {
          system: systemPrompt,
          messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          maxTokens: 1000,
        },
      );

      res.json({ data: { answer: result.text, usage: result.usage } });
    } catch (err: any) {
      if (err instanceof NoProviderAvailableError) {
        res.status(503).json({
          error: 'config',
          message: 'Add any LLM API key in Settings (Anthropic, NVIDIA, or OpenAI) to use the copilot.',
        });
        return;
      }
      res.status(500).json({ error: 'llm', message: err.message || 'Failed to get response.' });
    }
  });

  // POST /api/intelligence/copilot-stream - SSE streaming variant
  // Emits lifecycle status events during LLM call, then a final result event.
  router.post('/copilot-stream', async (req: Req, res: Response) => {
    const { messages, swarmId } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'validation', message: 'Messages array required.' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const onStatus: StatusCallback = (event) => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'status', ...event })}\n\n`);
      } catch {
        // Client likely disconnected
      }
    };

    try {
      const { model, route } = getCheapestModel(0.4); // Low complexity — copilot chat
      const systemPrompt = buildCopilotSystemPrompt(swarmId, swarmService);

      const result = await callGenerateText(
        { caller: 'copilot', route, model, onStatus },
        {
          system: systemPrompt,
          messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          maxTokens: 1000,
        },
      );

      // Send final result event
      res.write(`data: ${JSON.stringify({
        type: 'result',
        answer: result.text,
        usage: result.usage,
      })}\n\n`);
    } catch (err: any) {
      if (err instanceof NoProviderAvailableError) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Add any LLM API key in Settings (Anthropic, NVIDIA, or OpenAI) to use the copilot.',
        })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: err.message || 'Failed to get response.',
        })}\n\n`);
      }
    } finally {
      res.end();
    }
  });

  return router;
}
