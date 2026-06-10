import type { Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  type User,
  type Role,
  getUserById,
  getPermissions,
  issueSessionToken,
  verifyToken,
} from './auth-service.js';
import {
  type LicensePlan,
  type LicenseStatus,
  type SubscriptionResolution,
  initSubscriptionStore,
} from './subscription-service.js';

export type Capability =
  | 'templates.full'
  | 'simulation.live'
  | 'docs.handoff'
  | 'deploy.once'
  | 'deploy.scheduled'
  | 'interview.view'
  | 'interview.conduct'
  | 'prospects.view'
  | 'prospects.generate'
  | 'prospects.export'
  | 'traces.capture'
  | 'traces.view'
  | 'traces.patterns'
  | 'support.priority'
  | 'auth.sso'
  | 'branding.whiteLabel'
  | 'hosting.selfHosted';

export interface LicenseSummary {
  plan: LicensePlan;
  status: LicenseStatus;
  source: SubscriptionResolution['source'];
  issuedAt: string;
  expiresAt: string;
  refreshAfter: string;
  needsRefresh: boolean;
  deviceFingerprint: string;
}

export interface AuthorizationState {
  authenticated: boolean;
  user: User | null;
  permissions: string[];
  capabilities: Capability[];
  featureFlags: Record<Capability, boolean>;
  license: LicenseSummary | null;
  warnings: string[];
  sessionToken: string | null;
}

interface LicenseClaims extends jwt.JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  plan: LicensePlan;
  status: LicenseStatus;
  source: SubscriptionResolution['source'];
  capabilities: Capability[];
  refreshAfter: string;
  deviceFingerprint: string;
}

type AuthenticatedRequest = Request & { auth?: AuthorizationState };

const LICENSE_ISSUER = 'agent-modus-map-local';
const LICENSE_AUDIENCE = 'agent-modus-map';

const PLAN_CAPABILITIES: Record<LicensePlan, Capability[]> = {
  free: ['traces.capture'],
  starter: ['traces.capture', 'traces.view', 'templates.full', 'simulation.live', 'docs.handoff', 'deploy.once', 'prospects.view', 'interview.view'],
  pro: [
    'traces.capture',
    'traces.view',
    'traces.patterns',
    'templates.full',
    'simulation.live',
    'docs.handoff',
    'deploy.once',
    'deploy.scheduled',
    'interview.view',
    'interview.conduct',
    'prospects.view',
    'prospects.generate',
    'prospects.export',
    'support.priority',
  ],
  enterprise: [
    'traces.capture',
    'traces.view',
    'traces.patterns',
    'templates.full',
    'simulation.live',
    'docs.handoff',
    'deploy.once',
    'deploy.scheduled',
    'interview.view',
    'interview.conduct',
    'prospects.view',
    'prospects.generate',
    'prospects.export',
    'support.priority',
    'auth.sso',
    'branding.whiteLabel',
    'hosting.selfHosted',
  ],
};

const CAPABILITY_MIN_PLAN: Record<Capability, LicensePlan> = {
  'templates.full': 'starter',
  'simulation.live': 'starter',
  'docs.handoff': 'starter',
  'deploy.once': 'starter',
  'deploy.scheduled': 'pro',
  'interview.view': 'starter',
  'interview.conduct': 'pro',
  'prospects.view': 'starter',
  'prospects.generate': 'pro',
  'prospects.export': 'pro',
  'traces.capture': 'free',
  'traces.view': 'starter',
  'traces.patterns': 'pro',
  'support.priority': 'pro',
  'auth.sso': 'enterprise',
  'branding.whiteLabel': 'enterprise',
  'hosting.selfHosted': 'enterprise',
};

export function initLicenseStore(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      refresh_after TEXT NOT NULL,
      device_fingerprint TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      license_path TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  initSubscriptionStore(db);
}

