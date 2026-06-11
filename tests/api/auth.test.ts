import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import type Database from 'better-sqlite3';
import type { Express } from 'express';
import { createApp } from '../../src/api/server.js';
import { getTestDb } from '../../src/api/db/database.js';

let db: Database.Database;
let app: Express;
let authHome: string;

function makeDevGoogleToken(payload: { sub: string; email: string; name: string; plan?: string; picture?: string }): string {
  return `test-google:${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
}

beforeEach(() => {
  authHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-modus-auth-'));
  process.env.AGENT_MODUS_HOME = authHome;
  process.env.NODE_ENV = 'test';
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.PADDLE_API_KEY;

  db = getTestDb();
  app = createApp(db);
});

afterEach(() => {
  db.close();
  fs.rmSync(authHome, { recursive: true, force: true });
  delete process.env.AGENT_MODUS_HOME;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.PADDLE_API_KEY;
});

describe('Auth and licensing API', () => {
  it('returns anonymous state and community template access by default', async () => {
    const stateRes = await request(app).get('/api/auth/state');
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.data.authenticated).toBe(false);
    expect(stateRes.body.data.license).toBeNull();

    const templatesRes = await request(app).get('/api/templates');
    expect(templatesRes.status).toBe(200);
    expect(templatesRes.body.data).toHaveLength(2);
  });

  it('issues a role-backed enterprise license for local admin login', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@agentmodus.local', password: 'admin' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.authenticated).toBe(true);
    expect(loginRes.body.data.license.plan).toBe('enterprise');
    expect(loginRes.body.data.sessionToken).toBeTruthy();
    expect(loginRes.body.data.user.authProvider).toBe('password');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.data.sessionToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('admin@agentmodus.local');
    expect(meRes.body.data.featureFlags['traces.capture']).toBe(true);
  });

  it('activates a Google-backed pro license from a verified test token', async () => {
    const activateRes = await request(app)
      .post('/api/auth/google/activate')
      .send({
        idToken: makeDevGoogleToken({
          sub: 'google-user-1',
          email: 'pro-user@example.com',
          name: 'Pro User',
          plan: 'pro',
        }),
      });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.authenticated).toBe(true);
    expect(activateRes.body.data.user.email).toBe('pro-user@example.com');
    expect(activateRes.body.data.user.authProvider).toBe('google');
    expect(activateRes.body.data.license.plan).toBe('pro');
    expect(activateRes.body.data.featureFlags['interview.conduct']).toBe(true);

    const interviewRes = await request(app)
      .get('/api/interview/list')
      .set('Authorization', `Bearer ${activateRes.body.data.sessionToken}`);

    expect(interviewRes.status).toBe(200);
  });

  it('defaults Google activation to a free unverified license when Paddle is unavailable', async () => {
    const activateRes = await request(app)
      .post('/api/auth/google/activate')
      .send({
        idToken: makeDevGoogleToken({
          sub: 'google-user-2',
          email: 'free-user@example.com',
          name: 'Free User',
        }),
      });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.license.plan).toBe('free');
    expect(activateRes.body.data.license.status).toBe('unverified');
    expect(activateRes.body.data.featureFlags['interview.conduct']).toBe(false);

    const lockedRes = await request(app)
      .get('/api/interview/list')
      .set('Authorization', `Bearer ${activateRes.body.data.sessionToken}`);

    expect(lockedRes.status).toBe(402);
    expect(lockedRes.body.error).toBe('feature_locked');
  });

  it('grants traces.capture to free users but denies traces.view and traces.patterns', async () => {
    const activateRes = await request(app)
      .post('/api/auth/google/activate')
      .send({
        idToken: makeDevGoogleToken({
          sub: 'google-user-free-traces',
          email: 'free-traces@example.com',
          name: 'Free Traces',
        }),
      });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.featureFlags['traces.capture']).toBe(true);
    expect(activateRes.body.data.featureFlags['traces.view']).toBe(false);
    expect(activateRes.body.data.featureFlags['traces.patterns']).toBe(false);
  });

  it('grants traces.view and interview.view to starter users but denies traces.patterns', async () => {
    const activateRes = await request(app)
      .post('/api/auth/google/activate')
      .send({
        idToken: makeDevGoogleToken({
          sub: 'google-user-starter',
          email: 'starter@example.com',
          name: 'Starter User',
          plan: 'starter',
        }),
      });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.featureFlags['traces.view']).toBe(true);
    expect(activateRes.body.data.featureFlags['interview.view']).toBe(true);
    expect(activateRes.body.data.featureFlags['traces.patterns']).toBe(false);
  });

  it('grants traces.patterns and interview.conduct to pro users', async () => {
    const activateRes = await request(app)
      .post('/api/auth/google/activate')
      .send({
        idToken: makeDevGoogleToken({
          sub: 'google-user-pro-patterns',
          email: 'pro-patterns@example.com',
          name: 'Pro Patterns',
          plan: 'pro',
        }),
      });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.featureFlags['traces.patterns']).toBe(true);
    expect(activateRes.body.data.featureFlags['interview.conduct']).toBe(true);
  });

  it('stores a Google avatar when the client provides a picture fallback', async () => {
    const avatarUrl = 'https://example.com/google-avatar.png';
    const activateRes = await request(app)
      .post('/api/auth/google/activate')
      .send({
        idToken: makeDevGoogleToken({
          sub: 'google-user-3',
          email: 'avatar-user@example.com',
          name: 'Avatar User',
        }),
        picture: avatarUrl,
      });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.user.avatarUrl).toBe(avatarUrl);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${activateRes.body.data.sessionToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.avatarUrl).toBe(avatarUrl);
  });

  it('preserves a previously stored Google avatar when a later activation has no picture', async () => {
    const avatarUrl = 'https://example.com/kept-google-avatar.png';
    await request(app)
      .post('/api/auth/google/activate')
      .send({
        idToken: makeDevGoogleToken({
          sub: 'google-user-4',
          email: 'sticky-avatar@example.com',
          name: 'Sticky Avatar',
        }),
        picture: avatarUrl,
      });

    const activateRes = await request(app)
      .post('/api/auth/google/activate')
      .send({
        idToken: makeDevGoogleToken({
          sub: 'google-user-4',
          email: 'sticky-avatar@example.com',
          name: 'Sticky Avatar',
          plan: 'pro',
        }),
      });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.user.avatarUrl).toBe(avatarUrl);
  });
});
