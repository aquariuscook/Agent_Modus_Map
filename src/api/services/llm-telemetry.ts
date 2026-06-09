// LLM Call Telemetry — JSONL rolling file + SQLite stats
// Controlled by LLM_TELEMETRY env var (default: true). Set to false/0/no to disable.
// Each LLM call is appended as one JSON line to a rolling file.
// When the file exceeds LLM_TELEMETRY_MAX_BYTES (default 5 MB), it is rotated:
//   llm-calls.jsonl → llm-calls.jsonl.1 (old .1 → .2, up to .N)

import fs from 'fs';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../db/database.js';

// ── Config ──────────────────────────────────────────────────────────────────

const TELEMETRY_ENABLED = !['false', '0', 'no'].includes(
  (process.env.LLM_TELEMETRY ?? 'true').toLowerCase(),
);

const MAX_BYTES = parseInt(process.env.LLM_TELEMETRY_MAX_BYTES ?? '5242880', 10); // 5 MB
const MAX_ROTATIONS = parseInt(process.env.LLM_TELEMETRY_MAX_ROTATIONS ?? '3', 10); // .1, .2, .3
const LOG_DIR = process.env.LLM_TELEMETRY_DIR || path.join(process.cwd(), 'data', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'llm-calls.jsonl');

// ── Types ───────────────────────────────────────────────────────────────────

export interface TelemetryEntry {
  id: string;
  ts: string;
  caller: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  durationMs: number;
  success: boolean;
  error: string | null;
}

// ── Rolling file writer ─────────────────────────────────────────────────────

let dirEnsured = false;

function ensureLogDir(): void {
  if (dirEnsured) return;
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    dirEnsured = true;
  } catch {
    // Swallow — telemetry must never break the call
  }
}

function rotateIfNeeded(): void {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stat = fs.statSync(LOG_FILE);
    if (stat.size < MAX_BYTES) return;

    // Shift rotation: .N-1 → .N, ..., .1 → .2, original → .1
    for (let i = MAX_ROTATIONS; i >= 1; i--) {
      const older = `${LOG_FILE}.${i}`;
      const newer = i === 1 ? LOG_FILE : `${LOG_FILE}.${i - 1}`;
      if (fs.existsSync(newer)) {
        if (i === MAX_ROTATIONS) {
          fs.unlinkSync(older); // Drop oldest
        } else {
          fs.renameSync(newer, older);
        }
      }
    }
    // Current file → .1
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch {
    // Rotation failure must not block writes
  }
}

function appendJsonl(line: string): void {
  ensureLogDir();
  rotateIfNeeded();
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch {
    // Telemetry must never break the call
  }
}

// ── SQLite persistence (best-effort) ────────────────────────────────────────

function persistToSqlite(entry: TelemetryEntry): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO llm_calls (id, caller, provider, model, input_tokens, output_tokens, cached_tokens, duration_ms, success, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.id,
      entry.caller,
      entry.provider,
      entry.model,
      entry.inputTokens,
      entry.outputTokens,
      entry.cachedTokens,
      entry.durationMs,
      entry.success ? 1 : 0,
      entry.error,
    );
  } catch {
    // Swallow — telemetry must never break the call
  }
}

// ── Console one-liner ──────────────────────────────────────────────────────

function logConsole(entry: TelemetryEntry): void {
  const tokStr = `${entry.inputTokens ?? '?'}/${entry.outputTokens ?? '?'}/${entry.cachedTokens ?? '?'}`;
  const status = entry.success ? '✓' : `✗ ${entry.error?.slice(0, 60) ?? ''}`;
  const durStr = entry.durationMs >= 1000
    ? `${(entry.durationMs / 1000).toFixed(1)}s`
    : `${entry.durationMs}ms`;
  console.log(
    `[LLM] ${entry.caller} | ${entry.provider} ${entry.model} | ${tokStr} | ${durStr} ${status}`,
  );
}

// ── Public: record one LLM call ─────────────────────────────────────────────

