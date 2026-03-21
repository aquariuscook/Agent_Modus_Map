import React, { useState } from 'react';
import { runSimulation, getSwarmCostEstimate } from '../api.js';

interface Props {
  swarmId: string;
  isOpen: boolean;
  onToggle: () => void;
}

type Tab = 'simulate' | 'cost';

export function SimulationPanel({ swarmId, isOpen, onToggle }: Props) {
  const [tab, setTab] = useState<Tab>('simulate');
  const [simResult, setSimResult] = useState<any>(null);
  const [costResult, setCostResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sampleInput, setSampleInput] = useState('');
  const [callsPerDay, setCallsPerDay] = useState('');

  async function handleRunSimulation() {
    setLoading(true);
    try {
      const res = await runSimulation(swarmId, sampleInput || undefined);
      setSimResult(res.data);
    } catch { setSimResult(null); }
    setLoading(false);
  }

  async function handleGetCost() {
    setLoading(true);
    try {
      const cpd = callsPerDay ? Number(callsPerDay) : undefined;
      const res = await getSwarmCostEstimate(swarmId, cpd);
      setCostResult(res.data);
    } catch { setCostResult(null); }
    setLoading(false);
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute', top: 50, right: 20, width: 480, maxHeight: 'calc(100vh - 120px)',
      background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 12,
      display: 'flex', flexDirection: 'column', zIndex: 25,
      boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2 }}>
          {(['simulate', 'cost'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
              background: tab === t ? 'var(--accent-primary)' : 'transparent',
              color: tab === t ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-primary)',
            }}>{t === 'simulate' ? 'Mock Run' : 'Cost Estimate'}</button>
          ))}
        </div>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>{'\u00D7'}</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 0 }}>
        {tab === 'simulate' && (
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Sample Input</div>
            <textarea
              value={sampleInput}
              onChange={e => setSampleInput(e.target.value)}
              placeholder="Enter a sample request to trace through the swarm... (leave blank for default)"
              style={{
                width: '100%', minHeight: 60, padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-primary)',
                resize: 'vertical', outline: 'none',
              }}
            />
            <button onClick={handleRunSimulation} disabled={loading} style={{
              marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent-primary)', color: 'var(--text-inverse)',
              fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontSize: 13,
              fontFamily: 'var(--font-primary)', opacity: loading ? 0.5 : 1,
            }}>{loading ? 'Running...' : 'Run Simulation'}</button>

            {simResult && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <Stat label="Agents Processed" value={simResult.steps.length} />
                  <Stat label="Total Tokens" value={simResult.totalTokens.toLocaleString()} />
                  <Stat label="Est. Duration" value={`${(simResult.totalDurationMs / 1000).toFixed(1)}s`} />
                </div>

                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Execution Trace</div>
                {simResult.steps.map((step: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px 14px', marginBottom: 6, borderRadius: 8,
                    background: 'var(--bg-surface)',
                    borderLeft: `3px solid ${step.status === 'success' ? '#22c55e' : step.status === 'filtered' ? '#ef4444' : '#fbbf24'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                        {step.order + 1}. {step.nickname}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 10,
                        background: step.status === 'success' ? 'rgba(34,197,94,0.15)' : step.status === 'filtered' ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)',
                        color: step.status === 'success' ? '#22c55e' : step.status === 'filtered' ? '#ef4444' : '#fbbf24',
                      }}>{step.status.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {step.output}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 12 }}>
                      <span>{step.tokensUsed} tokens</span>
                      <span>{step.durationMs.toFixed(0)}ms</span>
                      {step.downstreamAgents.length > 0 && <span>{'>'} {step.downstreamAgents.join(', ')}</span>}
                    </div>
                  </div>
                ))}

                {simResult.dataFlow.length > 0 && <>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 16, marginBottom: 8 }}>Data Flow</div>
                  {simResult.dataFlow.map((flow: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: '#00d9ff' }}>{flow.from}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{'>'}</span>
                      <span style={{ fontWeight: 600, color: '#a855f7' }}>{flow.to}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{flow.data.slice(0, 60)}...</span>
                    </div>
                  ))}
                </>}
              </div>
            )}
          </div>
        )}

        {tab === 'cost' && (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Calls Per Day (optional)</div>
                <input
                  value={callsPerDay}
                  onChange={e => setCallsPerDay(e.target.value)}
                  type="number"
                  placeholder="Auto-estimate"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-primary)', outline: 'none',
                  }}
                />
              </div>
              <button onClick={handleGetCost} disabled={loading} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: 'var(--accent-primary)', color: 'var(--text-inverse)',
                fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontSize: 13,
                fontFamily: 'var(--font-primary)', opacity: loading ? 0.5 : 1,
              }}>{loading ? 'Calculating...' : 'Estimate Cost'}</button>
            </div>

            {costResult && (
              <div>
                {/* Summary */}
                <div style={{
                  padding: 16, borderRadius: 10, background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#00d9ff' }}>${costResult.totalMonthlyCost}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Estimated Monthly</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>${costResult.totalDailyCost}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Per Day</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Budget: </span><span style={{ color: costResult.totalMonthlyCost > costResult.totalMonthlyBudget ? '#ef4444' : '#22c55e' }}>${costResult.totalMonthlyBudget}/mo</span></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Cheapest: </span><span style={{ color: '#22c55e' }}>{costResult.cheapestProvider}</span></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Most expensive: </span><span style={{ color: '#fbbf24' }}>{costResult.mostExpensiveAgent}</span></div>
                  </div>
                </div>

                {/* Per-agent breakdown */}
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Per Agent Breakdown</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Agent</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Model</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Calls/Day</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-tertiary)', fontWeight: 600 }}>$/Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costResult.agents
                      .sort((a: any, b: any) => b.monthlyCost - a.monthlyCost)
                      .map((agent: any) => (
                      <tr key={agent.agentId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '6px 8px', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {agent.nickname}
                          {agent.overBudget && <span style={{ color: '#ef4444', marginLeft: 4, fontSize: 10 }}>OVER</span>}
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-tertiary)' }}>{agent.model.split('-').slice(-2).join('-')}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{agent.callsPerDay}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: agent.overBudget ? '#ef4444' : 'var(--text-primary)', fontWeight: 600 }}>${agent.monthlyCost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-surface)', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</div>
    </div>
  );
}
