import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath || path.join(process.cwd(), 'data', 'agent-modus.db');
  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

export function getTestDb(): Database.Database {
  const testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  initSchema(testDb);
  return testDb;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS swarms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      template_source TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS layers (
      id TEXT PRIMARY KEY,
      swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color_theme TEXT NOT NULL,
      display_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL,
      formal_name TEXT NOT NULL,
      descriptor TEXT NOT NULL,
      layer_id TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
      badges TEXT NOT NULL DEFAULT '[]',
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      config TEXT NOT NULL DEFAULT '{}',
      UNIQUE(swarm_id, nickname)
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
      source_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      target_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('dependsOn', 'feedsInto', 'collaboratesWith', 'canOverride')),
      metadata TEXT NOT NULL DEFAULT '{}',
      UNIQUE(swarm_id, source_agent_id, target_agent_id, type)
    );

    CREATE INDEX IF NOT EXISTS idx_agents_swarm ON agents(swarm_id);
    CREATE INDEX IF NOT EXISTS idx_agents_layer ON agents(layer_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_swarm ON relationships(swarm_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_agent_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_agent_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);

    CREATE TABLE IF NOT EXISTS deploy_results (
      id TEXT PRIMARY KEY,
      swarm_id TEXT NOT NULL,
      query TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      duration_ms INTEGER,
      agents_processed INTEGER,
      total_tokens INTEGER,
      cost REAL,
      status TEXT,
      steps TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_deploy_results_swarm ON deploy_results(swarm_id);
    CREATE INDEX IF NOT EXISTS idx_deploy_results_timestamp ON deploy_results(timestamp);
  `);
}
