import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb } from '../../src/api/db/database.js';
import { initAuditStore, appendAuditEntry, getAuditLog, verifyAuditChain } from '../../src/api/db/audit-store.js';
import type Database from 'better-sqlite3';

describe('Governance / Audit Store', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getTestDb();
    initAuditStore(db);
  });

  it('should append and retrieve audit entries', () => {
    appendAuditEntry(db, {
      id: 'audit-1',
      swarmId: 'test-swarm',
      action: 'agent.created' as any,
      userId: 'user-1',
      userName: 'Anne',
      details: { nickname: 'Orchestrator' },
      timestamp: new Date().toISOString(),
    });

    const entries = getAuditLog(db, 'test-swarm');
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('agent.created');
    expect(entries[0].userName).toBe('Anne');
    expect(entries[0].details).toEqual({ nickname: 'Orchestrator' });
  });

  it('should maintain chain integrity', () => {
    for (let i = 0; i < 5; i++) {
      appendAuditEntry(db, {
        id: `audit-${i}`,
        swarmId: 'test-swarm',
        action: 'agent.updated' as any,
        userId: 'user-1',
        userName: 'Anne',
        details: { step: i },
        timestamp: new Date().toISOString(),
      });
    }

    const result = verifyAuditChain(db, 'test-swarm');
    expect(result.valid).toBe(true);
  });

  it('should filter audit entries by action', () => {
    appendAuditEntry(db, {
      id: 'a1', swarmId: 'test-swarm', action: 'agent.created' as any,
      userId: 'u1', userName: 'Anne', details: {}, timestamp: new Date().toISOString(),
    });
    appendAuditEntry(db, {
      id: 'a2', swarmId: 'test-swarm', action: 'agent.deleted' as any,
      userId: 'u1', userName: 'Anne', details: {}, timestamp: new Date().toISOString(),
    });

    const created = getAuditLog(db, 'test-swarm', { action: 'agent.created' });
    expect(created).toHaveLength(1);
    expect(created[0].action).toBe('agent.created');
  });

  it('should support pagination', () => {
    for (let i = 0; i < 10; i++) {
      appendAuditEntry(db, {
        id: `a-${i}`, swarmId: 'test-swarm', action: 'agent.updated' as any,
        userId: 'u1', userName: 'Anne', details: { i }, timestamp: new Date(Date.now() + i * 1000).toISOString(),
      });
    }

    const page1 = getAuditLog(db, 'test-swarm', { limit: 5 });
    expect(page1).toHaveLength(5);

    const page2 = getAuditLog(db, 'test-swarm', { limit: 5, offset: 5 });
    expect(page2).toHaveLength(5);
  });
});
