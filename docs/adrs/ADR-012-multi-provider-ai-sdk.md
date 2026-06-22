# ADR-012: Multi-Provider LLM Support via Vercel AI SDK

## Status
Accepted

## Context
Agent Modus Map is an multi-agent swarm design tool. The "prompt-to-swarm" auto-generator feature needs to call LLMs from multiple providers (Anthropic, NVIDIA NIM, OpenAI, Google) with different cost/performance profiles. Before this decision, the codebase had:

- **Hardcoded model strings** scattered in service files — no central provider registry
- **No provider abstraction** — each call site would need its own HTTP client, auth headers, and response parser per provider
- **No structured output** — LLM responses would be freeform text requiring manual parsing, regex, and validation
- **No tiered routing** — no way to route simple tasks to cheap models and complex tasks to powerful ones

NVIDIA NIM was being added as a Tier 2 provider (cheap, OpenAI-compatible endpoint) to complement Anthropic as Tier 3. OpenAI and Google were desirable future options. Without a unified layer, adding each new provider meant writing a new HTTP client, error handler, and response mapper — multiplicative work.

### Alternatives Considered

| Approach | Pros | Cons |
|---|---|---|
| **Raw `fetch()` per provider** | Zero dependencies | Must write auth, retry, streaming, error handling for each provider — O(n) code |
| **Each provider's native SDK** | Type-safe per provider | 4+ SDKs to install, update, and reconcile; incompatible response shapes |
| **LangChain** | Rich ecosystem, many integrations | Heavy dependency tree; pulls in more than needed; response format varies by model |
| **Vercel AI SDK** (`ai` + `@ai-sdk/openai-compatible`) | One interface for all OpenAI-compatible providers; built-in structured output via Zod; lightweight | Less mature than LangChain; Google native provider requires separate package |

## Decision
Adopt the **Vercel AI SDK** (`ai` v6 + `@ai-sdk/openai-compatible`) as the unified LLM provider abstraction layer. All model access will flow through `provider-router-service.ts`, which uses the SDK's `createOpenAICompatible()` to instantiate provider clients. No service file will call a provider SDK or `fetch()` directly.

### Provider Registry

A single `PROVIDERS` array in `provider-router-service.ts` defines every available provider:

```typescript
const PROVIDERS: ProviderConfig[] = [
  { id: 'anthropic', endpoint: 'https://api.anthropic.com/v1',     envKey: 'ANTHROPIC_API_KEY', defaultModel: 'claude-sonnet-4-6' },
  { id: 'nvidia',    endpoint: 'https://integrate.api.nvidia.com/v1', envKey: 'NVIDIA_API_KEY',    defaultModel: 'meta/llama-3.3-70b-instruct' },
  { id: 'openai',    endpoint: 'https://api.openai.com/v1',        envKey: 'OPENAI_API_KEY',    defaultModel: 'gpt-4o-mini' },
  { id: 'google',    endpoint: 'https://generativelanguage.googleapis.com/v1beta', envKey: 'GOOGLE_API_KEY', defaultModel: 'gemini-2.0-flash' },
];
```

Adding a new provider = one object + one API key. No code changes elsewhere.

### 3-Tier Model Routing

Aligns with the existing Ruflo ADR-026 routing pattern:

| Tier | Handler | Use Cases | Cost |
|---|---|---|---|
| 1 | WASM Agent Booster (deterministic codemods) | `var-to-const`, `remove-console`, `add-logging` | $0 *(future — not yet implemented)* |
| 2 | NVIDIA NIM (open-weight models) | Low-complexity tasks, prompt-to-swarm generation | ~$0.20/1M tokens |
| 3 | Anthropic Sonnet/Opus | Architecture, security, complex reasoning | ~$3/1M tokens |

### Structured Output via `generateObject()`

The SDK's `generateObject()` function accepts a Zod schema and guarantees the LLM response conforms to it:

```typescript
const result = await generateObject({
  model,                              // any provider → same call signature
  schema: GeneratedSwarmSchema,       // Zod schema = the output mold
  system: SYSTEM_PROMPT,
  prompt: 'Design a swarm for: ...',
});
const generated = result.object;      // typed, validated, no manual parsing
```

Without the SDK, this would require:
- Prompt engineering ("respond in JSON matching this schema")
- Manual JSON extraction from freeform text
- Zod validation + retry on parse failures
- Provider-specific format quirks

The SDK handles all of this internally.

### Provider Fallback Chain

`getCheapestModel(complexity)` falls back through available providers:

**Low complexity (`complexity < 0.5`):**
1. NVIDIA NIM (preferred for low complexity)
2. OpenAI `gpt-4o-mini` (if NIM unavailable)
3. Anthropic `claude-haiku-4-5-20251001` (last resort)

**High complexity (`complexity >= 0.5`):**
1. Anthropic `claude-sonnet-4-6` (preferred for complex reasoning)
2. OpenAI `gpt-4o` (if Anthropic unavailable)
3. NVIDIA NIM `meta/llama-3.3-70b-instruct` (degraded last resort)

If **no provider** has an API key configured, `getCheapestModel()` throws `NoProviderAvailableError` instead of returning a `null` model. Callers should catch this and fall back to heuristic generation.

Each fallback is automatic — the caller never specifies a provider, only a complexity level.

### Heuristic Fallback (No LLM Required)

When no API key is configured at all (or `NoProviderAvailableError` is thrown), `swarm-generator-service.ts` falls back to keyword-matching heuristics (`TASK_AGENT_MAP`). If no keywords match the prompt, a **generic single-agent starter swarm** is returned instead of silently using the wrong template. This ensures the prompt-to-swarm feature works offline or in sandboxed environments, and communicates honestly when it can't infer intent.

