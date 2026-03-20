import React, { useState, useEffect } from 'react';
import type { Agent, Badge, LayerDefinition } from '../../shared/types/index.js';

const ALL_BADGES: Badge[] = [
  'HUB', 'CRITICAL', 'ENTRY', 'AUTO', 'HUMAN', 'APPROVAL',
  'ALWAYS_ON', 'ADVISORY', 'CAN_OVERRIDE', 'HIGH_PRIORITY', 'MEDIUM', 'LOGS_ALL',
];

type Tab = 'general' | 'skills' | 'rag' | 'api' | 'mcp' | 'database' | 'prompt' | 'model' | 'memory' | 'guardrails' | 'triggers' | 'errors' | 'costs' | 'permissions' | 'context' | 'notes' | 'practices';

interface PropertyEditorProps {
  agent: Agent;
  layers: LayerDefinition[];
  onSave: (agentId: string, changes: Partial<Agent>) => void;
  onDelete: (agentId: string) => void;
  onClose: () => void;
  dependentCount: number;
}

interface AgentConfig {
  skills?: SkillEntry[];
  rag?: RagConfig;
  apiCalls?: ApiCallEntry[];
  mcp?: McpConfig;
  database?: DatabaseConfig;
  systemPrompt?: SystemPromptConfig;
  modelConfig?: ModelConfig;
  memoryConfig?: MemoryConfig;
  guardrails?: GuardrailsConfig;
  triggers?: TriggerEntry[];
  errorHandling?: ErrorHandlingConfig;
  costLimits?: CostLimitsConfig;
  permissions?: PermissionsConfig;
  contextSources?: ContextSourceEntry[];
  notes?: NoteEntry[];
  [key: string]: unknown;
}

interface SkillEntry { id: string; name: string; description: string; enabled: boolean; }
interface RagConfig { enabled: boolean; sources: RagSource[]; chunkSize: number; overlapTokens: number; embeddingModel: string; }
interface RagSource { id: string; name: string; type: 'document' | 'graph' | 'web' | 'database'; uri: string; }
interface ApiCallEntry { id: string; name: string; method: string; url: string; headers: string; authType: string; }
interface McpConfig { enabled: boolean; servers: McpServer[]; tools: McpTool[]; }
interface McpServer { id: string; name: string; url: string; transport: 'stdio' | 'sse' | 'streamable-http'; }
interface McpTool { id: string; name: string; serverId: string; description: string; enabled: boolean; }
interface NoteEntry { id: string; content: string; author: string; timestamp: string; }
interface DatabaseConfig { connections: DbConnection[]; }
interface DbConnection { id: string; name: string; type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'redis'; connectionString: string; readOnly: boolean; }
interface SystemPromptConfig { persona: string; instructions: string; constraints: string; outputFormat: string; }
interface ModelConfig { provider: string; model: string; temperature: number; maxTokens: number; topP: number; frequencyPenalty: number; }
interface MemoryConfig { shortTermEnabled: boolean; longTermEnabled: boolean; contextWindowTokens: number; memoryBackend: string; ttlMinutes: number; }
interface GuardrailsConfig { contentFilters: string[]; outputValidation: string[]; maxOutputTokens: number; blockedTopics: string[]; requireCitation: boolean; }
interface TriggerEntry { id: string; type: 'scheduled' | 'webhook' | 'message' | 'event' | 'manual'; config: string; enabled: boolean; }
interface ErrorHandlingConfig { retryCount: number; retryDelayMs: number; timeoutMs: number; fallbackAgentId: string; circuitBreakerThreshold: number; circuitBreakerResetMs: number; }
interface CostLimitsConfig { maxTokensPerRequest: number; maxRequestsPerMinute: number; dailyBudgetUsd: number; monthlyBudgetUsd: number; alertThresholdPercent: number; }
interface PermissionsConfig { canRead: string[]; canWrite: string[]; canExecute: string[]; canAccessExternal: boolean; requireApproval: boolean; }
interface ContextSourceEntry { id: string; agentNickname: string; dataType: string; required: boolean; }

