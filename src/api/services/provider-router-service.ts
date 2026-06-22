// Stage 3: Provider Router — AI SDK–backed multi-provider abstraction
// Maps our ADR-026 3-tier routing to Vercel AI SDK provider instances.
// This is the provider abstraction layer (Rec 2): all model access flows
// through this single service rather than hardcoded model strings.

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import type { z } from 'zod';
import { recordTelemetry, getLLMStats, isTelemetryEnabled, getTelemetryLogInfo } from './llm-telemetry.js';

// ── Provider configuration ──────────────────────────────────────────────────

interface ProviderConfig {
  id: string;
  name: string;
  endpoint: string;
  envKey: string; // environment variable holding the API key
  defaultModel: string;
}

const PROVIDERS: ProviderConfig[] = [
  // Auth note: uses Anthropic's OpenAI-compatible endpoint, which accepts
  // Authorization: Bearer (unlike the native API that requires x-api-key).
  // See ADR-012 "Anthropic Auth Header Compatibility" section.
  {
    id: 'anthropic',
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1',
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-6',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    endpoint: 'https://integrate.api.nvidia.com/v1',
    envKey: 'NVIDIA_API_KEY',
    defaultModel: 'meta/llama-3.3-70b-instruct',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'google',
    name: 'Google AI',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    envKey: 'GOOGLE_API_KEY',
    defaultModel: 'gemini-2.0-flash',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'ollama',
    name: 'Ollama Local',
    endpoint: 'http://localhost:11434/v1',
    envKey: 'OLLAMA_API_KEY',
    defaultModel: 'qwen3-coder:30b',
  },
];

// ── Model selection for tiers ───────────────────────────────────────────────

const TIER_MODELS: Record<number, { provider: string; model: string }> = {
  1: { provider: 'wasm-booster', model: 'codemod' }, // No LLM — deterministic
  2: { provider: 'nvidia', model: 'meta/llama-3.3-70b-instruct' },
  3: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
};

// ── Provider instance cache ─────────────────────────────────────────────────

const providerCache = new Map<string, ReturnType<typeof createOpenAICompatible>>();

