import { Router } from 'express';
import type Database from 'better-sqlite3';
import { SwarmService } from '../services/swarm-service.js';

export function createImportRoutes(db: Database.Database): Router {
  const router = Router();
  const swarmService = new SwarmService(db);

  // POST /api/import/csv - import agents from CSV data
  router.post('/csv', (req, res) => {
    const { csvData, swarmName } = req.body;
    if (!csvData || !swarmName) {
      return res.status(400).json({ error: 'csvData and swarmName are required' });
    }

    try {
      const result = parseAndImportCSV(db, swarmService, csvData, swarmName);
      res.status(201).json({ data: result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/import/template - download CSV template
  router.get('/template', (_req, res) => {
    const headers = [
      'Nickname', 'Emoji', 'Formal Name', 'Descriptor', 'Layer',
      'Badges', 'Core Task', 'Inputs', 'Outputs',
      'Depends On', 'Feeds Into', 'Collaborates With', 'Can Override',
      'Response Time', 'Confidence', 'Escalation Rate',
    ];

    const example = [
      'Doorbell', '🔔', 'Interface-FirstContact', 'The Greeter', 'Interface',
      'ENTRY;AUTO', 'Handles all initial customer inquiries across channels', 'Customer messages;Channel metadata',
      'Routed queries;Escalation flags', 'Catalog;Scribe', 'Compass;Echo', 'Vibe', '',
      '1.2', '85', '8',
    ];

    const csv = [headers.join(','), example.map(v => `"${v}"`).join(',')].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="agent_motus_template.csv"');
    res.send(csv);
  });

  return router;
}

function parseAndImportCSV(
  db: Database.Database,
  swarmService: SwarmService,
  csvData: string,
  swarmName: string
): { swarmId: string; agentsImported: number; relationshipsCreated: number } {
  const lines = csvData.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  // Map header indices
  const idx = {
    nickname: headers.indexOf('nickname'),
    emoji: headers.indexOf('emoji'),
    formalName: findIndex(headers, ['formal name', 'formalname', 'formal']),
    descriptor: headers.indexOf('descriptor'),
    layer: headers.indexOf('layer'),
    badges: headers.indexOf('badges'),
    coreTask: findIndex(headers, ['core task', 'coretask', 'task']),
    inputs: headers.indexOf('inputs'),
    outputs: headers.indexOf('outputs'),
    dependsOn: findIndex(headers, ['depends on', 'dependson']),
    feedsInto: findIndex(headers, ['feeds into', 'feedsinto']),
    collaboratesWith: findIndex(headers, ['collaborates with', 'collaborateswith', 'collaborates']),
    canOverride: findIndex(headers, ['can override', 'canoverride', 'override']),
    responseTime: findIndex(headers, ['response time', 'responsetime']),
    confidence: headers.indexOf('confidence'),
    escalationRate: findIndex(headers, ['escalation rate', 'escalationrate']),
  };

  if (idx.nickname === -1) throw new Error('CSV must have a "Nickname" column');

  // Collect unique layers
  const layerNames = new Set<string>();
  const agentRows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const nickname = getVal(values, idx.nickname);
    if (!nickname) continue;

    const layer = getVal(values, idx.layer) || 'Default';
    layerNames.add(layer);

    agentRows.push({
      nickname,
      emoji: getVal(values, idx.emoji) || '',
      formalName: getVal(values, idx.formalName) || nickname,
      descriptor: getVal(values, idx.descriptor) || '',
      layer,
      badges: splitSemicolon(getVal(values, idx.badges)),
      coreTask: getVal(values, idx.coreTask) || '',
      inputs: splitSemicolon(getVal(values, idx.inputs)),
      outputs: splitSemicolon(getVal(values, idx.outputs)),
      dependsOn: splitSemicolon(getVal(values, idx.dependsOn)),
      feedsInto: splitSemicolon(getVal(values, idx.feedsInto)),
      collaboratesWith: splitSemicolon(getVal(values, idx.collaboratesWith)),
      canOverride: splitSemicolon(getVal(values, idx.canOverride)),
      responseTime: parseFloat(getVal(values, idx.responseTime)) || 1.5,
      confidence: parseInt(getVal(values, idx.confidence)) || 85,
      escalationRate: parseInt(getVal(values, idx.escalationRate)) || 8,
    });
  }

  // Default layer colors
  const layerColors = ['#00d9ff', '#a855f7', '#22c55e', '#fbbf24', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
  const layerArr = [...layerNames].map((name, i) => ({
    name,
    colorTheme: layerColors[i % layerColors.length],
    order: i + 1,
  }));

  // Create swarm with layers
  const swarm = swarmService.create({ name: swarmName, layers: layerArr });

  // Build layer ID map
  const layerIdMap = new Map<string, string>();
  for (const layer of swarm.layers) {
    layerIdMap.set(layer.name, layer.id);
  }

  // Create agents
  const agentIdMap = new Map<string, string>();
  for (let i = 0; i < agentRows.length; i++) {
    const row = agentRows[i];
    const layerId = layerIdMap.get(row.layer) || swarm.layers[0]?.id;
    if (!layerId) continue;

    const agent = swarmService.addAgent(swarm.id, {
      nickname: row.nickname,
      formalName: row.formalName,
      descriptor: row.descriptor,
      layerId,
      badges: row.badges.filter((b: string) => b),
      position: { x: 150 + (i % 5) * 280, y: 150 + Math.floor(i / 5) * 220 },
      config: {
        emoji: row.emoji,
        coreTask: row.coreTask,
        inputs: row.inputs,
        outputs: row.outputs,
        health: {
          responseTime: row.responseTime,
          avgConfidence: row.confidence,
          escalationRate: row.escalationRate,
        },
      },
    });
    if (agent) agentIdMap.set(row.nickname, agent.id);
  }

  // Create relationships
  let relsCreated = 0;
  for (const row of agentRows) {
    const sourceId = agentIdMap.get(row.nickname);
    if (!sourceId) continue;

    for (const target of row.dependsOn) {
      const targetId = agentIdMap.get(target);
      if (targetId) {
        try { swarmService.addRelationship(swarm.id, { sourceAgentId: sourceId, targetAgentId: targetId, type: 'dependsOn', metadata: {} }); relsCreated++; } catch {}
      }
    }
    for (const target of row.feedsInto) {
      const targetId = agentIdMap.get(target);
      if (targetId) {
        try { swarmService.addRelationship(swarm.id, { sourceAgentId: sourceId, targetAgentId: targetId, type: 'feedsInto', metadata: {} }); relsCreated++; } catch {}
      }
    }
    for (const target of row.collaboratesWith) {
      const targetId = agentIdMap.get(target);
      if (targetId) {
        try { swarmService.addRelationship(swarm.id, { sourceAgentId: sourceId, targetAgentId: targetId, type: 'collaboratesWith', metadata: {} }); relsCreated++; } catch {}
      }
    }
    for (const target of row.canOverride) {
      const targetId = agentIdMap.get(target);
      if (targetId) {
        try { swarmService.addRelationship(swarm.id, { sourceAgentId: sourceId, targetAgentId: targetId, type: 'canOverride', metadata: {} }); relsCreated++; } catch {}
      }
    }
  }

  return { swarmId: swarm.id, agentsImported: agentRows.length, relationshipsCreated: relsCreated };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function getVal(values: string[], index: number): string {
  if (index === -1 || index >= values.length) return '';
  return values[index].replace(/^"|"$/g, '').trim();
}

function splitSemicolon(val: string): string[] {
  if (!val) return [];
  return val.split(/[;,]/).map(s => s.trim()).filter(s => s);
}

function findIndex(headers: string[], options: string[]): number {
  for (const opt of options) {
    const idx = headers.indexOf(opt);
    if (idx !== -1) return idx;
  }
  return -1;
}
