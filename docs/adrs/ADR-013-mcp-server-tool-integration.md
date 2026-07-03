# ADR-013: MCP Server Integration for Agent Tool Access

## Status
Proposed

## Context
Agent Modus currently executes agents via pure text generation (`callLLM` in `live-execution-service.ts`). No tools are registered with the LLM calls, so agents cannot take actions on external systems (send email, query databases, call APIs) — they can only produce text.

The Model Context Protocol (MCP) provides a standardised way to expose external capabilities (filesystem, email, HTTP, etc.) as typed tools that LLMs can invoke. The MCP HTTP transport (`@modelcontextprotocol/sdk`) allows connecting to remote MCP servers over HTTP/SSE, enabling agents to use tools without embedding provider-specific logic in Agent Modus itself.

The immediate driver is email access: agents that generate or send emails need an SMTP tool, not just the ability to write email text.

### Alternatives Considered

| Approach | Pros | Cons |
|---|---|---|
| **Hardcode email service in execution engine** | Simple, no new dependency | Non-generic; every new capability requires core code changes |
| **Pre-call hooks that call external APIs directly** | No LLM tool loop needed | Agent output cannot adapt based on tool results; no composability |
| **MCP HTTP server per capability** | Standard protocol; decoupled; LLM drives tool invocation | Requires tool-use LLM call (not just `generateText`); adds runtime complexity |

## Decision

Adopt MCP HTTP servers as the extension mechanism for agent external tool access. Each agent may declare an `mcpServers` list in its `config` field. The execution engine will:

1. **Connect** to declared MCP servers via `@modelcontextprotocol/sdk` `Client` + `HttpClientTransport` before the LLM call.
2. **Discover** available tools via `client.listTools()` and pass them to `generateText({ tools })`.
3. **Handle** tool calls in a loop until the model emits a final text response or a max-steps limit is reached.
4. **Inject** available tool names into the agent's system prompt so the LLM knows what it can do.

### Agent Config Schema (addition)

```json
{
  "mcpServers": [
    { "url": "http://localhost:3001/sse", "label": "email" }
  ],
  "coreTask": "Send a follow-up email to each qualified lead."
}
```

### Integration Seam

All changes are confined to `live-execution-service.ts`:
- `buildSystemPrompt()` appends a "Available tools: …" line when `mcpServers` is present.
- `callLLM()` is replaced by `callLLMWithTools()` for agents that have `mcpServers` configured; agents without it continue using the existing path with no behaviour change.

### Configuration Collection

MCP server URLs and any required credentials are collected from the user at Ship/Deploy time via the `configRequirements` mechanism (ADR links to the config-prompting work). They are stored in `localStorage` per swarm and passed with each deploy request; they are never persisted server-side.

## Consequences

**Positive**
- Any MCP-compatible server (email, database, calendar, HTTP) can be plugged in without changing core code.
- Agents can adapt their output based on real tool results (e.g., confirm email sent).
- Aligns with emerging industry standard for LLM ↔ tool integration.
- **Ollama 0.3+ (released mid-2024) exposes an OpenAI-compatible function calling API at `/v1/chat/completions`.** Because Agent Modus already uses `createOpenAICompatible()` for Ollama, the Vercel AI SDK `tools` parameter flows through with no extra adapter code — tool-use agents can run fully locally at zero API cost.

**Negative**
- Tool use requires the specific model (not just the provider) to support function calling. The constraint is per-model, not per-tier.
- MCP server lifecycle (start/stop, auth) is the operator's responsibility; Agent Modus does not manage it.
- Increases latency for agents with tools due to multi-step tool loop.

### Model Tool-Use Compatibility

| Provider | Models with tool support | Models without |
|---|---|---|
| **Anthropic** | All Claude 3+ models | — |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo` | `gpt-3.5-turbo` (unreliable) |
| **NVIDIA NIM** | `meta/llama-3.1-70b-instruct`, `meta/llama-3.3-70b-instruct` | Most other NIM hosted models |
| **Ollama (local)** | `qwen2.5`, `qwen3` (incl. `qwen3-coder:30b`), `llama3.1`, `llama3.2`, `llama3.3`, `mistral`, `mistral-nemo`, `command-r` | `codellama`, `phi3`, `phi2`, most base/non-instruct models |
| **OpenRouter** | Depends on routed model — check OpenRouter model page | — |

When an agent has `mcpServers` configured and its assigned model does not support tools, the execution engine should log a warning and fall back to the next available tier that does (Tier 3 / Anthropic Claude by default).