function getProviderInstance(providerId: string): ReturnType<typeof createOpenAICompatible> | null {
  if (providerCache.has(providerId)) return providerCache.get(providerId)!;

  const config = PROVIDERS.find(p => p.id === providerId);
  if (!config) return null;

  const apiKey = process.env[config.envKey];
  if (!apiKey) return null;

  const instance = createOpenAICompatible({
    name: config.id,
    baseURL: config.endpoint,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  providerCache.set(providerId, instance);
  return instance;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ModelRoute {
  provider: string;
  model: string;
  endpoint: string;
  tier: number;
  available: boolean;
  reason?: string;
}

/** Thrown when no LLM provider has an API key configured. */
export class NoProviderAvailableError extends Error {
  constructor(
    message = 'No LLM provider available — configure at least one API key (NVIDIA_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY)',
  ) {
    super(message);
    this.name = 'NoProviderAvailableError';
  }
}

/**
 * Get a LanguageModel instance for a given provider + model.
 * This is the core abstraction: callers never touch provider internals.
 */
export function getModel(providerId: string, modelId?: string): LanguageModel | null {
  const instance = getProviderInstance(providerId);
  if (!instance) return null;
  const config = PROVIDERS.find(p => p.id === providerId)!;
  const model = modelId || config.defaultModel;
  return instance.languageModel(model);
}

/**
 * Get the model for a specific tier (ADR-026 routing).
 */
export function getModelForTier(tier: number): { model: LanguageModel | null; route: ModelRoute } {
  const tierConfig = TIER_MODELS[tier] || TIER_MODELS[3]; // Default to Tier 3
  const providerConfig = PROVIDERS.find(p => p.id === tierConfig.provider);

  const model = getModel(tierConfig.provider, tierConfig.model);

  return {
    model,
    route: {
      provider: tierConfig.provider,
      model: tierConfig.model,
      endpoint: providerConfig?.endpoint || '',
      tier,
      available: model !== null,
      reason: model === null
        ? `Missing API key: ${providerConfig?.envKey || 'unknown'}`
        : undefined,
    },
  };
}

/**
 * List all configured providers with their availability status.
 */
export function listProviders(): Array<ProviderConfig & { available: boolean }> {
  return PROVIDERS.map(p => ({
    ...p,
    available: !!process.env[p.envKey],
  }));
}

/**
 * Get the cheapest available model for a given complexity level.
 * Falls back through providers if the preferred one isn't available.
 */
export function getCheapestModel(complexity: number): { model: LanguageModel; route: ModelRoute } {
  // Low complexity: try NVIDIA first, then OpenAI, then Anthropic
  if (complexity < 0.5) {
    const nim = getModelForTier(2);
    if (nim.model) return { model: nim.model, route: nim.route };

    // Fallback to OpenAI mini
    const openai = getModel('openai', 'gpt-4o-mini');
    if (openai) return {
      model: openai,
      route: { provider: 'openai', model: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1', tier: 2, available: true, reason: 'NVIDIA NIM unavailable, using OpenAI fallback' },
    };

    // Last resort: Anthropic Haiku
    const haiku = getModel('anthropic', 'claude-haiku-4-5-20251001');
    if (!haiku) throw new NoProviderAvailableError();
    return {
      model: haiku,
      route: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', endpoint: 'https://api.anthropic.com/v1', tier: 3, available: true, reason: 'NVIDIA + OpenAI unavailable, using Anthropic Haiku fallback' },
    };
  }

  // High complexity: try Tier 3 first, then degrade to cheaper providers
  const anthropic = getModelForTier(3);
  if (anthropic.model) return { model: anthropic.model, route: anthropic.route };

  // Fallback to OpenAI gpt-4o (near-Tier-3 quality)
  const openai = getModel('openai', 'gpt-4o');
  if (openai) return {
    model: openai,
    route: { provider: 'openai', model: 'gpt-4o', endpoint: 'https://api.openai.com/v1', tier: 3, available: true, reason: 'Anthropic unavailable, using OpenAI GPT-4o fallback' },
  };

  // Last resort: use NVIDIA NIM as a degraded high-complexity option
  const nim = getModel('nvidia', 'meta/llama-3.3-70b-instruct');
  if (!nim) throw new NoProviderAvailableError();
  return {
    model: nim,
    route: { provider: 'nvidia', model: 'meta/llama-3.3-70b-instruct', endpoint: 'https://integrate.api.nvidia.com/v1', tier: 2, available: true, reason: 'Anthropic + OpenAI unavailable, using NVIDIA NIM as degraded fallback' },
  };
}

// ── Telemetry-wrapped AI SDK calls ──────────────────────────────────────────

/** Callback for streaming lifecycle updates to callers (e.g. SSE to frontend). */
export type StatusCallback = (event: { step: string; [key: string]: any }) => void;

export interface CallLLMOptions {
  /** Who is making this call (e.g. 'interview', 'swarm-generator') */
  caller: string;
  /** Provider+route info from getCheapestModel/getModelForTier */
  route: ModelRoute;
  /** The LanguageModel from the route */
  model: LanguageModel;
  /** Optional callback to emit lifecycle status events (selecting-model, sending-request, etc.) */
  onStatus?: StatusCallback;
}

/**
 * generateText() with telemetry. Accepts the same options as the SDK,
 * plus caller/route tracking. Returns the full AI SDK result.
 */
export async function callGenerateText(
  opts: CallLLMOptions,
  params: Record<string, any>,
): Promise<any> {
  // Emit lifecycle: selecting model
  opts.onStatus?.({
    step: 'selecting-model',
    provider: opts.route.provider,
    model: opts.route.model,
    tier: opts.route.tier,
  });

  // Emit lifecycle: sending request (count messages/tools if available)
  const messageCount = params.messages?.length ?? (params.prompt ? 1 : 0);
  const toolCount = params.tools?.length ?? 0;
  opts.onStatus?.({
    step: 'sending-request',
    messageCount,
    toolCount,
    provider: opts.route.provider,
    model: opts.route.model,
  });

  // Emit lifecycle: waiting for response
  opts.onStatus?.({
    step: 'waiting-response',
    provider: opts.route.provider,
    model: opts.route.model,
  });

  const start = Date.now();
  try {
    const result = await generateText({ model: opts.model, ...params } as any);
    const elapsed = Date.now() - start;

    // Emit lifecycle: response received
    opts.onStatus?.({
      step: 'response-received',
      durationMs: elapsed,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      cachedTokens: result.usage?.inputTokenDetails?.cacheReadTokens,
      provider: opts.route.provider,
    });

    recordTelemetry({
      caller: opts.caller,
      provider: opts.route.provider,
      model: opts.route.model,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      cachedTokens: result.usage?.inputTokenDetails?.cacheReadTokens,
      durationMs: elapsed,
      success: true,
    });

    return result;
  } catch (err: any) {
    const elapsed = Date.now() - start;

    // Emit lifecycle: error
    opts.onStatus?.({
      step: 'error',
      durationMs: elapsed,
      provider: opts.route.provider,
      model: opts.route.model,
      error: err.message,
    });

    recordTelemetry({
      caller: opts.caller,
      provider: opts.route.provider,
      model: opts.route.model,
      inputTokens: undefined,
      outputTokens: undefined,
      cachedTokens: undefined,
      durationMs: elapsed,
      success: false,
      error: err.message,
    });
    throw err;
  }
}

/**
 * generateObject() with telemetry. Accepts the same options as the SDK,
 * plus caller/route tracking. Returns the full AI SDK result.
 */
export async function callGenerateObject<T extends z.ZodType>(
  opts: CallLLMOptions,
  params: Record<string, any> & { schema: T },
): Promise<any> {
  // Emit lifecycle: selecting model
  opts.onStatus?.({
    step: 'selecting-model',
    provider: opts.route.provider,
    model: opts.route.model,
    tier: opts.route.tier,
  });

  // Emit lifecycle: sending request
  const promptInfo = params.prompt ? 'single prompt' : `${params.messages?.length ?? 0} messages`;
  opts.onStatus?.({
    step: 'sending-request',
    messageCount: params.messages?.length ?? (params.prompt ? 1 : 0),
    toolCount: 0,
    provider: opts.route.provider,
    model: opts.route.model,
  });

  // Emit lifecycle: waiting for response
  opts.onStatus?.({
    step: 'waiting-response',
    provider: opts.route.provider,
    model: opts.route.model,
  });

  const start = Date.now();
  try {
    const result = await generateObject({ model: opts.model, ...params } as any);
    const elapsed = Date.now() - start;

    // Emit lifecycle: response received
    opts.onStatus?.({
      step: 'response-received',
      durationMs: elapsed,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      cachedTokens: result.usage?.inputTokenDetails?.cacheReadTokens,
      provider: opts.route.provider,
    });

    recordTelemetry({
      caller: opts.caller,
      provider: opts.route.provider,
      model: opts.route.model,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      cachedTokens: result.usage?.inputTokenDetails?.cacheReadTokens,
      durationMs: elapsed,
      success: true,
    });

    return result;
  } catch (err: any) {
    const elapsed = Date.now() - start;

    // Emit lifecycle: error
    opts.onStatus?.({
      step: 'error',
      durationMs: elapsed,
      provider: opts.route.provider,
      model: opts.route.model,
      error: err.message,
    });

    recordTelemetry({
      caller: opts.caller,
      provider: opts.route.provider,
      model: opts.route.model,
      inputTokens: undefined,
      outputTokens: undefined,
      cachedTokens: undefined,
      durationMs: elapsed,
      success: false,
      error: err.message,
    });
    throw err;
  }
}

// Re-export telemetry utilities for consumers that need them
export { getLLMStats, isTelemetryEnabled, getTelemetryLogInfo };
