// Template service implementing ADR-005 (Template-First UX)
import type Database from 'better-sqlite3';
import { v7 as uuidv7 } from 'uuid';
import type { Swarm, Badge } from '../../shared/types/index.js';

export interface SwarmTemplate {
  id: string;
  name: string;
  domain: string;
  description: string;
  agentCount: number;
  layerCount: number;
  tags: string[];
  layers: Array<{ name: string; colorTheme: string; order: number }>;
  agents: Array<{
    nickname: string;
    formalName: string;
    descriptor: string;
    layerIndex: number;
    badges: Badge[];
    positionIndex: number;
  }>;
  relationships: Array<{
    sourceNickname: string;
    targetNickname: string;
    type: 'dependsOn' | 'feedsInto' | 'collaboratesWith' | 'canOverride';
  }>;
}

const templates: SwarmTemplate[] = [
  {
    id: 'customer-service-v1',
    name: 'Customer Service Center',
    domain: 'Support',
    description: '18-agent swarm for multi-tier customer support with sentiment analysis, escalation management, and knowledge base integration.',
    agentCount: 18,
    layerCount: 4,
    tags: ['customer-service', 'support', 'escalation', 'sentiment'],
    layers: [
      { name: 'Intake & Triage', colorTheme: '#00d9ff', order: 1 },
      { name: 'Resolution', colorTheme: '#a855f7', order: 2 },
      { name: 'Escalation & Oversight', colorTheme: '#22c55e', order: 3 },
      { name: 'Analytics & Learning', colorTheme: '#fbbf24', order: 4 },
    ],
    agents: [
      { nickname: 'Portal', formalName: 'Interface-Intake-Multichannel', descriptor: 'The Front Door', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'Triage', formalName: 'Workflow-Classifier-Priority', descriptor: 'The Sorter', layerIndex: 0, badges: ['AUTO', 'CRITICAL'], positionIndex: 1 },
      { nickname: 'Mood', formalName: 'Interface-Sentiment-Realtime', descriptor: 'The Empath', layerIndex: 0, badges: ['ALWAYS_ON', 'ADVISORY'], positionIndex: 2 },
      { nickname: 'Queue', formalName: 'Workflow-Router-Assignment', descriptor: 'The Dispatcher', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 3 },
      { nickname: 'Atlas', formalName: 'Data-KnowledgeBase-Search', descriptor: 'The Librarian', layerIndex: 1, badges: ['HUB', 'AUTO'], positionIndex: 0 },
      { nickname: 'Solver', formalName: 'Workflow-Resolution-Auto', descriptor: 'The Fixer', layerIndex: 1, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Scribble', formalName: 'Content-Response-Draft', descriptor: 'The Writer', layerIndex: 1, badges: ['AUTO', 'MEDIUM'], positionIndex: 2 },
      { nickname: 'Checklist', formalName: 'Workflow-Verification-QA', descriptor: 'The Proofreader', layerIndex: 1, badges: ['AUTO'], positionIndex: 3 },
      { nickname: 'Translate', formalName: 'Content-Localize-Response', descriptor: 'The Interpreter', layerIndex: 1, badges: ['AUTO', 'MEDIUM'], positionIndex: 4 },
      { nickname: 'Ladder', formalName: 'Workflow-Escalation-TierRoute', descriptor: 'The Elevator', layerIndex: 2, badges: ['CRITICAL', 'HUMAN'], positionIndex: 0 },
      { nickname: 'Captain', formalName: 'Workflow-Supervisor-Override', descriptor: 'The Boss', layerIndex: 2, badges: ['CRITICAL', 'CAN_OVERRIDE', 'HUMAN'], positionIndex: 1 },
      { nickname: 'Witness', formalName: 'Workflow-Logger-Interactions', descriptor: 'The Recorder', layerIndex: 2, badges: ['HUB', 'CRITICAL', 'LOGS_ALL'], positionIndex: 2 },
      { nickname: 'Alarm', formalName: 'Alert-SLA-Breach', descriptor: 'The Watchdog', layerIndex: 2, badges: ['ALWAYS_ON', 'CAN_OVERRIDE'], positionIndex: 3 },
      { nickname: 'Pulse', formalName: 'Monitor-Performance-Agents', descriptor: 'The Health Check', layerIndex: 2, badges: ['ALWAYS_ON', 'CRITICAL'], positionIndex: 4 },
      { nickname: 'Trend', formalName: 'Intelligence-Pattern-Issues', descriptor: 'The Spotter', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 0 },
      { nickname: 'Score', formalName: 'Intelligence-CSAT-Predictor', descriptor: 'The Rater', layerIndex: 3, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Coach', formalName: 'Intelligence-AgentTraining', descriptor: 'The Mentor', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 2 },
      { nickname: 'Dashboard', formalName: 'Intelligence-Reporting-Ops', descriptor: 'The Summarizer', layerIndex: 3, badges: ['AUTO'], positionIndex: 3 },
    ],
    relationships: [
      ['Portal', 'Triage', 'feedsInto'], ['Portal', 'Mood', 'collaboratesWith'],
      ['Triage', 'Queue', 'feedsInto'], ['Triage', 'Mood', 'dependsOn'],
      ['Queue', 'Solver', 'feedsInto'], ['Queue', 'Ladder', 'feedsInto'],
      ['Solver', 'Atlas', 'dependsOn'], ['Solver', 'Scribble', 'feedsInto'],
      ['Scribble', 'Checklist', 'feedsInto'], ['Scribble', 'Translate', 'collaboratesWith'],
      ['Checklist', 'Portal', 'feedsInto'], ['Ladder', 'Captain', 'feedsInto'],
      ['Captain', 'Solver', 'canOverride'], ['Witness', 'Trend', 'feedsInto'],
      ['Alarm', 'Captain', 'feedsInto'], ['Alarm', 'Ladder', 'canOverride'],
      ['Pulse', 'Alarm', 'feedsInto'], ['Trend', 'Coach', 'feedsInto'],
      ['Score', 'Dashboard', 'feedsInto'], ['Mood', 'Score', 'feedsInto'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'content-ops-v1',
    name: 'Content Operations',
    domain: 'Media',
    description: '15-agent swarm for content creation, review, optimization, and publishing pipelines with brand compliance.',
    agentCount: 15,
    layerCount: 4,
    tags: ['content', 'media', 'marketing', 'publishing', 'seo'],
    layers: [
      { name: 'Content Creation', colorTheme: '#a855f7', order: 1 },
      { name: 'Review & Compliance', colorTheme: '#22c55e', order: 2 },
      { name: 'Optimization & Distribution', colorTheme: '#00d9ff', order: 3 },
      { name: 'Analytics & Performance', colorTheme: '#fbbf24', order: 4 },
    ],
    agents: [
      { nickname: 'Brief', formalName: 'Workflow-ContentBrief-Intake', descriptor: 'The Planner', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'Quill', formalName: 'Content-Generator-LongForm', descriptor: 'The Author', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Pixel', formalName: 'Content-Generator-Visual', descriptor: 'The Designer', layerIndex: 0, badges: ['AUTO', 'MEDIUM'], positionIndex: 2 },
      { nickname: 'Clip', formalName: 'Content-Generator-Video', descriptor: 'The Director', layerIndex: 0, badges: ['AUTO', 'MEDIUM'], positionIndex: 3 },
      { nickname: 'Brand', formalName: 'Review-Compliance-BrandVoice', descriptor: 'The Guardian', layerIndex: 1, badges: ['CRITICAL', 'APPROVAL'], positionIndex: 0 },
      { nickname: 'Legal', formalName: 'Review-Compliance-Legal', descriptor: 'The Counsel', layerIndex: 1, badges: ['CRITICAL', 'HUMAN'], positionIndex: 1 },
      { nickname: 'Editor', formalName: 'Review-Quality-Editorial', descriptor: 'The Perfectionist', layerIndex: 1, badges: ['HUMAN', 'CAN_OVERRIDE'], positionIndex: 2 },
      { nickname: 'Boost', formalName: 'Optimize-SEO-Keywords', descriptor: 'The Ranker', layerIndex: 2, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 0 },
      { nickname: 'Format', formalName: 'Optimize-Adapt-MultiFormat', descriptor: 'The Shapeshifter', layerIndex: 2, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Schedule', formalName: 'Distribution-Publish-Calendar', descriptor: 'The Timekeeper', layerIndex: 2, badges: ['AUTO', 'CRITICAL'], positionIndex: 2 },
      { nickname: 'Broadcast', formalName: 'Distribution-MultiChannel', descriptor: 'The Megaphone', layerIndex: 2, badges: ['AUTO'], positionIndex: 3 },
      { nickname: 'Tracker', formalName: 'Analytics-Performance-Content', descriptor: 'The Scorekeeper', layerIndex: 3, badges: ['ALWAYS_ON', 'AUTO'], positionIndex: 0 },
      { nickname: 'Insight', formalName: 'Analytics-Audience-Behavior', descriptor: 'The Mind Reader', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 1 },
      { nickname: 'Suggest', formalName: 'Intelligence-ContentIdeas', descriptor: 'The Muse', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 2 },
      { nickname: 'Report', formalName: 'Intelligence-ROI-Summary', descriptor: 'The Accountant', layerIndex: 3, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 3 },
    ],
    relationships: [
      ['Brief', 'Quill', 'feedsInto'], ['Brief', 'Pixel', 'feedsInto'], ['Brief', 'Clip', 'feedsInto'],
      ['Quill', 'Brand', 'feedsInto'], ['Pixel', 'Brand', 'feedsInto'],
      ['Brand', 'Editor', 'feedsInto'], ['Legal', 'Editor', 'collaboratesWith'],
      ['Editor', 'Boost', 'feedsInto'], ['Boost', 'Format', 'feedsInto'],
      ['Format', 'Schedule', 'feedsInto'], ['Schedule', 'Broadcast', 'feedsInto'],
      ['Broadcast', 'Tracker', 'feedsInto'], ['Tracker', 'Insight', 'feedsInto'],
      ['Insight', 'Suggest', 'feedsInto'], ['Suggest', 'Brief', 'feedsInto'],
      ['Editor', 'Quill', 'canOverride'], ['Report', 'Brief', 'collaboratesWith'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
];

export class TemplateService {
  constructor(private db: Database.Database) {}

  listTemplates(): Array<Omit<SwarmTemplate, 'agents' | 'relationships' | 'layers'>> {
    return templates.map(t => ({
      id: t.id,
      name: t.name,
      domain: t.domain,
      description: t.description,
      agentCount: t.agentCount,
      layerCount: t.layerCount,
      tags: t.tags,
    }));
  }

  getTemplate(id: string): SwarmTemplate | null {
    return templates.find(t => t.id === id) || null;
  }

  instantiate(templateId: string, swarmName: string): Swarm | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    const swarmId = uuidv7();
    const now = new Date().toISOString();

    // Create layer IDs
    const layerIds = template.layers.map(() => uuidv7());

    // Build layers
    const insertSwarm = this.db.prepare(
      "INSERT INTO swarms (id, name, description, template_source, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
    );
    const insertLayer = this.db.prepare(
      'INSERT INTO layers (id, swarm_id, name, color_theme, display_order) VALUES (?, ?, ?, ?, ?)'
    );
    const insertAgent = this.db.prepare(
      'INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertRel = this.db.prepare(
      'INSERT INTO relationships (id, swarm_id, source_agent_id, target_agent_id, type) VALUES (?, ?, ?, ?, ?)'
    );

    const transaction = this.db.transaction(() => {
      insertSwarm.run(swarmId, swarmName, template.description, templateId, now, now);

      for (let i = 0; i < template.layers.length; i++) {
        const l = template.layers[i];
        insertLayer.run(layerIds[i], swarmId, l.name, l.colorTheme, l.order);
      }

      const agentIdMap = new Map<string, string>();
      for (const agent of template.agents) {
        const agentId = uuidv7();
        agentIdMap.set(agent.nickname, agentId);
        const layerId = layerIds[agent.layerIndex];
        const posX = 150 + agent.positionIndex * 300;
        const posY = 150 + agent.layerIndex * 250;
        insertAgent.run(
          agentId, swarmId, agent.nickname, agent.formalName, agent.descriptor,
          layerId, JSON.stringify(agent.badges), posX, posY
        );
      }

      for (const rel of template.relationships) {
        const sourceId = agentIdMap.get(rel.sourceNickname);
        const targetId = agentIdMap.get(rel.targetNickname);
        if (sourceId && targetId) {
          insertRel.run(uuidv7(), swarmId, sourceId, targetId, rel.type);
        }
      }
    });

    transaction();

    // Load and return the full swarm using inline query (avoids circular import)
    const row = this.db.prepare('SELECT * FROM swarms WHERE id = ?').get(swarmId) as any;
    if (!row) return null;

    const layerRows = this.db.prepare('SELECT * FROM layers WHERE swarm_id = ? ORDER BY display_order').all(swarmId) as any[];
    const agentRows = this.db.prepare('SELECT * FROM agents WHERE swarm_id = ?').all(swarmId) as any[];
    const relRows = this.db.prepare('SELECT * FROM relationships WHERE swarm_id = ?').all(swarmId) as any[];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      templateSource: row.template_source || undefined,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      layers: layerRows.map((l: any) => ({ id: l.id, name: l.name, colorTheme: l.color_theme, order: l.display_order })),
      agents: agentRows.map((a: any) => ({
        id: a.id, swarmId: a.swarm_id, nickname: a.nickname, formalName: a.formal_name,
        descriptor: a.descriptor, layerId: a.layer_id, badges: JSON.parse(a.badges),
        position: { x: a.position_x, y: a.position_y }, config: JSON.parse(a.config),
      })),
      relationships: relRows.map((r: any) => ({
        id: r.id, swarmId: r.swarm_id, sourceAgentId: r.source_agent_id,
        targetAgentId: r.target_agent_id, type: r.type, metadata: JSON.parse(r.metadata),
      })),
    };
  }
}
