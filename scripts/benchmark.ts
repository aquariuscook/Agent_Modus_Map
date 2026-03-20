import { createApp } from '../src/api/server.js';
import { getDb, closeDb } from '../src/api/db/database.js';
import type { AddressInfo } from 'net';

async function run() {
  const db = getDb();
  const app = createApp(db);

  const server = app.listen(0, async () => {
    const port = (server.address() as AddressInfo).port;
    const base = `http://localhost:${port}`;

    const benchmarks: Array<{ name: string; ms: number; status: number }> = [];

    async function bench(name: string, url: string) {
      const start = performance.now();
      const res = await fetch(base + url);
      const elapsed = performance.now() - start;
      await res.json();
      benchmarks.push({ name, ms: Math.round(elapsed * 100) / 100, status: res.status });
    }

    await bench('GET /api/health', '/api/health');
    await bench('GET /api/swarms', '/api/swarms');
    await bench('GET /api/swarms/:id (full swarm)', '/api/swarms/ecommerce-standard-v1');
    await bench('GET /api/swarms/:id/export', '/api/swarms/ecommerce-standard-v1/export');
    await bench('Blast Radius (Catalog)', '/api/swarms/ecommerce-standard-v1/graph/blast-radius?agent=Catalog');
    await bench('Critical Path (Domino->Courier)', '/api/swarms/ecommerce-standard-v1/graph/critical-path?from=Domino&to=Courier');
    await bench('Single Points of Failure', '/api/swarms/ecommerce-standard-v1/graph/single-points-of-failure?threshold=2');
    await bench('Hub Agents', '/api/swarms/ecommerce-standard-v1/graph/hubs');

    console.log('\n=== API BENCHMARK (25 agents, 170 relationships) ===\n');
    for (const b of benchmarks) {
      const status = b.status === 200 ? 'OK' : `ERR:${b.status}`;
      console.log(`  [${status}] ${b.name.padEnd(42)} ${b.ms}ms`);
    }

    const total = benchmarks.reduce((sum, b) => sum + b.ms, 0);
    console.log(`\n  TOTAL${' '.repeat(38)}${Math.round(total * 100) / 100}ms`);
    console.log(`  All endpoints under 200ms: ${benchmarks.every(b => b.ms < 200) ? 'PASS' : 'FAIL'}`);
    console.log(`  All endpoints return 200:  ${benchmarks.every(b => b.status === 200) ? 'PASS' : 'FAIL'}`);

    server.close();
    closeDb();
  });
}

run();
