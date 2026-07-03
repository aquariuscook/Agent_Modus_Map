# ADR-014: SaaS OAuth Integration Model for Prompt-to-Swarm (Email, CRM, etc.)

## Status
Proposed

## Context
[ADR-013](ADR-013-mcp-server-tool-integration.md) established MCP servers as the mechanism for agent tool access, with credentials collected via `configRequirements` at deploy time. The first concrete use case is email sending (Gmail, Microsoft Graph), followed by other SaaS integrations swarms may need (Salesforce, HubSpot, etc.).

The open question was whether Agent Modus should register **one shared OAuth app** (Google Cloud project / Azure app registration / Salesforce Connected App) used by all users, or have each user/org register their **own OAuth app** and supply its Client ID/Secret at deploy time.

This is not simply a "hosted vs. local" hosting question — it is a question of **who carries the OAuth verification liability for a given scope's sensitivity tier**.

### Research findings

- Agent Modus already runs a shared Google OAuth app for sign-in (`GOOGLE_CLIENT_ID` env var, see [ADR-011](ADR-011-subscription-design.md) and `google-oauth-service.ts`). This works with **zero verification burden** because sign-in only requests non-sensitive scopes (`openid`, `email`, `profile`).
- Sending email requires **restricted/sensitive scopes** (`gmail.send`, Graph `Mail.Send`), a different liability tier entirely:
  - **Google**: restricted scopes require a CASA security assessment. Unverified apps are capped at 100 users **for the lifetime of the project — the cap cannot be reset.** ([Google: restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification))
  - **Microsoft**: multi-tenant apps requesting delegated permissions from other orgs' users need Publisher Verification (Microsoft Partner Center account + domain verification) or users see a "not commonly used" warning. ([Microsoft: publisher verification overview](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview))
  - **Salesforce**: the JWT Bearer flow enables server-to-server access (no login popup, needed for scheduled swarms) but still requires one-time admin pre-authorization of the connected app per target org. ([Salesforce: JWT bearer flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_jwt_flow.htm))
- Agent Modus is currently a **local-first product** (per ADR-011) with no multi-tenant server-side token custody. A shared OAuth app for sensitive scopes would put Agent Modus on the hook for a real, ongoing compliance process (cost + weeks/months lead time) it has not budgeted for.

## Decision

Adopt scope-sensitivity tiering, not hosted-vs-local, as the axis that decides OAuth app ownership:

| Scope tier | Example | OAuth app | Rationale |
|---|---|---|---|
| Basic identity | `openid`, `email`, `profile` | Shared Agent Modus app | Already shipped; no verification required |
| Sensitive/restricted delegated access | `gmail.send`, `Mail.Send`, broad Salesforce API | **User/org-provided (BYO) app** | Avoids Agent Modus taking on CASA/Publisher Verification liability before it is a genuinely multi-tenant hosted product |
| Server-to-server (headless/scheduled) | Salesforce JWT Bearer, Graph app-only, Google domain-wide delegation | Per-provider, admin-consented once per org | Required for any swarm using the existing `schedule` deploy option — a login popup cannot run unattended |

**For now: all scopes beyond basic sign-in use the BYO-app model, in both hosted and local deployment modes.** "Shared Agent Modus app for sensitive scopes" becomes available only after the relevant provider's verification (Google CASA, Microsoft Publisher Verification) is completed and tracked as its own separate initiative — it is not a configuration toggle.

### Provider-agnostic integration model

To generalize past email to CRM/other SaaS (Salesforce, HubSpot, etc.) without one-off code per provider:

```typescript
interface IntegrationProvider {
  id: string;                 // 'gmail' | 'msgraph' | 'salesforce' | 'hubspot'
  displayName: string;
  authMode: 'oauth-delegated' | 'oauth-jwt-bearer' | 'oauth-client-credentials';
  scopes: string[];
  credentialSource: 'byo-app' | 'hosted-shared-app'; // gated per-provider on verification status
}
```

The swarm generator detects integration intent during the interview (e.g. "send via Gmail", "log to Salesforce") and resolves a provider from this registry, which drives the `configRequirements` generated for that swarm — replacing the previously proposed fixed `oauthProvider: 'gmail' | 'msgraph'` union with an open, registry-keyed string.

## Consequences

**Positive**
- Zero OAuth-verification liability for Agent Modus while it remains local-first.
- Same integration pattern (BYO app + registry entry) extends to any future SaaS provider without new type unions or bespoke deploy-time logic.
- Matches the precedent already established for basic sign-in, and the local-first architecture from ADR-011.

**Negative**
- Higher setup friction for end users (must register their own OAuth app per provider) compared to a one-click "Connect Gmail" shared-app experience.
- Scheduled swarms using delegated OAuth still need secure refresh-token storage (local: encrypted file, similar to the `license.jwt` pattern in ADR-011; hosted: encrypted per-tenant store) — server-to-server flows avoid this but require one-time admin consent per org.
- A future shared-app ("hosted") experience requires a real compliance project per provider (CASA assessment, Publisher Verification) — not a quick follow-up.

## Open Questions
- Whether Agent Modus will pursue Google CASA / Microsoft Publisher Verification at all, or stay BYO-app permanently, is a business decision outside this ADR's scope.
- Whether admin-in-the-loop-once (server-to-server flows) is acceptable for "fully autonomous" scheduled swarms, or whether refresh-token storage is preferred, is deferred until scheduled-swarm OAuth is implemented.