export function recordTelemetry(fields: {
  caller: string;
  provider: string;
  model: string;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  cachedTokens: number | undefined;
  durationMs: number;
  success: boolean;
  error?: string;
}): void {
  if (!TELEMETRY_ENABLED) return;

  const entry: TelemetryEntry = {
    id: uuidv7(),
    ts: new Date().toISOString(),
    caller: fields.caller,
    provider: fields.provider,
    model: fields.model,
    inputTokens: fields.inputTokens ?? null,
    outputTokens: fields.outputTokens ?? null,
    cachedTokens: fields.cachedTokens ?? null,
    durationMs: fields.durationMs,
    success: fields.success,
    error: fields.error ?? null,
  };

  // 1. Console (always immediate)
  logConsole(entry);

  // 2. JSONL rolling file (fire-and-forget)
  try {
    appendJsonl(JSON.stringify(entry));
  } catch {
    // Swallow
  }

  // 3. SQLite (best-effort, for dashboard queries)
  persistToSqlite(entry);
}

// ── Public: aggregated stats from SQLite ────────────────────────────────────

export function getLLMStats(since?: string): {
  totalCalls: number;
  successRate: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  avgDurationMs: number;
  byProvider: Record<string, { calls: number; inputTokens: number; outputTokens: number }>;
  byCaller: Record<string, { calls: number; inputTokens: number; outputTokens: number }>;
} {
  const empty = {
    totalCalls: 0, successRate: 0, totalInputTokens: 0, totalOutputTokens: 0,
    totalCachedTokens: 0, avgDurationMs: 0,
    byProvider: {} as Record<string, { calls: number; inputTokens: number; outputTokens: number }>,
    byCaller: {} as Record<string, { calls: number; inputTokens: number; outputTokens: number }>,
  };

  try {
    const db = getDb();
    const where = since ? `WHERE ts >= '${since}'` : '';

    const row = db.prepare(
      `SELECT
        COUNT(*) as totalCalls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
        COALESCE(SUM(input_tokens), 0) as totalInputTokens,
        COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
        COALESCE(SUM(cached_tokens), 0) as totalCachedTokens,
        COALESCE(AVG(duration_ms), 0) as avgDurationMs
       FROM llm_calls ${where}`,
    ).get() as any;

    const byProviderRows = db.prepare(
      `SELECT provider, COUNT(*) as calls,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens
       FROM llm_calls ${where} GROUP BY provider`,
    ).all() as any[];

    const byCallerRows = db.prepare(
      `SELECT caller, COUNT(*) as calls,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens
       FROM llm_calls ${where} GROUP BY caller`,
    ).all() as any[];

    return {
      totalCalls: row.totalCalls || 0,
      successRate: row.totalCalls ? row.successes / row.totalCalls : 0,
      totalInputTokens: row.totalInputTokens || 0,
      totalOutputTokens: row.totalOutputTokens || 0,
      totalCachedTokens: row.totalCachedTokens || 0,
      avgDurationMs: Math.round(row.avgDurationMs || 0),
      byProvider: Object.fromEntries(
        byProviderRows.map((r: any) => [r.provider, { calls: r.calls, inputTokens: r.inputTokens, outputTokens: r.outputTokens }]),
      ),
      byCaller: Object.fromEntries(
        byCallerRows.map((r: any) => [r.caller, { calls: r.calls, inputTokens: r.inputTokens, outputTokens: r.outputTokens }]),
      ),
    };
  } catch {
    return empty;
  }
}

/** Check if telemetry is enabled (useful for health/status endpoints). */
export function isTelemetryEnabled(): boolean {
  return TELEMETRY_ENABLED;
}

/** Return the current log file path and size (for diagnostics). */
export function getTelemetryLogInfo(): { path: string; sizeBytes: number | null; rotations: number } {
  try {
    if (!fs.existsSync(LOG_FILE)) return { path: LOG_FILE, sizeBytes: null, rotations: 0 };
    const size = fs.statSync(LOG_FILE).size;
    let rotations = 0;
    for (let i = 1; i <= MAX_ROTATIONS; i++) {
      if (fs.existsSync(`${LOG_FILE}.${i}`)) rotations = i;
    }
    return { path: LOG_FILE, sizeBytes: size, rotations };
  } catch {
    return { path: LOG_FILE, sizeBytes: null, rotations: 0 };
  }
}
