# Agent Modus Map — Source Design Document

> **Last updated:** 2026-06-09
>
> This document describes every folder and file under `src/`. Keep it in sync when files are added, removed, or repurposed. See the maintenance instruction in `CLAUDE.md`.

---

## Directory Overview

```
src/
├── api/            Express backend (routes, services, database)
│   ├── db/         SQLite store layer
│   ├── routes/     Express route handlers
│   └── services/   Business logic / domain services
├── client/         React + Vite frontend
│   ├── components/ UI components
│   ├── hooks/      Custom React hooks
│   ├── styles/     Global CSS / design tokens
│   ├── types/      Client-side type declarations
│   └── utils/      Client utility functions
└── shared/         Code shared between api and client
    ├── design-tokens/  Programmatic color/style tokens
    └── types/          Shared domain type definitions
```

---

## `src/api/` — Backend

### `src/api/server.ts`

Express application factory. Initializes all database stores, mounts every route module under `/api/*`, sets up the collaboration WebSocket server, serves static production assets, and starts listening.

---

### `src/api/db/` — SQLite Store Layer

All persistent data lives in SQLite (better-sqlite3, WAL mode). Each file is a self-contained store with its own table schema and query functions.

| File | Purpose |
|------|---------|
| `database.ts` | Singleton SQLite connection manager. Provides `getDb()` for the app and `getTestDb()` for an in-memory test instance. |
| `audit-store.ts` | Append-only audit log (ADR-007). Tracks all mutating actions (agent/relationship/swarm CRUD, approvals) with integrity checksums and chain verification. |
| `decision-trace-store.ts` | Four-stage decision trace storage (ADR-004: observation → reasoning → action → outcome). Supports insert, query, and pattern detection across agents. |
| `health-store.ts` | Time-series health data (ADR-009). Stores per-agent latency/throughput/error/CPU/memory reports and provides aggregate health summaries. |
| `knowledge-base.ts` | FTS5 full-text search knowledge base for documentation RAG (ADR-003). Stores curated best-practice documents with title, category, content, and tags. |
| `seed.ts` | Seed script that loads the 24-agent e-commerce demo swarm into the database. |
| `version-store.ts` | Swarm version history and collaboration comments (Sprints 21-22). Supports version snapshots, diffs, comments, and comment resolution. |

---

### `src/api/routes/` — Express Route Handlers

Each file registers a group of REST endpoints on an Express Router. All are mounted by `server.ts`.

| File | Purpose |
|------|---------|
| `auth-routes.ts` | Authentication: login, user CRUD, Google OAuth sign-in, license/subscription resolution, auth config. |
| `collaboration-routes.ts` | Collaboration: version history, version diff, comments, comment resolution. |
| `decision-trace-routes.ts` | Decision trace CRUD and pattern detection (gated by `traces.view` and `traces.patterns` capabilities). |
| `doc-generation-routes.ts` | Documentation generation: full swarm docs (Markdown/JSON), per-agent docs, handoff documents, HTML export. |
| `governance-routes.ts` | Governance: audit log retrieval and audit chain integrity verification. |
| `health-routes.ts` | Health monitoring: per-swarm agent health, health summaries, health report ingestion. |
| `import-routes.ts` | CSV import: upload CSV data to create agents, download CSV template. |
| `intelligence-routes.ts` | AI copilot: RAG-powered Q&A with streaming responses and web search integration. |
| `interview-routes.ts` | Interview-driven swarm builder: start/list/resume interviews, process messages, deploy generated swarm. |
| `mcp-routes.ts` | MCP server management: start/stop MCP servers, list tools, call tools, execute external API calls. |
| `optimization-routes.ts` | Optimization: bottleneck detection, what-if agent removal analysis, cost estimation. |
| `prospect-routes.ts` | Prospect/lead management: CRUD, pipeline stats, status updates, CSV export, AI outreach generation. |
| `settings-routes.ts` | API key management (Anthropic, Tavily, etc.), user profile CRUD, environment-based settings. |
| `simulation-routes.ts` | Simulation/deploy: mock simulation, live test execution (streaming), search preview, cost estimation, swarm deployment (start/pause/resume/stop), export. |
| `swarm-routes.ts` | Core swarm CRUD, agent/relationship management, blast-radius queries, prompt-based swarm generation, CLI bridge export. |
| `template-routes.ts` | Template listing and instantiation (filtered by user authorization/license tier). |

