import React, { useState, useEffect } from 'react';
import { Logo } from './Logo.js';
import type { Agent, Badge, LayerDefinition, Swarm, RelationshipType } from '../../shared/types/index.js';

interface Props {
  agent: Agent;
  swarm: Swarm;
  layers: LayerDefinition[];
  onSave: (agentId: string, changes: Partial<Agent>) => void;
  onDelete: (agentId: string) => void;
  onClose: () => void;
  dependentCount: number;
}

// Config shape for all agent data
interface FullAgentConfig {
  emoji?: string;
  coreTask?: string;
  inputs?: string[];
  outputs?: string[];
  inputFormat?: string;
  outputDestination?: string;
  autonomyLevel?: string;
  triggerConditions?: string;

  // Performance & Reliability
  successMetrics?: string;
  typicalRuntime?: string;
  failureModes?: string;
  escalationPath?: string;

  // Behavior Profile
  priorityRanking?: string;
  communicationStyle?: string;
  learningBehavior?: string;
  decisionAuthority?: string;

  // Structured Notes
  knownQuirks?: string;
  maintenanceNeeds?: string;
  futureEnhancements?: string;

  // Relationship explanations
  relationshipNotes?: Record<string, string>;

  // System Prompt
  systemPrompt?: { persona?: string; instructions?: string; constraints?: string; outputFormat?: string };

  // Model
  modelConfig?: { provider?: string; model?: string; temperature?: number; maxTokens?: number };

  // Skills
  skills?: Array<{ id: string; name: string; description: string; enabled: boolean }>;

  // RAG
  rag?: { enabled?: boolean; sources?: Array<{ id: string; name: string; type: string; uri: string }> };

  // MCP
  mcp?: { enabled?: boolean; servers?: Array<{ id: string; name: string; url: string; transport: string }> };

  // API
  apiCalls?: Array<{ id: string; name: string; method: string; url: string; authType: string }>;

  // Database
  database?: { connections?: Array<{ id: string; name: string; type: string; connectionString: string; readOnly: boolean }> };

  // Error Handling
  errorHandling?: { retryCount?: number; retryDelayMs?: number; timeoutMs?: number; fallbackAgentId?: string };

  // Cost
  costLimits?: { maxTokensPerRequest?: number; dailyBudgetUsd?: number; monthlyBudgetUsd?: number };

  // Notes (legacy)
  notes?: Array<{ id: string; content: string; author: string; timestamp: string }>;

  [key: string]: unknown;
}

const ALL_BADGES: Badge[] = ['HUB','CRITICAL','ENTRY','AUTO','HUMAN','APPROVAL','ALWAYS_ON','ADVISORY','CAN_OVERRIDE','HIGH_PRIORITY','MEDIUM','LOGS_ALL'];

function uid() { return Math.random().toString(36).slice(2, 10); }

