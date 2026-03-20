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
        background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 12,
        width: '90%', maxWidth: 850, maxHeight: '85vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#e2e8f0', fontSize: 18 }}>Optimization</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setTab('bottlenecks')} style={tabStyle(tab === 'bottlenecks')}>Bottlenecks</button>
              <button onClick={() => setTab('cost')} style={tabStyle(tab === 'cost')}>Cost Model</button>
              <button onClick={() => setTab('whatif')} style={tabStyle(tab === 'whatif')}>What-If</button>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>X</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {tab === 'bottlenecks' && (
            <div>
              {bottlenecks.length === 0 && <p style={{ color: '#64748b' }}>No bottlenecks detected. Your swarm topology looks well-distributed.</p>}
              {bottlenecks.map(b => (
                <div key={b.agentId} style={{
                  padding: 14, marginBottom: 10, borderRadius: 8, background: '#0f1f35',
                  border: '1px solid #1e3a5f',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{b.nickname}</span>
                    <div style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                      background: b.score >= 70 ? '#dc2626' : b.score >= 40 ? '#d97706' : '#2563eb',
                      color: '#fff',
                    }}>
                      Risk: {b.score}
                    </div>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{b.reason}</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, color: '#64748b', fontSize: 12 }}>
                    <span>In: {b.inDegree}</span>
                    <span>Out: {b.outDegree}</span>
                    <span>Dependents: {b.dependents}</span>
                  </div>
                  <div style={{ marginTop: 8, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${b.score}%`, height: '100%', borderRadius: 3,
                      background: b.score >= 70 ? '#dc2626' : b.score >= 40 ? '#d97706' : '#2563eb',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'cost' && cost && (
            <div>
              <div style={{
                padding: 16, borderRadius: 8, background: '#0f1f35', marginBottom: 16,
                display: 'flex', gap: 24,
              }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Monthly Est.</div>
                  <div style={{ color: '#00d9ff', fontSize: 28, fontWeight: 700 }}>${cost.estimatedMonthlyCost}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Agents</div>
                  <div style={{ color: '#e2e8f0', fontSize: 28, fontWeight: 700 }}>{cost.totalAgents}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Relationships</div>
                  <div style={{ color: '#e2e8f0', fontSize: 28, fontWeight: 700 }}>{cost.totalRelationships}</div>
                </div>
              </div>

              <h3 style={{ color: '#e2e8f0', fontSize: 14, margin: '16px 0 8px' }}>Cost by Layer</h3>
              {cost.breakdown.map(b => (
                <div key={b.layer} style={{
                  padding: '10px 14px', marginBottom: 6, borderRadius: 8, background: '#0f1f35',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ color: '#e2e8f0', fontSize: 13 }}>{b.layer} ({b.agents} agents)</span>
                  <span style={{ color: '#00d9ff', fontWeight: 600 }}>${b.estimatedCost}/mo</span>
                </div>
              ))}

              {cost.optimizationSuggestions.length > 0 && (
                <>
                  <h3 style={{ color: '#e2e8f0', fontSize: 14, margin: '16px 0 8px' }}>Suggestions</h3>
                  {cost.optimizationSuggestions.map((s, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', marginBottom: 6, borderRadius: 8,
                      background: '#1a1a2e', borderLeft: '3px solid #f59e0b', color: '#fbbf24', fontSize: 13,
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
                    flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #1e3a5f',
                    background: '#0f1f35', color: '#e2e8f0', fontSize: 13, outline: 'none',
                  }}
                />
                <button onClick={runWhatIf} style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: 13,
                }}>Simulate Removal</button>
              </div>

              {whatIf && (
                <div>
                  <div style={{
                    padding: 16, borderRadius: 8, marginBottom: 16,
                    background: whatIf.riskScore >= 70 ? '#450a0a' : whatIf.riskScore >= 40 ? '#451a03' : '#052e16',
                    border: `1px solid ${whatIf.riskScore >= 70 ? '#dc2626' : whatIf.riskScore >= 40 ? '#d97706' : '#16a34a'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{whatIf.scenario}</span>
                      <span style={{
                        color: whatIf.riskScore >= 70 ? '#f87171' : whatIf.riskScore >= 40 ? '#fbbf24' : '#4ade80',
                        fontWeight: 700,
                      }}>Risk: {whatIf.riskScore}/100</span>
                    </div>
                    <p style={{ color: '#cbd5e1', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{whatIf.recommendation}</p>
                  </div>

                  {whatIf.impactedAgents.length > 0 && (
                    <>
                      <h3 style={{ color: '#e2e8f0', fontSize: 14, margin: '0 0 8px' }}>Impacted Agents</h3>
                      {whatIf.impactedAgents.map((a, i) => (
                        <div key={i} style={{
                          padding: '8px 12px', marginBottom: 4, borderRadius: 6, background: '#0f1f35',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <span style={{ color: '#e2e8f0', fontSize: 13 }}>{a.nickname}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: a.impact === 'high' ? '#dc2626' : a.impact === 'medium' ? '#d97706' : '#2563eb',
                            color: '#fff',
                          }}>{a.impact}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {!whatIf && <p style={{ color: '#64748b' }}>Enter an agent nickname and click "Simulate Removal" to see the impact analysis.</p>}
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
