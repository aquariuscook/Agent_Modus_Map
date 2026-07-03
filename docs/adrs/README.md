# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Agent Modus Map enterprise platform. Each ADR documents a significant architectural choice, its context, the decision made, and the consequences.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](ADR-001-property-graph-agent-relationships.md) | Property Graph for Agent Relationships | Accepted | 2026-03-20 |
| [ADR-002](ADR-002-react-spa-design-system.md) | React SPA with Ocean Gradient Design System | Accepted | 2026-03-20 |
| [ADR-003](ADR-003-dual-rag-architecture.md) | Dual RAG Architecture (Graph RAG + Documentation RAG) | Accepted | 2026-03-20 |
| [ADR-004](ADR-004-decision-trace-format.md) | Four-Stage Decision Trace Format | Accepted | 2026-03-20 |
| [ADR-005](ADR-005-template-first-ux.md) | Template-First User Experience | Accepted | 2026-03-20 |
| [ADR-006](ADR-006-progressive-disclosure-ux.md) | Progressive Disclosure UX Pattern | Accepted | 2026-03-20 |
| [ADR-007](ADR-007-append-only-audit-log.md) | Append-Only Cryptographic Audit Log | Accepted | 2026-03-20 |
| [ADR-008](ADR-008-crdt-collaboration.md) | CRDT-Based Real-Time Collaboration | Accepted | 2026-03-20 |
| [ADR-009](ADR-009-agent-health-protocol.md) | Standardized Agent Health Data Protocol | Accepted | 2026-03-20 |
| [ADR-010](ADR-010-goap-runtime-planning.md) | GOAP as Runtime Planning System | Proposed | 2026-03-20 |
| [ADR-011](ADR-011-subscription-design.md) | Local License Verification Architecture (React + Local Node Backend) | Accepted | 2026-04-22 |
| [ADR-012](ADR-012-multi-provider-ai-sdk.md) | Multi-Provider LLM Support via Vercel AI SDK | Accepted | 2026-06-08 |
| [ADR-013](ADR-013-mcp-server-tool-integration.md) | MCP Server Integration for Agent Tool Access | Proposed | 2026-06-29 |
| [ADR-014](ADR-014-saas-oauth-integration-model.md) | SaaS OAuth Integration Model for Prompt-to-Swarm | Proposed | 2026-06-29 |

## ADR Statuses

- **Proposed**: Under discussion, not yet accepted
- **Accepted**: Approved and guiding implementation
- **Superseded**: Replaced by a newer ADR
- **Deprecated**: No longer relevant

## Template

New ADRs should follow the format established in this directory: Title, Status, Context, Decision, Consequences (positive, negative, neutral), and Alternatives Considered.
