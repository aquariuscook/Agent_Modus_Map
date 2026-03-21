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
