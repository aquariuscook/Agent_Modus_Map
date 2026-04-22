# ADR: Local License Verification Architecture (React + Local Node Backend)

## Status
Accepted (with future option to migrate backend to remote server)

## Context
The application is a desktop-distributed product built using a React frontend and a Node.js backend, both running locally on the user’s machine. The product’s value (premium features, logic, algorithms) resides entirely on the client side. This means:

- The local environment is inherently untrusted.
- A determined attacker can modify both the React UI and the Node backend.
- Server-side verification cannot enforce local behavior.
- The goal is not perfect security, but to make unauthorized access **non-trivial**.

Stripe is used for subscription management, and Google OAuth is used for identity. Both require secure verification, but since the backend is local, verification cannot be fully trusted. However, the system can still raise the difficulty of casual tampering.

The long-term plan is to migrate the Node backend to a remote server, where verification and authorization will become authoritative.

## Decision
Implement a **local Node.js backend** that handles identity verification, subscription checks, and license issuance, even though it runs locally. The backend will:

1. **Verify Google OAuth tokens** using Google’s public keys.
2. **Check Stripe subscription status** using Stripe’s API.
3. **Generate and validate a signed license file** stored locally.
4. **Expose a local API** that the React app uses to query authorization state.
5. **Scatter and obfuscate authorization checks** to make patching harder.
6. **Periodically refresh the license** by re-checking Stripe.

The React frontend will:
- Never store subscription logic directly.
- Never call Stripe or Google directly.
- Only call the local Node backend for authorization decisions.

This design does not prevent determined attackers from bypassing checks, but it significantly raises the effort required.

## Rationale
Even though the backend runs locally and can be modified, this architecture provides several benefits:

- **Signed license files** prevent trivial JSON editing (“free → pro”).
- **Obfuscation and scattered checks** increase the cost of patching.
- **Periodic Stripe refresh** ensures subscription changes propagate.
- **Separation of concerns** keeps React free of sensitive logic.
- **Future migration path**: the same API can later be hosted remotely without changing the React app.

This approach balances:
- Practicality (works offline, simple distribution)
- User experience (no constant online requirement)
- Security (not perfect, but not trivial to bypass)
- Future scalability (easy to move backend to the cloud)

## Detailed Design

### A. Activation Flow (First Login)
1. User logs in via Google OAuth in the React UI.
2. React sends the Google ID token to the local Node backend.
3. Node verifies the token using Google’s public keys.
4. Node queries Stripe to determine the user’s subscription tier.
5. Node generates a **signed license file** containing:
   - user ID
   - plan (free/pro/premium)
   - expiration timestamp
   - optional device fingerprint
6. Node signs the license using a private key stored locally (obfuscated).
7. License is saved to disk (e.g., `~/.myapp/license.jwt`).

### B. Daily Usage Flow
1. On startup, Node loads the license file.
2. Node verifies the signature using a public key embedded in the app.
3. Node checks expiration and plan.
4. React queries Node for authorization via local API endpoints.
5. Node returns yes/no for each feature.
6. Authorization checks are scattered across Node modules and partially obfuscated.

### C. Periodic Online Refresh
1. Every X days or on app restart, Node re-checks Stripe.
2. If subscription changed:
   - Node issues a new signed license file.
3. If subscription is invalid or expired:
   - Node downgrades the license.
4. React updates UI accordingly.

### D. Anti-Tamper Measures
- Obfuscate Node backend code.
- Split private key into multiple fragments.
- Scatter authorization checks across modules.
- Use indirect capability flags instead of simple `if (plan === 'pro')`.
- Use IPC or separate processes to make patching harder.
- Break compatibility with patched versions on updates.

## Consequences

### Positive
- Significantly harder for casual users to bypass licensing.
- No trivial config-file edits.
- Works offline with cached license.
- Clean separation between UI and licensing logic.
- Easy migration to remote backend later.
- Stripe and Google remain the source of truth.

### Negative
- Determined attackers can still crack the app.
- Local private key storage is inherently insecure.
- Obfuscation increases build complexity.
- License refresh requires occasional internet access.
- Local Node backend adds distribution complexity.

## Future Considerations
- Move the Node backend to a remote server for real enforcement.
- Add telemetry (optional) to detect suspicious patterns.
- Add rate limiting and device binding once remote.
- Replace local private key with secure server-side signing.

## Decision Summary
Use a **local Node backend with signed licenses and obfuscated checks** to make unauthorized access inconvenient but not impossible, while preserving a clean migration path to a secure remote backend in the future.