export async function issueLicense(
  db: Database.Database,
  user: User,
  subscription: SubscriptionResolution
): Promise<AuthorizationState> {
  ensureLicenseKeyPair();
  const privateKey = fs.readFileSync(getLicensePrivateKeyPath(), 'utf8');
  const publicKey = fs.readFileSync(getLicensePublicKeyPath(), 'utf8');
  const capabilities = PLAN_CAPABILITIES[subscription.plan];
  const now = new Date();
  const expiresAt = subscription.expiresAt || new Date(now.getTime() + getLicenseValidDays() * 24 * 60 * 60 * 1000).toISOString();
  const issuedAt = now.toISOString();
  const refreshAfter = subscription.refreshAfter || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const deviceFingerprint = getDeviceFingerprint();

  const token = jwt.sign({
    email: user.email,
    name: user.name,
    role: user.role,
    plan: subscription.plan,
    status: subscription.status,
    source: subscription.source,
    capabilities,
    refreshAfter,
    deviceFingerprint,
  }, privateKey, {
    algorithm: 'RS256',
    issuer: LICENSE_ISSUER,
    audience: LICENSE_AUDIENCE,
    subject: user.id,
    expiresIn: Math.max(60, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000)),
  });

  fs.mkdirSync(path.dirname(getLicensePath()), { recursive: true });
  fs.writeFileSync(getLicensePath(), token, { encoding: 'utf8', mode: 0o600 });

  verifyLicenseToken(token, publicKey);

  db.prepare(`
    INSERT INTO licenses (
      user_id, plan, status, source, issued_at, expires_at, refresh_after,
      device_fingerprint, capabilities_json, license_path, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      plan = excluded.plan,
      status = excluded.status,
      source = excluded.source,
      issued_at = excluded.issued_at,
      expires_at = excluded.expires_at,
      refresh_after = excluded.refresh_after,
      device_fingerprint = excluded.device_fingerprint,
      capabilities_json = excluded.capabilities_json,
      license_path = excluded.license_path,
      updated_at = excluded.updated_at
  `).run(
    user.id,
    subscription.plan,
    subscription.status,
    subscription.source,
    issuedAt,
    expiresAt,
    refreshAfter,
    deviceFingerprint,
    JSON.stringify(capabilities),
    getLicensePath()
  );

  const { token: sessionToken } = issueSessionToken(user, subscription.plan);
  return buildAuthorizationState(user, {
    plan: subscription.plan,
    status: subscription.status,
    source: subscription.source,
    issuedAt,
    expiresAt,
    refreshAfter,
    needsRefresh: new Date(refreshAfter).getTime() <= Date.now(),
    deviceFingerprint,
  }, sessionToken);
}

export async function issueRoleBackedLicense(db: Database.Database, user: User): Promise<AuthorizationState> {
  const rolePlan: Record<Role, LicensePlan> = {
    viewer: 'free',
    designer: 'pro',
    admin: 'enterprise',
  };

  return issueLicense(db, user, {
    plan: rolePlan[user.role],
    status: rolePlan[user.role] === 'free' ? 'free' : 'active',
    source: 'local-role',
    refreshAfter: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}

export async function resolveAuthorizationState(
  db: Database.Database,
  bearerToken?: string | null
): Promise<AuthorizationState> {
  const warnings: string[] = [];
  let sessionToken = bearerToken || null;
  let user: User | null = null;

  if (bearerToken) {
    const claims = verifyToken(bearerToken);
    if (claims) {
      user = getUserById(db, claims.userId);
    } else {
      warnings.push('Session expired or invalid.');
    }
  }

  const licenseRecord = readLicenseSummary();
  if (!user && licenseRecord) {
    user = getUserById(db, licenseRecord.claims.sub);
    if (user) {
      sessionToken = issueSessionToken(user, licenseRecord.summary.plan).token;
    }
  }

  if (!user || !licenseRecord) {
    return {
      authenticated: false,
      user: null,
      permissions: [],
      capabilities: [],
      featureFlags: createFeatureFlags([]),
      license: null,
      warnings,
      sessionToken,
    };
  }

  if (licenseRecord.summary.deviceFingerprint !== getDeviceFingerprint()) {
    warnings.push('License device fingerprint mismatch detected.');
  }

  if (licenseRecord.summary.needsRefresh) {
    warnings.push('License refresh is due.');
  }

  return {
    authenticated: true,
    user,
    permissions: getPermissions(user.role),
    capabilities: licenseRecord.claims.capabilities,
    featureFlags: createFeatureFlags(licenseRecord.claims.capabilities),
    license: licenseRecord.summary,
    warnings,
    sessionToken,
  };
}

export function createAuthorizationMiddleware(db: Database.Database) {
  return (req: Request, _res: Response, next: NextFunction) => {
    void resolveAuthorizationState(db, extractBearerToken(req))
      .then((auth) => {
        (req as AuthenticatedRequest).auth = auth;
        next();
      })
      .catch(next);
  };
}

export function requireCapability(capability: Capability) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getRequestAuth(req);
    if (!auth.authenticated) {
      res.status(401).json({ error: 'auth_required', message: 'Authentication is required for this feature.' });
      return;
    }

    if (!auth.featureFlags[capability]) {
      res.status(402).json({
        error: 'feature_locked',
        message: `This feature requires the ${requiredPlanForCapability(capability)} plan.`,
        capability,
        requiredPlan: requiredPlanForCapability(capability),
      });
      return;
    }

    next();
  };
}

