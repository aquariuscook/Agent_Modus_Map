import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb } from '../../src/api/db/database.js';
import { initDecisionTraceStore, insertDecisionTrace, getDecisionTraces, getDecisionTrace, detectTracePatterns } from '../../src/api/db/decision-trace-store.js';
import type Database from 'better-sqlite3';

describe('Decision Trace Store', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getTestDb();
    initDecisionTraceStore(db);
  });

  const makeTrace = (overrides = {}) => ({
    id: `trace-${Math.random().toString(36).slice(2)}`,
    swarmId: 'test-swarm',
    agentId: 'agent-1',
    agentNickname: 'Orchestrator',
    title: 'Route customer request',
    timestamp: new Date().toISOString(),
    stages: [
      { stage: 'observation' as const, content: 'Incoming request from user', timestamp: new Date().toISOString() },
      { stage: 'reasoning' as const, content: 'Request type is billing', timestamp: new Date().toISOString() },
      { stage: 'action' as const, content: 'Route to BillingAgent', timestamp: new Date().toISOString() },
      { stage: 'outcome' as const, content: 'Successfully routed', timestamp: new Date().toISOString() },
    ],
    tags: ['routing', 'billing'],
    confidence: 0.92,
    durationMs: 145,
    ...overrides,
  });

  it('should insert and retrieve a decision trace', () => {
    const trace = makeTrace();
    insertDecisionTrace(db, trace);

    const retrieved = getDecisionTrace(db, trace.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe('Route customer request');
    expect(retrieved!.stages).toHaveLength(4);
    expect(retrieved!.confidence).toBe(0.92);
  });

  it('should list traces by swarm', () => {
    insertDecisionTrace(db, makeTrace());
    insertDecisionTrace(db, makeTrace({ id: 'trace-2', title: 'Escalate issue' }));
    insertDecisionTrace(db, makeTrace({ id: 'trace-3', swarmId: 'other-swarm' }));

    const traces = getDecisionTraces(db, 'test-swarm');
    expect(traces).toHaveLength(2);
  });

  it('should filter traces by agent', () => {
    insertDecisionTrace(db, makeTrace());
    insertDecisionTrace(db, makeTrace({ id: 'trace-2', agentId: 'agent-2', agentNickname: 'Billing' }));

    const traces = getDecisionTraces(db, 'test-swarm', { agentId: 'agent-1' });
    expect(traces).toHaveLength(1);
    expect(traces[0].agentNickname).toBe('Orchestrator');
  });

  it('should filter traces by tag', () => {
    insertDecisionTrace(db, makeTrace({ tags: ['routing', 'billing'] }));
    insertDecisionTrace(db, makeTrace({ id: 'trace-2', tags: ['escalation'] }));

    const traces = getDecisionTraces(db, 'test-swarm', { tag: 'billing' });
    expect(traces).toHaveLength(1);
  });

  it('should detect patterns from tags', () => {
    insertDecisionTrace(db, makeTrace({ tags: ['routing', 'billing'] }));
    insertDecisionTrace(db, makeTrace({ id: 't2', tags: ['routing', 'support'] }));
    insertDecisionTrace(db, makeTrace({ id: 't3', tags: ['billing'] }));

    const patterns = detectTracePatterns(db, 'test-swarm');
    expect(patterns.length).toBeGreaterThanOrEqual(2);

    const routingPattern = patterns.find(p => p.pattern === 'routing');
    expect(routingPattern).toBeDefined();
    expect(routingPattern!.occurrences).toBe(2);
  });

  it('should return null for non-existent trace', () => {
    const result = getDecisionTrace(db, 'nonexistent');
    expect(result).toBeNull();
  });
});
