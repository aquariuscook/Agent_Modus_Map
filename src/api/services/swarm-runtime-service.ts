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

// In-memory store for active deployments and results
const deployments = new Map<string, DeployConfig>();
const runHistory = new Map<string, RunResult[]>(); // swarmId -> results
const timers = new Map<string, NodeJS.Timeout>();

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

    if (!runHistory.has(swarmId)) runHistory.set(swarmId, []);
    runHistory.get(swarmId)!.unshift(runResult); // newest first
    // Keep last 50 runs
    if (runHistory.get(swarmId)!.length > 50) runHistory.get(swarmId)!.pop();

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
    if (!runHistory.has(swarmId)) runHistory.set(swarmId, []);
    runHistory.get(swarmId)!.unshift(errorResult);
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
  return runHistory.get(swarmId) || [];
}

export function getAllDeployments(): DeployConfig[] {
  return Array.from(deployments.values());
}