## Detailed Design

### New Files

| File | Purpose |
|---|---|
| `src/api/services/provider-router-service.ts` | Provider registry, `createOpenAICompatible()` instances, tier routing, fallback chain |
| `src/api/services/swarm-generator-service.ts` | Prompt-to-swarm using `generateObject()` + heuristic fallback |

### New Dependencies

| Package | Version | Purpose |
|---|---|---|
| `ai` | 6.x | Core AI SDK: `generateObject()`, `LanguageModel` type |
| `@ai-sdk/openai-compatible` | 2.x | `createOpenAICompatible()` for all OpenAI-compatible endpoints |

### New API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/swarms/generate` | Prompt-to-swarm auto-generator |
| `POST` | `/api/swarms/:id/cli-bridge` | Visual → CLI command bridge |

### Anthropic Auth Header Compatibility

The `@ai-sdk/openai-compatible` package sends `Authorization: Bearer <key>` for all providers. Anthropic's **native** API (`/v1/messages`) requires the `x-api-key` header instead and would reject `Bearer`. However, Anthropic provides an **OpenAI-compatible endpoint** at `https://api.anthropic.com/v1` that accepts `Authorization: Bearer`. Our provider registry uses this compatible endpoint, so the Bearer auth works without special handling.

If we ever need Anthropic-specific features (extended thinking, prompt caching, PDF processing), we would need to switch the Anthropic provider to use `@ai-sdk/anthropic` with the native endpoint — which sends `x-api-key` internally. This can be done by changing one provider config entry and adding the package; no other code changes are required.

### Why `@ai-sdk/openai-compatible` Instead of Provider-Specific Packages

Anthropic, OpenAI, and Google each have dedicated AI SDK packages (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`). We chose the generic `openai-compatible` wrapper because:

1. **NVIDIA NIM is OpenAI-compatible** but has no dedicated AI SDK package — `openai-compatible` covers it and all others
2. **One import** instead of four — every provider uses the same 3-line instantiation
3. **Trade-off**: We lose provider-specific features (Anthropic's extended thinking, Google's grounding). These can be added later with dedicated packages if needed — the `provider-router-service.ts` interface supports mixing provider types

### Tier Selection Process

The system automatically routes tasks to appropriate tiers based on complexity analysis:

1. **Low Complexity Tasks** (< 0.5) → **Tier 2** (NVIDIA NIM)
2. **High Complexity Tasks** (≥ 0.5) → **Tier 3** (Anthropic)

### Provider Selection Logic

When a tier is selected, the system chooses the best available provider:

1. **Tier 2**: 
   - Use NVIDIA NIM if API key is configured
   - Fallback to OpenAI if NVIDIA unavailable and key is configured
   - Fallback to Ollama if no other providers available (uses local instance)
   - Fallback to heuristic if no providers available

2. **Tier 3**:
   - Use Anthropic if API key is configured  
   - Fallback to OpenAI if Anthropic unavailable and key is configured
   - Fallback to Ollama if no other providers available (uses local instance)
   - Fallback to heuristic if no providers available

### Configuration

| Environment Variable | Purpose | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Tier 3 (complex reasoning) | No — degrades to Tier 2 or heuristic |
| `NVIDIA_API_KEY` | Tier 2 (cheap generation) | No — degrades to OpenAI or heuristic |
| `OPENAI_API_KEY` | Tier 2 fallback | No |
| `GOOGLE_API_KEY` | Future use | No |

No keys = heuristic-only mode. All features still work; LLM generation degrades gracefully.

### Ollama Integration

Ollama is supported as a local fallback provider that can be used when cloud providers are unavailable or not configured. It works automatically without requiring an API key - the system detects when Ollama is running locally and uses it as a last resort option.

Ollama integration allows users to leverage local LLMs without internet connectivity or API costs, providing privacy and cost-free processing capabilities.

## Consequences

### Positive
- **Adding a provider = 1 config object** — no new HTTP client, no new parser, no new retry logic
- **Structured output is guaranteed** — `generateObject()` + Zod eliminates manual parsing and its fragility
- **Cost optimization built-in** — tiered routing sends simple tasks to cheap models automatically
- **Graceful degradation** — no API key → heuristic fallback, never a hard crash
- **Single dependency** for all providers instead of N provider SDKs
- **Type-safe** — `LanguageModel` is the universal type; call sites are provider-agnostic

### Negative
- **Vendor coupling to Vercel AI SDK** — if the SDK is abandoned or makes breaking changes, migration effort is non-trivial
- **OpenAI-compatible limitation** — providers with non-standard features (Anthropic extended thinking, Google grounding) cannot use those features through the generic wrapper
- **Bundle size** — `ai` + `@ai-sdk/openai-compatible` adds ~200KB to the Node backend bundle
- **Abstraction leak risk** — if a provider's OpenAI compatibility has quirks (e.g., non-standard error codes, rate limit headers), debugging goes through the SDK layer first

## Future Considerations
- **Implement Tier 1 (WASM Agent Booster):** Tier 1 is currently a placeholder in the routing table (`TIER_MODELS[1]`). Implementing it requires integrating a WASM-based deterministic codemod engine that can handle `var-to-const`, `remove-console`, and `add-logging` transforms without any LLM call. Until then, `getModelForTier(1)` returns `null` and callers should fall back to Tier 2 or Tier 3.
- Add dedicated `@ai-sdk/anthropic` package if Anthropic-specific features (extended thinking, tool use) are needed
- Add streaming support via the AI SDK's `streamObject()` for real-time swarm generation progress
- Wire provider selection into the UI so users can choose models from the canvas
- Add token usage tracking per provider to the cost estimator
- Consider `@ai-sdk/google` for Gemini-specific grounding/retrieval features
