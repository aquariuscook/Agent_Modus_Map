# How to Test Subscription Entitlements Without Paddle

This guide explains how to test paid features (interview, traces, live simulation, deploy, prospect access/export, handoff documents) in your local dev environment **without hitting real Paddle servers**.

There are three approaches, ranging from "no setup" to "full Paddle sandbox."

---

## Approach 1: No Paddle at All (Fastest)

If `PADDLE_API_KEY` is not set in your environment, `resolveSubscription()` in `subscription-service.ts` returns:

```json
{ "plan": "free", "status": "unverified", "source": "unverified" }
```

No Paddle API call is made. This is what the test suite does — see `tests/api/auth.test.ts` line 24: `delete process.env.PADDLE_API_KEY`.

**What you get:** Free-tier behavior. Paid features return `402 feature_locked`. Good for testing the locked-out path, but **not** for testing pro/enterprise features.

---

## Approach 2: Dev Google Tokens with `plan` Hint

When you activate via Google OAuth, you can pass a **fake dev token** that embeds a `plan` field. The backend reads this as a `planHint` and skips both Paddle and the overrides table.

### Token format

```
test-google:<base64url-encoded JSON>
```

The JSON payload must include `sub`, `email`, and `name`. Optionally include `plan` to set the license tier.

### How to construct one

```typescript
// In a test or script:
const payload = {
  sub: 'dev-user-1',
  email: 'dev-pro@example.com',
  name: 'Dev Pro User',
  plan: 'pro',              // ← this controls the entitlement tier
  picture: 'https://example.com/avatar.png',
};

const token = `test-google:${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
```

### Available plans

| `plan` value | Result | What unlocks |
|---|---|---|
| *(omit)* | `free` / `unverified` | `traces.capture` only — agent decisions are recorded but not viewable |
| `starter` | Starter tier | + `traces.view`, `prospects.view`, `interview.view`, `templates.full`, `simulation.live`, `docs.handoff`, `deploy.once` |
| `pro` | Pro tier | + `traces.patterns`, `prospects.generate`, `prospects.export`, `interview.conduct`, `deploy.scheduled`, `support.priority` |
| `enterprise` | Enterprise tier | + `auth.sso`, `branding.whiteLabel`, `hosting.selfHosted` |

### Using it with the API

```bash
# Construct a dev token (Node one-liner):
TOKEN=$(node -e "console.log('test-google:' + Buffer.from(JSON.stringify({sub:'d1',email:'dev@example.com',name:'Dev',plan:'pro'})).toString('base64url'))")

# Activate via the API:
curl -X POST http://localhost:3001/api/auth/google/activate \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"$TOKEN\"}"
```

The response includes a `sessionToken` you can use for subsequent authenticated requests. The license will have `source: 'google-dev'`.

### Safety guard

Dev tokens are **blocked in production** unless you explicitly set `AUTH_ALLOW_DEV_GOOGLE_TOKENS=true`. See `google-oauth-service.ts` line 91:

```typescript
if (process.env.NODE_ENV === 'production' && process.env.AUTH_ALLOW_DEV_GOOGLE_TOKENS !== 'true') {
  throw new Error('Development Google tokens are disabled');
}
```

---

## Approach 3: Subscription Override Table (No Paddle, Persistent)

You can insert a row into the `subscription_overrides` SQLite table for a specific email. This persists across restarts and takes priority over Paddle lookups.

### Via the API (dev only)

```bash
# First, log in as admin to get a token:
ADMIN_TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@agentmodus.local","password":"admin"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).data.sessionToken))")

# Then set the override:
curl -X POST http://localhost:3001/api/auth/dev/subscription-override \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "email": "pro-user@example.com",
    "plan": "pro",
    "status": "active",
    "expiresAt": "2027-01-01T00:00:00Z"
  }'
