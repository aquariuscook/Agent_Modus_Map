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
    config?: Record<string, unknown>;
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
      { name: 'Intake & Triage', colorTheme: '#22c55e', order: 1 },
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
      { name: 'Optimization & Distribution', colorTheme: '#22c55e', order: 3 },
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
  {
    id: 'devops-pipeline-v1',
    name: 'DevOps CI/CD Pipeline',
    domain: 'Engineering',
    description: '14-agent swarm for automated build, test, deploy, and monitoring pipelines with rollback capabilities.',
    agentCount: 14,
    layerCount: 4,
    tags: ['devops', 'cicd', 'deployment', 'monitoring', 'automation'],
    layers: [
      { name: 'Source & Build', colorTheme: '#3b82f6', order: 1 },
      { name: 'Test & Quality', colorTheme: '#a855f7', order: 2 },
      { name: 'Deploy & Release', colorTheme: '#22c55e', order: 3 },
      { name: 'Monitor & Respond', colorTheme: '#ef4444', order: 4 },
    ],
    agents: [
      { nickname: 'Watcher', formalName: 'Source-Git-WebhookListener', descriptor: 'The Trigger', layerIndex: 0, badges: ['ENTRY', 'ALWAYS_ON'], positionIndex: 0 },
      { nickname: 'Builder', formalName: 'Build-Compile-Artifacts', descriptor: 'The Constructor', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Deps', formalName: 'Build-Dependency-Scanner', descriptor: 'The Auditor', layerIndex: 0, badges: ['AUTO', 'CRITICAL'], positionIndex: 2 },
      { nickname: 'Lint', formalName: 'Quality-Static-Analysis', descriptor: 'The Nitpicker', layerIndex: 1, badges: ['AUTO'], positionIndex: 0 },
      { nickname: 'Unit', formalName: 'Test-Unit-Runner', descriptor: 'The Validator', layerIndex: 1, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Integration', formalName: 'Test-Integration-E2E', descriptor: 'The Connector', layerIndex: 1, badges: ['AUTO', 'CRITICAL'], positionIndex: 2 },
      { nickname: 'Security', formalName: 'Scan-SAST-DAST', descriptor: 'The Shield', layerIndex: 1, badges: ['CRITICAL', 'ALWAYS_ON'], positionIndex: 3 },
      { nickname: 'Gate', formalName: 'Quality-Gate-Decision', descriptor: 'The Bouncer', layerIndex: 2, badges: ['CRITICAL', 'APPROVAL', 'HUB'], positionIndex: 0 },
      { nickname: 'Canary', formalName: 'Deploy-Canary-Progressive', descriptor: 'The Scout', layerIndex: 2, badges: ['AUTO', 'CRITICAL'], positionIndex: 1 },
      { nickname: 'Release', formalName: 'Deploy-Production-Promote', descriptor: 'The Launcher', layerIndex: 2, badges: ['CRITICAL', 'HUMAN'], positionIndex: 2 },
      { nickname: 'Rollback', formalName: 'Deploy-Rollback-Emergency', descriptor: 'The Safety Net', layerIndex: 2, badges: ['CRITICAL', 'CAN_OVERRIDE'], positionIndex: 3 },
      { nickname: 'Metrics', formalName: 'Monitor-APM-Collector', descriptor: 'The Pulse', layerIndex: 3, badges: ['ALWAYS_ON', 'AUTO'], positionIndex: 0 },
      { nickname: 'Alert', formalName: 'Monitor-Incident-Trigger', descriptor: 'The Alarm', layerIndex: 3, badges: ['ALWAYS_ON', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'PostMortem', formalName: 'Intelligence-IncidentReview', descriptor: 'The Analyst', layerIndex: 3, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 2 },
    ],
    relationships: [
      ['Watcher', 'Builder', 'feedsInto'], ['Watcher', 'Deps', 'feedsInto'],
      ['Builder', 'Lint', 'feedsInto'], ['Builder', 'Unit', 'feedsInto'],
      ['Unit', 'Integration', 'feedsInto'], ['Deps', 'Security', 'feedsInto'],
      ['Lint', 'Gate', 'feedsInto'], ['Unit', 'Gate', 'feedsInto'],
      ['Integration', 'Gate', 'feedsInto'], ['Security', 'Gate', 'feedsInto'],
      ['Gate', 'Canary', 'feedsInto'], ['Canary', 'Release', 'feedsInto'],
      ['Release', 'Metrics', 'feedsInto'], ['Metrics', 'Alert', 'feedsInto'],
      ['Alert', 'Rollback', 'feedsInto'], ['Rollback', 'Canary', 'canOverride'],
      ['PostMortem', 'Watcher', 'collaboratesWith'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'data-pipeline-v1',
    name: 'Data Processing Pipeline',
    domain: 'Data',
    description: '16-agent swarm for ETL, data quality, transformation, and analytics with real-time and batch processing.',
    agentCount: 16,
    layerCount: 4,
    tags: ['data', 'etl', 'analytics', 'pipeline', 'warehouse'],
    layers: [
      { name: 'Ingestion', colorTheme: '#06b6d4', order: 1 },
      { name: 'Processing & Quality', colorTheme: '#8b5cf6', order: 2 },
      { name: 'Storage & Serving', colorTheme: '#22c55e', order: 3 },
      { name: 'Analytics & Intelligence', colorTheme: '#fbbf24', order: 4 },
    ],
    agents: [
      { nickname: 'Collector', formalName: 'Ingest-Source-Connector', descriptor: 'The Gatherer', layerIndex: 0, badges: ['ENTRY', 'ALWAYS_ON'], positionIndex: 0 },
      { nickname: 'Stream', formalName: 'Ingest-Realtime-Kafka', descriptor: 'The River', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Batch', formalName: 'Ingest-Scheduled-Bulk', descriptor: 'The Hauler', layerIndex: 0, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'Schema', formalName: 'Ingest-Schema-Registry', descriptor: 'The Gatekeeper', layerIndex: 0, badges: ['CRITICAL', 'AUTO'], positionIndex: 3 },
      { nickname: 'Cleaner', formalName: 'Process-DataQuality-Cleanse', descriptor: 'The Scrubber', layerIndex: 1, badges: ['AUTO', 'CRITICAL'], positionIndex: 0 },
      { nickname: 'Validate', formalName: 'Process-DataQuality-Check', descriptor: 'The Inspector', layerIndex: 1, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Transform', formalName: 'Process-ETL-Transform', descriptor: 'The Alchemist', layerIndex: 1, badges: ['AUTO', 'HUB'], positionIndex: 2 },
      { nickname: 'Enrich', formalName: 'Process-DataEnrich-External', descriptor: 'The Enhancer', layerIndex: 1, badges: ['AUTO', 'MEDIUM'], positionIndex: 3 },
      { nickname: 'Warehouse', formalName: 'Store-DataWarehouse-Load', descriptor: 'The Vault', layerIndex: 2, badges: ['CRITICAL', 'AUTO'], positionIndex: 0 },
      { nickname: 'Lake', formalName: 'Store-DataLake-Raw', descriptor: 'The Reservoir', layerIndex: 2, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Cache', formalName: 'Store-Cache-FastAccess', descriptor: 'The Speedster', layerIndex: 2, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 2 },
      { nickname: 'Catalog', formalName: 'Store-Metadata-Catalog', descriptor: 'The Librarian', layerIndex: 2, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 3 },
      { nickname: 'Dash', formalName: 'Analytics-Dashboard-Builder', descriptor: 'The Visualizer', layerIndex: 3, badges: ['AUTO'], positionIndex: 0 },
      { nickname: 'ML', formalName: 'Analytics-ML-FeatureStore', descriptor: 'The Learner', layerIndex: 3, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Anomaly', formalName: 'Analytics-AnomalyDetect', descriptor: 'The Watchdog', layerIndex: 3, badges: ['ALWAYS_ON', 'CRITICAL'], positionIndex: 2 },
      { nickname: 'Lineage', formalName: 'Analytics-DataLineage-Track', descriptor: 'The Historian', layerIndex: 3, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 3 },
    ],
    relationships: [
      ['Collector', 'Stream', 'feedsInto'], ['Collector', 'Batch', 'feedsInto'],
      ['Stream', 'Schema', 'dependsOn'], ['Batch', 'Schema', 'dependsOn'],
      ['Schema', 'Cleaner', 'feedsInto'], ['Cleaner', 'Validate', 'feedsInto'],
      ['Validate', 'Transform', 'feedsInto'], ['Transform', 'Enrich', 'collaboratesWith'],
      ['Transform', 'Warehouse', 'feedsInto'], ['Transform', 'Lake', 'feedsInto'],
      ['Warehouse', 'Cache', 'feedsInto'], ['Warehouse', 'Dash', 'feedsInto'],
      ['Lake', 'ML', 'feedsInto'], ['Cache', 'Dash', 'feedsInto'],
      ['Anomaly', 'Cleaner', 'feedsInto'], ['Lineage', 'Catalog', 'feedsInto'],
      ['Catalog', 'Lineage', 'collaboratesWith'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'security-ops-v1',
    name: 'Security Operations Center',
    domain: 'Security',
    description: '12-agent swarm for threat detection, incident response, vulnerability management, and compliance monitoring.',
    agentCount: 12,
    layerCount: 3,
    tags: ['security', 'soc', 'incident-response', 'compliance', 'threat-detection'],
    layers: [
      { name: 'Detection & Monitoring', colorTheme: '#ef4444', order: 1 },
      { name: 'Analysis & Response', colorTheme: '#f59e0b', order: 2 },
      { name: 'Governance & Compliance', colorTheme: '#22c55e', order: 3 },
    ],
    agents: [
      { nickname: 'Sentinel', formalName: 'Detect-SIEM-Collector', descriptor: 'The Watcher', layerIndex: 0, badges: ['ENTRY', 'ALWAYS_ON', 'CRITICAL'], positionIndex: 0 },
      { nickname: 'NetWatch', formalName: 'Detect-Network-IDS', descriptor: 'The Net Guard', layerIndex: 0, badges: ['ALWAYS_ON', 'AUTO'], positionIndex: 1 },
      { nickname: 'Endpoint', formalName: 'Detect-EDR-Monitor', descriptor: 'The Device Guard', layerIndex: 0, badges: ['ALWAYS_ON', 'AUTO'], positionIndex: 2 },
      { nickname: 'Scanner', formalName: 'Detect-Vulnerability-Scan', descriptor: 'The Prober', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 3 },
      { nickname: 'Analyst', formalName: 'Analyze-Threat-Intel', descriptor: 'The Investigator', layerIndex: 1, badges: ['HUB', 'CRITICAL', 'AUTO'], positionIndex: 0 },
      { nickname: 'Responder', formalName: 'Response-Incident-Handler', descriptor: 'The First Responder', layerIndex: 1, badges: ['CRITICAL', 'CAN_OVERRIDE', 'HUMAN'], positionIndex: 1 },
      { nickname: 'Quarantine', formalName: 'Response-Isolate-Contain', descriptor: 'The Enforcer', layerIndex: 1, badges: ['AUTO', 'CAN_OVERRIDE'], positionIndex: 2 },
      { nickname: 'Forensic', formalName: 'Analyze-Digital-Forensics', descriptor: 'The Detective', layerIndex: 1, badges: ['HUMAN', 'LOGS_ALL'], positionIndex: 3 },
      { nickname: 'Compliance', formalName: 'Govern-Policy-Enforce', descriptor: 'The Regulator', layerIndex: 2, badges: ['CRITICAL', 'ALWAYS_ON'], positionIndex: 0 },
      { nickname: 'Auditor', formalName: 'Govern-Audit-Trail', descriptor: 'The Recorder', layerIndex: 2, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 1 },
      { nickname: 'Patch', formalName: 'Govern-Vuln-Remediate', descriptor: 'The Fixer', layerIndex: 2, badges: ['AUTO', 'APPROVAL'], positionIndex: 2 },
      { nickname: 'Report', formalName: 'Govern-Executive-Brief', descriptor: 'The Briefer', layerIndex: 2, badges: ['AUTO'], positionIndex: 3 },
    ],
    relationships: [
      ['Sentinel', 'Analyst', 'feedsInto'], ['NetWatch', 'Analyst', 'feedsInto'],
      ['Endpoint', 'Analyst', 'feedsInto'], ['Scanner', 'Analyst', 'feedsInto'],
      ['Analyst', 'Responder', 'feedsInto'], ['Responder', 'Quarantine', 'feedsInto'],
      ['Responder', 'Forensic', 'collaboratesWith'], ['Quarantine', 'Endpoint', 'canOverride'],
      ['Forensic', 'Report', 'feedsInto'], ['Compliance', 'Auditor', 'dependsOn'],
      ['Scanner', 'Patch', 'feedsInto'], ['Patch', 'Compliance', 'feedsInto'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'research-assistant-v1',
    name: 'Research & Knowledge Assistant',
    domain: 'Research',
    description: '10-agent swarm for research, knowledge synthesis, fact-checking, and report generation with RAG integration.',
    agentCount: 10,
    layerCount: 3,
    tags: ['research', 'knowledge', 'rag', 'fact-check', 'synthesis'],
    layers: [
      { name: 'Discovery & Gathering', colorTheme: '#3b82f6', order: 1 },
      { name: 'Analysis & Synthesis', colorTheme: '#a855f7', order: 2 },
      { name: 'Output & Review', colorTheme: '#22c55e', order: 3 },
    ],
    agents: [
      { nickname: 'Query', formalName: 'Discovery-Query-Parser', descriptor: 'The Listener', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'WebSearch', formalName: 'Discovery-Web-Crawler', descriptor: 'The Explorer', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'DocSearch', formalName: 'Discovery-Document-RAG', descriptor: 'The Archivist', layerIndex: 0, badges: ['AUTO', 'HUB'], positionIndex: 2 },
      { nickname: 'GraphSearch', formalName: 'Discovery-KnowledgeGraph', descriptor: 'The Mapper', layerIndex: 0, badges: ['AUTO'], positionIndex: 3 },
      { nickname: 'Synthesizer', formalName: 'Analyze-Combine-Sources', descriptor: 'The Weaver', layerIndex: 1, badges: ['HUB', 'CRITICAL', 'AUTO'], positionIndex: 0 },
      { nickname: 'FactCheck', formalName: 'Analyze-Verify-Claims', descriptor: 'The Skeptic', layerIndex: 1, badges: ['CRITICAL', 'AUTO'], positionIndex: 1 },
      { nickname: 'Summarize', formalName: 'Analyze-Condense-KeyPoints', descriptor: 'The Distiller', layerIndex: 1, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'Writer', formalName: 'Output-Report-Generator', descriptor: 'The Author', layerIndex: 2, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 0 },
      { nickname: 'Reviewer', formalName: 'Output-Quality-Check', descriptor: 'The Editor', layerIndex: 2, badges: ['HUMAN', 'APPROVAL'], positionIndex: 1 },
      { nickname: 'Cite', formalName: 'Output-Citation-Manager', descriptor: 'The Librarian', layerIndex: 2, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 2 },
    ],
    relationships: [
      ['Query', 'WebSearch', 'feedsInto'], ['Query', 'DocSearch', 'feedsInto'], ['Query', 'GraphSearch', 'feedsInto'],
      ['WebSearch', 'Synthesizer', 'feedsInto'], ['DocSearch', 'Synthesizer', 'feedsInto'], ['GraphSearch', 'Synthesizer', 'feedsInto'],
      ['Synthesizer', 'FactCheck', 'feedsInto'], ['Synthesizer', 'Summarize', 'feedsInto'],
      ['FactCheck', 'Writer', 'feedsInto'], ['Summarize', 'Writer', 'feedsInto'],
      ['Writer', 'Reviewer', 'feedsInto'], ['Writer', 'Cite', 'dependsOn'],
      ['Reviewer', 'Writer', 'canOverride'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'sales-automation-v1',
    name: 'Sales & CRM Automation',
    domain: 'Sales',
    description: '12-agent swarm for lead scoring, pipeline management, outreach automation, and sales intelligence.',
    agentCount: 12,
    layerCount: 3,
    tags: ['sales', 'crm', 'lead-scoring', 'outreach', 'pipeline'],
    layers: [
      { name: 'Lead Generation', colorTheme: '#06b6d4', order: 1 },
      { name: 'Pipeline Management', colorTheme: '#8b5cf6', order: 2 },
      { name: 'Intelligence & Reporting', colorTheme: '#fbbf24', order: 3 },
    ],
    agents: [
      { nickname: 'Prospect', formalName: 'Lead-Source-Identifier', descriptor: 'The Hunter', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'Scorer', formalName: 'Lead-Score-Qualifier', descriptor: 'The Judge', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 1 },
      { nickname: 'Enricher', formalName: 'Lead-Data-Enrichment', descriptor: 'The Researcher', layerIndex: 0, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'Outreach', formalName: 'Engage-Email-Sequence', descriptor: 'The Messenger', layerIndex: 0, badges: ['AUTO', 'MEDIUM'], positionIndex: 3 },
      { nickname: 'Pipeline', formalName: 'Manage-Deal-Tracker', descriptor: 'The Organizer', layerIndex: 1, badges: ['HUB', 'CRITICAL'], positionIndex: 0 },
      { nickname: 'Scheduler', formalName: 'Manage-Meeting-Book', descriptor: 'The Coordinator', layerIndex: 1, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Proposal', formalName: 'Manage-Proposal-Generate', descriptor: 'The Closer', layerIndex: 1, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 2 },
      { nickname: 'Follow', formalName: 'Manage-Followup-Remind', descriptor: 'The Nudger', layerIndex: 1, badges: ['AUTO', 'ALWAYS_ON'], positionIndex: 3 },
      { nickname: 'Forecast', formalName: 'Intel-Revenue-Predict', descriptor: 'The Oracle', layerIndex: 2, badges: ['AUTO', 'CRITICAL'], positionIndex: 0 },
      { nickname: 'Win', formalName: 'Intel-WinLoss-Analyze', descriptor: 'The Analyst', layerIndex: 2, badges: ['AUTO', 'ADVISORY'], positionIndex: 1 },
      { nickname: 'Compete', formalName: 'Intel-Competitive-Monitor', descriptor: 'The Spy', layerIndex: 2, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'Board', formalName: 'Intel-Sales-Dashboard', descriptor: 'The Scorecard', layerIndex: 2, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 3 },
    ],
    relationships: [
      ['Prospect', 'Scorer', 'feedsInto'], ['Scorer', 'Enricher', 'feedsInto'],
      ['Enricher', 'Outreach', 'feedsInto'], ['Scorer', 'Pipeline', 'feedsInto'],
      ['Outreach', 'Scheduler', 'feedsInto'], ['Pipeline', 'Proposal', 'feedsInto'],
      ['Pipeline', 'Follow', 'collaboratesWith'], ['Pipeline', 'Forecast', 'feedsInto'],
      ['Proposal', 'Pipeline', 'feedsInto'], ['Forecast', 'Board', 'feedsInto'],
      ['Win', 'Compete', 'collaboratesWith'], ['Win', 'Board', 'feedsInto'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'hr-onboarding-v1',
    name: 'HR & Employee Onboarding',
    domain: 'HR',
    description: '11-agent swarm for automated employee onboarding, document processing, training assignment, and compliance tracking.',
    agentCount: 11,
    layerCount: 3,
    tags: ['hr', 'onboarding', 'training', 'compliance', 'employee'],
    layers: [
      { name: 'Intake & Processing', colorTheme: '#3b82f6', order: 1 },
      { name: 'Setup & Training', colorTheme: '#22c55e', order: 2 },
      { name: 'Tracking & Compliance', colorTheme: '#f59e0b', order: 3 },
    ],
    agents: [
      { nickname: 'Hire', formalName: 'Intake-NewHire-Register', descriptor: 'The Welcome Mat', layerIndex: 0, badges: ['ENTRY', 'AUTO'], positionIndex: 0 },
      { nickname: 'DocScan', formalName: 'Intake-Document-Process', descriptor: 'The Paper Pusher', layerIndex: 0, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Verify', formalName: 'Intake-Background-Check', descriptor: 'The Validator', layerIndex: 0, badges: ['CRITICAL', 'HUMAN'], positionIndex: 2 },
      { nickname: 'Provision', formalName: 'Setup-Account-Create', descriptor: 'The Key Master', layerIndex: 1, badges: ['AUTO', 'CRITICAL'], positionIndex: 0 },
      { nickname: 'Assign', formalName: 'Setup-Training-Schedule', descriptor: 'The Trainer', layerIndex: 1, badges: ['AUTO'], positionIndex: 1 },
      { nickname: 'Buddy', formalName: 'Setup-Mentor-Match', descriptor: 'The Matchmaker', layerIndex: 1, badges: ['AUTO', 'ADVISORY'], positionIndex: 2 },
      { nickname: 'Welcome', formalName: 'Setup-Orientation-Guide', descriptor: 'The Tour Guide', layerIndex: 1, badges: ['AUTO'], positionIndex: 3 },
      { nickname: 'Progress', formalName: 'Track-Milestone-Monitor', descriptor: 'The Tracker', layerIndex: 2, badges: ['ALWAYS_ON', 'AUTO'], positionIndex: 0 },
      { nickname: 'Comply', formalName: 'Track-Compliance-Verify', descriptor: 'The Regulator', layerIndex: 2, badges: ['CRITICAL', 'APPROVAL'], positionIndex: 1 },
      { nickname: 'Feedback', formalName: 'Track-Survey-Collect', descriptor: 'The Listener', layerIndex: 2, badges: ['AUTO'], positionIndex: 2 },
      { nickname: 'HRDash', formalName: 'Track-Analytics-Report', descriptor: 'The Dashboard', layerIndex: 2, badges: ['AUTO', 'LOGS_ALL'], positionIndex: 3 },
    ],
    relationships: [
      ['Hire', 'DocScan', 'feedsInto'], ['Hire', 'Verify', 'feedsInto'],
      ['Verify', 'Provision', 'feedsInto'], ['DocScan', 'Comply', 'feedsInto'],
      ['Provision', 'Assign', 'feedsInto'], ['Provision', 'Welcome', 'feedsInto'],
      ['Assign', 'Buddy', 'collaboratesWith'], ['Welcome', 'Progress', 'feedsInto'],
      ['Progress', 'Feedback', 'feedsInto'], ['Comply', 'HRDash', 'feedsInto'],
      ['Feedback', 'HRDash', 'feedsInto'],
    ].map(([s, t, type]) => ({ sourceNickname: s as string, targetNickname: t as string, type: type as any })),
  },
  {
    id: 'lead-gen-consulting-v1',
    name: 'Consulting Lead Gen',
    domain: 'Sales',
    description: '14-agent swarm for finding consulting clients: prospect identification, outreach, qualification, proposal generation, and pipeline management.',
    agentCount: 14,
    layerCount: 4,
    tags: ['lead-gen', 'consulting', 'sales', 'outreach', 'pipeline', 'prospecting'],
    layers: [
      { name: 'Discovery & Research', colorTheme: '#00d9ff', order: 1 },
      { name: 'Outreach & Engagement', colorTheme: '#a855f7', order: 2 },
      { name: 'Qualification & Proposal', colorTheme: '#22c55e', order: 3 },
      { name: 'Pipeline & Intelligence', colorTheme: '#fbbf24', order: 4 },
    ],
    agents: [
      // Discovery & Research
      { nickname: 'Scout', formalName: 'Research-Prospect-Identify', descriptor: 'The Opportunity Finder', layerIndex: 0, badges: ['ENTRY', 'AUTO', 'ALWAYS_ON'], positionIndex: 0, config: {
        coreTask: 'Monitor LinkedIn, job boards, industry forums, and business directories to identify companies ($2M-$8M revenue) that need AI training, process automation, or customer service modernization. Look for signals like: hiring for AI/automation roles, posting about digital transformation, complaining about manual processes or poor customer self-service, announcing growth initiatives, or requesting proposals for consulting services.',
        autonomyLevel: 'Fully Automated',
        systemPrompt: { persona: 'You are a sharp-eyed business development researcher who specializes in finding consulting opportunities for an AI/UX consultancy. You focus on small-to-mid market companies ($2M-$8M revenue) that are ripe for AI training, automation, and customer experience improvements.', instructions: 'Search for companies showing buying signals. Prioritize companies with 15-80 employees that are growing and have manual processes they want to automate. Look for pain points in customer service, employee training, and operational efficiency. Output a structured prospect profile for each find.', constraints: 'Only flag companies in the $2M-$8M revenue range. Skip enterprise companies and solo operations. Do not reach out directly, only research and flag.', outputFormat: '{ "company": "...", "revenue_estimate": "...", "employee_count": "...", "signal": "...", "pain_points": ["..."], "contact": "...", "source": "...", "score": 1-10 }' },
        modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.5, maxTokens: 2048 },
      }},
      { nickname: 'Profile', formalName: 'Research-Company-Enrich', descriptor: 'The Deep Diver', layerIndex: 0, badges: ['AUTO'], positionIndex: 1, config: {
        coreTask: 'Take prospect leads from Scout and build comprehensive company profiles. Research their tech stack, current customer service setup, training programs, key decision makers, recent news, growth trajectory, and specific pain points related to AI adoption, automation, and customer experience.',
        autonomyLevel: 'Fully Automated',
        systemPrompt: { persona: 'You are a thorough business analyst who builds detailed prospect dossiers for a consulting firm specializing in AI training, automation, and customer experience.', instructions: 'For each prospect, research and compile: company overview, revenue/size, industry, current tech stack, customer service channels, training practices, key contacts (CEO, COO, CTO, VP Ops), recent news, and specific opportunities where AI training, process automation, or CX improvements would help them.', constraints: 'Stick to publicly available information. Do not fabricate data. Flag when confidence is low.', outputFormat: '{ "company": "...", "profile": { "industry": "...", "tech_stack": ["..."], "pain_points": ["..."], "decision_makers": [{"name": "...", "title": "...", "linkedin": "..."}], "opportunity_fit": "training|automation|cx|multiple" } }' },
        modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3, maxTokens: 3000 },
      }},
      { nickname: 'Signal', formalName: 'Research-Intent-Detect', descriptor: 'The Radar', layerIndex: 0, badges: ['AUTO', 'HIGH_PRIORITY'], positionIndex: 2, config: {
        coreTask: 'Analyze prospect data to detect buying intent signals. Score each prospect on timing, urgency, and readiness to buy consulting services. Flag hot leads that show immediate need for AI training, automation consulting, or customer service transformation.',
        autonomyLevel: 'Fully Automated',
        systemPrompt: { persona: 'You are a buying intent specialist who can read between the lines to determine when a company is ready to invest in consulting help.', instructions: 'Analyze each prospect for intent signals: active job postings for roles they could outsource, budget allocation announcements, executive quotes about transformation, RFP postings, technology evaluation activity, or complaints about current processes. Rate urgency on a 1-10 scale.', constraints: 'Be honest about signal strength. A score of 8+ means they are actively looking. 5-7 means warming up. Below 5 means long-term nurture.' },
        modelConfig: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.2, maxTokens: 1500 },
      }},
      { nickname: 'Compete', formalName: 'Research-Competitor-Watch', descriptor: 'The Rival Watcher', layerIndex: 0, badges: ['AUTO', 'ADVISORY'], positionIndex: 3, config: {
        coreTask: 'Monitor what competing consultancies are offering in the AI training, automation, and CX space. Track their pricing, positioning, case studies, and client wins. Identify gaps where our expertise in conversational AI, IVR-to-AI migration, and hands-on training gives us an edge.',
        autonomyLevel: 'Fully Automated',
        systemPrompt: { persona: 'You are a competitive intelligence analyst for a boutique AI/UX consultancy.', instructions: 'Track competitors offering similar services (AI training, automation consulting, CX transformation). Note their pricing models, target markets, strengths and weaknesses. Identify positioning opportunities where 20+ years of UX experience and deep conversational AI expertise differentiates us.', constraints: 'Do not copy competitor materials. Focus on strategic intelligence, not tactics.' },
        modelConfig: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.4, maxTokens: 2000 },
      }},
      // Outreach & Engagement
      { nickname: 'Craft', formalName: 'Content-Outreach-Personalize', descriptor: 'The Message Tailor', layerIndex: 1, badges: ['AUTO', 'APPROVAL'], positionIndex: 0, config: {
        coreTask: 'Write personalized outreach messages (email, LinkedIn DM) for each qualified prospect. Reference their specific pain points, recent company news, and explain how our consulting services in AI training, process automation, or customer service modernization can help them specifically.',
        autonomyLevel: 'Human-in-Loop',
        systemPrompt: { persona: 'You write outreach messages for a seasoned AI/UX consultant with 20+ years in tech. Your tone is direct, knowledgeable, and human. No corporate speak, no AI cliches, no "game-changer" or "supercharge" language.', instructions: 'Write a personalized email or LinkedIn message for each prospect. Lead with their specific problem, not our services. Reference something real about their company. Keep it under 150 words. Include a clear, low-commitment CTA like a 15-minute call or sharing a relevant case study.', constraints: 'Never use em dashes. Never use phrases like "I hope this finds you well" or "I wanted to reach out." Be direct and human. One message per prospect, not templates.' },
        modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 1500 },
      }},
      { nickname: 'Sequence', formalName: 'Workflow-Cadence-Manage', descriptor: 'The Follow-Upper', layerIndex: 1, badges: ['AUTO', 'ALWAYS_ON'], positionIndex: 1, config: {
        coreTask: 'Manage multi-touch follow-up sequences for prospects who did not respond to initial outreach. Space follow-ups 3-5 business days apart. Each touch adds new value (article, insight, case study reference). Stop after 4 touches if no response.',
        autonomyLevel: 'Fully Automated',
        systemPrompt: { persona: 'You manage follow-up cadences with a light touch. Persistent but never annoying.', instructions: 'For each non-responsive prospect, generate follow-up messages that add new value each time. Touch 2: share a relevant insight about their industry. Touch 3: reference a case study or result. Touch 4: final "door is open" message. Each should be shorter than the last.', constraints: 'Maximum 4 follow-ups. Never be pushy. If they say no, stop immediately. Keep follow-ups under 100 words.' },
        modelConfig: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.6, maxTokens: 1000 },
      }},
      { nickname: 'Social', formalName: 'Content-LinkedIn-Engage', descriptor: 'The Networker', layerIndex: 1, badges: ['AUTO', 'HUMAN'], positionIndex: 2, config: {
        coreTask: 'Draft LinkedIn engagement content: thoughtful comments on prospect posts, short thought leadership posts about AI training and automation for small businesses, and connection request messages. Build visibility with target prospects before direct outreach.',
        autonomyLevel: 'Human-in-Loop',
        systemPrompt: { persona: 'You write LinkedIn content for a consultant who is genuinely knowledgeable about AI, UX, and helping businesses modernize. The voice is expert but approachable, sharing real experience not theory.', instructions: 'Draft LinkedIn comments that add genuine value to prospect posts. Write short posts (under 200 words) sharing practical AI adoption tips for small businesses. No hashtag spam, no engagement bait. Write like a real person with real opinions.', constraints: 'No AI cliches. No em dashes. No "let me know in the comments" engagement bait. No generic motivational content. Every post should teach something specific.' },
        modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.8, maxTokens: 1500 },
      }},
      { nickname: 'Warm', formalName: 'Content-Nurture-Drip', descriptor: 'The Relationship Builder', layerIndex: 1, badges: ['AUTO'], positionIndex: 3, config: {
        coreTask: 'Nurture cold and warm leads with periodic value-add content. Share relevant articles, quick tips about AI adoption for small businesses, industry trends, and occasional case study highlights. Keep the consultancy top-of-mind without being salesy.',
        autonomyLevel: 'Fully Automated',
        systemPrompt: { persona: 'You nurture business relationships by consistently providing value, not pitches.', instructions: 'Generate nurture content for leads not yet ready to buy. Mix of: quick AI tips they can use today, industry trend summaries, links to relevant resources, and brief success stories. One piece per lead per week.', constraints: 'Never hard-sell in nurture content. Ratio should be 90% value, 10% subtle positioning.' },
        modelConfig: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.6, maxTokens: 1000 },
      }},
      // Qualification & Proposal
      { nickname: 'Qualify', formalName: 'Workflow-Lead-Score', descriptor: 'The Gatekeeper', layerIndex: 2, badges: ['CRITICAL', 'AUTO'], positionIndex: 0, config: {
        coreTask: 'Score and qualify leads based on: company revenue ($2M-$8M sweet spot), employee count (15-80), pain point alignment (training, automation, CX), budget signals, decision maker accessibility, and timing. Route qualified leads to discovery, send unqualified to nurture.',
        autonomyLevel: 'Hybrid',
        systemPrompt: { persona: 'You are a ruthless but fair lead qualifier. You protect the consultant\'s time by only passing through leads with genuine potential.', instructions: 'Score each lead on: Revenue Fit (is it $2M-$8M?), Need Fit (do they need training, automation, or CX help?), Budget Signal (can they afford $5K-$50K engagements?), Timing (are they ready now or later?), Access (can we reach the decision maker?). Total score out of 50. Pass leads scoring 30+ to Discover. Send 15-29 to Warm for nurture. Drop below 15.', constraints: 'Be honest about weak leads. Better to nurture than force-qualify.', outputFormat: '{ "lead": "...", "scores": { "revenue_fit": 10, "need_fit": 10, "budget": 10, "timing": 10, "access": 10 }, "total": 50, "decision": "qualify|nurture|drop", "reason": "..." }' },
        modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.2, maxTokens: 1500 },
      }},
      { nickname: 'Discover', formalName: 'Workflow-NeedsAnalysis-Run', descriptor: 'The Question Asker', layerIndex: 2, badges: ['HUMAN', 'HIGH_PRIORITY'], positionIndex: 1, config: {
        coreTask: 'Prepare discovery call agendas and question frameworks for qualified leads. Focus on understanding their current state, desired future state, and the gap. Identify which service line fits best: AI/prompt training, process automation consulting, or customer service modernization.',
        autonomyLevel: 'Human-in-Loop',
        systemPrompt: { persona: 'You prepare discovery conversations that uncover real problems, not surface-level needs.', instructions: 'For each qualified lead, generate: 5-7 discovery questions tailored to their specific situation, a pre-call research brief, suggested talking points that connect their pain to our expertise, and red flags to watch for. Frame questions around business impact, not technology.', constraints: 'Questions should feel conversational, not like a survey. Focus on "what happens when..." and "how does that affect..." framing.' },
        modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.5, maxTokens: 2000 },
      }},
      { nickname: 'Propose', formalName: 'Content-Proposal-Generate', descriptor: 'The Deal Maker', layerIndex: 2, badges: ['APPROVAL', 'HIGH_PRIORITY'], positionIndex: 2, config: {
        coreTask: 'Generate custom consulting proposals based on discovery findings. Structure proposals around the client\'s specific problems, proposed approach, expected outcomes, timeline, and investment. Offer tiered pricing when appropriate.',
        autonomyLevel: 'Human-in-Loop',
        systemPrompt: { persona: 'You write proposals that feel like a natural next step after a great conversation, not a sales document.', instructions: 'Generate a proposal with: Executive summary of their problem (in their words), proposed approach (specific to their situation), expected outcomes with metrics, timeline, team/expertise overview, and investment options (2-3 tiers). Keep it under 4 pages.', constraints: 'Never use jargon the client hasn\'t used themselves. Lead with their problem, not our capabilities. Include specific deliverables, not vague promises.' },
        modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.6, maxTokens: 4096 },
      }},
      { nickname: 'Price', formalName: 'Workflow-Estimate-Calculate', descriptor: 'The Number Cruncher', layerIndex: 2, badges: ['AUTO', 'CRITICAL'], positionIndex: 3, config: {
        coreTask: 'Calculate engagement pricing based on scope, complexity, and duration. Training engagements: $3K-$10K. Automation consulting: $8K-$25K. CX transformation: $15K-$50K. Factor in travel, materials, and ongoing support.',
        autonomyLevel: 'Fully Automated',
        systemPrompt: { persona: 'You calculate fair, competitive pricing for consulting engagements.', instructions: 'Based on the scope from Discover, calculate pricing tiers. Include: Starter (minimum viable engagement), Standard (recommended), and Premium (comprehensive). Factor in consultant day rate, preparation time, deliverables, and any tools/licenses needed. Show ROI estimates when possible.', constraints: 'Minimum engagement: $3K. Maximum single engagement: $50K. If scope exceeds $50K, recommend phased approach.' },
        modelConfig: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.1, maxTokens: 1500 },
      }},
      // Pipeline & Intelligence
      { nickname: 'Funnel', formalName: 'Analytics-Pipeline-Track', descriptor: 'The Pipeline Manager', layerIndex: 3, badges: ['HUB', 'ALWAYS_ON', 'LOGS_ALL'], positionIndex: 0, config: {
        coreTask: 'Track all leads through the pipeline stages: Identified, Profiled, Contacted, Responded, Qualified, Discovery, Proposal, Won, Lost. Calculate conversion rates between stages and forecast monthly revenue. Flag stale leads.',
        autonomyLevel: 'Fully Automated',
        systemPrompt: { persona: 'You are a pipeline manager who keeps the sales funnel healthy and visible.', instructions: 'Maintain a running tally of leads at each stage. Calculate: total pipeline value, conversion rates between stages, average time in each stage, and projected revenue for the next 30/60/90 days. Flag leads that have been stuck in any stage for more than 14 days.', constraints: 'Report facts, not opinions. Let the data speak.' },
        modelConfig: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.1, maxTokens: 2000 },
      }},
      { nickname: 'Insight', formalName: 'Intelligence-WinLoss-Analyze', descriptor: 'The Pattern Spotter', layerIndex: 3, badges: ['AUTO', 'ADVISORY'], positionIndex: 1, config: {
        coreTask: 'Analyze win/loss patterns to improve the pipeline. Which industries convert best? Which service line has the highest close rate? What objections keep coming up? What messaging resonates most? Feed learnings back to Scout and Craft to improve targeting and outreach.',
        autonomyLevel: 'Fully Automated',
        systemPrompt: { persona: 'You are a pattern analyst who turns sales data into actionable strategy.', instructions: 'Analyze pipeline data to find: which prospect types convert best, which outreach messages get the highest response rates, common objections and how to address them, optimal follow-up timing, and which service lines are most in demand. Generate weekly insights with specific recommendations.', constraints: 'Need at least 10 data points before making pattern claims. Be specific with recommendations, not vague.' },
        modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.5, maxTokens: 2000 },
      }},
    ],
    relationships: [
      // Discovery flow
      ['Scout', 'Profile', 'feedsInto'], ['Scout', 'Signal', 'feedsInto'],
      ['Profile', 'Craft', 'feedsInto'], ['Signal', 'Craft', 'feedsInto'],
      ['Compete', 'Craft', 'feedsInto'], ['Compete', 'Propose', 'feedsInto'],
      // Outreach flow
      ['Craft', 'Sequence', 'feedsInto'], ['Craft', 'Social', 'feedsInto'],
      ['Sequence', 'Warm', 'feedsInto'], ['Social', 'Warm', 'feedsInto'],
      ['Warm', 'Qualify', 'feedsInto'],
      // Qualification flow
      ['Qualify', 'Discover', 'feedsInto'], ['Discover', 'Propose', 'feedsInto'],
      ['Propose', 'Price', 'dependsOn'], ['Price', 'Propose', 'feedsInto'],
      // Pipeline
      ['Qualify', 'Funnel', 'feedsInto'], ['Propose', 'Funnel', 'feedsInto'],
      ['Funnel', 'Insight', 'feedsInto'], ['Insight', 'Scout', 'feedsInto'],
      // Collaborations
      ['Scout', 'Compete', 'collaboratesWith'], ['Profile', 'Signal', 'collaboratesWith'],
      ['Craft', 'Warm', 'collaboratesWith'], ['Qualify', 'Funnel', 'collaboratesWith'],
      ['Insight', 'Compete', 'collaboratesWith'], ['Discover', 'Price', 'collaboratesWith'],
      // Dependencies
      ['Craft', 'Profile', 'dependsOn'], ['Qualify', 'Profile', 'dependsOn'],
      ['Propose', 'Discover', 'dependsOn'], ['Social', 'Profile', 'dependsOn'],
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
      'INSERT INTO agents (id, swarm_id, nickname, formal_name, descriptor, layer_id, badges, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
          layerId, JSON.stringify(agent.badges), posX, posY,
          agent.config ? JSON.stringify(agent.config) : '{}'
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