export function AgentModusModal({ agent, swarm, layers, onSave, onDelete, onClose, dependentCount }: Props) {
  const [config, setConfig] = useState<FullAgentConfig>((agent.config || {}) as FullAgentConfig);
  const [nickname, setNickname] = useState(agent.nickname);
  const [formalName, setFormalName] = useState(agent.formalName);
  const [descriptor, setDescriptor] = useState(agent.descriptor);
  const [layerId, setLayerId] = useState(agent.layerId);
  const [badges, setBadges] = useState<Badge[]>(agent.badges);
  const [dirty, setDirty] = useState(false);
  const [section, setSection] = useState<string>('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfig((agent.config || {}) as FullAgentConfig);
    setNickname(agent.nickname);
    setFormalName(agent.formalName);
    setDescriptor(agent.descriptor);
    setLayerId(agent.layerId);
    setBadges(agent.badges);
    setDirty(false);
    setConfirmDelete(false);
  }, [agent.id]);

  function mark() { setDirty(true); }
  function updateConfig(patch: Partial<FullAgentConfig>) { setConfig(prev => ({ ...prev, ...patch })); mark(); }
  function toggleBadge(b: Badge) { setBadges(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]); mark(); }

  function handleSave() {
    onSave(agent.id, { nickname, formalName, descriptor, layerId, badges, config: config as Record<string, unknown> });
    setDirty(false);
  }

  const layer = layers.find(l => l.id === layerId);
  const borderColor = layer?.colorTheme || '#00d9ff';

  // Relationships for this agent
  const rels = {
    dependsOn: swarm.relationships.filter(r => r.sourceAgentId === agent.id && r.type === 'dependsOn').map(r => swarm.agents.find(a => a.id === r.targetAgentId)),
    feedsInto: swarm.relationships.filter(r => r.sourceAgentId === agent.id && r.type === 'feedsInto').map(r => swarm.agents.find(a => a.id === r.targetAgentId)),
    collaboratesWith: swarm.relationships.filter(r => (r.sourceAgentId === agent.id || r.targetAgentId === agent.id) && r.type === 'collaboratesWith').map(r => {
      const otherId = r.sourceAgentId === agent.id ? r.targetAgentId : r.sourceAgentId;
      return swarm.agents.find(a => a.id === otherId);
    }),
    canOverride: swarm.relationships.filter(r => r.sourceAgentId === agent.id && r.type === 'canOverride').map(r => swarm.agents.find(a => a.id === r.targetAgentId)),
    dependedOnBy: swarm.relationships.filter(r => r.targetAgentId === agent.id && r.type === 'dependsOn').map(r => swarm.agents.find(a => a.id === r.sourceAgentId)),
  };

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'function', label: 'Primary Function' },
    { id: 'io', label: 'Inputs & Outputs' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'performance', label: 'Performance' },
    { id: 'behavior', label: 'Behavior Profile' },
    { id: 'technical', label: 'Technical Config' },
    { id: 'notes', label: 'Notes' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
        border: `3px solid ${borderColor}`, borderRadius: 20,
        width: '95%', maxWidth: 1000, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: `0 20px 60px rgba(0,0,0,0.9), 0 0 40px ${borderColor}20`,
      }}>

        {/* Header - Agent Identity */}
        <div style={{ padding: '24px 30px', borderBottom: `2px solid ${borderColor}40`, display: 'flex', gap: 24, alignItems: 'flex-start', flexShrink: 0 }}>
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 64, textAlign: 'center', marginBottom: 8 }}>{config.emoji || '🤖'}</div>
            <input value={config.emoji || ''} onChange={e => updateConfig({ emoji: e.target.value })} placeholder="🤖" maxLength={4}
              style={{ width: 80, textAlign: 'center', fontSize: 24, ...inp, marginTop: 0 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 4 }}>
              <Logo size={32} />
              <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--accent-primary)' }}>Agent Modus</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={lbl}>Formal Name</label>
                <input value={formalName} onChange={e => { setFormalName(e.target.value); mark(); }} style={inp} />
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label style={lbl}>Nickname</label>
                <input value={nickname} onChange={e => { setNickname(e.target.value); mark(); }} style={inp} />
              </div>
            </div>
            <div>
              <label style={lbl}>Descriptor</label>
              <input value={descriptor} onChange={e => { setDescriptor(e.target.value); mark(); }} placeholder='"The Gatekeeper"' style={inp} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              {ALL_BADGES.map(b => (
                <button key={b} onClick={() => toggleBadge(b)} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${badges.includes(b) ? borderColor : 'rgba(255,255,255,0.15)'}`,
                  background: badges.includes(b) ? `${borderColor}25` : 'transparent',
                  color: badges.includes(b) ? '#fff' : '#64748b',
                }}>{b.replace('_', ' ')}</button>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.2)',
            border: '2px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>X</button>
        </div>

        {/* Section Nav */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 20px', flexShrink: 0, overflowX: 'auto' }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              padding: '10px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'transparent', color: section === s.id ? '#00d9ff' : '#64748b',
              borderBottom: section === s.id ? '2px solid #00d9ff' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}>{s.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 30px' }}>

          {section === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <InfoCard title="Layer" value={layer?.name || layerId}>
                <select value={layerId} onChange={e => { setLayerId(e.target.value); mark(); }} style={{ ...inp, cursor: 'pointer' }}>
                  {layers.map(l => <option key={l.id} value={l.id} style={{ background: '#1e293b' }}>{l.name}</option>)}
                </select>
              </InfoCard>
              <InfoCard title="Autonomy Level" value={config.autonomyLevel || 'Not set'}>
                <select value={config.autonomyLevel || ''} onChange={e => updateConfig({ autonomyLevel: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1e293b' }}>Select...</option>
                  <option value="Fully Automated" style={{ background: '#1e293b' }}>Fully Automated</option>
                  <option value="Human-in-Loop" style={{ background: '#1e293b' }}>Human-in-Loop</option>
                  <option value="Hybrid" style={{ background: '#1e293b' }}>Hybrid</option>
                  <option value="Advisory Only" style={{ background: '#1e293b' }}>Advisory Only</option>
                  <option value="Manual" style={{ background: '#1e293b' }}>Manual</option>
                </select>
              </InfoCard>
              <InfoCard title="Relationships" value={`${rels.dependsOn.length + rels.feedsInto.length + rels.collaboratesWith.length + rels.canOverride.length} connections`} />
              <InfoCard title="Depended On By" value={`${rels.dependedOnBy.length} agents`} />
              <div style={{ gridColumn: 'span 2' }}>
                <SectionHeader title="Core Task" />
                <textarea value={config.coreTask || ''} onChange={e => updateConfig({ coreTask: e.target.value })} placeholder="Describe what this agent does, its primary purpose..." style={{ ...inp, minHeight: 80, fontFamily: 'inherit' }} />
              </div>
            </div>
          )}

          {section === 'function' && (
            <>
              <SectionHeader title="Primary Function" />
              <label style={lbl}>Core Task</label>
              <textarea value={config.coreTask || ''} onChange={e => updateConfig({ coreTask: e.target.value })} placeholder="Reviews all user-generated content against community guidelines..." style={{ ...inp, minHeight: 100, fontFamily: 'inherit' }} />
              <label style={lbl}>Trigger Conditions</label>
              <textarea value={config.triggerConditions || ''} onChange={e => updateConfig({ triggerConditions: e.target.value })} placeholder="Activates whenever new content is submitted (posts, comments, uploads, profile updates)" style={{ ...inp, minHeight: 50, fontFamily: 'inherit' }} />
              <label style={lbl}>Autonomy Level</label>
              <select value={config.autonomyLevel || ''} onChange={e => updateConfig({ autonomyLevel: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                <option value="" style={{ background: '#1e293b' }}>Select...</option>
                <option value="Fully Automated" style={{ background: '#1e293b' }}>Fully Automated</option>
                <option value="Human-in-Loop" style={{ background: '#1e293b' }}>Human-in-Loop</option>
                <option value="Hybrid" style={{ background: '#1e293b' }}>Hybrid (auto-approve obvious, flag gray areas)</option>
                <option value="Advisory Only" style={{ background: '#1e293b' }}>Advisory Only</option>
                <option value="Manual" style={{ background: '#1e293b' }}>Manual</option>
              </select>

              <SectionHeader title="System Prompt" />
              <label style={lbl}>Persona</label>
              <textarea value={config.systemPrompt?.persona || ''} onChange={e => updateConfig({ systemPrompt: { ...config.systemPrompt, persona: e.target.value } })} placeholder="You are a content moderation agent..." style={{ ...inp, minHeight: 60, fontFamily: 'inherit' }} />
              <label style={lbl}>Instructions</label>
              <textarea value={config.systemPrompt?.instructions || ''} onChange={e => updateConfig({ systemPrompt: { ...config.systemPrompt, instructions: e.target.value } })} placeholder="When reviewing content, check against the current moderation ruleset..." style={{ ...inp, minHeight: 80, fontFamily: 'inherit' }} />
              <label style={lbl}>Constraints</label>
              <textarea value={config.systemPrompt?.constraints || ''} onChange={e => updateConfig({ systemPrompt: { ...config.systemPrompt, constraints: e.target.value } })} placeholder="Never auto-approve content involving minors. Always escalate credible threats..." style={{ ...inp, minHeight: 60, fontFamily: 'inherit' }} />

              <SectionHeader title="Model Configuration" />
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Provider</label>
                  <select value={config.modelConfig?.provider || 'anthropic'} onChange={e => updateConfig({ modelConfig: { ...config.modelConfig, provider: e.target.value } })} style={{ ...inp, cursor: 'pointer' }}>
                    {['anthropic','openai','google','mistral','meta','local'].map(p => <option key={p} value={p} style={{ background: '#1e293b' }}>{p}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Model</label>
                  <input value={config.modelConfig?.model || ''} onChange={e => updateConfig({ modelConfig: { ...config.modelConfig, model: e.target.value } })} placeholder="claude-sonnet-4-6" style={inp} />
                </div>
                <div style={{ width: 80 }}>
                  <label style={lbl}>Temp</label>
                  <input type="number" value={config.modelConfig?.temperature ?? 0.7} onChange={e => updateConfig({ modelConfig: { ...config.modelConfig, temperature: Number(e.target.value) } })} min={0} max={2} step={0.1} style={inp} />
                </div>
              </div>
            </>
          )}

          {section === 'io' && (
            <>
              <SectionHeader title="Inputs & Outputs" />
              <label style={lbl}>Required Inputs</label>
              <textarea value={(config.inputs || []).join(', ')} onChange={e => updateConfig({ inputs: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} placeholder="Raw user-generated content (text, images, links), current moderation rule-set, user history" style={{ ...inp, minHeight: 50, fontFamily: 'inherit' }} />
              <label style={lbl}>Input Format</label>
              <textarea value={config.inputFormat || ''} onChange={e => updateConfig({ inputFormat: e.target.value })} placeholder="JSON payload with content body, metadata, timestamp, user ID" style={{ ...inp, minHeight: 40, fontFamily: 'inherit' }} />
              <label style={lbl}>Primary Output</label>
              <textarea value={(config.outputs || []).join(', ')} onChange={e => updateConfig({ outputs: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} placeholder="Moderation decision (approve/reject/flag) with confidence score and reason code" style={{ ...inp, minHeight: 50, fontFamily: 'inherit' }} />
              <label style={lbl}>Output Destination</label>
              <textarea value={config.outputDestination || ''} onChange={e => updateConfig({ outputDestination: e.target.value })} placeholder="Approved content goes to publish queue, rejected triggers user notification, flagged goes to human moderator dashboard" style={{ ...inp, minHeight: 50, fontFamily: 'inherit' }} />
            </>
          )}

          {section === 'relationships' && (
            <>
              <SectionHeader title="Relationships" />
              <RelSection title="Depends On" color="#00d9ff" agents={rels.dependsOn} agentConfig={config} type="dependsOn" onUpdateNote={(id, note) => updateConfig({ relationshipNotes: { ...config.relationshipNotes, [id]: note } })} />
              <RelSection title="Feeds Into" color="#a855f7" agents={rels.feedsInto} agentConfig={config} type="feedsInto" onUpdateNote={(id, note) => updateConfig({ relationshipNotes: { ...config.relationshipNotes, [id]: note } })} />
              <RelSection title="Collaborates With" color="#fbbf24" agents={rels.collaboratesWith} agentConfig={config} type="collaboratesWith" onUpdateNote={(id, note) => updateConfig({ relationshipNotes: { ...config.relationshipNotes, [id]: note } })} />
              <RelSection title="Can Override" color="#ef4444" agents={rels.canOverride} agentConfig={config} type="canOverride" onUpdateNote={(id, note) => updateConfig({ relationshipNotes: { ...config.relationshipNotes, [id]: note } })} />
              <RelSection title="Depended On By" color="#06b6d4" agents={rels.dependedOnBy} agentConfig={config} type="dependedOnBy" onUpdateNote={(id, note) => updateConfig({ relationshipNotes: { ...config.relationshipNotes, [id]: note } })} />
            </>
          )}

          {section === 'performance' && (
            <>
              <SectionHeader title="Performance & Reliability" />
              <label style={lbl}>Success Metrics</label>
              <textarea value={config.successMetrics || ''} onChange={e => updateConfig({ successMetrics: e.target.value })} placeholder="False positive rate under 5%, false negative rate under 2%, average review time under 500ms, human review queue stays under 100 items" style={{ ...inp, minHeight: 60, fontFamily: 'inherit' }} />
              <label style={lbl}>Typical Runtime</label>
              <textarea value={config.typicalRuntime || ''} onChange={e => updateConfig({ typicalRuntime: e.target.value })} placeholder="200-800ms depending on content complexity (longer for image analysis)" style={{ ...inp, minHeight: 40, fontFamily: 'inherit' }} />
              <label style={lbl}>Failure Modes</label>
              <textarea value={config.failureModes || ''} onChange={e => updateConfig({ failureModes: e.target.value })} placeholder="API timeout on image processing, ruleset version mismatch, edge cases with new slang/cultural references" style={{ ...inp, minHeight: 60, fontFamily: 'inherit' }} />
              <label style={lbl}>Escalation Path</label>
              <textarea value={config.escalationPath || ''} onChange={e => updateConfig({ escalationPath: e.target.value })} placeholder="Automatically flags content with confidence score below 70% for human review, escalates immediately if content involves potential harm" style={{ ...inp, minHeight: 60, fontFamily: 'inherit' }} />

              <SectionHeader title="Error Handling" />
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Retries</label><input type="number" value={config.errorHandling?.retryCount ?? 3} onChange={e => updateConfig({ errorHandling: { ...config.errorHandling, retryCount: Number(e.target.value) } })} style={inp} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>Timeout (ms)</label><input type="number" value={config.errorHandling?.timeoutMs ?? 30000} onChange={e => updateConfig({ errorHandling: { ...config.errorHandling, timeoutMs: Number(e.target.value) } })} style={inp} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>Fallback Agent</label><input value={config.errorHandling?.fallbackAgentId || ''} onChange={e => updateConfig({ errorHandling: { ...config.errorHandling, fallbackAgentId: e.target.value } })} placeholder="Nickname" style={inp} /></div>
              </div>

              <SectionHeader title="Cost Limits" />
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Max Tokens/Req</label><input type="number" value={config.costLimits?.maxTokensPerRequest ?? 10000} onChange={e => updateConfig({ costLimits: { ...config.costLimits, maxTokensPerRequest: Number(e.target.value) } })} style={inp} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>Daily Budget ($)</label><input type="number" value={config.costLimits?.dailyBudgetUsd ?? 50} onChange={e => updateConfig({ costLimits: { ...config.costLimits, dailyBudgetUsd: Number(e.target.value) } })} style={inp} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>Monthly ($)</label><input type="number" value={config.costLimits?.monthlyBudgetUsd ?? 1000} onChange={e => updateConfig({ costLimits: { ...config.costLimits, monthlyBudgetUsd: Number(e.target.value) } })} style={inp} /></div>
              </div>
            </>
          )}

          {section === 'behavior' && (
            <>
              <SectionHeader title="Behavior Profile" />
              <label style={lbl}>Priority Ranking</label>
              <textarea value={config.priorityRanking || ''} onChange={e => updateConfig({ priorityRanking: e.target.value })} placeholder="High - nothing publishes without passing through this agent, but not critical infrastructure (can queue if overloaded)" style={{ ...inp, minHeight: 50, fontFamily: 'inherit' }} />
              <label style={lbl}>Communication Style</label>
              <textarea value={config.communicationStyle || ''} onChange={e => updateConfig({ communicationStyle: e.target.value })} placeholder="Terse and rule-based when rejecting content, includes specific violation reason and relevant guideline section" style={{ ...inp, minHeight: 50, fontFamily: 'inherit' }} />
              <label style={lbl}>Learning Behavior</label>
              <textarea value={config.learningBehavior || ''} onChange={e => updateConfig({ learningBehavior: e.target.value })} placeholder="Adaptive - improves accuracy based on human moderator corrections, updates internal scoring when guidelines change" style={{ ...inp, minHeight: 50, fontFamily: 'inherit' }} />
              <label style={lbl}>Decision Authority</label>
              <textarea value={config.decisionAuthority || ''} onChange={e => updateConfig({ decisionAuthority: e.target.value })} placeholder="Can auto-approve content with 90%+ confidence, can auto-reject clear violations (spam, hate speech), must defer gray area decisions" style={{ ...inp, minHeight: 50, fontFamily: 'inherit' }} />
            </>
          )}

          {section === 'technical' && (
            <>
              <SectionHeader title="Skills" />
              {(config.skills || []).map((s, i) => (
                <div key={s.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input value={s.name} onChange={e => { const sk = [...(config.skills || [])]; sk[i] = { ...sk[i], name: e.target.value }; updateConfig({ skills: sk }); }} placeholder="Skill name" style={{ ...inp, marginTop: 0, flex: 1 }} />
                  <button onClick={() => updateConfig({ skills: (config.skills || []).filter((_, j) => j !== i) })} style={rmBtn}>X</button>
                </div>
              ))}
              <button onClick={() => updateConfig({ skills: [...(config.skills || []), { id: uid(), name: '', description: '', enabled: true }] })} style={addBtn}>+ Add Skill</button>

              <SectionHeader title="RAG Sources" />
              {(config.rag?.sources || []).map((s, i) => (
                <div key={s.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input value={s.name} onChange={e => { const src = [...(config.rag?.sources || [])]; src[i] = { ...src[i], name: e.target.value }; updateConfig({ rag: { ...config.rag, sources: src } }); }} placeholder="Source name" style={{ ...inp, marginTop: 0, flex: 1 }} />
                  <input value={s.uri} onChange={e => { const src = [...(config.rag?.sources || [])]; src[i] = { ...src[i], uri: e.target.value }; updateConfig({ rag: { ...config.rag, sources: src } }); }} placeholder="URI" style={{ ...inp, marginTop: 0, flex: 1 }} />
                  <button onClick={() => updateConfig({ rag: { ...config.rag, sources: (config.rag?.sources || []).filter((_, j) => j !== i) } })} style={rmBtn}>X</button>
                </div>
              ))}
              <button onClick={() => updateConfig({ rag: { ...config.rag, sources: [...(config.rag?.sources || []), { id: uid(), name: '', type: 'document', uri: '' }] } })} style={addBtn}>+ Add RAG Source</button>

              <SectionHeader title="MCP Servers" />
              {(config.mcp?.servers || []).map((s, i) => (
                <div key={s.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input value={s.name} onChange={e => { const sv = [...(config.mcp?.servers || [])]; sv[i] = { ...sv[i], name: e.target.value }; updateConfig({ mcp: { ...config.mcp, servers: sv } }); }} placeholder="Server name" style={{ ...inp, marginTop: 0, flex: 1 }} />
                  <input value={s.url} onChange={e => { const sv = [...(config.mcp?.servers || [])]; sv[i] = { ...sv[i], url: e.target.value }; updateConfig({ mcp: { ...config.mcp, servers: sv } }); }} placeholder="npx -y @server/name" style={{ ...inp, marginTop: 0, flex: 2 }} />
                  <button onClick={() => updateConfig({ mcp: { ...config.mcp, servers: (config.mcp?.servers || []).filter((_, j) => j !== i) } })} style={rmBtn}>X</button>
                </div>
              ))}
              <button onClick={() => updateConfig({ mcp: { ...config.mcp, servers: [...(config.mcp?.servers || []), { id: uid(), name: '', url: '', transport: 'stdio' }] } })} style={addBtn}>+ Add MCP Server</button>

              <SectionHeader title="API Integrations" />
              {(config.apiCalls || []).map((a, i) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <select value={a.method} onChange={e => { const ap = [...(config.apiCalls || [])]; ap[i] = { ...ap[i], method: e.target.value }; updateConfig({ apiCalls: ap }); }} style={{ ...inp, marginTop: 0, width: 70, cursor: 'pointer' }}>
                    {['GET','POST','PUT','DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input value={a.url} onChange={e => { const ap = [...(config.apiCalls || [])]; ap[i] = { ...ap[i], url: e.target.value }; updateConfig({ apiCalls: ap }); }} placeholder="https://api.example.com" style={{ ...inp, marginTop: 0, flex: 1 }} />
                  <button onClick={() => updateConfig({ apiCalls: (config.apiCalls || []).filter((_, j) => j !== i) })} style={rmBtn}>X</button>
                </div>
              ))}
              <button onClick={() => updateConfig({ apiCalls: [...(config.apiCalls || []), { id: uid(), name: '', method: 'GET', url: '', authType: 'none' }] })} style={addBtn}>+ Add API Call</button>

              <SectionHeader title="Database Connections" />
              {(config.database?.connections || []).map((c, i) => (
                <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <select value={c.type} onChange={e => { const cn = [...(config.database?.connections || [])]; cn[i] = { ...cn[i], type: e.target.value }; updateConfig({ database: { connections: cn } }); }} style={{ ...inp, marginTop: 0, width: 100, cursor: 'pointer' }}>
                    {['postgresql','mysql','sqlite','mongodb','redis'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={c.connectionString} onChange={e => { const cn = [...(config.database?.connections || [])]; cn[i] = { ...cn[i], connectionString: e.target.value }; updateConfig({ database: { connections: cn } }); }} placeholder="Connection string" style={{ ...inp, marginTop: 0, flex: 1 }} />
                  <button onClick={() => updateConfig({ database: { connections: (config.database?.connections || []).filter((_, j) => j !== i) } })} style={rmBtn}>X</button>
                </div>
              ))}
              <button onClick={() => updateConfig({ database: { connections: [...(config.database?.connections || []), { id: uid(), name: '', type: 'postgresql', connectionString: '', readOnly: true }] } })} style={addBtn}>+ Add Database</button>
            </>
          )}

          {section === 'notes' && (
            <>
              <SectionHeader title="Known Quirks" />
              <textarea value={config.knownQuirks || ''} onChange={e => updateConfig({ knownQuirks: e.target.value })} placeholder="Struggles with regional slang, occasionally over-flags political content during election seasons, has trouble with satire/parody unless clearly labeled" style={{ ...inp, minHeight: 80, fontFamily: 'inherit' }} />
              <SectionHeader title="Maintenance Needs" />
              <textarea value={config.maintenanceNeeds || ''} onChange={e => updateConfig({ maintenanceNeeds: e.target.value })} placeholder="Weekly ruleset review, monthly accuracy audit against human moderator decisions, quarterly retraining on new content patterns" style={{ ...inp, minHeight: 60, fontFamily: 'inherit' }} />
              <SectionHeader title="Future Enhancements" />
              <textarea value={config.futureEnhancements || ''} onChange={e => updateConfig({ futureEnhancements: e.target.value })} placeholder="Planned integration with community voting system, improved context awareness for reply chains, multilingual support expansion" style={{ ...inp, minHeight: 60, fontFamily: 'inherit' }} />

              <SectionHeader title="General Notes" />
              {(config.notes || []).map((n, i) => (
                <div key={n.id} style={{ ...card, position: 'relative' }}>
                  <p style={{ color: '#e2e8f0', fontSize: 13, margin: 0, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                  <div style={{ color: '#64748b', fontSize: 10, marginTop: 6 }}>{n.author} | {new Date(n.timestamp).toLocaleString()}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input id="newNoteInput" placeholder="Add a note..." style={{ ...inp, marginTop: 0, flex: 1 }} onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value.trim()) {
                      updateConfig({ notes: [{ id: uid(), content: input.value.trim(), author: 'Designer', timestamp: new Date().toISOString() }, ...(config.notes || [])] });
                      input.value = '';
                    }
                  }
                }} />
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '12px 30px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Delete Agent</button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#ef4444', fontSize: 12 }}>Delete "{nickname}"?{dependentCount > 0 ? ` (${dependentCount} dependents)` : ''}</span>
                <button onClick={() => onDelete(agent.id)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Yes, Delete</button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8b9dc3', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: '#475569', fontSize: 11, alignSelf: 'center' }}>ID: {agent.id.slice(0, 12)}...</span>
            {dirty && <button onClick={handleSave} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: '#00d9ff', color: '#0a0e27', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Save Changes</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function SectionHeader({ title }: { title: string }) {
  return <div style={{ color: '#00d9ff', fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(0,217,255,0.2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>;
}

function InfoCard({ title, value, children }: { title: string; value: string; children?: React.ReactNode }) {
  return (
    <div style={{ ...card }}>
      <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>{title}</div>
      <div style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 600 }}>{value}</div>
      {children}
    </div>
  );
}

function RelSection({ title, color, agents, agentConfig, type, onUpdateNote }: {
  title: string; color: string; agents: (Agent | undefined)[]; agentConfig: FullAgentConfig; type: string;
  onUpdateNote: (id: string, note: string) => void;
}) {
  const valid = agents.filter(Boolean) as Agent[];
  if (valid.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {valid.map(a => {
        const noteKey = `${type}:${a.id}`;
        const note = agentConfig.relationshipNotes?.[noteKey] || '';
        return (
          <div key={a.id} style={{ ...card, borderLeft: `3px solid ${color}`, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{a.nickname}</span>
                <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>{a.descriptor}</span>
              </div>
              <span style={{ color: '#475569', fontSize: 10 }}>{a.badges.join(', ')}</span>
            </div>
            <input value={note} onChange={e => onUpdateNote(noteKey, e.target.value)}
              placeholder={`Why does this agent ${type === 'dependsOn' ? 'depend on' : type === 'feedsInto' ? 'feed into' : type === 'collaboratesWith' ? 'collaborate with' : type === 'canOverride' ? 'override' : 'relate to'} ${a.nickname}?`}
              style={{ ...inp, marginTop: 6, fontSize: 12, color: '#94a3b8' }} />
          </div>
        );
      })}
    </div>
  );
}

// Styles
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box', resize: 'vertical' as const };
const lbl: React.CSSProperties = { fontSize: 11, color: '#8b9dc3', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, display: 'block' };
const card: React.CSSProperties = { padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' };
const addBtn: React.CSSProperties = { padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(0,217,255,0.3)', background: 'rgba(0,217,255,0.08)', color: '#00d9ff', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 8 };
const rmBtn: React.CSSProperties = { padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 11 };