export function getRequestAuth(req: Request): AuthorizationState {
  return (req as AuthenticatedRequest).auth || anonymousAuthorizationState();
}

export function hasCapability(auth: AuthorizationState, capability: Capability): boolean {
  return auth.featureFlags[capability];
}

export function filterTemplatesForAuthorization<T>(templates: T[], auth: AuthorizationState): T[] {
  return hasCapability(auth, 'templates.full') ? templates : templates.slice(0, 2);
}

export function requiredPlanForCapability(capability: Capability): LicensePlan {
  return CAPABILITY_MIN_PLAN[capability];
}

function anonymousAuthorizationState(): AuthorizationState {
  return {
    authenticated: false,
    user: null,
    permissions: [],
    capabilities: [],
    featureFlags: createFeatureFlags([]),
    license: null,
    warnings: [],
    sessionToken: null,
  };
}

function buildAuthorizationState(user: User, license: LicenseSummary, sessionToken: string | null): AuthorizationState {
  return {
    authenticated: true,
    user,
    permissions: getPermissions(user.role),
    capabilities: PLAN_CAPABILITIES[license.plan],
    featureFlags: createFeatureFlags(PLAN_CAPABILITIES[license.plan]),
    license,
    warnings: [],
    sessionToken,
  };
}

function createFeatureFlags(capabilities: Capability[]): Record<Capability, boolean> {
  const granted = new Set(capabilities);
  return Object.fromEntries(
    Object.keys(CAPABILITY_MIN_PLAN).map((capability) => [capability, granted.has(capability as Capability)])
  ) as Record<Capability, boolean>;
}

function readLicenseSummary(): { claims: LicenseClaims; summary: LicenseSummary } | null {
  if (!fs.existsSync(getLicensePath())) {
    return null;
  }

  const token = fs.readFileSync(getLicensePath(), 'utf8').trim();
  if (!token) {
    return null;
  }

  const publicKey = fs.readFileSync(getLicensePublicKeyPath(), 'utf8');
  const claims = verifyLicenseToken(token, publicKey);
  const expiresAt = claims.exp ? new Date(claims.exp * 1000).toISOString() : new Date().toISOString();
  const issuedAt = claims.iat ? new Date(claims.iat * 1000).toISOString() : new Date().toISOString();
  return {
    claims,
    summary: {
      plan: claims.plan,
      status: claims.status,
      source: claims.source,
      issuedAt,
      expiresAt,
      refreshAfter: claims.refreshAfter,
      needsRefresh: new Date(claims.refreshAfter).getTime() <= Date.now(),
      deviceFingerprint: claims.deviceFingerprint,
    },
  };
}

function verifyLicenseToken(token: string, publicKey: string): LicenseClaims {
  const claims = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: LICENSE_ISSUER,
    audience: LICENSE_AUDIENCE,
  }) as LicenseClaims;

  if (!claims.sub || !claims.email || !claims.plan || !claims.capabilities || !claims.refreshAfter || !claims.deviceFingerprint) {
    throw new Error('License token missing required claims');
  }
  return claims;
}

function ensureLicenseKeyPair(): void {
  fs.mkdirSync(getAppHome(), { recursive: true });
  if (fs.existsSync(getLicensePrivateKeyPath()) && fs.existsSync(getLicensePublicKeyPath())) {
    return;
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  fs.writeFileSync(getLicensePrivateKeyPath(), privateKey, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(getLicensePublicKeyPath(), publicKey, { encoding: 'utf8', mode: 0o644 });
}

function getDeviceFingerprint(): string {
  return crypto
    .createHash('sha256')
    .update([
      os.hostname(),
      os.platform(),
      os.arch(),
      os.userInfo().username,
    ].join('|'))
    .digest('hex');
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

function getLicenseValidDays(): number {
  return Number(process.env.AUTH_LICENSE_VALID_DAYS || 7);
}

function getAppHome(): string {
  return process.env.AGENT_MODUS_HOME || path.join(os.homedir(), '.agent-modus-map');
}

function getLicensePath(): string {
  return process.env.AGENT_MODUS_LICENSE_PATH || path.join(getAppHome(), 'license.jwt');
}

function getLicensePrivateKeyPath(): string {
  return process.env.AGENT_MODUS_LICENSE_PRIVATE_KEY_PATH || path.join(getAppHome(), 'license-private.pem');
}

function getLicensePublicKeyPath(): string {
  return process.env.AGENT_MODUS_LICENSE_PUBLIC_KEY_PATH || path.join(getAppHome(), 'license-public.pem');
}
