// Swarm Runtime Service - runs swarms continuously inside the app
import type Database from 'better-sqlite3';
import type { Swarm } from '../../shared/types/index.js';
import { runLiveExecution, type LiveExecutionResult } from './live-execution-service.js';
import { SwarmService } from './swarm-service.js';

export interface DeployConfig {
  swarmId: string;
  query: string;
  schedule: 'once' | 'hourly' | 'daily' | 'weekly';
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error' | 'budget_reached';
  startedAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  totalCost: number;
  budgetLimit: number | null;
  error?: string;
}

export interface RunResult {
  id: string;
  swarmId: string;
  query: string;
  timestamp: string;
  durationMs: number;
  agentsProcessed: number;
  totalTokens: number;
  cost: number;
  status: 'success' | 'error';
  steps: any[];
  error?: string;
}

// In-memory store for active deployments (fine for runtime state)
const deployments = new Map<string, DeployConfig>();
const timers = new Map<string, NodeJS.Timeout>();

// Database reference for persisting results
let _db: Database.Database | null = null;

export function setRuntimeDb(db: Database.Database): void {
  _db = db;
}

function saveResultToDb(result: RunResult): void {
  if (!_db) return;
  try {
    const stmt = _db.prepare(`
      INSERT OR REPLACE INTO deploy_results (id, swarm_id, query, timestamp, duration_ms, agents_processed, total_tokens, cost, status, steps, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      result.id,
      result.swarmId,
      result.query,
      result.timestamp,
      result.durationMs,
      result.agentsProcessed,
      result.totalTokens,
      result.cost,
      result.status,
      JSON.stringify(result.steps),
      result.error || null,
    );
  } catch (err) {
    console.error('[RUNTIME] Failed to save result to database:', err);
  }
}

function loadResultsFromDb(swarmId: string): RunResult[] {
  if (!_db) return [];
  try {
    const rows = _db.prepare(
      'SELECT * FROM deploy_results WHERE swarm_id = ? ORDER BY timestamp DESC LIMIT 50'
    ).all(swarmId) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      swarmId: row.swarm_id,
      query: row.query,
      timestamp: row.timestamp,
      durationMs: row.duration_ms,
      agentsProcessed: row.agents_processed,
      totalTokens: row.total_tokens,
      cost: row.cost,
      status: row.status,
      steps: JSON.parse(row.steps || '[]'),
      error: row.error || undefined,
    }));
  } catch (err) {
    console.error('[RUNTIME] Failed to load results from database:', err);
    return [];
  }
}

function loadAllResultsFromDb(): RunResult[] {
  if (!_db) return [];
  try {
    const rows = _db.prepare(
      'SELECT * FROM deploy_results ORDER BY timestamp DESC LIMIT 50'
    ).all() as any[];
    return rows.map((row: any) => ({
      id: row.id,
      swarmId: row.swarm_id,
      query: row.query,
      timestamp: row.timestamp,
      durationMs: row.duration_ms,
      agentsProcessed: row.agents_processed,
      totalTokens: row.total_tokens,
      cost: row.cost,
      status: row.status,
      steps: JSON.parse(row.steps || '[]'),
      error: row.error || undefined,
    }));
  } catch (err) {
    console.error('[RUNTIME] Failed to load all results from database:', err);
    return [];
  }
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function getNextRunTime(schedule: string): string | null {
  const now = new Date();
  switch (schedule) {
    case 'hourly': return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    default: return null;
  }
}

function getIntervalMs(schedule: string): number | null {
  switch (schedule) {
    case 'hourly': return 60 * 60 * 1000;
    case 'daily': return 24 * 60 * 60 * 1000;
    case 'weekly': return 7 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

async function executeRun(swarmId: string, swarmService: SwarmService): Promise<void> {
  const config = deployments.get(swarmId);
  if (!config || config.status === 'stopped' || config.status === 'paused') return;

  const swarm = swarmService.findById(swarmId);
  if (!swarm) {
    config.status = 'error';
    config.error = 'Swarm not found';
    return;
  }

  console.log(`[RUNTIME] Executing swarm "${swarm.name}" run #${config.runCount + 1}`);

  try {
    const result = await runLiveExecution(swarm, config.query);

    const runResult: RunResult = {
      id: uid(),
      swarmId,
      query: config.query,
      timestamp: new Date().toISOString(),
      durationMs: result.totalDurationMs,
      agentsProcessed: result.steps.length,
      totalTokens: (result.totalInputTokens || 0) + (result.totalOutputTokens || 0),
      cost: result.totalCost || 0,
      status: result.status === 'completed' ? 'success' : 'error',
      steps: result.steps,
    };

    saveResultToDb(runResult);

    // Auto-save prospects to ruvector database
    const commandStep = result.steps.find(s => s.nickname === 'Command' && s.status === 'success');
    if (commandStep?.output) {
      try {
        const { saveProspectsFromRun } = await import('./prospect-service.js');
        const saved = await saveProspectsFromRun(runResult.id, commandStep.output);
        console.log(`[RUNTIME] Saved ${saved.newCount} new, ${saved.updatedCount} updated prospects to database`);
      } catch (err) {
        console.log('[RUNTIME] Failed to save prospects:', (err as Error).message);
      }
    }

    config.runCount++;
    config.totalCost += runResult.cost;
    config.lastRunAt = runResult.timestamp;
    config.nextRunAt = getNextRunTime(config.schedule);

    if (config.schedule === 'once') {
      config.status = 'completed';
    }

    // Check budget limit
    if (config.budgetLimit && config.totalCost >= config.budgetLimit) {
      config.status = 'budget_reached';
      console.log(`[RUNTIME] Budget limit reached ($${config.totalCost.toFixed(4)} >= $${config.budgetLimit}). Stopping.`);
      const timer = timers.get(swarmId);
      if (timer) { clearInterval(timer); timers.delete(swarmId); }
    }

    console.log(`[RUNTIME] Run complete. Cost: $${runResult.cost.toFixed(4)}, Agents: ${runResult.agentsProcessed}`);
  } catch (err: any) {
    config.error = err.message;
    config.status = 'error';
    console.log(`[RUNTIME] Run failed: ${err.message}`);

    const errorResult: RunResult = {
      id: uid(),
      swarmId,
      query: config.query,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      agentsProcessed: 0,
      totalTokens: 0,
      cost: 0,
      status: 'error',
      steps: [],
      error: err.message,
    };
    saveResultToDb(errorResult);
  }
}

export function deploySwarm(
  swarmId: string,
  query: string,
  schedule: 'once' | 'hourly' | 'daily' | 'weekly',
  swarmService: SwarmService,
  budgetLimit?: number
): DeployConfig {
  // Stop existing deployment if any
  stopSwarm(swarmId);

  const config: DeployConfig = {
    swarmId,
    query,
    schedule,
    status: 'running',
    startedAt: new Date().toISOString(),
    lastRunAt: null,
    nextRunAt: schedule === 'once' ? null : getNextRunTime(schedule),
    runCount: 0,
    totalCost: 0,
    budgetLimit: budgetLimit || null,
  };

  deployments.set(swarmId, config);

  // Run immediately
  executeRun(swarmId, swarmService);

  // Set up recurring runs if not "once"
  const intervalMs = getIntervalMs(schedule);
  if (intervalMs) {
    const timer = setInterval(() => {
      const currentConfig = deployments.get(swarmId);
      if (!currentConfig || currentConfig.status !== 'running') {
        clearInterval(timer);
        timers.delete(swarmId);
        return;
      }
      executeRun(swarmId, swarmService);
    }, intervalMs);
    timers.set(swarmId, timer);
  }

  return config;
}

export function pauseSwarm(swarmId: string): DeployConfig | null {
  const config = deployments.get(swarmId);
  if (!config) return null;
  config.status = 'paused';
  const timer = timers.get(swarmId);
  if (timer) { clearInterval(timer); timers.delete(swarmId); }
  return config;
}

export function resumeSwarm(swarmId: string, swarmService: SwarmService): DeployConfig | null {
  const config = deployments.get(swarmId);
  if (!config) return null;
  config.status = 'running';

  // Re-run immediately and set up interval
  executeRun(swarmId, swarmService);
  const intervalMs = getIntervalMs(config.schedule);
  if (intervalMs) {
    const timer = setInterval(() => {
      const c = deployments.get(swarmId);
      if (!c || c.status !== 'running') { clearInterval(timer); timers.delete(swarmId); return; }
      executeRun(swarmId, swarmService);
    }, intervalMs);
    timers.set(swarmId, timer);
  }

  return config;
}

export function stopSwarm(swarmId: string): DeployConfig | null {
  const config = deployments.get(swarmId);
  if (!config) return null;
  config.status = 'stopped';
  const timer = timers.get(swarmId);
  if (timer) { clearInterval(timer); timers.delete(swarmId); }
  return config;
}

export function getDeployStatus(swarmId: string): DeployConfig | null {
  return deployments.get(swarmId) || null;
}

export function getRunHistory(swarmId: string): RunResult[] {
  return loadResultsFromDb(swarmId);
}

export function getAllDeployments(): DeployConfig[] {
  return Array.from(deployments.values());
}

export function getAllResults(): RunResult[] {
  return loadAllResultsFromDb();
}
