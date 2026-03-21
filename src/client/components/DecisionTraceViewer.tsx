import React, { useState, useEffect } from 'react';
import { getDecisionTraces, getTracePatterns } from '../api.js';
import type { DecisionTrace, TracePattern } from '../api.js';

interface Props {
  swarmId: string;
  isOpen: boolean;
  onClose: () => void;
}

const STAGE_COLORS: Record<string, string> = {
  observation: '#3b82f6',
  reasoning: '#8b5cf6',
  action: '#f59e0b',
  outcome: '#10b981',
};

const STAGE_ICONS: Record<string, string> = {
  observation: 'O',
  reasoning: 'R',
  action: 'A',
  outcome: 'X',
};

export function DecisionTraceViewer({ swarmId, isOpen, onClose }: Props) {
  const [traces, setTraces] = useState<DecisionTrace[]>([]);
  const [patterns, setPatterns] = useState<TracePattern[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<DecisionTrace | null>(null);
  const [tab, setTab] = useState<'traces' | 'patterns'>('traces');
  const [filterTag, setFilterTag] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    getDecisionTraces(swarmId, filterTag ? { tag: filterTag } : undefined).then(setTraces).catch(() => {});
    getTracePatterns(swarmId).then(setPatterns).catch(() => {});
  }, [swarmId, isOpen, filterTag]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 12,
        width: '90%', maxWidth: 900, maxHeight: '85vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#e2e8f0', fontSize: 18 }}>Decision Traces</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setTab('traces')} style={tabStyle(tab === 'traces')}>Traces</button>
              <button onClick={() => setTab('patterns')} style={tabStyle(tab === 'patterns')}>Patterns</button>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>X</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {tab === 'traces' && (
            <div style={{ display: 'flex', gap: 16, height: '100%' }}>
              <div style={{ width: 300, overflow: 'auto' }}>
                {traces.length === 0 && <p style={{ color: '#64748b' }}>No decision traces recorded yet. Traces are created when agents make decisions during swarm execution.</p>}
                {traces.map(trace => (
                  <div
                    key={trace.id}
                    onClick={() => setSelectedTrace(trace)}
                    style={{
                      padding: '10px 12px', marginBottom: 8, borderRadius: 8, cursor: 'pointer',
                      background: selectedTrace?.id === trace.id ? '#1e3a5f' : '#0f1f35',
                      border: `1px solid ${selectedTrace?.id === trace.id ? '#00d9ff' : '#1e3a5f'}`,
                    }}
                  >
                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{trace.title}</div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
                      {trace.agentNickname} | {new Date(trace.timestamp).toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {trace.stages.map((s, i) => (
                        <span key={i} style={{
                          width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: STAGE_COLORS[s.stage] || '#475569', color: '#fff', fontSize: 10, fontWeight: 700,
                        }}>{STAGE_ICONS[s.stage] || '?'}</span>
                      ))}
                      <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 11 }}>
                        {Math.round(trace.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                {selectedTrace ? (
                  <div>
                    <h3 style={{ color: '#e2e8f0', margin: '0 0 8px' }}>{selectedTrace.title}</h3>
                    <div style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
                      Agent: {selectedTrace.agentNickname} | Confidence: {Math.round(selectedTrace.confidence * 100)}% | Duration: {selectedTrace.durationMs}ms
                    </div>
                    {selectedTrace.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        {selectedTrace.tags.map(tag => (
                          <span key={tag} style={{ background: '#1e3a5f', color: '#00d9ff', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {selectedTrace.stages.map((stage, i) => (
                        <div key={i} style={{
                          padding: 14, borderRadius: 8, background: '#0f1f35',
                          borderLeft: `3px solid ${STAGE_COLORS[stage.stage] || '#475569'}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{
                              width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: STAGE_COLORS[stage.stage] || '#475569', color: '#fff', fontSize: 11, fontWeight: 700,
                            }}>{STAGE_ICONS[stage.stage] || '?'}</span>
                            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{stage.stage}</span>
                          </div>
                          <p style={{ color: '#cbd5e1', fontSize: 13, margin: 0, lineHeight: 1.6 }}>{stage.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#64748b' }}>Select a trace to view its 4-stage decision process.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'patterns' && (
            <div>
              {patterns.length === 0 && <p style={{ color: '#64748b' }}>No patterns detected yet. Patterns emerge as more decision traces are recorded.</p>}
              {patterns.map(p => (
                <div key={p.pattern} style={{
                  padding: 14, marginBottom: 10, borderRadius: 8, background: '#0f1f35',
                  border: '1px solid #1e3a5f',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#00d9ff', fontWeight: 600 }}>{p.pattern}</span>
                    <span style={{ color: '#64748b', fontSize: 12 }}>{p.occurrences} occurrences</span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>
                    Agents: {p.agents.join(', ')} | Avg confidence: {Math.round(p.avgConfidence * 100)}% | Avg duration: {Math.round(p.avgDurationMs)}ms
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    background: active ? '#00d9ff' : '#1e3a5f',
    color: active ? '#0a1628' : '#94a3b8',
  };
}
