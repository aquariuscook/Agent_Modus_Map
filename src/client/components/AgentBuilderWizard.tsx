import React, { useState, useMemo } from 'react';
import type { Badge, LayerDefinition } from '../../shared/types/index.js';

interface Props {
  layers: LayerDefinition[];
  existingNicknames: string[];
  onCreate: (agentData: AgentFormData) => void;
  onCancel: () => void;
}

export interface AgentFormData {
  nickname: string;
  formalName: string;
  descriptor: string;
  layerId: string;
  badges: Badge[];
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const ALL_BADGES: Badge[] = ['HUB','CRITICAL','ENTRY','AUTO','HUMAN','APPROVAL','ALWAYS_ON','ADVISORY','CAN_OVERRIDE','HIGH_PRIORITY','MEDIUM','LOGS_ALL'];

const STEPS: Array<{ num: Step; title: string; subtitle: string }> = [
  { num: 1, title: 'Identity', subtitle: 'Who is this agent?' },
  { num: 2, title: 'Primary Function', subtitle: 'What does it do?' },
  { num: 3, title: 'Inputs & Outputs', subtitle: 'Data in, data out' },
  { num: 4, title: 'AI & Memory', subtitle: 'How does it think?' },
  { num: 5, title: 'Tools & Data', subtitle: 'What tools does it use?' },
  { num: 6, title: 'Behavior & Safety', subtitle: 'Rules and guardrails' },
  { num: 7, title: 'Performance & Notes', subtitle: 'Metrics and documentation' },
  { num: 8, title: 'Review & Create', subtitle: 'Confirm and build' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

// Smart suggestion engine: analyzes core task to provide contextual guidance
interface TaskSuggestions {
  category: string;
  skills: string[];
  autonomy: string;
  inputs: string;
  inputFormat: string;
  outputs: string;
  outputDestination: string;
  temperature: number;
  maxTokens: number;
  longTermMemory: boolean;
  memoryBackend: string;
  guardrails: string[];
  blockedTopics: string[];
  outputValidation: string[];
  communicationStyle: string;
  priorityRanking: string;
  successMetrics: string;
  failureModes: string;
  escalationPath: string;
  badges: Badge[];
  mcpServers: string[];
  ragHint: string;
}

const TASK_PATTERNS: Array<{ keywords: string[]; suggestions: TaskSuggestions }> = [
  {
    keywords: ['moderate', 'moderation', 'content review', 'filter', 'flag', 'compliance', 'approve', 'reject'],
    suggestions: {
      category: 'Content Moderation',
      skills: ['Classification', 'Sentiment Analysis', 'Image Analysis'],
      autonomy: 'Hybrid',
      inputs: 'User-generated content (text, images, links), moderation ruleset, user reputation score',
      inputFormat: 'JSON payload with content body, metadata, timestamp, user ID',
      outputs: 'Moderation decision (approve/reject/flag) with confidence score and reason code',
      outputDestination: 'Approved content to publish queue, rejected to user notification, flagged to human moderator dashboard',
      temperature: 0.2, maxTokens: 2048, longTermMemory: true, memoryBackend: 'sqlite',
      guardrails: ['pii-detection', 'profanity-filter', 'bias-check'],
      blockedTopics: ['legal-advice', 'medical-diagnosis'],
      outputValidation: ['json-schema', 'confidence-threshold'],
      communicationStyle: 'Terse and rule-based when rejecting, includes specific violation reason and guideline section',
      priorityRanking: 'High, nothing publishes without passing through this agent',
      successMetrics: 'False positive rate <5%, false negative rate <2%, avg review time <500ms',
      failureModes: 'API timeout on image processing, ruleset version mismatch, novel slang it hasn\'t seen',
      escalationPath: 'Flags content with confidence below 70% for human review, escalates credible threats immediately',
      badges: ['CRITICAL', 'ALWAYS_ON', 'LOGS_ALL'],
      mcpServers: [], ragHint: 'Community guidelines document, previous moderation decisions',
    },
  },
  {
    keywords: ['customer', 'support', 'help desk', 'ticket', 'inquiry', 'service', 'chat', 'assist'],
    suggestions: {
      category: 'Customer Service',
      skills: ['Text Generation', 'Sentiment Analysis', 'Classification', 'Summarization'],
      autonomy: 'Hybrid',
      inputs: 'Customer message, conversation history, account details, knowledge base context',
      inputFormat: 'JSON with message text, customer ID, conversation thread, product/account metadata',
      outputs: 'Response to customer, internal notes, ticket updates, escalation flags',
      outputDestination: 'Chat interface for customer, CRM for ticket updates, Slack for escalations',
      temperature: 0.5, maxTokens: 4096, longTermMemory: true, memoryBackend: 'sqlite',
      guardrails: ['pii-detection', 'no-hallucination', 'brand-voice-check'],
      blockedTopics: ['competitor-pricing', 'internal-policy-details', 'legal-commitments'],
      outputValidation: ['max-length', 'tone-check', 'no-hallucination'],
      communicationStyle: 'Empathetic, professional, solution-oriented. Adapts tone to customer sentiment',
      priorityRanking: 'High, directly impacts customer satisfaction and retention',
      successMetrics: 'CSAT >4.2/5, first-response time <30s, resolution rate >75%, escalation rate <15%',
      failureModes: 'Knowledge base gaps, misreading customer intent, over-promising solutions',
      escalationPath: 'Transfers to human agent for billing disputes, complaints, or requests it cannot resolve',
      badges: ['ENTRY', 'ALWAYS_ON', 'HUMAN'],
      mcpServers: [], ragHint: 'Product documentation, FAQ database, past successful resolutions',
    },
  },
  {
    keywords: ['code', 'review', 'analyze', 'lint', 'debug', 'test', 'refactor', 'pr ', 'pull request'],
    suggestions: {
      category: 'Code Analysis',
      skills: ['Code Analysis', 'Classification', 'Text Generation'],
      autonomy: 'Advisory Only',
      inputs: 'Source code files, git diff, pull request metadata, existing test results',
      inputFormat: 'Code files with diff context, JSON metadata for PR details',
      outputs: 'Review comments, severity ratings, suggested fixes, quality score',
      outputDestination: 'GitHub PR comments, code review dashboard, CI/CD pipeline status',
      temperature: 0.1, maxTokens: 8192, longTermMemory: false, memoryBackend: 'in-memory',
      guardrails: ['no-hallucination', 'code-safety-check'],
      blockedTopics: [],
      outputValidation: ['valid-code-syntax', 'actionable-feedback'],
      communicationStyle: 'Direct and technical. References specific lines and patterns. Explains why, not just what',
      priorityRanking: 'Medium, gates code quality but does not block emergency hotfixes',
      successMetrics: 'Bug catch rate >30%, false positive rate <10%, developer satisfaction >4/5',
      failureModes: 'Misunderstanding project-specific patterns, false positives on intentional patterns',
      escalationPath: 'Flags security issues to security team, architectural concerns to tech lead',
      badges: ['ADVISORY', 'LOGS_ALL'],
      mcpServers: ['github', 'filesystem'], ragHint: 'Coding standards document, architecture decision records',
    },
  },
  {
    keywords: ['data', 'extract', 'pipeline', 'transform', 'etl', 'ingest', 'process', 'parse', 'scrape'],
    suggestions: {
      category: 'Data Processing',
      skills: ['Data Extraction', 'Classification', 'Text Generation'],
      autonomy: 'Fully Automated',
      inputs: 'Raw data feeds, API responses, file uploads, database records',
      inputFormat: 'CSV, JSON, XML, or raw text depending on source',
      outputs: 'Cleaned and structured data, validation reports, transformation logs',
      outputDestination: 'Data warehouse, downstream pipeline stages, monitoring dashboard',
      temperature: 0.0, maxTokens: 4096, longTermMemory: false, memoryBackend: 'in-memory',
      guardrails: ['pii-detection', 'data-quality-check'],
      blockedTopics: [],
      outputValidation: ['schema-validation', 'data-completeness', 'no-duplicates'],
      communicationStyle: 'Structured and log-oriented. Reports progress, errors, and metrics clearly',
      priorityRanking: 'High, downstream systems depend on timely and accurate data delivery',
      successMetrics: 'Data accuracy >99.5%, processing time within SLA, zero data loss',
      failureModes: 'Schema changes in source data, API rate limits, malformed input records',
      escalationPath: 'Queues failed records for retry, alerts data engineering team after 3 consecutive failures',
      badges: ['AUTO', 'ALWAYS_ON', 'CRITICAL'],
      mcpServers: ['filesystem', 'postgres'], ragHint: 'Data dictionary, schema documentation',
    },
  },
  {
    keywords: ['research', 'summarize', 'investigate', 'report', 'analyze', 'study', 'find', 'search', 'discover'],
    suggestions: {
      category: 'Research & Analysis',
      skills: ['Summarization', 'Text Generation', 'Data Extraction', 'Classification'],
      autonomy: 'Human-in-Loop',
      inputs: 'Research query, source documents, previous findings, scope constraints',
      inputFormat: 'Natural language query with optional structured parameters for scope and depth',
      outputs: 'Research report, source citations, confidence ratings, knowledge gaps identified',
      outputDestination: 'Research dashboard, stakeholder email summary, knowledge base update',
      temperature: 0.6, maxTokens: 8192, longTermMemory: true, memoryBackend: 'sqlite',
      guardrails: ['no-hallucination', 'bias-check', 'source-verification'],
      blockedTopics: [],
      outputValidation: ['citation-required', 'confidence-scoring', 'no-hallucination'],
      communicationStyle: 'Thorough and evidence-based. Always cites sources and rates confidence levels',
      priorityRanking: 'Medium, supports decision-making but does not block operations',
      successMetrics: 'Source accuracy >95%, coverage completeness >85%, stakeholder usefulness rating >4/5',
      failureModes: 'Source unavailability, information recency gaps, scope creep',
      escalationPath: 'Flags low-confidence findings for expert review, escalates contradictory source data',
      badges: ['ADVISORY', 'LOGS_ALL'],
      mcpServers: ['brave-search'], ragHint: 'Industry reports, internal knowledge base, competitor analysis docs',
    },
  },
  {
    keywords: ['security', 'scan', 'audit', 'vulnerability', 'threat', 'penetration', 'compliance', 'soc'],
    suggestions: {
      category: 'Security',
      skills: ['Code Analysis', 'Classification', 'Data Extraction'],
      autonomy: 'Human-in-Loop',
      inputs: 'Codebase, infrastructure config, access logs, vulnerability databases, compliance requirements',
      inputFormat: 'Source files, YAML/JSON configs, log streams, CVE database queries',
      outputs: 'Vulnerability report, risk scores, remediation steps, compliance status',
      outputDestination: 'Security dashboard, JIRA tickets for findings, Slack alerts for critical issues',
      temperature: 0.1, maxTokens: 8192, longTermMemory: true, memoryBackend: 'sqlite',
      guardrails: ['no-hallucination', 'pii-detection'],
      blockedTopics: ['exploit-development', 'bypass-techniques'],
      outputValidation: ['severity-classification', 'actionable-remediation', 'false-positive-check'],
      communicationStyle: 'Precise and severity-prioritized. Leads with risk level and affected systems',
      priorityRanking: 'Critical, security findings can block deployments',
      successMetrics: 'Detection rate >90%, false positive rate <15%, mean time to report <1h',
      failureModes: 'Novel attack vectors, config drift not captured, outdated vulnerability DB',
      escalationPath: 'Critical/high findings escalate immediately to security lead and block deployment',
      badges: ['CRITICAL', 'APPROVAL', 'LOGS_ALL', 'CAN_OVERRIDE'],
      mcpServers: ['github', 'filesystem'], ragHint: 'OWASP guidelines, internal security policies, CVE database',
    },
  },
  {
    keywords: ['sales', 'lead', 'qualify', 'outreach', 'prospect', 'crm', 'opportunity', 'pipeline'],
    suggestions: {
      category: 'Sales',
      skills: ['Text Generation', 'Sentiment Analysis', 'Classification', 'Summarization'],
      autonomy: 'Hybrid',
      inputs: 'Lead data, company info, interaction history, CRM records, email threads',
      inputFormat: 'JSON from CRM with lead profile, company data, and engagement history',
      outputs: 'Lead score, personalized outreach draft, next-step recommendation, CRM updates',
      outputDestination: 'CRM lead record, sales rep inbox, pipeline dashboard',
      temperature: 0.7, maxTokens: 4096, longTermMemory: true, memoryBackend: 'sqlite',
      guardrails: ['brand-voice-check', 'no-hallucination'],
      blockedTopics: ['competitor-bashing', 'false-claims', 'pricing-commitments'],
      outputValidation: ['tone-check', 'personalization-score'],
      communicationStyle: 'Professional, consultative, and personalized. Matches industry context',
      priorityRanking: 'Medium, supports revenue pipeline but human reps make final decisions',
      successMetrics: 'Lead qualification accuracy >80%, outreach response rate >25%, pipeline velocity improvement',
      failureModes: 'Stale CRM data, misqualifying leads, generic outreach that feels automated',
      escalationPath: 'Flags high-value leads for immediate rep attention, escalates confused leads to manager',
      badges: ['AUTO', 'HUMAN'],
      mcpServers: [], ragHint: 'Product docs, case studies, pricing tiers, competitor analysis',
    },
  },
  {
    keywords: ['write', 'draft', 'edit', 'copywrite', 'generate', 'compose', 'blog', 'article', 'document'],
    suggestions: {
      category: 'Content Generation',
      skills: ['Text Generation', 'Summarization', 'Translation'],
      autonomy: 'Human-in-Loop',
      inputs: 'Content brief, brand guidelines, topic outline, reference materials, audience profile',
      inputFormat: 'Structured brief with topic, audience, tone, length requirements, and key messages',
      outputs: 'Draft content, SEO recommendations, readability score, revision notes',
      outputDestination: 'CMS draft queue, editor review dashboard, content calendar',
      temperature: 0.8, maxTokens: 8192, longTermMemory: true, memoryBackend: 'sqlite',
      guardrails: ['brand-voice-check', 'no-hallucination', 'plagiarism-check'],
      blockedTopics: [],
      outputValidation: ['readability-score', 'brand-compliance', 'fact-check'],
      communicationStyle: 'Adapts to specified brand voice. Clear revision callouts and reasoning',
      priorityRanking: 'Medium, feeds content pipeline but all output goes through human editor',
      successMetrics: 'Editor approval rate >70%, revision rounds <2, content engagement metrics',
      failureModes: 'Brand voice drift, factual errors, repetitive phrasing across pieces',
      escalationPath: 'Flags factual uncertainty for fact-checker, brand voice issues to brand team',
      badges: ['HUMAN', 'ADVISORY'],
      mcpServers: [], ragHint: 'Brand style guide, previous approved content, competitor content examples',
    },
  },
  {
    keywords: ['schedule', 'coordinate', 'plan', 'calendar', 'allocate', 'dispatch', 'route', 'assign', 'orchestrat'],
    suggestions: {
      category: 'Orchestration & Scheduling',
      skills: ['Classification', 'Data Extraction'],
      autonomy: 'Fully Automated',
      inputs: 'Task queue, agent availability, priority rules, resource constraints, deadlines',
      inputFormat: 'JSON with task definitions, priority scores, dependency graph, resource pool',
      outputs: 'Task assignments, schedule updates, conflict alerts, status reports',
      outputDestination: 'Task queue for assigned agents, dashboard for status, alerts for conflicts',
      temperature: 0.1, maxTokens: 2048, longTermMemory: false, memoryBackend: 'in-memory',
      guardrails: ['deadline-enforcement', 'resource-limit-check'],
      blockedTopics: [],
      outputValidation: ['no-conflicts', 'deadline-feasibility', 'load-balance-check'],
      communicationStyle: 'Concise and status-oriented. Reports assignments, changes, and blockers clearly',
      priorityRanking: 'Critical, orchestrates the workflow for other agents',
      successMetrics: 'On-time completion >95%, resource utilization >80%, zero missed deadlines',
      failureModes: 'Deadlock conditions, resource contention, cascading delays from one failure',
      escalationPath: 'Alerts supervisor when deadlines at risk, escalates deadlocks for manual resolution',
      badges: ['HUB', 'CRITICAL', 'AUTO', 'ALWAYS_ON'],
      mcpServers: [], ragHint: 'Workflow playbooks, SLA documentation',
    },
  },
];

function analyzeCoreTask(coreTask: string): TaskSuggestions | null {
  if (!coreTask || coreTask.trim().length < 10) return null;
  const lower = coreTask.toLowerCase();

  let bestMatch: TaskSuggestions | null = null;
  let bestScore = 0;

  for (const pattern of TASK_PATTERNS) {
    let score = 0;
    for (const kw of pattern.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern.suggestions;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

const QUICK_STEPS: number[] = [1, 2, 8];

export function AgentBuilderWizard({ layers, existingNicknames, onCreate, onCancel }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [quickMode, setQuickMode] = useState(true);

  // Step 1: Identity
  const [nickname, setNickname] = useState('');
  const [formalName, setFormalName] = useState('');
  const [descriptor, setDescriptor] = useState('');
  const [emoji, setEmoji] = useState('');
  const [layerId, setLayerId] = useState(layers[0]?.id || '');
  const [badges, setBadges] = useState<Badge[]>([]);

  // Step 2: Primary Function
  const [coreTask, setCoreTask] = useState('');
  const [triggerConditions, setTriggerConditions] = useState('');
  const [autonomyLevel, setAutonomyLevel] = useState('');
  const [persona, setPersona] = useState('');
  const [instructions, setInstructions] = useState('');
  const [constraints, setConstraints] = useState('');
  const [outputFormat, setOutputFormat] = useState('');

  // Step 3: Inputs & Outputs
  const [inputs, setInputs] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputs, setOutputs] = useState('');
  const [outputDestination, setOutputDestination] = useState('');

  // Step 4: Model & Memory
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [shortTerm, setShortTerm] = useState(true);
  const [longTerm, setLongTerm] = useState(false);
  const [contextWindow, setContextWindow] = useState(100000);
  const [memoryBackend, setMemoryBackend] = useState('in-memory');

  // Step 5: Integrations
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description: string; enabled: boolean }>>([]);
  const [ragSources, setRagSources] = useState<Array<{ id: string; name: string; type: string; uri: string }>>([]);
  const [mcpServers, setMcpServers] = useState<Array<{ id: string; name: string; url: string; transport: string }>>([]);
  const [apiCalls, setApiCalls] = useState<Array<{ id: string; name: string; method: string; url: string; authType: string }>>([]);
  const [dbConnections, setDbConnections] = useState<Array<{ id: string; name: string; type: string; connectionString: string; readOnly: boolean }>>([]);

  // Step 6: Behavior & Safety
  const [priorityRanking, setPriorityRanking] = useState('');
  const [communicationStyle, setCommunicationStyle] = useState('');
  const [learningBehavior, setLearningBehavior] = useState('');
  const [decisionAuthority, setDecisionAuthority] = useState('');
  const [contentFilters, setContentFilters] = useState('');
  const [blockedTopics, setBlockedTopics] = useState('');
  const [outputValidation, setOutputValidation] = useState('');
  const [requireCitation, setRequireCitation] = useState(false);
  const [retryCount, setRetryCount] = useState(3);
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [fallbackAgent, setFallbackAgent] = useState('');
  const [maxTokensPerReq, setMaxTokensPerReq] = useState(10000);
  const [dailyBudget, setDailyBudget] = useState(50);
  const [monthlyBudget, setMonthlyBudget] = useState(1000);
  const [canRead, setCanRead] = useState('');
  const [canWrite, setCanWrite] = useState('');
  const [canExecute, setCanExecute] = useState('');
  const [canAccessExternal, setCanAccessExternal] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);

  // Step 7: Performance & Notes
  const [successMetrics, setSuccessMetrics] = useState('');
  const [typicalRuntime, setTypicalRuntime] = useState('');
  const [failureModes, setFailureModes] = useState('');
  const [escalationPath, setEscalationPath] = useState('');
  const [knownQuirks, setKnownQuirks] = useState('');
  const [maintenanceNeeds, setMaintenanceNeeds] = useState('');
  const [futureEnhancements, setFutureEnhancements] = useState('');

  // Smart suggestions based on core task
  const suggestions = useMemo(() => analyzeCoreTask(coreTask), [coreTask]);

  function toggleBadge(b: Badge) { setBadges(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]); }

  function canProceed(): boolean {
    if (step === 1) return nickname.trim().length > 0 && formalName.trim().length > 0 && layerId.length > 0;
    return true;
  }

  function handleCreate() {
    const split = (s: string) => s.split(',').map(x => x.trim()).filter(x => x);

    const config: Record<string, unknown> = {
      emoji, coreTask, triggerConditions, autonomyLevel,
      inputs: split(inputs), inputFormat, outputs: split(outputs), outputDestination,
      systemPrompt: { persona, instructions, constraints, outputFormat },
      modelConfig: { provider, model, temperature, maxTokens },
      memoryConfig: { shortTermEnabled: shortTerm, longTermEnabled: longTerm, contextWindowTokens: contextWindow, memoryBackend, ttlMinutes: 60 },
      skills, rag: { enabled: ragSources.length > 0, sources: ragSources },
      mcp: { enabled: mcpServers.length > 0, servers: mcpServers, tools: [] },
      apiCalls, database: { connections: dbConnections },
      priorityRanking, communicationStyle, learningBehavior, decisionAuthority,
      guardrails: { contentFilters: split(contentFilters), blockedTopics: split(blockedTopics), outputValidation: split(outputValidation), maxOutputTokens: 4096, requireCitation },
      errorHandling: { retryCount, retryDelayMs: 1000, timeoutMs, fallbackAgentId: fallbackAgent, circuitBreakerThreshold: 5, circuitBreakerResetMs: 60000 },
      costLimits: { maxTokensPerRequest: maxTokensPerReq, maxRequestsPerMinute: 60, dailyBudgetUsd: dailyBudget, monthlyBudgetUsd: monthlyBudget, alertThresholdPercent: 80 },
      permissions: { canRead: split(canRead), canWrite: split(canWrite), canExecute: split(canExecute), canAccessExternal, requireApproval },
      successMetrics, typicalRuntime, failureModes, escalationPath,
      knownQuirks, maintenanceNeeds, futureEnhancements,
      notes: [],
    };

    onCreate({
      nickname: nickname.trim(),
      formalName: formalName.trim(),
      descriptor: descriptor.trim(),
      layerId, badges,
      position: { x: 200 + Math.random() * 400, y: 200 + Math.random() * 300 },
      config,
    });
  }

  const nicknameError = existingNicknames.includes(nickname.trim()) ? 'This nickname already exists in the swarm' : '';

  // Quick mode navigation helpers
  const activeSteps = quickMode ? QUICK_STEPS : STEPS.map(s => s.num);
  const currentStepIndex = activeSteps.indexOf(step);
  const displayStepNum = currentStepIndex + 1;
  const displayStepTotal = activeSteps.length;
  const isLastStep = currentStepIndex === activeSteps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  function goNext() {
    if (quickMode) {
      const nextIdx = currentStepIndex + 1;
      if (nextIdx < QUICK_STEPS.length) setStep(QUICK_STEPS[nextIdx] as Step);
    } else {
      if (step < 8) setStep((step + 1) as Step);
    }
  }

  function goBack() {
    if (quickMode) {
      const prevIdx = currentStepIndex - 1;
      if (prevIdx >= 0) setStep(QUICK_STEPS[prevIdx] as Step);
    } else {
      if (step > 1) setStep((step - 1) as Step);
    }
  }

  function handleModeToggle(toQuick: boolean) {
    setQuickMode(toQuick);
    // Reset to step 1 when switching modes to avoid landing on an invisible step
    if (toQuick && !QUICK_STEPS.includes(step)) {
      setStep(1);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-xl)', width: '95%', maxWidth: 860, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Progress Header */}
        <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 2, width: 'fit-content' }}>
            <button onClick={() => handleModeToggle(true)} style={{
              padding: '5px 14px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: 'var(--text-xs)', fontWeight: 600,
              fontFamily: 'var(--font-primary)', cursor: 'pointer',
              background: quickMode ? 'var(--accent-primary)' : 'transparent',
              color: quickMode ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              transition: 'background 0.15s, color 0.15s',
            }}>Quick Create (3 steps)</button>
            <button onClick={() => handleModeToggle(false)} style={{
              padding: '5px 14px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: 'var(--text-xs)', fontWeight: 600,
              fontFamily: 'var(--font-primary)', cursor: 'pointer',
              background: !quickMode ? 'var(--accent-primary)' : 'transparent',
              color: !quickMode ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              transition: 'background 0.15s, color 0.15s',
            }}>Advanced (8 steps)</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 2 }}>
                Step {displayStepNum} of {displayStepTotal}
              </div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {STEPS[step - 1].title}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {STEPS[step - 1].subtitle}
              </div>
            </div>
            <button onClick={onCancel} style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
          </div>
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 3 }}>
            {activeSteps.map((s, i) => (
              <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= currentStepIndex ? 'var(--accent-primary)' : 'var(--border-default)', transition: 'background 0.2s' }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 'var(--space-6)' }}>

          {step === 1 && <>
            <Callout type="info">
              Fill in the basics here, then describe the core task in Step 2. Your core task description will drive smart suggestions for the rest of the wizard.
            </Callout>
            <Row>
              <Field label="Nickname *" hint="Short, memorable name used on the canvas">
                <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="e.g. Granite" style={inp} autoFocus />
                {nicknameError && <div style={{ color: 'var(--gem-ruby-400)', fontSize: 'var(--text-xs)', marginTop: 4 }}>{nicknameError}</div>}
              </Field>
              <Field label="Emoji" hint="Visual identity on the canvas node">
                <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="e.g. 🛡️" maxLength={4} style={{ ...inp, textAlign: 'center', fontSize: 24 }} />
              </Field>
            </Row>
            <Field label="Formal Name *" hint="Category-Function-Specificity pattern (e.g. Content-Moderator-Filter)">
              <input value={formalName} onChange={e => setFormalName(e.target.value)} placeholder="e.g. Content-Moderator-Filter" style={inp} />
            </Field>
            <Field label="Descriptor" hint='A personality label in 2-3 words, shown under the name'>
              <input value={descriptor} onChange={e => setDescriptor(e.target.value)} placeholder='e.g. "The Gatekeeper"' style={inp} />
            </Field>
            <Field label="Layer *" hint="Which architectural layer this agent belongs to (determines canvas grouping)">
              <select value={layerId} onChange={e => setLayerId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {layers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Badges" hint="Operational tags that appear on the agent card and affect validation rules">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {ALL_BADGES.map(b => (
                  <Tooltip key={b} text={BADGE_TOOLTIPS[b] || ''}>
                    <button onClick={() => toggleBadge(b)} style={{
                      fontSize: 'var(--text-xs)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      border: `1px solid ${badges.includes(b) ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                      background: badges.includes(b) ? 'var(--accent-primary-muted)' : 'transparent',
                      color: badges.includes(b) ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                      fontFamily: 'var(--font-primary)', fontWeight: 500,
                    }}>{b.replace('_', ' ')}</button>
                  </Tooltip>
                ))}
              </div>
            </Field>
          </>}

          {step === 2 && <>
            <Callout type="primary">
              {quickMode
                ? 'Describe what this agent does. Smart suggestions will fill in the details for you.'
                : 'Start here. Describe what this agent does in plain language. The more detail you provide, the better suggestions you will get for inputs, outputs, model settings, guardrails, and more in the following steps.'}
            </Callout>
            <Field label="Core Task *" hint="The primary thing this agent does. Be specific about what, when, and how.">
              <textarea value={coreTask} onChange={e => setCoreTask(e.target.value)} placeholder="Reviews all user-generated content against community guidelines and brand standards before it goes live. Flags problematic content, auto-approves clean content, and queues borderline cases for human review." style={{ ...inp, minHeight: 100 }} autoFocus />
            </Field>
            {suggestions && (
              <div style={{ ...suggestionBoxStyle, marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gem-emerald-400)', marginBottom: 4 }}>
                  Detected: {suggestions.category}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {quickMode
                    ? 'Smart suggestions will auto-fill skipped steps when you create this agent.'
                    : 'Smart suggestions are now active for the remaining steps. Look for the green suggestion banners.'}
                </div>
              </div>
            )}
            <Field label="Autonomy Level" hint="How independently should it operate? Higher autonomy = less human oversight needed">
              <select value={autonomyLevel} onChange={e => setAutonomyLevel(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Select...</option>
                <option value="Fully Automated">Fully Automated - no human needed</option>
                <option value="Hybrid">Hybrid - auto for obvious cases, human for gray areas</option>
                <option value="Human-in-Loop">Human-in-Loop - suggests, human decides</option>
                <option value="Advisory Only">Advisory Only - provides insights, no action</option>
                <option value="Manual">Manual - human triggers each action</option>
              </select>
              {suggestions && !autonomyLevel && (
                <SuggestionChip label={suggestions.autonomy} onApply={() => setAutonomyLevel(suggestions.autonomy)} />
              )}
            </Field>
            {!quickMode && <>
              <Field label="Trigger Conditions" hint="What activates this agent? (e.g. new data arrives, user action, schedule, another agent's output)">
                <textarea value={triggerConditions} onChange={e => setTriggerConditions(e.target.value)} placeholder="Activates whenever new content is submitted (posts, comments, uploads, profile updates)" style={{ ...inp, minHeight: 50 }} />
              </Field>
              <Divider />
              <SH title="System Prompt" />
              <Field label="Persona" hint="The identity and voice of this agent. Sets the foundation for all responses.">
                <textarea value={persona} onChange={e => setPersona(e.target.value)} placeholder="You are a content moderation agent that reviews user-generated content..." style={{ ...inp, minHeight: 60 }} />
              </Field>
              <Field label="Instructions" hint="Step-by-step guidance for how the agent should process its task">
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="When reviewing content, check against the current moderation ruleset. For images, run through the visual content classifier first..." style={{ ...inp, minHeight: 80 }} />
              </Field>
              <Field label="Constraints" hint="Hard boundaries. What must it NEVER do? Think about safety, compliance, and trust.">
                <textarea value={constraints} onChange={e => setConstraints(e.target.value)} placeholder="Never auto-approve content involving minors. Always escalate credible threats immediately..." style={{ ...inp, minHeight: 60 }} />
              </Field>
              <Field label="Output Format" hint="The expected structure of responses. JSON schema, markdown template, or plain text.">
                <textarea value={outputFormat} onChange={e => setOutputFormat(e.target.value)} placeholder='{ "decision": "approve|reject|flag", "confidence": 0.92, "reason": "..." }' style={{ ...inp, minHeight: 40, fontFamily: "'SF Mono', monospace", fontSize: 'var(--text-xs)' }} />
              </Field>
            </>}
          </>}

          {step === 3 && <>
            {suggestions && (
              <SuggestionBanner
                title={`Suggested for ${suggestions.category}`}
                items={[
                  { label: 'Inputs', value: suggestions.inputs, current: inputs, onApply: () => setInputs(suggestions.inputs) },
                  { label: 'Input Format', value: suggestions.inputFormat, current: inputFormat, onApply: () => setInputFormat(suggestions.inputFormat) },
                  { label: 'Outputs', value: suggestions.outputs, current: outputs, onApply: () => setOutputs(suggestions.outputs) },
                  { label: 'Destination', value: suggestions.outputDestination, current: outputDestination, onApply: () => setOutputDestination(suggestions.outputDestination) },
                ]}
              />
            )}
            <Field label="Required Inputs" hint="What data does this agent need to do its job? List everything, even things that seem obvious.">
              <textarea value={inputs} onChange={e => setInputs(e.target.value)} placeholder="Raw user-generated content (text, images, links), current moderation rule-set, user history/reputation score" style={{ ...inp, minHeight: 60 }} autoFocus />
            </Field>
            <Field label="Input Format" hint="How is data structured coming in? JSON, CSV, plain text, binary?">
              <textarea value={inputFormat} onChange={e => setInputFormat(e.target.value)} placeholder="JSON payload with content body, metadata, timestamp, user ID" style={{ ...inp, minHeight: 40 }} />
            </Field>
            <Field label="Primary Output" hint="What does this agent produce? Be specific about the format and content.">
              <textarea value={outputs} onChange={e => setOutputs(e.target.value)} placeholder="Moderation decision (approve/reject/flag) with confidence score and reason code" style={{ ...inp, minHeight: 60 }} />
            </Field>
            <Field label="Output Destination" hint="Where does the output go? Other agents, databases, dashboards, APIs?">
              <textarea value={outputDestination} onChange={e => setOutputDestination(e.target.value)} placeholder="Approved content goes to publish queue, rejected triggers user notification, flagged goes to human moderator dashboard" style={{ ...inp, minHeight: 60 }} />
            </Field>
          </>}

          {step === 4 && <>
            {suggestions && (
              <SuggestionBanner
                title={`Recommended for ${suggestions.category}`}
                items={[
                  { label: `Temperature ${suggestions.temperature}`, value: String(suggestions.temperature), current: String(temperature), onApply: () => setTemperature(suggestions.temperature) },
                  { label: `Max Tokens ${suggestions.maxTokens}`, value: String(suggestions.maxTokens), current: String(maxTokens), onApply: () => setMaxTokens(suggestions.maxTokens) },
                  ...(suggestions.longTermMemory && !longTerm ? [{ label: 'Enable Long-term Memory', value: 'true', current: String(longTerm), onApply: () => setLongTerm(true) }] : []),
                  ...(suggestions.memoryBackend !== 'in-memory' ? [{ label: `Backend: ${suggestions.memoryBackend}`, value: suggestions.memoryBackend, current: memoryBackend, onApply: () => setMemoryBackend(suggestions.memoryBackend) }] : []),
                ]}
              />
            )}
            <SH title="AI Model" />
            <Row>
              <Field label="AI Provider" hint="Which AI provider to use">
                <select value={provider} onChange={e => setProvider(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  {['anthropic','openai','google','mistral','meta','local','custom'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Model" hint="Specific model ID from the provider">
                <input value={model} onChange={e => setModel(e.target.value)} placeholder="claude-sonnet-4-6" style={inp} />
              </Field>
            </Row>
            <Row>
              <Field label="Temperature" hint="Lower = more predictable, Higher = more creative">
                <input type="number" value={temperature} onChange={e => setTemperature(Number(e.target.value))} min={0} max={2} step={0.1} style={inp} />
              </Field>
              <Field label="Max Tokens" hint="How long the response can be">
                <input type="number" value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))} step={256} style={inp} />
              </Field>
            </Row>
            <Divider />
            <SH title="Memory" />
            <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
              <Tooltip text="Remembers context within a single conversation or task. Resets between runs.">
                <Check label="Short-term memory" checked={shortTerm} onChange={setShortTerm} />
              </Tooltip>
              <Tooltip text="Persists learnings across sessions. Essential for agents that improve over time.">
                <Check label="Long-term memory" checked={longTerm} onChange={setLongTerm} />
              </Tooltip>
            </div>
            <Row>
              <Field label="Memory size" hint="How much the agent can remember at once">
                <input type="number" value={contextWindow} onChange={e => setContextWindow(Number(e.target.value))} step={1000} style={inp} />
              </Field>
              <Field label="Where to store memory" hint="In-memory is fastest but temporary. SQLite/Redis for persistence.">
                <select value={memoryBackend} onChange={e => setMemoryBackend(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  {['in-memory','sqlite','redis','postgres','pinecone','chromadb','qdrant'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
            </Row>
          </>}

          {step === 5 && <>
            {suggestions && (
              <SuggestionBanner
                title={`Common tools for ${suggestions.category}`}
                items={[
                  ...suggestions.skills.filter(s => !skills.some(sk => sk.name === s)).map(s => ({
                    label: s, value: s, current: '', onApply: () => setSkills(prev => [...prev, { id: uid(), name: s, description: '', enabled: true }]),
                  })),
                  ...suggestions.mcpServers.filter(s => !mcpServers.some(m => m.name === s)).map(s => ({
                    label: `MCP: ${s}`, value: s, current: '', onApply: () => setMcpServers(prev => [...prev, { id: uid(), name: s, url: `npx -y @modelcontextprotocol/server-${s}`, transport: 'stdio' }]),
                  })),
                ]}
              />
            )}
            {suggestions?.ragHint && ragSources.length === 0 && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-sm)' }}>
                RAG tip: Consider adding {suggestions.ragHint}
              </div>
            )}
            <SH title="Skills" />
            <ListBuilder items={skills} onAdd={() => setSkills([...skills, { id: uid(), name: '', description: '', enabled: true }])} onRemove={id => setSkills(skills.filter(s => s.id !== id))}
              renderItem={(s, i) => <input value={s.name} onChange={e => { const n = [...skills]; n[i] = { ...n[i], name: e.target.value }; setSkills(n); }} placeholder="Skill name (e.g. Text Generation)" style={{ ...inp, marginTop: 0 }} />}
            />
            <QuickAdd label="Common Skills" options={['Text Generation','Code Analysis','Data Extraction','Summarization','Classification','Translation','Sentiment Analysis','Image Analysis']}
              onAdd={name => setSkills([...skills, { id: uid(), name, description: '', enabled: true }])} />

            <Divider />
            <SH title="Knowledge Sources" />
            <ListBuilder items={ragSources} onAdd={() => setRagSources([...ragSources, { id: uid(), name: '', type: 'document', uri: '' }])} onRemove={id => setRagSources(ragSources.filter(s => s.id !== id))}
              renderItem={(s, i) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={s.name} onChange={e => { const n = [...ragSources]; n[i] = { ...n[i], name: e.target.value }; setRagSources(n); }} placeholder="Source name" style={{ ...inp, marginTop: 0, flex: 1 }} />
                  <input value={s.uri} onChange={e => { const n = [...ragSources]; n[i] = { ...n[i], uri: e.target.value }; setRagSources(n); }} placeholder="URI / path" style={{ ...inp, marginTop: 0, flex: 2 }} />
                </div>
              )}
            />

            <Divider />
            <SH title="Tool Connections" />
            <ListBuilder items={mcpServers} onAdd={() => setMcpServers([...mcpServers, { id: uid(), name: '', url: '', transport: 'stdio' }])} onRemove={id => setMcpServers(mcpServers.filter(s => s.id !== id))}
              renderItem={(s, i) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={s.name} onChange={e => { const n = [...mcpServers]; n[i] = { ...n[i], name: e.target.value }; setMcpServers(n); }} placeholder="Server name" style={{ ...inp, marginTop: 0, flex: 1 }} />
                  <input value={s.url} onChange={e => { const n = [...mcpServers]; n[i] = { ...n[i], url: e.target.value }; setMcpServers(n); }} placeholder="npx -y @server/name" style={{ ...inp, marginTop: 0, flex: 2 }} />
                </div>
              )}
            />
            <QuickAdd label="Common MCP Servers" options={['filesystem','github','postgres','brave-search','memory','puppeteer']}
              onAdd={name => setMcpServers([...mcpServers, { id: uid(), name, url: `npx -y @modelcontextprotocol/server-${name}`, transport: 'stdio' }])} />

            <Divider />
            <SH title="External Services" />
            <ListBuilder items={apiCalls} onAdd={() => setApiCalls([...apiCalls, { id: uid(), name: '', method: 'GET', url: '', authType: 'none' }])} onRemove={id => setApiCalls(apiCalls.filter(a => a.id !== id))}
              renderItem={(a, i) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={a.method} onChange={e => { const n = [...apiCalls]; n[i] = { ...n[i], method: e.target.value }; setApiCalls(n); }} style={{ ...inp, marginTop: 0, width: 80, cursor: 'pointer' }}>
                    {['GET','POST','PUT','DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input value={a.url} onChange={e => { const n = [...apiCalls]; n[i] = { ...n[i], url: e.target.value }; setApiCalls(n); }} placeholder="https://api.example.com/endpoint" style={{ ...inp, marginTop: 0, flex: 1 }} />
                </div>
              )}
            />

            <Divider />
            <SH title="Data Sources" />
            <ListBuilder items={dbConnections} onAdd={() => setDbConnections([...dbConnections, { id: uid(), name: '', type: 'postgresql', connectionString: '', readOnly: true }])} onRemove={id => setDbConnections(dbConnections.filter(c => c.id !== id))}
              renderItem={(c, i) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={c.type} onChange={e => { const n = [...dbConnections]; n[i] = { ...n[i], type: e.target.value }; setDbConnections(n); }} style={{ ...inp, marginTop: 0, width: 110, cursor: 'pointer' }}>
                    {['postgresql','mysql','sqlite','mongodb','redis'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={c.connectionString} onChange={e => { const n = [...dbConnections]; n[i] = { ...n[i], connectionString: e.target.value }; setDbConnections(n); }} placeholder="Connection string" style={{ ...inp, marginTop: 0, flex: 1 }} />
                </div>
              )}
            />
          </>}

          {step === 6 && <>
            {suggestions && (
              <SuggestionBanner
                title={`Safety profile for ${suggestions.category}`}
                items={[
                  ...(suggestions.priorityRanking && !priorityRanking ? [{ label: 'Priority', value: suggestions.priorityRanking, current: priorityRanking, onApply: () => setPriorityRanking(suggestions.priorityRanking) }] : []),
                  ...(suggestions.communicationStyle && !communicationStyle ? [{ label: 'Comm. Style', value: suggestions.communicationStyle, current: communicationStyle, onApply: () => setCommunicationStyle(suggestions.communicationStyle) }] : []),
                  ...suggestions.guardrails.filter(g => !contentFilters.includes(g)).map(g => ({
                    label: g, value: g, current: '', onApply: () => setContentFilters(prev => prev ? `${prev}, ${g}` : g),
                  })),
                  ...suggestions.blockedTopics.filter(t => !blockedTopics.includes(t)).map(t => ({
                    label: `Block: ${t}`, value: t, current: '', onApply: () => setBlockedTopics(prev => prev ? `${prev}, ${t}` : t),
                  })),
                  ...suggestions.outputValidation.filter(v => !outputValidation.includes(v)).map(v => ({
                    label: `Validate: ${v}`, value: v, current: '', onApply: () => setOutputValidation(prev => prev ? `${prev}, ${v}` : v),
                  })),
                ]}
              />
            )}
            <SH title="Behavior Profile" />
            <Field label="Priority Ranking" hint="How critical is this agent to the swarm? Affects alerting thresholds and resource allocation.">
              <textarea value={priorityRanking} onChange={e => setPriorityRanking(e.target.value)} placeholder="High - nothing publishes without passing through this agent, but not critical infrastructure (can queue if overloaded)" style={{ ...inp, minHeight: 50 }} autoFocus />
            </Field>
            <Field label="Communication Style" hint="How it talks to other agents and humans. Affects tone, verbosity, and format of messages.">
              <textarea value={communicationStyle} onChange={e => setCommunicationStyle(e.target.value)} placeholder="Terse and rule-based when rejecting content, includes specific violation reason and relevant guideline section" style={{ ...inp, minHeight: 50 }} />
            </Field>
            <Field label="Learning Behavior" hint="Does it improve over time? Static agents are more predictable, adaptive agents get better but need monitoring.">
              <textarea value={learningBehavior} onChange={e => setLearningBehavior(e.target.value)} placeholder="Adaptive - improves accuracy based on human moderator corrections, updates internal scoring when guidelines change" style={{ ...inp, minHeight: 50 }} />
            </Field>
            <Field label="Decision Authority" hint="What decisions can it make without asking? Define clear boundaries for autonomous action.">
              <textarea value={decisionAuthority} onChange={e => setDecisionAuthority(e.target.value)} placeholder="Can auto-approve content with 90%+ confidence, can auto-reject clear violations, must defer gray area decisions" style={{ ...inp, minHeight: 50 }} />
            </Field>

            <Divider />
            <SH title="Guardrails" />
            <Field label="Content Filters" hint="Safety filters applied to all output. Comma-separated. These run before any output is delivered.">
              <input value={contentFilters} onChange={e => setContentFilters(e.target.value)} placeholder="pii-detection, profanity-filter, bias-check" style={inp} />
            </Field>
            <Field label="Blocked Topics" hint="Topics the agent must never engage with. Hard stops, no exceptions.">
              <input value={blockedTopics} onChange={e => setBlockedTopics(e.target.value)} placeholder="internal-pricing, competitor-info, legal-advice" style={inp} />
            </Field>
            <Field label="Output Validation" hint="Checks applied to every response before delivery. Comma-separated.">
              <input value={outputValidation} onChange={e => setOutputValidation(e.target.value)} placeholder="json-schema, max-length, no-hallucination" style={inp} />
            </Field>
            <Check label="Require citations for factual claims" checked={requireCitation} onChange={setRequireCitation} />

            <Divider />
            <SH title="Error Handling" />
            <Row>
              <Field label="Retry Count" hint="How many times to retry on failure before giving up">
                <input type="number" value={retryCount} onChange={e => setRetryCount(Number(e.target.value))} min={0} max={10} style={inp} />
              </Field>
              <Field label="Timeout (ms)" hint="Max time to wait for a response. 30000ms = 30 seconds">
                <input type="number" value={timeoutMs} onChange={e => setTimeoutMs(Number(e.target.value))} step={1000} style={inp} />
              </Field>
              <Field label="Fallback Agent" hint="Which agent takes over if this one fails. Use their nickname.">
                <input value={fallbackAgent} onChange={e => setFallbackAgent(e.target.value)} placeholder="Nickname" style={inp} />
              </Field>
            </Row>

            <Divider />
            <SH title="Cost Limits" />
            <Row>
              <Field label="Max Tokens/Request" hint="Cap output size per single request to control costs">
                <input type="number" value={maxTokensPerReq} onChange={e => setMaxTokensPerReq(Number(e.target.value))} step={1000} style={inp} />
              </Field>
              <Field label="Daily Budget ($)" hint="Daily spending cap. Agent pauses when reached.">
                <input type="number" value={dailyBudget} onChange={e => setDailyBudget(Number(e.target.value))} step={5} style={inp} />
              </Field>
              <Field label="Monthly Budget ($)" hint="Monthly spending cap. Critical for production agents.">
                <input type="number" value={monthlyBudget} onChange={e => setMonthlyBudget(Number(e.target.value))} step={50} style={inp} />
              </Field>
            </Row>

            <Divider />
            <SH title="Permissions" />
            <Field label="Can Read" hint="Comma-separated list of data sources this agent can read from">
              <input value={canRead} onChange={e => setCanRead(e.target.value)} placeholder="product-catalog, user-profiles" style={inp} />
            </Field>
            <Field label="Can Write" hint="Data sources this agent can write to. Be restrictive here.">
              <input value={canWrite} onChange={e => setCanWrite(e.target.value)} placeholder="audit-log, support-tickets" style={inp} />
            </Field>
            <Field label="Can Execute" hint="Actions this agent is allowed to perform. Each one is a permission grant.">
              <input value={canExecute} onChange={e => setCanExecute(e.target.value)} placeholder="send-email, create-ticket" style={inp} />
            </Field>
            <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-3)' }}>
              <Tooltip text="Allow this agent to call external APIs, webhooks, and third-party services">
                <Check label="Can access external APIs" checked={canAccessExternal} onChange={setCanAccessExternal} />
              </Tooltip>
              <Tooltip text="Require a human to approve before the agent takes any action (write, execute, or external call)">
                <Check label="Require human approval for actions" checked={requireApproval} onChange={setRequireApproval} />
              </Tooltip>
            </div>
          </>}

          {step === 7 && <>
            {suggestions && (
              <SuggestionBanner
                title={`Metrics for ${suggestions.category}`}
                items={[
                  ...(suggestions.successMetrics && !successMetrics ? [{ label: 'Success Metrics', value: suggestions.successMetrics, current: successMetrics, onApply: () => setSuccessMetrics(suggestions.successMetrics) }] : []),
                  ...(suggestions.failureModes && !failureModes ? [{ label: 'Failure Modes', value: suggestions.failureModes, current: failureModes, onApply: () => setFailureModes(suggestions.failureModes) }] : []),
                  ...(suggestions.escalationPath && !escalationPath ? [{ label: 'Escalation Path', value: suggestions.escalationPath, current: escalationPath, onApply: () => setEscalationPath(suggestions.escalationPath) }] : []),
                ]}
              />
            )}
            <SH title="Performance & Reliability" />
            <Field label="Success Metrics" hint="How do you measure if this agent is doing its job well? Be specific and measurable.">
              <textarea value={successMetrics} onChange={e => setSuccessMetrics(e.target.value)} placeholder="False positive rate under 5%, false negative rate under 2%, average review time under 500ms" style={{ ...inp, minHeight: 60 }} autoFocus />
            </Field>
            <Field label="Typical Runtime" hint="Expected execution time per request. Important for SLA planning.">
              <input value={typicalRuntime} onChange={e => setTypicalRuntime(e.target.value)} placeholder="200-800ms depending on content complexity" style={inp} />
            </Field>
            <Field label="Failure Modes" hint="What can realistically go wrong? Knowing these upfront helps build better error handling.">
              <textarea value={failureModes} onChange={e => setFailureModes(e.target.value)} placeholder="API timeout on image processing, ruleset version mismatch, new slang/cultural references it hasn't seen" style={{ ...inp, minHeight: 60 }} />
            </Field>
            <Field label="Escalation Path" hint="What happens when the agent can't handle something? Define the chain of responsibility.">
              <textarea value={escalationPath} onChange={e => setEscalationPath(e.target.value)} placeholder="Flags content with confidence below 70% for human review, escalates immediately if content involves potential harm" style={{ ...inp, minHeight: 60 }} />
            </Field>

            <Divider />
            <SH title="Notes" />
            <Field label="Known Quirks" hint="Observed behaviors or edge cases that others should know about">
              <textarea value={knownQuirks} onChange={e => setKnownQuirks(e.target.value)} placeholder="Struggles with regional slang, occasionally over-flags political content during election seasons" style={{ ...inp, minHeight: 60 }} />
            </Field>
            <Field label="Maintenance Needs" hint="Recurring upkeep this agent requires to stay effective">
              <textarea value={maintenanceNeeds} onChange={e => setMaintenanceNeeds(e.target.value)} placeholder="Weekly ruleset review, monthly accuracy audit, quarterly retraining" style={{ ...inp, minHeight: 50 }} />
            </Field>
            <Field label="Future Enhancements" hint="Planned improvements or features you want to add later">
              <textarea value={futureEnhancements} onChange={e => setFutureEnhancements(e.target.value)} placeholder="Community voting integration, improved context awareness for reply chains, multilingual support" style={{ ...inp, minHeight: 50 }} />
            </Field>
          </>}

          {step === 8 && <>
            <SH title="Review Your Agent" />
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: 36 }}>{emoji || '🤖'}</span>
                <div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{nickname || 'Unnamed'}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{formalName}</div>
                  {descriptor && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>"{descriptor}"</div>}
                </div>
              </div>

              {badges.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                {badges.map(b => <span key={b} style={badgeStyle}>{b.replace('_', ' ')}</span>)}
              </div>}

              <ReviewRow label="Layer" value={layers.find(l => l.id === layerId)?.name || ''} />
              <ReviewRow label="Autonomy" value={autonomyLevel} />
              <ReviewRow label="Core Task" value={coreTask} />
              <ReviewRow label="Model" value={`${provider} / ${model}`} />
              {inputs && <ReviewRow label="Inputs" value={inputs} />}
              {outputs && <ReviewRow label="Outputs" value={outputs} />}
              {skills.length > 0 && <ReviewRow label="Skills" value={skills.map(s => s.name).join(', ')} />}
              {ragSources.length > 0 && <ReviewRow label="RAG Sources" value={ragSources.map(s => s.name).join(', ')} />}
              {mcpServers.length > 0 && <ReviewRow label="MCP Servers" value={mcpServers.map(s => s.name).join(', ')} />}
              {apiCalls.length > 0 && <ReviewRow label="API Calls" value={apiCalls.length + ' configured'} />}
              {dbConnections.length > 0 && <ReviewRow label="Databases" value={dbConnections.map(c => c.type).join(', ')} />}
              {contentFilters && <ReviewRow label="Guardrails" value={contentFilters} />}
              {successMetrics && <ReviewRow label="Success Metrics" value={successMetrics} />}
              {suggestions && <ReviewRow label="Detected Type" value={suggestions.category} />}
            </div>

            {/* Completeness check */}
            {(() => {
              const filled = [coreTask, inputs, outputs, autonomyLevel, successMetrics].filter(Boolean).length;
              const total = 5;
              if (filled < total) return (
                <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--gem-amber-glow)', border: '1px solid var(--gem-amber-500)', fontSize: 'var(--text-xs)', color: 'var(--gem-amber-400)' }}>
                  {filled}/{total} key fields filled. Consider going back to complete: {[
                    !coreTask && 'Core Task (Step 2)',
                    !inputs && 'Inputs (Step 3)',
                    !outputs && 'Outputs (Step 3)',
                    !autonomyLevel && 'Autonomy Level (Step 2)',
                    !successMetrics && 'Success Metrics (Step 7)',
                  ].filter(Boolean).join(', ')}
                </div>
              );
              return null;
            })()}
          </>}
        </div>

        {/* Footer */}
        <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={!isFirstStep ? goBack : onCancel} style={btnSecondary}>
            {!isFirstStep ? 'Back' : 'Cancel'}
          </button>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {!quickMode && step < 8 && step > 1 && (
              <button onClick={() => setStep(8 as Step)} style={{ ...btnSecondary, color: 'var(--text-tertiary)' }}>Skip to Review</button>
            )}
            {!isLastStep ? (
              <button onClick={goNext} disabled={!canProceed()} style={{ ...btnPrimary, opacity: canProceed() ? 1 : 0.4 }}>
                Continue
              </button>
            ) : (
              <button onClick={handleCreate} disabled={!nickname.trim() || !formalName.trim() || !!nicknameError} style={{ ...btnPrimary, opacity: (nickname.trim() && formalName.trim() && !nicknameError) ? 1 : 0.4 }}>
                Create Agent
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Badge tooltips
const BADGE_TOOLTIPS: Record<string, string> = {
  HUB: 'Central coordinator that routes work to other agents',
  CRITICAL: 'System depends on this agent. Failures trigger alerts.',
  ENTRY: 'First point of contact. Receives external input.',
  AUTO: 'Runs without human intervention',
  HUMAN: 'Requires human interaction or oversight',
  APPROVAL: 'Must approve actions before they proceed',
  ALWAYS_ON: 'Must be running 24/7. Downtime is not acceptable.',
  ADVISORY: 'Provides recommendations but does not take action',
  CAN_OVERRIDE: 'Has authority to override other agents\' decisions',
  HIGH_PRIORITY: 'Gets preferential resource allocation',
  MEDIUM: 'Standard priority level',
  LOGS_ALL: 'Records every decision for audit trail',
};

// Helper components
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>{label}</label>
      {hint && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>{hint}</div>}
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr)`, gap: 'var(--space-4)' }}>{children}</div>;
}

function SH({ title }: { title: string }) {
  return <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>{title}</div>;
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border-default)', margin: 'var(--space-6) 0' }} />;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}
    </label>
  );
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  if (!text) return <>{children}</>;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
          fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
          whiteSpace: 'nowrap', maxWidth: 280, zIndex: 10, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginBottom: 4,
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

function Callout({ type, children }: { type: 'info' | 'primary'; children: React.ReactNode }) {
  const isP = type === 'primary';
  return (
    <div style={{
      padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)',
      background: isP ? 'var(--gem-emerald-glow)' : 'var(--accent-primary-muted)',
      border: `1px solid ${isP ? 'var(--gem-emerald-500)' : 'var(--border-accent)'}`,
      fontSize: 'var(--text-sm)', color: isP ? 'var(--gem-emerald-400)' : 'var(--text-secondary)',
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

interface SuggestionItem {
  label: string;
  value: string;
  current: string;
  onApply: () => void;
}

function SuggestionBanner({ title, items }: { title: string; items: SuggestionItem[] }) {
  const actionable = items.filter(i => i.current !== i.value);
  if (actionable.length === 0) return null;
  return (
    <div style={{ ...suggestionBoxStyle, marginBottom: 'var(--space-5)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gem-emerald-400)', marginBottom: 'var(--space-2)' }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
        {actionable.map(item => (
          <button key={item.label} onClick={item.onApply} title={item.value.length > 40 ? item.value : undefined} style={{
            fontSize: 'var(--text-xs)', padding: '3px 8px', borderRadius: 'var(--radius-full)',
            border: '1px solid var(--gem-emerald-500)', background: 'transparent',
            color: 'var(--gem-emerald-400)', cursor: 'pointer', fontFamily: 'var(--font-primary)',
            transition: 'background 0.15s',
          }}>
            + {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SuggestionChip({ label, onApply }: { label: string; onApply: () => void }) {
  return (
    <button onClick={onApply} style={{
      display: 'inline-block', marginTop: 'var(--space-2)',
      fontSize: 'var(--text-xs)', padding: '3px 10px', borderRadius: 'var(--radius-full)',
      border: '1px solid var(--gem-emerald-500)', background: 'var(--gem-emerald-glow)',
      color: 'var(--gem-emerald-400)', cursor: 'pointer', fontFamily: 'var(--font-primary)',
    }}>
      Suggested: {label}
    </button>
  );
}

function ListBuilder<T extends { id: string }>({ items, onAdd, onRemove, renderItem }: { items: T[]; onAdd: () => void; onRemove: (id: string) => void; renderItem: (item: T, index: number) => React.ReactNode }) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <div style={{ flex: 1 }}>{renderItem(item, i)}</div>
          <button onClick={() => onRemove(item.id)} style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--gem-ruby-glow)', color: 'var(--gem-ruby-400)', cursor: 'pointer', fontSize: 11 }}>X</button>
        </div>
      ))}
      <button onClick={onAdd} style={addBtn}>+ Add</button>
    </div>
  );
}

function QuickAdd({ label, options, onAdd }: { label: string; options: string[]; onAdd: (name: string) => void }) {
  return (
    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary-muted)', border: '1px solid var(--border-accent)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>{label}</div>
      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
        {options.map(name => (
          <button key={name} onClick={() => onAdd(name)} style={{
            fontSize: 'var(--text-xs)', padding: '3px 8px', borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-default)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-primary)',
          }}>+ {name}</button>
        ))}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
      <div style={{ width: 120, flexShrink: 0, fontWeight: 500, color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

// Styles
const inp: React.CSSProperties = {
  fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)', background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)', width: '100%',
  outline: 'none', boxSizing: 'border-box', resize: 'vertical' as const,
};

const btnPrimary: React.CSSProperties = {
  fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)', fontWeight: 600,
  borderRadius: 'var(--radius-md)', cursor: 'pointer', border: 'none',
  background: 'var(--accent-primary)', color: 'var(--bg-base)',
  padding: 'var(--space-3) var(--space-6)',
};

const btnSecondary: React.CSSProperties = {
  fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)', fontWeight: 600,
  borderRadius: 'var(--radius-md)', cursor: 'pointer',
  background: 'transparent', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  padding: 'var(--space-3) var(--space-5)',
};

const addBtn: React.CSSProperties = {
  fontFamily: 'var(--font-primary)', fontSize: 'var(--text-xs)', fontWeight: 600,
  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  border: '1px solid var(--border-accent)', background: 'var(--accent-primary-muted)',
  color: 'var(--accent-primary)', padding: 'var(--space-2) var(--space-3)',
  marginTop: 'var(--space-2)',
};

const badgeStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 500,
  padding: '3px var(--space-2)', borderRadius: 'var(--radius-sm)',
  background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)',
  border: '1px solid var(--border-accent)', fontFamily: 'var(--font-primary)',
};

const suggestionBoxStyle: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
  background: 'var(--gem-emerald-glow)', border: '1px solid var(--gem-emerald-500)',
};
