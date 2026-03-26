import React, { useState, useEffect } from 'react';
import { getBottlenecks, getWhatIf, getCostEstimate } from '../api.js';
import type { BottleneckResult, WhatIfResult, CostEstimate } from '../api.js';

interface Props {
  swarmId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OptimizationPanel({ swarmId, isOpen, onClose }: Props) {
  const [bottlenecks, setBottlenecks] = useState<BottleneckResult[]>([]);
  const [cost, setCost] = useState<CostEstimate | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);
  const [tab, setTab] = useState<'bottlenecks' | 'cost' | 'whatif'>('bottlenecks');
  const [whatIfAgent, setWhatIfAgent] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    getBottlenecks(swarmId).then(setBottlenecks).catch(() => {});
    getCostEstimate(swarmId).then(setCost).catch(() => {});
  }, [swarmId, isOpen]);

  const runWhatIf = async () => {
    if (!whatIfAgent.trim()) return;
    const result = await getWhatIf(swarmId, whatIfAgent.trim());
    setWhatIf(result);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 12,
        width: '90%', maxWidth: 850, maxHeight: '85vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>Optimization</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setTab('bottlenecks')} style={tabStyle(tab === 'bottlenecks')}>Bottlenecks</button>
              <button onClick={() => setTab('cost')} style={tabStyle(tab === 'cost')}>Cost Model</button>
              <button onClick={() => setTab('whatif')} style={tabStyle(tab === 'whatif')}>What-If</button>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18 }}>X</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {tab === 'bottlenecks' && (
            <div>
              {bottlenecks.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No bottlenecks detected. Your swarm topology looks well-distributed.</p>}
              {bottlenecks.map(b => (
                <div key={b.agentId} style={{
                  padding: 14, marginBottom: 10, borderRadius: 8, background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{b.nickname}</span>
                    <div style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                      background: b.score >= 70 ? 'var(--status-error-strong, #dc2626)' : b.score >= 40 ? 'var(--status-warn-strong, #d97706)' : 'var(--accent-primary)',
                      color: 'var(--text-primary)',
                    }}>
                      Risk: {b.score}
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 6 }}>{b.reason}</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, color: 'var(--text-tertiary)', fontSize: 12 }}>
                    <span>In: {b.inDegree}</span>
                    <span>Out: {b.outDegree}</span>
                    <span>Dependents: {b.dependents}</span>
                  </div>
                  <div style={{ marginTop: 8, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${b.score}%`, height: '100%', borderRadius: 3,
                      background: b.score >= 70 ? 'var(--status-error-strong, #dc2626)' : b.score >= 40 ? 'var(--status-warn-strong, #d97706)' : 'var(--accent-primary)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'cost' && cost && (
            <div>
              <div style={{
                padding: 16, borderRadius: 8, background: 'var(--bg-surface)', marginBottom: 16,
                display: 'flex', gap: 24,
              }}>
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Monthly Est.</div>
                  <div style={{ color: 'var(--text-accent)', fontSize: 28, fontWeight: 700 }}>${cost.estimatedMonthlyCost}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Agents</div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 700 }}>{cost.totalAgents}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase' }}>Relationships</div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 700 }}>{cost.totalRelationships}</div>
                </div>
              </div>

              <h3 style={{ color: 'var(--text-primary)', fontSize: 14, margin: '16px 0 8px' }}>Cost by Layer</h3>
              {cost.breakdown.map(b => (
                <div key={b.layer} style={{
                  padding: '10px 14px', marginBottom: 6, borderRadius: 8, background: 'var(--bg-surface)',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{b.layer} ({b.agents} agents)</span>
                  <span style={{ color: 'var(--text-accent)', fontWeight: 600 }}>${b.estimatedCost}/mo</span>
                </div>
              ))}

              {cost.optimizationSuggestions.length > 0 && (
                <>
                  <h3 style={{ color: 'var(--text-primary)', fontSize: 14, margin: '16px 0 8px' }}>Suggestions</h3>
                  {cost.optimizationSuggestions.map((s, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', marginBottom: 6, borderRadius: 8,
                      background: 'var(--bg-subtle)', borderLeft: '3px solid #f59e0b', color: '#fbbf24', fontSize: 13,
                    }}>{s}</div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'whatif' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  value={whatIfAgent}
                  onChange={e => setWhatIfAgent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runWhatIf()}
                  placeholder="Agent nickname to simulate removing..."
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  }}
                />
                <button onClick={runWhatIf} style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: '#ef4444', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13,
                }}>Simulate Removal</button>
              </div>

              {whatIf && (
                <div>
                  <div style={{
                    padding: 16, borderRadius: 8, marginBottom: 16,
                    background: whatIf.riskScore >= 70 ? 'var(--status-error-bg, #450a0a)' : whatIf.riskScore >= 40 ? 'var(--status-warn-bg, #451a03)' : 'var(--status-ok-bg, #052e16)',
                    border: `1px solid ${whatIf.riskScore >= 70 ? 'var(--status-error-strong, #dc2626)' : whatIf.riskScore >= 40 ? 'var(--status-warn-strong, #d97706)' : 'var(--status-ok-strong, #16a34a)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{whatIf.scenario}</span>
                      <span style={{
                        color: whatIf.riskScore >= 70 ? '#f87171' : whatIf.riskScore >= 40 ? '#fbbf24' : '#4ade80',
                        fontWeight: 700,
                      }}>Risk: {whatIf.riskScore}/100</span>
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{whatIf.recommendation}</p>
                  </div>

                  {whatIf.impactedAgents.length > 0 && (
                    <>
                      <h3 style={{ color: 'var(--text-primary)', fontSize: 14, margin: '0 0 8px' }}>Impacted Agents</h3>
                      {whatIf.impactedAgents.map((a, i) => (
                        <div key={i} style={{
                          padding: '8px 12px', marginBottom: 4, borderRadius: 6, background: 'var(--bg-surface)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{a.nickname}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: a.impact === 'high' ? 'var(--status-error-strong, #dc2626)' : a.impact === 'medium' ? 'var(--status-warn-strong, #d97706)' : 'var(--accent-primary)',
                            color: 'var(--text-primary)',
                          }}>{a.impact}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {!whatIf && <p style={{ color: 'var(--text-tertiary)' }}>Enter an agent nickname and click "Simulate Removal" to see the impact analysis.</p>}
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
    background: active ? 'var(--accent-primary)' : 'var(--bg-overlay)',
    color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
  };
}