---

### `src/api/services/` — Business Logic Services

Domain services consumed by route handlers. Each file encapsulates a specific capability.

| File | Purpose |
|------|---------|
| `auth-service.ts` | Authentication and RBAC: password hashing (bcrypt), JWT session tokens, user CRUD, role-based permissions (admin/designer/viewer), Google user upsert. |
| `cost-estimation-service.ts` | LLM cost calculator: estimates per-agent and per-swarm daily/monthly costs based on model pricing, expected token usage, and call frequency. |
| `doc-generation-service.ts` | Markdown document generator for swarms: layer tables, agent cards, relationship diagrams, handoff documents. |
| `google-oauth-service.ts` | Google ID token verification using Google's public JWKS certs (dev-mode bypass for testing). |
| `graph-service.ts` | Graph query engine (ADR-001) over SQLite using BFS. Provides blast-radius and critical-path analysis against the agent dependency graph. |
| `health-simulator.ts` | Generates realistic simulated health metrics per agent based on personality profiles (latency, throughput, error rate, CPU, memory with volatility). |
| `html-export-service.ts` | Generates a self-contained HTML page visualizing a swarm in the "Agent Modus v2" layered style with agent cards, badges, and relationships. |
| `interview-service.ts` | Interview state machine: seven phases of conversational swarm building, with LLM-powered message processing and final swarm deployment. |
| `license-service.ts` | Licensing and capability gate: plan tiers (free/starter/pro/enterprise), JWT license tokens, capability-based middleware, Paddle subscription integration. |
| `live-execution-service.ts` | Live test execution engine: runs real LLM calls through the agent graph, performs web search, filters business domains, records decision traces. |
| `llm-service.ts` | Thin LLM wrapper: checks provider availability and calls `generateAnswer` through the provider router. |
| `llm-telemetry.ts` | LLM call telemetry: JSONL rotating log (5 MB max, 3 rotations) with SQLite-backed aggregate stats. |
| `mcp-runtime.ts` | MCP execution runtime: spawns MCP server processes (stdio/SSE), lists tools, executes tool calls, makes external API calls. |
| `optimization-service.ts` | Optimization engine: bottleneck scoring (in/out degree analysis), what-if agent removal impact, cost modeling per layer. |
| `provider-router-service.ts` | Multi-provider LLM abstraction (ADR-012): routes calls to Anthropic/NVIDIA/OpenAI/Google based on availability and cost tier using Vercel AI SDK. |
| `prospect-service.ts` | Prospect database with vector storage and metadata filtering. Manages lead pipeline (new → won/lost) with CRUD and CSV export. |
| `rag-service.ts` | Dual RAG architecture (ADR-003): pattern-matches natural language to graph queries or documentation FTS, optionally enhances answers via LLM. |
| `simulation-service.ts` | Mock simulation engine: walks sample data through the agent graph, generating per-agent outputs, step metrics, and data-flow traces. |
| `subscription-service.ts` | Subscription plan resolution: checks Paddle API for active subscriptions, supports local overrides and dev-mode plans, normalizes to license tiers. |
| `swarm-cli-bridge-service.ts` | Visual-to-CLI bridge: converts a Swarm graph into the equivalent Claude Flow CLI command sequence (swarm init, agent add, connect). |
| `swarm-export-service.ts` | Exports a Swarm as a deployable package: `swarm.config.json`, per-agent prompt Markdown files, relationship map. |
| `swarm-generator-service.ts` | Prompt-to-swarm auto-generator: uses the provider router with Zod schemas to produce a full Swarm JSON from a natural-language prompt. |
| `swarm-runtime-service.ts` | Long-running swarm deployment manager: schedules runs (once/hourly/daily/weekly), tracks cost and budgets, persists run results. |
| `swarm-service.ts` | Core Swarm CRUD: loads swarms with agents/relationships/layers from SQLite, supports create/update/delete for swarms, agents, and relationships. |
| `template-service.ts` | Template-first UX (ADR-005): manages pre-built swarm templates (domain, layers, agents, relationships) and instantiates them as new swarms. |
| `web-search-service.ts` | Web search abstraction: tries Tavily first, then Brave Search, for programmatic web queries; detects directory/list URLs for scraping. |
| `websocket-service.ts` | Real-time collaboration WebSocket server: manages connected clients, broadcasts cursor positions, presence, and swarm-change events. |

