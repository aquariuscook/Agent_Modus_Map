import { getDb, closeDb } from '../src/api/db/database.js';
import { GraphService } from '../src/api/services/graph-service.js';

const db = getDb();
const gs = new GraphService(db);
const swarmId = 'ecommerce-standard-v1';

console.log('=== GRAPH QUERY VALIDATION ===\n');

const blast = gs.blastRadius(swarmId, 'Catalog', 3);
console.log('Blast Radius for Catalog (agents that depend on it):');
blast.forEach(b => console.log(`  Hop ${b.hops}: ${b.nickname} [${b.badges.join(', ')}]`));
console.log(`  Total affected: ${blast.length}\n`);

const path = gs.criticalPath(swarmId, 'Domino', 'Courier');
console.log('Critical Path (Domino -> Courier):');
console.log(`  ${path?.path.join(' -> ') || 'NOT FOUND'}`);
console.log(`  Length: ${path?.length || 0}\n`);

const spofs = gs.singlePointsOfFailure(swarmId, 2);
console.log('Single Points of Failure (threshold >= 2 dependents):');
spofs.forEach(s => console.log(`  ${s.nickname}: ${s.dependents} dependents`));
console.log('');

const hubs = gs.hubAgents(swarmId);
console.log('Top Hub Agents (by total edge count):');
hubs.slice(0, 5).forEach(h => console.log(`  ${h.nickname}: ${h.totalEdges} edges`));

closeDb();
