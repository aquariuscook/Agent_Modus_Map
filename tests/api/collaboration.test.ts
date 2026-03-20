import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb } from '../../src/api/db/database.js';
import {
  initVersionStore, saveVersion, getVersionHistory, getVersion, diffVersions,
  addComment, getComments, resolveComment,
} from '../../src/api/db/version-store.js';
import type Database from 'better-sqlite3';

describe('Collaboration / Version Store', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getTestDb();
    initVersionStore(db);
  });

  it('should save and retrieve versions', () => {
    saveVersion(db, {
      id: 'v1', swarmId: 'test-swarm', version: 1,
      snapshot: JSON.stringify({ agents: [{ id: 'a1', nickname: 'Orch' }] }),
      changeDescription: 'Initial version', userId: 'u1', userName: 'Anne',
      timestamp: new Date().toISOString(),
    });

    const history = getVersionHistory(db, 'test-swarm');
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(1);
    expect(history[0].changeDescription).toBe('Initial version');
  });

  it('should retrieve a specific version with snapshot', () => {
    saveVersion(db, {
      id: 'v1', swarmId: 'test-swarm', version: 1,
      snapshot: JSON.stringify({ agents: [{ id: 'a1', nickname: 'Orch' }] }),
      changeDescription: 'V1', userId: 'u1', userName: 'Anne',
      timestamp: new Date().toISOString(),
    });

    const version = getVersion(db, 'test-swarm', 1);
    expect(version).not.toBeNull();
    const snapshot = JSON.parse(version!.snapshot);
    expect(snapshot.agents[0].nickname).toBe('Orch');
  });

  it('should diff two versions', () => {
    saveVersion(db, {
      id: 'v1', swarmId: 'test-swarm', version: 1,
      snapshot: JSON.stringify({
        agents: [{ id: 'a1', nickname: 'Orch' }, { id: 'a2', nickname: 'Router' }],
        relationships: [{ id: 'r1' }],
      }),
      changeDescription: 'V1', userId: 'u1', userName: 'Anne', timestamp: new Date().toISOString(),
    });

    saveVersion(db, {
      id: 'v2', swarmId: 'test-swarm', version: 2,
      snapshot: JSON.stringify({
        agents: [{ id: 'a1', nickname: 'Orch' }, { id: 'a3', nickname: 'Logger' }],
        relationships: [{ id: 'r1' }, { id: 'r2' }],
      }),
      changeDescription: 'Added Logger, removed Router', userId: 'u1', userName: 'Anne', timestamp: new Date().toISOString(),
    });

    const diff = diffVersions(db, 'test-swarm', 1, 2);
    expect(diff.added.agents).toContain('Logger');
    expect(diff.removed.agents).toContain('Router');
    expect(diff.added.relationships).toContain('r2');
  });

  it('should add and retrieve comments', () => {
    addComment(db, {
      id: 'c1', swarmId: 'test-swarm', userId: 'u1', userName: 'Anne',
      content: 'This agent needs more connections', resolved: false,
      timestamp: new Date().toISOString(),
    });

    const comments = getComments(db, 'test-swarm');
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe('This agent needs more connections');
    expect(comments[0].resolved).toBe(false);
  });

  it('should resolve comments', () => {
    addComment(db, {
      id: 'c1', swarmId: 'test-swarm', userId: 'u1', userName: 'Anne',
      content: 'Fix this', resolved: false, timestamp: new Date().toISOString(),
    });

    resolveComment(db, 'c1');

    const comments = getComments(db, 'test-swarm');
    expect(comments[0].resolved).toBe(true);
  });

  it('should filter comments by agent', () => {
    addComment(db, {
      id: 'c1', swarmId: 'test-swarm', agentId: 'agent-1', userId: 'u1', userName: 'Anne',
      content: 'For agent 1', resolved: false, timestamp: new Date().toISOString(),
    });
    addComment(db, {
      id: 'c2', swarmId: 'test-swarm', userId: 'u1', userName: 'Anne',
      content: 'General comment', resolved: false, timestamp: new Date().toISOString(),
    });

    const agentComments = getComments(db, 'test-swarm', 'agent-1');
    expect(agentComments).toHaveLength(1);
    expect(agentComments[0].content).toBe('For agent 1');
  });
});
