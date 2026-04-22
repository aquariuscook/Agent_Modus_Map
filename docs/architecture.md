# Architecture

Agent Modus Map is a full-stack TypeScript application built around a central swarm graph domain. It combines a React/Vite single-page client, an Express API, SQLite persistence, and a WebSocket collaboration layer. The core model is a swarm made up of agents and typed relationships, with shared TypeScript contracts so the client and server operate on the same domain objects.

## System Overview

The application follows a straightforward runtime shape:

- **Client:** React application for designing, visualizing, and operating swarms
- **API:** Express server exposing REST endpoints for swarm management and related platform capabilities
- **Database:** SQLite for persistent application state
- **Realtime:** WebSocket endpoint for live collaboration features
- **Shared contracts:** Common domain types shared across frontend and backend

In practice, the system flows as:

`SPA frontend -> /api Express backend -> SQLite`, with `/ws` attached to the same server for real-time collaboration.

## Codebase Structure

| Area | Role | Key locations |
|---|---|---|
| **Client** | Interactive swarm editor and dashboard UI | `src/client` |
| **API** | REST endpoints for swarm CRUD, templates, intelligence, monitoring, governance, auth, docs, and import/export | `src/api/server.ts`, `src/api/routes/*` |
| **Persistence** | SQLite schema initialization and domain stores | `src/api/db/database.ts`, `src/api/db/*` |
| **Realtime** | Collaboration and presence over WebSocket | `src/api/services/websocket-service.ts` |
| **Shared domain model** | Shared types for swarms, agents, relationships, validation, and API contracts | `src/shared/types/index.ts` |

## Core Domain Model

The primary domain concept is the swarm graph:

- **Swarm**: aggregate root representing a designed multi-agent system
- **Agent**: an individual autonomous unit within a swarm
- **Relationship**: a typed edge between agents
- **Layer**: a logical grouping of agents by function

This domain model is defined in `src/shared/types/index.ts` and is used by both the client and the API to keep contracts aligned.

## Backend Architecture

The backend is organized as a modular Express application. `createApp()` in `src/api/server.ts` composes route modules by capability, including:

- swarms
- intelligence
- templates
- monitoring
- decision traces
- governance
- collaboration
- optimization
- documentation generation
- simulation
- settings
- authentication
- MCP integration
- import

This keeps the API structured by domain capability rather than concentrating everything in one router.

The server also initializes supporting stores and services on startup, including knowledge base, health, decision trace, audit, versioning, and authentication support. In production, the same Express server serves the built frontend and handles SPA fallback routing.

## Persistence Layer

Persistence is handled with SQLite through `better-sqlite3`. The main schema in `src/api/db/database.ts` establishes the system of record for:

- `swarms`
- `layers`
- `agents`
- `relationships`
- operational records such as `deploy_results`

The schema uses foreign keys, cascades, and indexes to maintain graph integrity and support efficient lookups. Database initialization happens automatically when the API starts.

## Frontend Architecture

The frontend is a React SPA bootstrapped from `src/client/main.tsx`. The main composition root is `src/client/App.tsx`, which coordinates:

- top-level application view state
- panel visibility and editor modes
- swarm loading and refresh behavior
- agent and relationship mutations
- import and export flows
- health polling
- collaboration hooks

Most user-facing functionality is broken into dedicated components under `src/client/components`, while `App.tsx` acts as the primary orchestration layer for the editor experience.

## Realtime Collaboration

Realtime behavior is provided by `CollaborationServer` in `src/api/services/websocket-service.ts`, attached to the same HTTP server at `/ws`. This layer supports collaborative editing and presence-oriented functionality without introducing a separate server tier.

## Architectural Style

Several design choices define the current architecture:

1. **Full-stack TypeScript:** shared language and shared types across client and server
2. **Modular Express backend:** route and service separation by platform capability
3. **Shared domain contracts:** frontend and backend both rely on the same swarm model
4. **SQLite as operational source of truth:** simple deployment model with persistent local storage
5. **SPA plus same-origin API:** the client and API can run separately in development and together in production

## DDD Alignment

The repository includes a documented Domain-Driven Design model in `docs/ddd`. That documentation defines bounded contexts such as:

- Design
- Template
- Intelligence
- Monitoring
- Governance
- Collaboration

In the current implementation, that separation is reflected most clearly in the API route and service structure rather than strict package or deployable-service boundaries. The **Design Context** is documented as the core domain and acts as the conceptual source of truth for what swarms, agents, and relationships exist.

## Summary

Agent Modus Map is architected as a single product with a clean full-stack boundary: a React design surface on top of an Express API, backed by SQLite, with WebSocket support for live collaboration. The codebase already reflects a strong domain model and a documented DDD target architecture, even where the implementation still uses pragmatic module boundaries rather than fully isolated bounded-context packages.