```

This endpoint (`POST /api/auth/dev/subscription-override`) requires admin role and is **disabled in production** (returns 404 when `NODE_ENV=production`).

### Via SQLite directly

```sql
INSERT INTO subscription_overrides (email, plan, status, expires_at, source, updated_at)
VALUES ('pro-user@example.com', 'pro', 'active', '2027-01-01T00:00:00Z', 'local-override', datetime('now'))
ON CONFLICT(email) DO UPDATE SET
  plan = 'pro',
  status = 'active',
  expires_at = '2027-01-01T00:00:00Z',
  source = 'local-override',
  updated_at = datetime('now');
```

The database file is at `$AGENT_MODUS_HOME/agent-modus.db` (defaults to `~/.agent-modus/agent-modus.db`).

### Resolution priority

When `resolveSubscription()` runs, it checks in this order:

1. **`planHint`** from a dev Google token → `source: 'google-dev'`
2. **`subscription_overrides` row** for the email → `source: 'local-override'`
3. **Paddle API** (if `PADDLE_API_KEY` is set) → `source: 'paddle'`
4. **Fallback** (no key, no override) → `source: 'unverified'`, `plan: 'free'`

So an override blocks Paddle from even being called for that user.

---

## Approach 4: Paddle Sandbox (Full Integration Test)

If you need to test the actual Paddle flow end-to-end (webhook delivery, price-to-plan mapping, billing period tracking), use Paddle's sandbox environment.

### Setup

1. Create a Paddle sandbox account at https://sandbox-vendors.paddle.com
2. Get a sandbox API key from the Paddle dashboard
3. Set environment variables:

```bash
PADDLE_API_KEY=pdlt_sandbox_XXXXX
PADDLE_API_BASE=https://sandbox-api.paddle.com   # overrides the default production URL
PADDLE_PRICE_PLAN_MAP={"pri_01abc123":"pro","pri_01def456":"enterprise"}
```

`PADDLE_API_BASE` defaults to `https://api.paddle.com` (production). Setting it to the sandbox URL routes all Paddle API calls to the test environment. See `subscription-service.ts` line 26.

### Price-to-plan mapping

`PADDLE_PRICE_PLAN_MAP` is a JSON string mapping Paddle price IDs to license plans. Without it, any active subscription defaults to `starter`. With it, the code matches each subscription item's `price.id` against the map.

### What you need in Paddle sandbox

- A **customer** with the same email your test user logs in with
- An **active subscription** for that customer on a price ID listed in `PADDLE_PRICE_PLAN_MAP`

---

## Quick Reference: Which Approach When?

| Scenario | Best approach | Paddle needed? |
|---|---|---|
| Run automated tests | Approach 2 (dev Google tokens) | No |
| Test locked-out / free-tier UI | Approach 1 (no `PADDLE_API_KEY`) | No |
| Manually test pro features in dev | Approach 2 or 3 | No |
| Test Paddle webhook handling | Approach 4 (sandbox) | Yes — sandbox |
| Test price-to-plan mapping | Approach 4 (sandbox) | Yes — sandbox |
| CI/CD pipeline | Approach 2 (dev Google tokens) | No |

---

## Environment Variable Summary

| Variable | Purpose | Default |
|---|---|---|
| `PADDLE_API_KEY` | Enables Paddle lookups. Unset → no Paddle calls. | *(unset)* |
| `PADDLE_API_BASE` | Paddle API URL. Set to sandbox URL for testing. | `https://api.paddle.com` |
| `PADDLE_PRICE_PLAN_MAP` | JSON mapping of Paddle price IDs → plan names. | *(unset — all subs get `starter`)* |
| `GOOGLE_CLIENT_ID` | Enables Google sign-in. | *(unset — Google sign-in hidden)* |
| `AUTH_ALLOW_DEV_GOOGLE_TOKENS` | Allow `test-google:` / `dev-google:` tokens in production. | `false` |
| `NODE_ENV` | `production` blocks dev endpoints and dev tokens. | *(unset)* |
| `AGENT_MODUS_HOME` | Data directory (contains SQLite DB for overrides). | `~/.agent-modus` |