function getConfig(agent: Agent): AgentConfig {
  const c = agent.config as AgentConfig;
  return {
    skills: c?.skills || [],
    rag: c?.rag || { enabled: false, sources: [], chunkSize: 512, overlapTokens: 50, embeddingModel: 'text-embedding-3-small' },
    apiCalls: c?.apiCalls || [],
    mcp: c?.mcp || { enabled: false, servers: [], tools: [] },
    database: c?.database || { connections: [] },
    systemPrompt: c?.systemPrompt || { persona: '', instructions: '', constraints: '', outputFormat: '' },
    modelConfig: c?.modelConfig || { provider: 'anthropic', model: 'claude-sonnet-4-20250514', temperature: 0.7, maxTokens: 4096, topP: 1, frequencyPenalty: 0 },
    memoryConfig: c?.memoryConfig || { shortTermEnabled: true, longTermEnabled: false, contextWindowTokens: 100000, memoryBackend: 'in-memory', ttlMinutes: 60 },
    guardrails: c?.guardrails || { contentFilters: [], outputValidation: [], maxOutputTokens: 4096, blockedTopics: [], requireCitation: false },
    triggers: c?.triggers || [],
    errorHandling: c?.errorHandling || { retryCount: 3, retryDelayMs: 1000, timeoutMs: 30000, fallbackAgentId: '', circuitBreakerThreshold: 5, circuitBreakerResetMs: 60000 },
    costLimits: c?.costLimits || { maxTokensPerRequest: 10000, maxRequestsPerMinute: 60, dailyBudgetUsd: 50, monthlyBudgetUsd: 1000, alertThresholdPercent: 80 },
    permissions: c?.permissions || { canRead: [], canWrite: [], canExecute: [], canAccessExternal: false, requireApproval: false },
    contextSources: c?.contextSources || [],
    notes: c?.notes || [],
  };
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export function PropertyEditor({ agent, layers, onSave, onDelete, onClose, dependentCount }: PropertyEditorProps) {
  const [nickname, setNickname] = useState(agent.nickname);
  const [formalName, setFormalName] = useState(agent.formalName);
  const [descriptor, setDescriptor] = useState(agent.descriptor);
  const [layerId, setLayerId] = useState(agent.layerId);
  const [badges, setBadges] = useState<Badge[]>(agent.badges);
  const [config, setConfig] = useState<AgentConfig>(getConfig(agent));
  const [tab, setTab] = useState<Tab>('general');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setNickname(agent.nickname);
    setFormalName(agent.formalName);
    setDescriptor(agent.descriptor);
    setLayerId(agent.layerId);
    setBadges(agent.badges);
    setConfig(getConfig(agent));
    setDirty(false);
    setConfirmDelete(false);
    setTab('general');
  }, [agent.id]);

  function markDirty() { setDirty(true); }
  function updateConfig(partial: Partial<AgentConfig>) { setConfig(prev => ({ ...prev, ...partial })); markDirty(); }

  function handleSave() {
    onSave(agent.id, { nickname, formalName, descriptor, layerId, badges, config: config as Record<string, unknown> });
    setDirty(false);
  }

  function toggleBadge(badge: Badge) {
    setBadges(prev => prev.includes(badge) ? prev.filter(b => b !== badge) : [...prev, badge]);
    markDirty();
  }

  const layer = layers.find(l => l.id === layerId);
  const borderColor = layer?.colorTheme || '#00d9ff';

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 340, height: '100%',
      background: 'rgba(15, 23, 42, 0.97)', borderLeft: `2px solid ${borderColor}`,
      zIndex: 20, display: 'flex', flexDirection: 'column',
      animation: 'slideIn 0.2s ease',
    }}>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{agent.nickname}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b9dc3', cursor: 'pointer', fontSize: 18 }}>{'\u00D7'}</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto', padding: '0 8px' }}>
        {([
          ['general', 'General'], ['prompt', 'Prompt'], ['model', 'Model'],
          ['skills', 'Skills'], ['rag', 'RAG'], ['api', 'API'], ['mcp', 'MCP'],
          ['database', 'Database'], ['memory', 'Memory'], ['triggers', 'Triggers'],
          ['guardrails', 'Guardrails'], ['errors', 'Errors'], ['costs', 'Costs'],
          ['permissions', 'Perms'], ['context', 'Context'], ['notes', 'Notes'],
          ['practices', 'Tips'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 8px', fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: 'transparent', color: tab === t ? '#00d9ff' : '#64748b',
            borderBottom: tab === t ? '2px solid #00d9ff' : '2px solid transparent',
            whiteSpace: 'nowrap',
          }}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        {tab === 'general' && <GeneralTab
          nickname={nickname} setNickname={v => { setNickname(v); markDirty(); }}
          formalName={formalName} setFormalName={v => { setFormalName(v); markDirty(); }}
          descriptor={descriptor} setDescriptor={v => { setDescriptor(v); markDirty(); }}
          layerId={layerId} setLayerId={v => { setLayerId(v); markDirty(); }}
          badges={badges} toggleBadge={toggleBadge}
          layers={layers} borderColor={borderColor} agent={agent}
          config={config} updateConfig={updateConfig}
        />}
        {tab === 'skills' && <SkillsTab skills={config.skills || []} onChange={skills => updateConfig({ skills })} />}
        {tab === 'rag' && <RagTab rag={config.rag!} onChange={rag => updateConfig({ rag })} />}
        {tab === 'api' && <ApiTab apiCalls={config.apiCalls || []} onChange={apiCalls => updateConfig({ apiCalls })} />}
        {tab === 'mcp' && <McpTab mcp={config.mcp!} onChange={mcp => updateConfig({ mcp })} />}
        {tab === 'database' && <DatabaseTab db={config.database!} onChange={database => updateConfig({ database })} />}
        {tab === 'prompt' && <SystemPromptTab prompt={config.systemPrompt!} onChange={systemPrompt => updateConfig({ systemPrompt })} />}
        {tab === 'model' && <ModelTab model={config.modelConfig!} onChange={modelConfig => updateConfig({ modelConfig })} />}
        {tab === 'memory' && <MemoryTab memory={config.memoryConfig!} onChange={memoryConfig => updateConfig({ memoryConfig })} />}
        {tab === 'guardrails' && <GuardrailsTab guardrails={config.guardrails!} onChange={guardrails => updateConfig({ guardrails })} />}
        {tab === 'triggers' && <TriggersTab triggers={config.triggers || []} onChange={triggers => updateConfig({ triggers })} />}
        {tab === 'errors' && <ErrorHandlingTab errors={config.errorHandling!} onChange={errorHandling => updateConfig({ errorHandling })} />}
        {tab === 'costs' && <CostLimitsTab costs={config.costLimits!} onChange={costLimits => updateConfig({ costLimits })} />}
        {tab === 'permissions' && <PermissionsTab perms={config.permissions!} onChange={permissions => updateConfig({ permissions })} />}
        {tab === 'context' && <ContextSourcesTab sources={config.contextSources || []} onChange={contextSources => updateConfig({ contextSources })} />}
        {tab === 'notes' && <NotesTab notes={config.notes || []} onChange={notes => updateConfig({ notes })} />}
        {tab === 'practices' && <BestPracticesTab agent={agent} badges={badges} />}
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dirty && <button onClick={handleSave} style={saveBtnStyle}>Save Changes</button>}
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={deleteBtnStyle}>Delete Agent</button>
        ) : (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 8, border: '1px solid #ef4444' }}>
            {dependentCount > 0 && <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>Warning: {dependentCount} agent{dependentCount > 1 ? 's' : ''} depend on this.</div>}
            <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>Delete "{agent.nickname}" permanently?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onDelete(agent.id)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Delete</button>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8b9dc3', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Shared styles
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#8b9dc3', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, display: 'block' };
const smallBtnStyle: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(0,217,255,0.3)', background: 'rgba(0,217,255,0.08)', color: '#00d9ff', cursor: 'pointer', fontSize: 11, fontWeight: 600 };
const removeBtnStyle: React.CSSProperties = { padding: '2px 6px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 10 };
const saveBtnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#00d9ff', color: '#0a0e27', fontWeight: 600, cursor: 'pointer', fontSize: 13 };
const deleteBtnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 };
const cardStyle: React.CSSProperties = { padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', marginTop: 8 };

// ---- General Tab ----
function GeneralTab({ nickname, setNickname, formalName, setFormalName, descriptor, setDescriptor, layerId, setLayerId, badges, toggleBadge, layers, borderColor, agent, config, updateConfig }: any) {
  const emoji = (config as any)?.emoji || '';
  const coreTask = (config as any)?.coreTask || '';
  const inputs = (config as any)?.inputs || [];
  const outputs = (config as any)?.outputs || [];

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Nickname</label>
          <input value={nickname} onChange={e => setNickname(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ width: 60 }}>
          <label style={labelStyle}>Emoji</label>
          <input value={emoji} onChange={e => updateConfig({ emoji: e.target.value })} placeholder="🤖" maxLength={4} style={{ ...inputStyle, textAlign: 'center', fontSize: 20 }} />
        </div>
      </div>
      <label style={labelStyle}>Formal Name</label>
      <input value={formalName} onChange={e => setFormalName(e.target.value)} style={inputStyle} placeholder="Category-Function-Specificity" />
      <label style={labelStyle}>Descriptor</label>
      <input value={descriptor} onChange={e => setDescriptor(e.target.value)} style={inputStyle} placeholder='e.g. "The Greeter"' />
      <label style={labelStyle}>Core Task</label>
      <textarea value={coreTask} onChange={e => updateConfig({ coreTask: e.target.value })} placeholder="What does this agent do? Describe its primary function..."
        style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} />
      <label style={labelStyle}>Layer</label>
      <select value={layerId} onChange={e => setLayerId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
        {layers.map((l: any) => <option key={l.id} value={l.id} style={{ background: '#1e293b' }}>{l.name}</option>)}
      </select>
      <label style={labelStyle}>Inputs (what data this agent receives)</label>
      <input value={inputs.join(', ')} onChange={e => updateConfig({ inputs: e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s) })}
        placeholder="Customer messages, Session context" style={inputStyle} />
      <label style={labelStyle}>Outputs (what this agent produces)</label>
      <input value={outputs.join(', ')} onChange={e => updateConfig({ outputs: e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s) })}
        placeholder="Routed queries, Escalation flags" style={inputStyle} />
      <label style={labelStyle}>Badges</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {ALL_BADGES.map(badge => (
          <button key={badge} onClick={() => toggleBadge(badge)} style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${badges.includes(badge) ? borderColor : 'rgba(255,255,255,0.15)'}`,
            background: badges.includes(badge) ? `${borderColor}25` : 'transparent',
            color: badges.includes(badge) ? '#fff' : '#8b9dc3',
          }}>{badge.replace('_', ' ')}</button>
        ))}
      </div>
      <label style={labelStyle}>Agent ID</label>
      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 4 }}>{agent.id}</div>
    </>
  );
}

// ---- Skills Tab ----
function SkillsTab({ skills, onChange }: { skills: SkillEntry[]; onChange: (s: SkillEntry[]) => void }) {
  const addSkill = () => onChange([...skills, { id: uid(), name: '', description: '', enabled: true }]);
  const update = (id: string, patch: Partial<SkillEntry>) => onChange(skills.map(s => s.id === id ? { ...s, ...patch } : s));
  const remove = (id: string) => onChange(skills.filter(s => s.id !== id));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>Skills this agent can perform</span>
        <button onClick={addSkill} style={smallBtnStyle}>+ Add Skill</button>
      </div>
      {skills.length === 0 && <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>No skills configured. Add skills to define what this agent can do.</p>}
      {skills.map(s => (
        <div key={s.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input value={s.name} onChange={e => update(s.id, { name: e.target.value })} placeholder="Skill name" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              <button onClick={() => update(s.id, { enabled: !s.enabled })} style={{ ...removeBtnStyle, background: s.enabled ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: s.enabled ? '#10b981' : '#ef4444' }}>
                {s.enabled ? 'ON' : 'OFF'}
              </button>
              <button onClick={() => remove(s.id)} style={removeBtnStyle}>X</button>
            </div>
          </div>
          <input value={s.description} onChange={e => update(s.id, { description: e.target.value })} placeholder="What does this skill do?" style={{ ...inputStyle }} />
        </div>
      ))}
      <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: 'rgba(0,217,255,0.04)', border: '1px solid rgba(0,217,255,0.1)' }}>
        <div style={{ color: '#00d9ff', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Common Skills</div>
        {['Text Generation', 'Code Analysis', 'Data Extraction', 'Summarization', 'Classification', 'Translation', 'Sentiment Analysis', 'Image Analysis', 'API Integration', 'Database Query'].map(name => (
          <button key={name} onClick={() => onChange([...skills, { id: uid(), name, description: '', enabled: true }])}
            style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12, border: '1px solid rgba(0,217,255,0.2)', background: 'transparent', color: '#8b9dc3', cursor: 'pointer', margin: '2px 2px' }}>
            + {name}
          </button>
        ))}
      </div>
    </>
  );
}

// ---- RAG Tab ----
function RagTab({ rag, onChange }: { rag: RagConfig; onChange: (r: RagConfig) => void }) {
  const update = (patch: Partial<RagConfig>) => onChange({ ...rag, ...patch });
  const addSource = () => update({ sources: [...rag.sources, { id: uid(), name: '', type: 'document', uri: '' }] });
  const updateSource = (id: string, patch: Partial<RagSource>) => update({ sources: rag.sources.map(s => s.id === id ? { ...s, ...patch } : s) });
  const removeSource = (id: string) => update({ sources: rag.sources.filter(s => s.id !== id) });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <label style={{ ...labelStyle, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          RAG Configuration
          <button onClick={() => update({ enabled: !rag.enabled })} style={{
            padding: '2px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: rag.enabled ? '#10b981' : '#475569', color: '#fff',
          }}>{rag.enabled ? 'ON' : 'OFF'}</button>
        </label>
      </div>

      <label style={labelStyle}>Embedding Model</label>
      <select value={rag.embeddingModel} onChange={e => update({ embeddingModel: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
        <option value="text-embedding-3-small" style={{ background: '#1e293b' }}>text-embedding-3-small</option>
        <option value="text-embedding-3-large" style={{ background: '#1e293b' }}>text-embedding-3-large</option>
        <option value="text-embedding-ada-002" style={{ background: '#1e293b' }}>text-embedding-ada-002</option>
        <option value="voyage-3" style={{ background: '#1e293b' }}>voyage-3</option>
        <option value="custom" style={{ background: '#1e293b' }}>Custom</option>
      </select>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Chunk Size</label>
          <input type="number" value={rag.chunkSize} onChange={e => update({ chunkSize: Number(e.target.value) })} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Overlap Tokens</label>
          <input type="number" value={rag.overlapTokens} onChange={e => update({ overlapTokens: Number(e.target.value) })} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <label style={{ ...labelStyle, marginTop: 0 }}>Knowledge Sources</label>
        <button onClick={addSource} style={smallBtnStyle}>+ Add Source</button>
      </div>

      {rag.sources.map(s => (
        <div key={s.id} style={cardStyle}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={s.name} onChange={e => updateSource(s.id, { name: e.target.value })} placeholder="Source name" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
            <button onClick={() => removeSource(s.id)} style={removeBtnStyle}>X</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <select value={s.type} onChange={e => updateSource(s.id, { type: e.target.value as any })} style={{ ...inputStyle, marginTop: 0, width: 100, cursor: 'pointer' }}>
              <option value="document" style={{ background: '#1e293b' }}>Document</option>
              <option value="graph" style={{ background: '#1e293b' }}>Graph</option>
              <option value="web" style={{ background: '#1e293b' }}>Web</option>
              <option value="database" style={{ background: '#1e293b' }}>Database</option>
            </select>
            <input value={s.uri} onChange={e => updateSource(s.id, { uri: e.target.value })} placeholder="URI / path" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
          </div>
        </div>
      ))}
    </>
  );
}

// ---- API Tab ----
function ApiTab({ apiCalls, onChange }: { apiCalls: ApiCallEntry[]; onChange: (a: ApiCallEntry[]) => void }) {
  const add = () => onChange([...apiCalls, { id: uid(), name: '', method: 'GET', url: '', headers: '{}', authType: 'none' }]);
  const update = (id: string, patch: Partial<ApiCallEntry>) => onChange(apiCalls.map(a => a.id === id ? { ...a, ...patch } : a));
  const remove = (id: string) => onChange(apiCalls.filter(a => a.id !== id));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>External API integrations</span>
        <button onClick={add} style={smallBtnStyle}>+ Add API</button>
      </div>
      {apiCalls.length === 0 && <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>No API calls configured. Add external service integrations for this agent.</p>}
      {apiCalls.map(a => (
        <div key={a.id} style={cardStyle}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={a.name} onChange={e => update(a.id, { name: e.target.value })} placeholder="API name" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
            <button onClick={() => remove(a.id)} style={removeBtnStyle}>X</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <select value={a.method} onChange={e => update(a.id, { method: e.target.value })} style={{ ...inputStyle, marginTop: 0, width: 70, cursor: 'pointer' }}>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>{m}</option>)}
            </select>
            <input value={a.url} onChange={e => update(a.id, { url: e.target.value })} placeholder="https://api.example.com/endpoint" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <select value={a.authType} onChange={e => update(a.id, { authType: e.target.value })} style={{ ...inputStyle, marginTop: 0, cursor: 'pointer' }}>
              <option value="none" style={{ background: '#1e293b' }}>No Auth</option>
              <option value="bearer" style={{ background: '#1e293b' }}>Bearer Token</option>
              <option value="api-key" style={{ background: '#1e293b' }}>API Key</option>
              <option value="oauth2" style={{ background: '#1e293b' }}>OAuth 2.0</option>
              <option value="basic" style={{ background: '#1e293b' }}>Basic Auth</option>
            </select>
          </div>
        </div>
      ))}
    </>
  );
}

// ---- MCP Tab ----
function McpTab({ mcp, onChange }: { mcp: McpConfig; onChange: (m: McpConfig) => void }) {
  const update = (patch: Partial<McpConfig>) => onChange({ ...mcp, ...patch });
  const addServer = () => update({ servers: [...mcp.servers, { id: uid(), name: '', url: '', transport: 'stdio' }] });
  const updateServer = (id: string, patch: Partial<McpServer>) => update({ servers: mcp.servers.map(s => s.id === id ? { ...s, ...patch } : s) });
  const removeServer = (id: string) => update({
    servers: mcp.servers.filter(s => s.id !== id),
    tools: mcp.tools.filter(t => t.serverId !== id),
  });
  const addTool = (serverId: string) => update({ tools: [...mcp.tools, { id: uid(), name: '', serverId, description: '', enabled: true }] });
  const updateTool = (id: string, patch: Partial<McpTool>) => update({ tools: mcp.tools.map(t => t.id === id ? { ...t, ...patch } : t) });
  const removeTool = (id: string) => update({ tools: mcp.tools.filter(t => t.id !== id) });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <label style={{ ...labelStyle, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          Model Context Protocol
          <button onClick={() => update({ enabled: !mcp.enabled })} style={{
            padding: '2px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: mcp.enabled ? '#10b981' : '#475569', color: '#fff',
          }}>{mcp.enabled ? 'ON' : 'OFF'}</button>
        </label>
        <button onClick={addServer} style={smallBtnStyle}>+ Add Server</button>
      </div>

      {mcp.servers.length === 0 && <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>No MCP servers configured. MCP allows agents to use external tools and resources.</p>}

      {mcp.servers.map(s => (
        <div key={s.id} style={{ ...cardStyle, borderColor: 'rgba(0,217,255,0.15)' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={s.name} onChange={e => updateServer(s.id, { name: e.target.value })} placeholder="Server name" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
            <button onClick={() => removeServer(s.id)} style={removeBtnStyle}>X</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <select value={s.transport} onChange={e => updateServer(s.id, { transport: e.target.value as any })} style={{ ...inputStyle, marginTop: 0, width: 100, cursor: 'pointer' }}>
              <option value="stdio" style={{ background: '#1e293b' }}>stdio</option>
              <option value="sse" style={{ background: '#1e293b' }}>SSE</option>
              <option value="streamable-http" style={{ background: '#1e293b' }}>HTTP Stream</option>
            </select>
            <input value={s.url} onChange={e => updateServer(s.id, { url: e.target.value })} placeholder="npx -y @server/name or URL" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>Tools</span>
            <button onClick={() => addTool(s.id)} style={{ ...smallBtnStyle, fontSize: 10, padding: '2px 8px' }}>+ Tool</button>
          </div>
          {mcp.tools.filter(t => t.serverId === s.id).map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
              <input value={t.name} onChange={e => updateTool(t.id, { name: e.target.value })} placeholder="tool_name" style={{ ...inputStyle, marginTop: 0, flex: 1, fontSize: 11 }} />
              <button onClick={() => updateTool(t.id, { enabled: !t.enabled })} style={{ ...removeBtnStyle, background: t.enabled ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: t.enabled ? '#10b981' : '#ef4444' }}>
                {t.enabled ? 'ON' : 'OFF'}
              </button>
              <button onClick={() => removeTool(t.id)} style={removeBtnStyle}>X</button>
            </div>
          ))}
        </div>
      ))}

      <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: 'rgba(0,217,255,0.04)', border: '1px solid rgba(0,217,255,0.1)' }}>
        <div style={{ color: '#00d9ff', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Common MCP Servers</div>
        {[
          { name: 'filesystem', cmd: 'npx -y @modelcontextprotocol/server-filesystem' },
          { name: 'github', cmd: 'npx -y @modelcontextprotocol/server-github' },
          { name: 'postgres', cmd: 'npx -y @modelcontextprotocol/server-postgres' },
          { name: 'brave-search', cmd: 'npx -y @modelcontextprotocol/server-brave-search' },
          { name: 'memory', cmd: 'npx -y @modelcontextprotocol/server-memory' },
          { name: 'puppeteer', cmd: 'npx -y @modelcontextprotocol/server-puppeteer' },
        ].map(s => (
          <button key={s.name} onClick={() => update({ servers: [...mcp.servers, { id: uid(), name: s.name, url: s.cmd, transport: 'stdio' }] })}
            style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12, border: '1px solid rgba(0,217,255,0.2)', background: 'transparent', color: '#8b9dc3', cursor: 'pointer', margin: '2px 2px' }}>
            + {s.name}
          </button>
        ))}
      </div>
    </>
  );
}

// ---- Notes Tab ----
function NotesTab({ notes, onChange }: { notes: NoteEntry[]; onChange: (n: NoteEntry[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange([{ id: uid(), content: draft.trim(), author: 'Designer', timestamp: new Date().toISOString() }, ...notes]);
    setDraft('');
  };
  const remove = (id: string) => onChange(notes.filter(n => n.id !== id));

  return (
    <>
      <div style={{ marginTop: 8 }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Leave a note about this agent..."
          style={{ ...inputStyle, marginTop: 0, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} />
        <button onClick={add} style={{ ...smallBtnStyle, marginTop: 6 }}>Add Note</button>
      </div>
      {notes.length === 0 && <p style={{ color: '#475569', fontSize: 12, marginTop: 12 }}>No notes yet. Leave design notes, reminders, or context for your team.</p>}
      {notes.map(n => (
        <div key={n.id} style={{ ...cardStyle, position: 'relative' }}>
          <p style={{ color: '#e2e8f0', fontSize: 12, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.content}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ color: '#64748b', fontSize: 10 }}>{n.author} | {new Date(n.timestamp).toLocaleString()}</span>
            <button onClick={() => remove(n.id)} style={removeBtnStyle}>X</button>
          </div>
        </div>
      ))}
    </>
  );
}

// ---- Best Practices Tab ----
function BestPracticesTab({ agent, badges }: { agent: Agent; badges: Badge[] }) {
  const tips: Array<{ category: string; tip: string; relevant: boolean }> = [
    { category: 'Single Responsibility', tip: 'Each agent should do one thing well. If the descriptor is more than one sentence, consider splitting into multiple agents.', relevant: true },
    { category: 'Error Handling', tip: 'Configure fallback behavior. What happens when this agent fails? Add a canOverride relationship to a backup agent.', relevant: true },
    { category: 'Observability', tip: 'Add LOGS_ALL badge to agents that handle critical data flows. Connect to a Logger agent via feedsInto.', relevant: !badges.includes('LOGS_ALL') },
    { category: 'Human-in-the-Loop', tip: 'Mark agents that need human approval with HUMAN and APPROVAL badges. Critical decisions should not be fully autonomous.', relevant: badges.includes('CRITICAL') && !badges.includes('HUMAN') },
    { category: 'RAG Integration', tip: 'Agents that answer questions or make decisions should have RAG configured with relevant knowledge sources. Use the RAG tab to set up document or graph sources.', relevant: true },
    { category: 'Redundancy', tip: 'HUB and CRITICAL agents should have at least one backup agent in the same layer to avoid single points of failure.', relevant: badges.includes('HUB') || badges.includes('CRITICAL') },
    { category: 'MCP Tools', tip: 'Configure MCP servers to give agents access to external tools (file system, databases, APIs). This is how agents interact with the real world.', relevant: true },
    { category: 'API Security', tip: 'Never hardcode API keys. Use environment variables or a secrets manager. Configure auth type in the API tab.', relevant: true },
    { category: 'Naming Convention', tip: 'Use short, memorable nicknames (1-2 words) and formal names that follow the pattern: Category-Function-Specificity.', relevant: true },
    { category: 'Connection Limits', tip: 'Agents with more than 5 incoming connections are potential bottlenecks. Consider adding a router agent to distribute load.', relevant: true },
    { category: 'Knowledge Graphs', tip: 'Use Graph RAG for relationship-heavy queries (who depends on what). Use Document RAG for factual lookups. Combine both for comprehensive intelligence.', relevant: true },
    { category: 'Testing', tip: 'Before deploying, use the What-If simulator to test removing agents and see the impact. Check the Optimization panel for bottleneck warnings.', relevant: true },
  ];

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>Recommendations for building effective agents based on current configuration.</p>
      {tips.filter(t => t.relevant).map((t, i) => (
        <div key={i} style={{ ...cardStyle, borderLeft: '3px solid #00d9ff' }}>
          <div style={{ color: '#00d9ff', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{t.category}</div>
          <p style={{ color: '#cbd5e1', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{t.tip}</p>
        </div>
      ))}
    </div>
  );
}

// ---- Database Tab ----
function DatabaseTab({ db, onChange }: { db: DatabaseConfig; onChange: (d: DatabaseConfig) => void }) {
  const add = () => onChange({ connections: [...db.connections, { id: uid(), name: '', type: 'postgresql', connectionString: '', readOnly: true }] });
  const update = (id: string, patch: Partial<DbConnection>) => onChange({ connections: db.connections.map(c => c.id === id ? { ...c, ...patch } : c) });
  const remove = (id: string) => onChange({ connections: db.connections.filter(c => c.id !== id) });
  return (<>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>Database connections</span>
      <button onClick={add} style={smallBtnStyle}>+ Add</button>
    </div>
    {db.connections.length === 0 && <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>No connections. Add one to let this agent query data.</p>}
    {db.connections.map(c => (
      <div key={c.id} style={cardStyle}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={c.name} onChange={e => update(c.id, { name: e.target.value })} placeholder="Name" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
          <button onClick={() => remove(c.id)} style={removeBtnStyle}>X</button>
        </div>
        <select value={c.type} onChange={e => update(c.id, { type: e.target.value as any })} style={{ ...inputStyle, cursor: 'pointer' }}>
          {['postgresql', 'mysql', 'sqlite', 'mongodb', 'redis'].map(t => <option key={t} value={t} style={{ background: '#1e293b' }}>{t}</option>)}
        </select>
        <input value={c.connectionString} onChange={e => update(c.id, { connectionString: e.target.value })} placeholder="connection string" style={inputStyle} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
          <input type="checkbox" checked={c.readOnly} onChange={e => update(c.id, { readOnly: e.target.checked })} /> Read-only
        </label>
      </div>
    ))}
  </>);
}

// ---- System Prompt Tab ----
function SystemPromptTab({ prompt, onChange }: { prompt: SystemPromptConfig; onChange: (p: SystemPromptConfig) => void }) {
  const update = (patch: Partial<SystemPromptConfig>) => onChange({ ...prompt, ...patch });
  return (<>
    <label style={labelStyle}>Persona</label>
    <textarea value={prompt.persona} onChange={e => update({ persona: e.target.value })} placeholder="You are a helpful customer service agent..." style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} />
    <label style={labelStyle}>Instructions</label>
    <textarea value={prompt.instructions} onChange={e => update({ instructions: e.target.value })} placeholder="When a customer asks about their order..." style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} />
    <label style={labelStyle}>Constraints</label>
    <textarea value={prompt.constraints} onChange={e => update({ constraints: e.target.value })} placeholder="Never share internal pricing. Always escalate safety complaints..." style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} />
    <label style={labelStyle}>Output Format</label>
    <textarea value={prompt.outputFormat} onChange={e => update({ outputFormat: e.target.value })} placeholder='{ "response": string, "confidence": number }' style={{ ...inputStyle, minHeight: 50, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }} />
  </>);
}

// ---- Model Tab ----
function ModelTab({ model, onChange }: { model: ModelConfig; onChange: (m: ModelConfig) => void }) {
  const update = (patch: Partial<ModelConfig>) => onChange({ ...model, ...patch });
  return (<>
    <label style={labelStyle}>Provider</label>
    <select value={model.provider} onChange={e => update({ provider: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
      {['anthropic', 'openai', 'google', 'mistral', 'meta', 'local', 'custom'].map(p => <option key={p} value={p} style={{ background: '#1e293b' }}>{p}</option>)}
    </select>
    <label style={labelStyle}>Model</label>
    {model.provider === 'anthropic' ? (
      <select value={model.model} onChange={e => update({ model: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
        {['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'].map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>{m}</option>)}
      </select>
    ) : model.provider === 'openai' ? (
      <select value={model.model} onChange={e => update({ model: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
        {['gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'].map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>{m}</option>)}
      </select>
    ) : model.provider === 'google' ? (
      <select value={model.model} onChange={e => update({ model: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
        {['gemini-2.5-pro', 'gemini-2.5-flash'].map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>{m}</option>)}
      </select>
    ) : (
      <input value={model.model} onChange={e => update({ model: e.target.value })} placeholder="model-name" style={inputStyle} />
    )}
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <div style={{ flex: 1 }}><label style={labelStyle}>Temperature</label><input type="number" value={model.temperature} onChange={e => update({ temperature: Number(e.target.value) })} min={0} max={2} step={0.1} style={inputStyle} /></div>
      <div style={{ flex: 1 }}><label style={labelStyle}>Max Tokens</label><input type="number" value={model.maxTokens} onChange={e => update({ maxTokens: Number(e.target.value) })} step={256} style={inputStyle} /></div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: 1 }}><label style={labelStyle}>Top P</label><input type="number" value={model.topP} onChange={e => update({ topP: Number(e.target.value) })} min={0} max={1} step={0.05} style={inputStyle} /></div>
      <div style={{ flex: 1 }}><label style={labelStyle}>Freq Penalty</label><input type="number" value={model.frequencyPenalty} onChange={e => update({ frequencyPenalty: Number(e.target.value) })} min={0} max={2} step={0.1} style={inputStyle} /></div>
    </div>
  </>);
}

// ---- Memory Tab ----
function MemoryTab({ memory, onChange }: { memory: MemoryConfig; onChange: (m: MemoryConfig) => void }) {
  const update = (patch: Partial<MemoryConfig>) => onChange({ ...memory, ...patch });
  return (<>
    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}><input type="checkbox" checked={memory.shortTermEnabled} onChange={e => update({ shortTermEnabled: e.target.checked })} /> Short-term</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}><input type="checkbox" checked={memory.longTermEnabled} onChange={e => update({ longTermEnabled: e.target.checked })} /> Long-term</label>
    </div>
    <label style={labelStyle}>Context Window (tokens)</label>
    <input type="number" value={memory.contextWindowTokens} onChange={e => update({ contextWindowTokens: Number(e.target.value) })} step={1000} style={inputStyle} />
    <label style={labelStyle}>Backend</label>
    <select value={memory.memoryBackend} onChange={e => update({ memoryBackend: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
      {['in-memory', 'sqlite', 'redis', 'postgres', 'pinecone', 'chromadb', 'qdrant'].map(b => <option key={b} value={b} style={{ background: '#1e293b' }}>{b}</option>)}
    </select>
    <label style={labelStyle}>TTL (minutes, 0 = never)</label>
    <input type="number" value={memory.ttlMinutes} onChange={e => update({ ttlMinutes: Number(e.target.value) })} min={0} style={inputStyle} />
  </>);
}

// ---- Guardrails Tab ----
function GuardrailsTab({ guardrails, onChange }: { guardrails: GuardrailsConfig; onChange: (g: GuardrailsConfig) => void }) {
  const update = (patch: Partial<GuardrailsConfig>) => onChange({ ...guardrails, ...patch });
  return (<>
    <label style={labelStyle}>Content Filters</label>
    <input value={guardrails.contentFilters.join(', ')} onChange={e => update({ contentFilters: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} placeholder="pii-detection, profanity-filter, bias-check" style={inputStyle} />
    <label style={labelStyle}>Output Validation</label>
    <input value={guardrails.outputValidation.join(', ')} onChange={e => update({ outputValidation: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} placeholder="json-schema, max-length, no-hallucination" style={inputStyle} />
    <label style={labelStyle}>Blocked Topics</label>
    <input value={guardrails.blockedTopics.join(', ')} onChange={e => update({ blockedTopics: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} placeholder="internal-pricing, competitor-info" style={inputStyle} />
    <label style={labelStyle}>Max Output Tokens</label>
    <input type="number" value={guardrails.maxOutputTokens} onChange={e => update({ maxOutputTokens: Number(e.target.value) })} step={256} style={inputStyle} />
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}><input type="checkbox" checked={guardrails.requireCitation} onChange={e => update({ requireCitation: e.target.checked })} /> Require citations</label>
  </>);
}

// ---- Triggers Tab ----
function TriggersTab({ triggers, onChange }: { triggers: TriggerEntry[]; onChange: (t: TriggerEntry[]) => void }) {
  const add = () => onChange([...triggers, { id: uid(), type: 'message', config: '', enabled: true }]);
  const update = (id: string, patch: Partial<TriggerEntry>) => onChange(triggers.map(t => t.id === id ? { ...t, ...patch } : t));
  const remove = (id: string) => onChange(triggers.filter(t => t.id !== id));
  return (<>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>What activates this agent</span>
      <button onClick={add} style={smallBtnStyle}>+ Add</button>
    </div>
    {triggers.length === 0 && <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>No triggers. Add one to define activation.</p>}
    {triggers.map(t => (
      <div key={t.id} style={cardStyle}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={t.type} onChange={e => update(t.id, { type: e.target.value as any })} style={{ ...inputStyle, marginTop: 0, width: 90, cursor: 'pointer' }}>
            {['scheduled', 'webhook', 'message', 'event', 'manual'].map(ty => <option key={ty} value={ty} style={{ background: '#1e293b' }}>{ty}</option>)}
          </select>
          <input value={t.config} onChange={e => update(t.id, { config: e.target.value })} placeholder={t.type === 'scheduled' ? 'cron expression' : 'config'} style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
          <button onClick={() => update(t.id, { enabled: !t.enabled })} style={{ ...removeBtnStyle, background: t.enabled ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: t.enabled ? '#10b981' : '#ef4444' }}>{t.enabled ? 'ON' : 'OFF'}</button>
          <button onClick={() => remove(t.id)} style={removeBtnStyle}>X</button>
        </div>
      </div>
    ))}
  </>);
}

// ---- Error Handling Tab ----
function ErrorHandlingTab({ errors, onChange }: { errors: ErrorHandlingConfig; onChange: (e: ErrorHandlingConfig) => void }) {
  const update = (patch: Partial<ErrorHandlingConfig>) => onChange({ ...errors, ...patch });
  return (<>
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <div style={{ flex: 1 }}><label style={labelStyle}>Retries</label><input type="number" value={errors.retryCount} onChange={e => update({ retryCount: Number(e.target.value) })} min={0} max={10} style={inputStyle} /></div>
      <div style={{ flex: 1 }}><label style={labelStyle}>Delay (ms)</label><input type="number" value={errors.retryDelayMs} onChange={e => update({ retryDelayMs: Number(e.target.value) })} step={500} style={inputStyle} /></div>
    </div>
    <label style={labelStyle}>Timeout (ms)</label>
    <input type="number" value={errors.timeoutMs} onChange={e => update({ timeoutMs: Number(e.target.value) })} step={1000} style={inputStyle} />
    <label style={labelStyle}>Fallback Agent</label>
    <input value={errors.fallbackAgentId} onChange={e => update({ fallbackAgentId: e.target.value })} placeholder="Agent nickname to call on failure" style={inputStyle} />
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: 1 }}><label style={labelStyle}>Circuit Breaker</label><input type="number" value={errors.circuitBreakerThreshold} onChange={e => update({ circuitBreakerThreshold: Number(e.target.value) })} min={1} style={inputStyle} /></div>
      <div style={{ flex: 1 }}><label style={labelStyle}>Reset (ms)</label><input type="number" value={errors.circuitBreakerResetMs} onChange={e => update({ circuitBreakerResetMs: Number(e.target.value) })} step={1000} style={inputStyle} /></div>
    </div>
  </>);
}

// ---- Cost Limits Tab ----
function CostLimitsTab({ costs, onChange }: { costs: CostLimitsConfig; onChange: (c: CostLimitsConfig) => void }) {
  const update = (patch: Partial<CostLimitsConfig>) => onChange({ ...costs, ...patch });
  return (<>
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <div style={{ flex: 1 }}><label style={labelStyle}>Tokens/Request</label><input type="number" value={costs.maxTokensPerRequest} onChange={e => update({ maxTokensPerRequest: Number(e.target.value) })} step={1000} style={inputStyle} /></div>
      <div style={{ flex: 1 }}><label style={labelStyle}>Req/Min</label><input type="number" value={costs.maxRequestsPerMinute} onChange={e => update({ maxRequestsPerMinute: Number(e.target.value) })} style={inputStyle} /></div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: 1 }}><label style={labelStyle}>Daily ($)</label><input type="number" value={costs.dailyBudgetUsd} onChange={e => update({ dailyBudgetUsd: Number(e.target.value) })} step={5} style={inputStyle} /></div>
      <div style={{ flex: 1 }}><label style={labelStyle}>Monthly ($)</label><input type="number" value={costs.monthlyBudgetUsd} onChange={e => update({ monthlyBudgetUsd: Number(e.target.value) })} step={50} style={inputStyle} /></div>
    </div>
    <label style={labelStyle}>Alert at % of budget</label>
    <input type="number" value={costs.alertThresholdPercent} onChange={e => update({ alertThresholdPercent: Number(e.target.value) })} min={0} max={100} style={inputStyle} />
  </>);
}

// ---- Permissions Tab ----
function PermissionsTab({ perms, onChange }: { perms: PermissionsConfig; onChange: (p: PermissionsConfig) => void }) {
  const update = (patch: Partial<PermissionsConfig>) => onChange({ ...perms, ...patch });
  return (<>
    <label style={labelStyle}>Can Read</label>
    <input value={perms.canRead.join(', ')} onChange={e => update({ canRead: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} placeholder="product-catalog, user-profiles" style={inputStyle} />
    <label style={labelStyle}>Can Write</label>
    <input value={perms.canWrite.join(', ')} onChange={e => update({ canWrite: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} placeholder="audit-log, support-tickets" style={inputStyle} />
    <label style={labelStyle}>Can Execute</label>
    <input value={perms.canExecute.join(', ')} onChange={e => update({ canExecute: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} placeholder="send-email, create-ticket" style={inputStyle} />
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}><input type="checkbox" checked={perms.canAccessExternal} onChange={e => update({ canAccessExternal: e.target.checked })} /> Can access external APIs</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}><input type="checkbox" checked={perms.requireApproval} onChange={e => update({ requireApproval: e.target.checked })} /> Require human approval</label>
    </div>
  </>);
}

// ---- Context Sources Tab ----
function ContextSourcesTab({ sources, onChange }: { sources: ContextSourceEntry[]; onChange: (s: ContextSourceEntry[]) => void }) {
  const add = () => onChange([...sources, { id: uid(), agentNickname: '', dataType: 'output', required: false }]);
  const update = (id: string, patch: Partial<ContextSourceEntry>) => onChange(sources.map(s => s.id === id ? { ...s, ...patch } : s));
  const remove = (id: string) => onChange(sources.filter(s => s.id !== id));
  return (<>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>Agent outputs this one reads</span>
      <button onClick={add} style={smallBtnStyle}>+ Add</button>
    </div>
    {sources.length === 0 && <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>No context sources configured.</p>}
    {sources.map(s => (
      <div key={s.id} style={cardStyle}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={s.agentNickname} onChange={e => update(s.id, { agentNickname: e.target.value })} placeholder="Agent nickname" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
          <select value={s.dataType} onChange={e => update(s.id, { dataType: e.target.value })} style={{ ...inputStyle, marginTop: 0, width: 80, cursor: 'pointer' }}>
            {['output', 'state', 'memory', 'logs', 'metrics'].map(d => <option key={d} value={d} style={{ background: '#1e293b' }}>{d}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#94a3b8', cursor: 'pointer', whiteSpace: 'nowrap' }}><input type="checkbox" checked={s.required} onChange={e => update(s.id, { required: e.target.checked })} /> Req</label>
          <button onClick={() => remove(s.id)} style={removeBtnStyle}>X</button>
        </div>
      </div>
    ))}
  </>);
}
