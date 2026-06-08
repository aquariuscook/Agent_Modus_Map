// Stage 3: Provider Router — AI SDK–backed multi-provider abstraction
// Maps our ADR-026 3-tier routing to Vercel AI SDK provider instances.
// This is the provider abstraction layer (Rec 2): all model access flows
// through this single service rather than hardcoded model strings.

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

// ── Provider configuration ──────────────────────────────────────────────────

interface ProviderConfig {
  id: string;
  name: string;
  endpoint: string;
  envKey: string; // environment variable holding the API key
  defaultModel: string;
}

const PROVIDERS: ProviderConfig[] = [
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
export function getCheapestModel(complexity: number): { model: LanguageModel | null; route: ModelRoute } {
  // Low complexity: try NVIDIA first, then OpenAI, then Anthropic
  if (complexity < 0.5) {
    const nim = getModelForTier(2);
    if (nim.model) return nim;

    // Fallback to OpenAI mini
    const openai = getModel('openai', 'gpt-4o-mini');
    if (openai) return {
      model: openai,
      route: { provider: 'openai', model: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1', tier: 2, available: true, reason: 'NVIDIA NIM unavailable, using OpenAI fallback' },
    };

    // Last resort: Anthropic Haiku
    const haiku = getModel('anthropic', 'claude-haiku-4-5-20251001');
    return {
      model: haiku,
      route: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', endpoint: 'https://api.anthropic.com/v1', tier: 3, available: !!haiku, reason: 'NVIDIA + OpenAI unavailable, using Anthropic Haiku fallback' },
    };
  }

  // High complexity: use Tier 3
  return getModelForTier(3);
}