---

## `src/client/` — Frontend

### `src/client/App.tsx`

Root application component. Orchestrates all panels, canvases, modals, and editor modes. Manages swarm state, authentication, keyboard shortcuts, and routes between Dashboard, SwarmCanvas, Interview, Pricing, and Login views.

### `src/client/main.tsx`

React entry point. Mounts `<App />` in StrictMode, imports `theme.css`, initializes the saved theme from localStorage.

### `src/client/api.ts`

Client-side API wrapper. Typed `fetchJson`/`postJson` helpers with JWT auth headers, exposing functions for all backend endpoints (swarms, health, traces, governance, collaboration, docs, templates, simulation, prospects, auth, settings, interviews, copilot).

### `src/client/vite-env.d.ts`

Vite client type references and module declarations for `.png`, `.jpg`, `.svg` asset imports.

---

### `src/client/components/` — React UI Components

| File | Purpose |
|------|---------|
| `AgentBuilderWizard.tsx` | Multi-step wizard (8 steps) for creating a new agent: nickname, formal name, descriptor, layer, badges, position, config. |
| `AgentModusModal.tsx` | Detail/edit modal for a single agent: emoji, core task, inputs/outputs, autonomy level, trigger conditions, edit/delete. |
| `AgentNode.tsx` | React Flow custom node: agent card with nickname, badges (HUB/CRITICAL/ENTRY etc.), layer color, health status, blast-radius highlighting. |
| `AgentPalette.tsx` | Draggable agent template palette: categorized templates (Customer Journey, Product, Order Processing, Operations) for drag-and-drop creation. |
| `AssistantDashboard.tsx` | AI assistant dashboard: task management (P1/P2/P3 priorities, kanban columns), daily schedule view, streaming copilot chat. |
| `ChatPanel.tsx` | AI copilot chat panel: streaming Q&A with the RAG-powered intelligence service, shows activity/status steps during LLM calls. |
| `CollaborationCursors.tsx` | Renders remote users' cursor positions and a presence indicator strip. |
| `CollaborationPanel.tsx` | Side panel for swarm version history and comments: browse/restore versions, add/resolve comments, tabbed views. |
| `ConnectionTypeModal.tsx` | Modal for selecting relationship type when connecting two agents (dependsOn, feedsInto, collaboratesWith, canOverride). |
| `Dashboard.tsx` | Home/landing screen: lists swarms, create-from-template, CSV import, interview launcher, user avatar, navigation to pricing/login. |
| `DecisionTraceViewer.tsx` | Side panel displaying four-stage decision traces (observation, reasoning, action, outcome) with pattern detection results. |
| `DocViewer.tsx` | Side panel that fetches and renders auto-generated swarm documentation as Markdown, with download button. |
| `EditorToolbar.tsx` | Top toolbar with four editor modes (Build/Watch/Test/Ship), mode-specific action buttons, theme toggle, logo. |
| `GovernancePanel.tsx` | Side panel showing the append-only audit log and compliance report, filterable by action type. |
| `HealthDashboard.tsx` | Side panel displaying per-agent health status (healthy/degraded/unhealthy) with sparkline charts for latency and throughput. |
| `InterviewPanel.tsx` | Conversational interview UI: chat-like interface that walks the user through defining a swarm goal, collects requirements, deploys the generated swarm. |
| `KeyboardShortcutsHelp.tsx` | Modal listing keyboard shortcuts (P=palette, V=validation, C=chat, H=health, etc.). |
| `LoginPage.tsx` | Login/signup page with email/password fields, Google Sign-In button, forgot-password flow. |
| `Logo.tsx` | Logo component that auto-switches between dark and light variants via MutationObserver on `data-theme`. |
| `OnboardingOverlay.tsx` | First-run overlay walkthrough explaining the four modes (Build, Watch, Test, Ship) and basic concepts. |
| `OptimizationPanel.tsx` | Side panel with three tabs: bottleneck analysis, cost estimation, what-if agent removal simulation. |
| `PricingPage.tsx` | Pricing/plans page: Free, Starter, Pro, Enterprise tiers with feature lists and plan selection. |
| `ProspectDashboard.tsx` | Kanban-style prospect pipeline: stages from "new" to "won/lost", status updates, notes, bulk actions, CSV export. |
| `RelationshipOrchestrator.tsx` | Side panel for viewing/managing swarm relationships: create new connections with type, delete existing, visualize relationship graph. |
| `SettingsPanel.tsx` | Settings modal for managing API keys (Anthropic, Tavily), viewing key status, running key-validation tests. |
| `SimulationPanel.tsx` | Simulation/test panel: mock runs, live test execution, cost estimates, deployment controls, search preview, swarm package export. |
| `Sparkline.tsx` | Tiny inline SVG sparkline chart for rendering time-series data (used by HealthDashboard). |
| `SwarmCanvas.tsx` | Main React Flow canvas: renders agents as nodes and relationships as styled edges, handles drag-and-drop, connection drawing, blast-radius visualization. |
| `TemplateBrowser.tsx` | Modal for browsing and instantiating pre-built swarm templates organized by domain (Support, Media, Retail, Engineering, etc.). |
| `ThemeToggle.tsx` | Dark/light theme toggle button that calls `useTheme` to switch `data-theme`. |
| `ValidationPanel.tsx` | Side panel that runs a rule-based validation engine on the swarm (disconnected agents, missing ENTRY/HUB, duplicate names, etc.) showing errors/warnings/advisories. Exports `validateSwarm()`. |

