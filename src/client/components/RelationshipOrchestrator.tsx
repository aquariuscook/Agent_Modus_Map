import React, { useState } from 'react';
import type { Swarm, Agent, RelationshipType } from '../../shared/types/index.js';

interface Props {
  swarm: Swarm;
  isOpen: boolean;
  onToggle: () => void;
  onCreateRelationship: (sourceId: string, targetId: string, type: RelationshipType) => void;
  onDeleteRelationship: (relId: string) => void;
}

const REL_COLORS: Record<RelationshipType, string> = {
  dependsOn: 'var(--accent-primary)',
  feedsInto: 'var(--accent-secondary)',
  collaboratesWith: '#fbbf24',
  canOverride: '#ef4444',
};

const REL_LABELS: Record<RelationshipType, string> = {
  dependsOn: 'Depends On',
  feedsInto: 'Feeds Into',
  collaboratesWith: 'Collaborates With',
  canOverride: 'Can Override',
};

export function RelationshipOrchestrator({ swarm, isOpen, onToggle, onCreateRelationship, onDeleteRelationship }: Props) {
  const [sourceNickname, setSourceNickname] = useState('');
  const [targetNickname, setTargetNickname] = useState('');
  const [relType, setRelType] = useState<RelationshipType>('feedsInto');
  const [pipelineAgents, setPipelineAgents] = useState<string[]>([]);
  const [tab, setTab] = useState<'quick' | 'pipeline' | 'bulk' | 'existing'>('quick');

  if (!isOpen) return null;

  const agents = swarm.agents.sort((a, b) => a.nickname.localeCompare(b.nickname));
  const agentMap = new Map(agents.map(a => [a.nickname, a]));

  const handleQuickConnect = () => {
    const source = agentMap.get(sourceNickname);
    const target = agentMap.get(targetNickname);
    if (source && target) {
      onCreateRelationship(source.id, target.id, relType);
      setSourceNickname('');
      setTargetNickname('');
    }
  };

  const handlePipelineCreate = () => {
    if (pipelineAgents.length < 2) return;
    for (let i = 0; i < pipelineAgents.length - 1; i++) {
      const source = agentMap.get(pipelineAgents[i]);
      const target = agentMap.get(pipelineAgents[i + 1]);
      if (source && target) {
        onCreateRelationship(source.id, target.id, 'feedsInto');
      }
    }
    setPipelineAgents([]);
  };

  const handleBulkConnect = (hubNickname: string, targetNicknames: string[], type: RelationshipType) => {
    const hub = agentMap.get(hubNickname);
    if (!hub) return;
    for (const tn of targetNicknames) {
      const target = agentMap.get(tn);
      if (target) onCreateRelationship(hub.id, target.id, type);
    }
  };

  // Suggested connections based on layer patterns
  const suggestions: Array<{ source: string; target: string; type: RelationshipType; reason: string }> = [];
  const entryAgents = agents.filter(a => a.badges.includes('ENTRY'));
  const hubAgents = agents.filter(a => a.badges.includes('HUB'));
  const criticalAgents = agents.filter(a => a.badges.includes('CRITICAL'));

  // Suggest entry agents feed into hub agents
  for (const entry of entryAgents) {
    for (const hub of hubAgents) {
      if (entry.id !== hub.id) {
        const exists = swarm.relationships.some(r => r.sourceAgentId === entry.id && r.targetAgentId === hub.id);
        if (!exists) {
          suggestions.push({ source: entry.nickname, target: hub.nickname, type: 'feedsInto', reason: 'Entry agents typically feed data to hub agents' });
        }
      }
    }
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 280,
      background: 'var(--bg-surface)', borderTop: '2px solid rgba(0,217,255,0.3)',
      zIndex: 20, display: 'flex', flexDirection: 'column',
      animation: 'slideUpOrch 0.2s ease',
    }}>
      <style>{`@keyframes slideUpOrch { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      {/* Tab header */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['quick', 'pipeline', 'bulk', 'existing'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: tab === t ? 'var(--accent-primary)' : 'var(--border-subtle)',
              color: tab === t ? 'var(--text-inverse)' : 'var(--text-tertiary)',
            }}>{t === 'quick' ? 'Quick Connect' : t === 'pipeline' ? 'Pipeline Builder' : t === 'bulk' ? 'Bulk / Suggest' : 'Existing'}</button>
          ))}
        </div>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16 }}>X</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Quick Connect */}
        {tab === 'quick' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Source Agent</label>
              <select value={sourceNickname} onChange={e => setSourceNickname(e.target.value)} style={sel}>
                <option value="">Select agent...</option>
                {agents.map(a => <option key={a.id} value={a.nickname}>{a.nickname}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Relationship</label>
              <select value={relType} onChange={e => setRelType(e.target.value as RelationshipType)} style={sel}>
                {Object.entries(REL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Target Agent</label>
              <select value={targetNickname} onChange={e => setTargetNickname(e.target.value)} style={sel}>
                <option value="">Select agent...</option>
                {agents.map(a => <option key={a.id} value={a.nickname}>{a.nickname}</option>)}
              </select>
            </div>
            <button onClick={handleQuickConnect} disabled={!sourceNickname || !targetNickname} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: sourceNickname && targetNickname ? 'var(--accent-primary)' : 'var(--bg-elevated)',
              color: sourceNickname && targetNickname ? 'var(--text-inverse)' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
            }}>Connect</button>
          </div>
        )}

        {/* Pipeline Builder */}
        {tab === 'pipeline' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 10 }}>
              Build a data pipeline by adding agents in order. Each connects to the next via "Feeds Into".
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {pipelineAgents.map((name, i) => (
                <React.Fragment key={i}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 8, background: 'var(--bg-elevated)',
                    color: 'var(--text-accent)', fontSize: 12, fontWeight: 600, border: '1px solid #00d9ff30',
                  }}>
                    {name}
                    <button onClick={() => setPipelineAgents(pipelineAgents.filter((_, j) => j !== i))} style={{
                      background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginLeft: 6, fontSize: 12,
                    }}>x</button>
                  </span>
                  {i < pipelineAgents.length - 1 && <span style={{ color: 'var(--accent-secondary)', fontSize: 16, alignSelf: 'center' }}>{'→'}</span>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select onChange={e => { if (e.target.value) { setPipelineAgents([...pipelineAgents, e.target.value]); e.target.value = ''; } }} style={{ ...sel, flex: 1 }}>
                <option value="">Add agent to pipeline...</option>
                {agents.filter(a => !pipelineAgents.includes(a.nickname)).map(a => <option key={a.id} value={a.nickname}>{a.nickname}</option>)}
              </select>
              <button onClick={handlePipelineCreate} disabled={pipelineAgents.length < 2} style={{
                padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: pipelineAgents.length >= 2 ? 'var(--accent-secondary)' : 'var(--bg-elevated)',
                color: pipelineAgents.length >= 2 ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
              }}>Create Pipeline ({Math.max(0, pipelineAgents.length - 1)} connections)</button>
            </div>
          </div>
        )}

        {/* Bulk / Suggest */}
        {tab === 'bulk' && (
          <div>
            {suggestions.length > 0 && (
              <>
                <p style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Suggested Connections</p>
                {suggestions.slice(0, 6).map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    borderRadius: 6, background: 'rgba(251,191,36,0.05)', marginBottom: 4,
                  }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{s.source}</span>
                    <span style={{ color: REL_COLORS[s.type], fontSize: 11 }}>{REL_LABELS[s.type]}</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{s.target}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 10, flex: 1 }}>{s.reason}</span>
                    <button onClick={() => {
                      const src = agentMap.get(s.source);
                      const tgt = agentMap.get(s.target);
                      if (src && tgt) onCreateRelationship(src.id, tgt.id, s.type);
                    }} style={{
                      padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                      background: '#22c55e', color: 'var(--text-primary)', fontSize: 10, fontWeight: 700,
                    }}>Add</button>
                  </div>
                ))}
              </>
            )}
            {suggestions.length === 0 && (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No suggestions. Your agents are well-connected based on their badges and layers.</p>
            )}
          </div>
        )}

        {/* Existing relationships */}
        {tab === 'existing' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
            {swarm.relationships.map(rel => {
              const source = swarm.agents.find(a => a.id === rel.sourceAgentId);
              const target = swarm.agents.find(a => a.id === rel.targetAgentId);
              if (!source || !target) return null;
              return (
                <div key={rel.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                  borderRadius: 6, background: 'rgba(255,255,255,0.03)',
                  borderLeft: `3px solid ${REL_COLORS[rel.type]}`,
                }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{source.nickname}</span>
                  <span style={{ color: REL_COLORS[rel.type], fontSize: 10 }}>{REL_LABELS[rel.type]}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{target.nickname}</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => onDeleteRelationship(rel.id)} style={{
                    background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12,
                  }}>x</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
const sel: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', cursor: 'pointer' };
