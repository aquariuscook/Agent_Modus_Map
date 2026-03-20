// Time-series health data storage (ADR-009)
import type Database from 'better-sqlite3';

export interface HealthReport {
  agentId: string;
  agentNickname: string;
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  throughput: number;
  errorRate: number;
  cpuPercent: number;
  memoryMb: number;
}

export interface AgentHealthSummary {
  agentId: string;
  nickname: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyP95: number;
  throughput: number;
  errorRate: number;
  cpuPercent: number;
  memoryMb: number;
  lastReportAt: string;
  history: Array<{ timestamp: string; latencyP95: number; throughput: number; errorRate: number; status: string }>;
}

export function initHealthStore(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      agent_nickname TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      latency_p50 REAL NOT NULL,
      latency_p95 REAL NOT NULL,
      latency_p99 REAL NOT NULL,
      throughput REAL NOT NULL,
      error_rate REAL NOT NULL,
      cpu_percent REAL NOT NULL,
      memory_mb REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_health_agent ON health_reports(agent_id);
    CREATE INDEX IF NOT EXISTS idx_health_timestamp ON health_reports(timestamp);
    CREATE INDEX IF NOT EXISTS idx_health_agent_ts ON health_reports(agent_id, timestamp);
  `);
}

export function insertHealthReport(db: Database.Database, report: HealthReport): void {
  db.prepare(`
    INSERT INTO health_reports (agent_id, agent_nickname, timestamp, status, latency_p50, latency_p95, latency_p99, throughput, error_rate, cpu_percent, memory_mb)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.agentId, report.agentNickname, report.timestamp, report.status,
    report.latencyP50, report.latencyP95, report.latencyP99,
    report.throughput, report.errorRate, report.cpuPercent, report.memoryMb
  );
}

export function getLatestHealth(db: Database.Database, swarmId: string): AgentHealthSummary[] {
  // Get all agents for this swarm
  const agents = db.prepare('SELECT id, nickname FROM agents WHERE swarm_id = ?').all(swarmId) as Array<{ id: string; nickname: string }>;

  const getLatest = db.prepare(`
    SELECT * FROM health_reports WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 1
  `);

  const getHistory = db.prepare(`
    SELECT timestamp, latency_p95, throughput, error_rate, status
    FROM health_reports
    WHERE agent_id = ?
    ORDER BY timestamp DESC
    LIMIT 30
  `);

  return agents.map(agent => {
    const latest = getLatest.get(agent.id) as any;
    const history = (getHistory.all(agent.id) as any[]).reverse();

    if (!latest) {
      return {
        agentId: agent.id,
        nickname: agent.nickname,
        status: 'unknown' as const,
        latencyP95: 0,
        throughput: 0,
        errorRate: 0,
        cpuPercent: 0,
        memoryMb: 0,
        lastReportAt: '',
        history: [],
      };
    }

    return {
      agentId: agent.id,
      nickname: agent.nickname,
      status: latest.status,
      latencyP95: latest.latency_p95,
      throughput: latest.throughput,
      errorRate: latest.error_rate,
      cpuPercent: latest.cpu_percent,
      memoryMb: latest.memory_mb,
      lastReportAt: latest.timestamp,
      history: history.map((h: any) => ({
        timestamp: h.timestamp,
        latencyP95: h.latency_p95,
        throughput: h.throughput,
        errorRate: h.error_rate,
        status: h.status,
      })),
    };
  });
}

export function getSwarmHealthSummary(db: Database.Database, swarmId: string) {
  const agents = getLatestHealth(db, swarmId);
  const counts = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
  for (const a of agents) {
    counts[a.status]++;
  }

  const overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' =
    counts.unhealthy > 0 ? 'unhealthy' :
    counts.degraded > 0 ? 'degraded' :
    counts.unknown === agents.length ? 'unknown' :
    'healthy';

  return { overall, counts, agentCount: agents.length };
}