---

### `src/client/hooks/` — Custom React Hooks

| File | Purpose |
|------|---------|
| `useCollaboration.ts` | WebSocket-based real-time collaboration: manages connection, presence tracking, cursor positions, and chat messages for a given swarm. |
| `useTheme.ts` | Theme toggle: reads/writes `data-theme` attribute, persists choice in localStorage. |
| `useUndoRedo.ts` | Undo/redo command pattern: tracks past/future command stacks with `canUndo`/`canRedo` flags and `lastAction` label. |

---

### `src/client/styles/` — CSS Styles

| File | Purpose |
|------|---------|
| `theme.css` | Global CSS design tokens: Outfit font import, typography scale, spacing scale, border radii, CSS custom properties for "gem tone on warm plum" design system. |

---

### `src/client/types/` — Client-Side Type Declarations

| File | Purpose |
|------|---------|
| `google-identity.d.ts` | TypeScript type declarations for the Google Identity Services (`accounts.google.com`) JavaScript API. |

---

### `src/client/utils/` — Client Utility Functions

| File | Purpose |
|------|---------|
| `agent-emojis.ts` | Maps agent nicknames to default emoji icons (e.g. Doorbell→bell, Sentinel→shield). Covers e-commerce, customer service, content ops, DevOps, data pipelines. Exports `getAgentEmoji()`. |

---

## `src/shared/` — Code Shared Between API and Client

### `src/shared/design-tokens/`

| File | Purpose |
|------|---------|
| `tokens.ts` | JavaScript design token constants (ADR-002): background, text, layer, relationship, and badge color definitions for the "gem tone on warm plum" theme. Used programmatically by both client and API (e.g. HTML export). |

### `src/shared/types/`

| File | Purpose |
|------|---------|
| `index.ts` | Core domain type definitions for the entire application: `Badge` (12 variants), `RelationshipType` (4 variants), `HealthStatus`, `LayerDefinition`, `Agent`, `Relationship`, `Swarm`, `ValidationResult`, `BlastRadiusResult`, `CriticalPathResult`, `ApiResponse<T>`, `ApiError`. |
