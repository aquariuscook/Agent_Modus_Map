import React, { useState } from 'react';
import { runSimulation, getSwarmCostEstimate, runLiveTestStreaming, getSwarmPackage } from '../api.js';

interface Props {
  swarmId: string;
  isOpen: boolean;
  onToggle: () => void;
  onOpenAgent?: (agentId: string) => void;
}

type Tab = 'simulate' | 'cost' | 'live' | 'deploy';

export function SimulationPanel({ swarmId, isOpen, onToggle, onOpenAgent }: Props) {
  const [tab, setTab] = useState<Tab>('simulate');
  const [simResult, setSimResult] = useState<any>(null);
  const [costResult, setCostResult] = useState<any>(null);
  const [liveResult, setLiveResult] = useState<any>(null);
  const [swarmPackage, setSwarmPackage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sampleInput, setSampleInput] = useState('');
  const [liveInput, setLiveInput] = useState('');
  const [liveProgress, setLiveProgress] = useState<{ agent: string; step: number; total: number } | null>(null);
  const [callsPerDay, setCallsPerDay] = useState('');

  async function handleRunSimulation() {
    setLoading(true);
    try {
      const res = await runSimulation(swarmId, sampleInput || undefined);
      setSimResult(res);
    } catch { setSimResult(null); }
    setLoading(false);
  }

  async function handleRunLiveTest() {
    setLoading(true);
    setLiveProgress(null);
    setLiveResult(null);
    try {
      const res = await runLiveTestStreaming(swarmId, liveInput || undefined, (event) => {
        if (event.type === 'progress') {
          setLiveProgress({ agent: event.agent || '', step: event.step || 0, total: event.total || 1 });
        }
      });
      setLiveResult(res);
    } catch (err: any) {
      setLiveResult({ status: 'failed', error: err.message });
    }
    setLiveProgress(null);
    setLoading(false);
  }

  async function handleExportPackage() {
    setLoading(true);
    try {
      const res = await getSwarmPackage(swarmId);
      setSwarmPackage(res);
    } catch { setSwarmPackage(null); }
    setLoading(false);
  }

  function downloadPackage() {
    if (!swarmPackage) return;
    // Download each file as a combined JSON for now
    const blob = new Blob([JSON.stringify(swarmPackage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${swarmPackage.name.replace(/[^a-zA-Z0-9]/g, '_')}_package.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadFile(file: { path: string; content: string }) {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() || file.path;
    a.click();
    URL.revokeObjectURL(url);
  }

  const [copied, setCopied] = useState(false);

  function copyResults(result: any, type: 'mock' | 'live') {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`${type === 'live' ? 'Live Test' : 'Mock Run'} Results`);
    lines.push(`Status: ${result.status}`);
    lines.push(`Agents: ${result.agentsProcessed || result.steps?.length || 0}`);
    lines.push(`Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);
    if (result.totalCost !== undefined) lines.push(`Cost: $${result.totalCost}`);
    lines.push(`Tokens: ${((result.totalInputTokens || 0) + (result.totalOutputTokens || 0) + (result.totalTokens || 0)).toLocaleString()}`);
    lines.push('');
    for (const step of result.steps || []) {
      lines.push(`--- ${step.nickname} (${step.status}) ---`);
      lines.push(step.output || step.error || '');
      if (step.downstreamAgents?.length) lines.push(`> Passes to: ${step.downstreamAgents.join(', ')}`);
      lines.push('');
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGetCost() {
    setLoading(true);
    try {
      const cpd = callsPerDay ? Number(callsPerDay) : undefined;
      const res = await getSwarmCostEstimate(swarmId, cpd);
      setCostResult(res);
    } catch { setCostResult(null); }
    setLoading(false);
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 60, right: 20, width: 480, maxHeight: 'calc(100vh - 120px)',
      background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 12,
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2 }}>
          {(['simulate', 'cost', 'live', 'deploy'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              background: tab === t ? (t === 'live' ? '#ef4444' : t === 'deploy' ? '#22c55e' : 'var(--accent-primary)') : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-primary)',
            }}>{t === 'simulate' ? 'Mock' : t === 'cost' ? 'Cost' : t === 'live' ? 'Live Test' : 'Deploy'}</button>
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
              placeholder="What should the agents work on? (leave blank for a default example)"
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

                <button onClick={() => copyResults(simResult, 'mock')} style={{
                  marginBottom: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)',
                  background: 'transparent', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-primary)', width: '100%',
                }}>{copied ? 'Copied!' : 'Copy All Results'}</button>

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
                      }}>{step.status === 'needs-review' ? 'NEEDS REVIEW' : step.status.toUpperCase()}</span>
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
                      <span style={{ fontWeight: 600, color: 'var(--text-accent)' }}>{flow.from}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{'>'}</span>
                      <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>{flow.to}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{flow.data.slice(0, 60)}...</span>
                    </div>
                  ))}
                </>}
              </div>
            )}
          </div>
        )}

        {tab === 'live' && (
          <div>
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 11, color: '#f87171', lineHeight: 1.5,
            }}>
              This makes real API calls and costs real money. Each agent in the swarm will call the configured LLM model. Review the Cost Estimate tab first.
            </div>

            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>What should the agents do?</div>
            <textarea
              value={liveInput}
              onChange={e => setLiveInput(e.target.value)}
              placeholder="Describe a task for your agents, like: Find companies that need AI training help"
              style={{
                width: '100%', minHeight: 60, padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-primary)',
                resize: 'vertical', outline: 'none',
              }}
            />
            <button onClick={handleRunLiveTest} disabled={loading} style={{
              marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#ef4444', color: 'var(--text-primary)',
              fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontSize: 13,
              fontFamily: 'var(--font-primary)', opacity: loading ? 0.5 : 1,
            }}>{loading ? 'Executing...' : 'Run Live Test'}</button>

            {loading && liveProgress && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Running: <b style={{ color: 'var(--text-primary)' }}>{liveProgress.agent}</b></span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{liveProgress.step}/{liveProgress.total}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: 'linear-gradient(90deg, #00d9ff, #a855f7)',
                    width: `${(liveProgress.step / liveProgress.total) * 100}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {Math.round((liveProgress.step / liveProgress.total) * 100)}% complete
                </div>
              </div>
            )}

            {loading && !liveProgress && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
                Starting up...
              </div>
            )}

            {liveResult && liveResult.status === 'failed' && !liveResult.steps && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#f87171' }}>
                Error: {liveResult.error}
              </div>
            )}

            {liveResult && liveResult.steps && (<>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <Stat label="Agents" value={`${liveResult.agentsProcessed}/${liveResult.agentsTotal}`} />
                  <Stat label="Duration" value={`${(liveResult.totalDurationMs / 1000).toFixed(1)}s`} />
                  <Stat label="Total Cost" value={`$${liveResult.totalCost}`} />
                  <Stat label="Tokens" value={`${(liveResult.totalInputTokens + liveResult.totalOutputTokens).toLocaleString()}`} />
                </div>

                <div style={{
                  padding: '6px 10px', borderRadius: 6, marginBottom: 12, fontSize: 11, fontWeight: 600,
                  background: liveResult.status === 'completed' ? 'rgba(34,197,94,0.1)' : liveResult.status === 'partial' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                  color: liveResult.status === 'completed' ? '#22c55e' : liveResult.status === 'partial' ? '#fbbf24' : '#ef4444',
                  border: `1px solid ${liveResult.status === 'completed' ? 'rgba(34,197,94,0.2)' : liveResult.status === 'partial' ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  Status: {liveResult.status.toUpperCase()}
                </div>

                <button onClick={() => copyResults(liveResult, 'live')} style={{
                  marginBottom: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)',
                  background: 'transparent', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-primary)', width: '100%',
                }}>{copied ? 'Copied!' : 'Copy All Results'}</button>

                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Agent Responses</div>
                {liveResult.steps.map((step: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px 14px', marginBottom: 8, borderRadius: 8,
                    background: 'var(--bg-surface)',
                    borderLeft: `3px solid ${step.status === 'success' ? '#22c55e' : '#ef4444'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                        {step.order + 1}. {step.nickname}
                      </span>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
                        <span>{step.model}</span>
                        <span>{step.durationMs}ms</span>
                        <span>${step.cost}</span>
                      </div>
                    </div>
                    {step.status === 'error' ? (
                      <div style={{ fontSize: 12, color: '#f87171' }}>Error: {step.error}</div>
                    ) : (
                      <div style={{
                        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                        maxHeight: 150, overflowY: 'auto', whiteSpace: 'pre-wrap',
                        padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elevated)',
                      }}>
                        {step.output}
                      </div>
                    )}
                    {step.downstreamAgents.length > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        Passes to: {step.downstreamAgents.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <DiagnosticsSection steps={liveResult.steps} onOpenAgent={onOpenAgent} />
            </>)}
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
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-accent)' }}>${costResult.totalMonthlyCost}</div>
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

        {tab === 'deploy' && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              Export your swarm as a standalone deployable package with agent prompts, configuration, and a runner script.
            </div>

            <button onClick={handleExportPackage} disabled={loading} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#22c55e', color: 'var(--text-primary)',
              fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontSize: 13,
              fontFamily: 'var(--font-primary)', opacity: loading ? 0.5 : 1,
              width: '100%',
            }}>{loading ? 'Generating...' : 'Generate Deploy Package'}</button>

            {swarmPackage && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Package: {swarmPackage.name}
                  </div>
                  <button onClick={downloadPackage} style={{
                    padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-default)',
                    background: 'transparent', color: 'var(--accent-primary)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)',
                  }}>Download All</button>
                </div>

                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Files ({swarmPackage.files.length})</div>
                {swarmPackage.files.map((file: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', marginBottom: 4, borderRadius: 6,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{file.path}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{file.content.length} chars</div>
                    </div>
                    <button onClick={() => downloadFile(file)} style={{
                      padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border-default)',
                      background: 'transparent', color: 'var(--text-secondary)',
                      fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-primary)',
                    }}>Save</button>
                  </div>
                ))}

                <div style={{
                  marginTop: 16, padding: '12px 14px', borderRadius: 8,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                  fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Quick Start</div>
                  <code style={{ display: 'block', padding: '8px', borderRadius: 4, background: 'var(--bg-elevated)', fontSize: 11, color: 'var(--accent-primary)' }}>
                    npm install{'\n'}
                    cp .env.example .env{'\n'}
                    # Add your ANTHROPIC_API_KEY to .env{'\n'}
                    npm start -- "Your input here"
                  </code>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface Diagnostic {
  agentId: string;
  nickname: string;
  severity: 'error' | 'warning' | 'tip';
  message: string;
  fix: string;
}

function analyzeLiveResults(steps: any[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const step of steps) {
    // Error: agent failed completely
    if (step.status === 'error') {
      const err = (step.error || '').toLowerCase();
      let message = `${step.nickname} failed to run.`;
      let fix = `Open ${step.nickname} and check its settings.`;

      if (err.includes('401') || err.includes('unauthorized') || err.includes('api key')) {
        message = `${step.nickname} couldn't connect to the AI service. Your API key may be missing or invalid.`;
        fix = 'Check that your API key is set up in your environment.';
      } else if (err.includes('timeout') || err.includes('timed out')) {
        message = `${step.nickname} took too long to respond and timed out.`;
        fix = `Try simplifying ${step.nickname}'s instructions or reducing the amount of text it needs to process.`;
      } else if (err.includes('rate') || err.includes('429')) {
        message = `${step.nickname} was rate-limited. Too many requests to the AI service.`;
        fix = 'Wait a minute and try again, or reduce the number of agents.';
      } else if (err.includes('model') || err.includes('not found')) {
        message = `${step.nickname} is configured to use a model that doesn't exist or isn't available.`;
        fix = `Open ${step.nickname} and change its model to a valid one.`;
      }

      diagnostics.push({ agentId: step.agentId, nickname: step.nickname, severity: 'error', message, fix });

      // Check for downstream impact
      if (step.downstreamAgents?.length > 0) {
        diagnostics.push({
          agentId: step.agentId, nickname: step.nickname, severity: 'warning',
          message: `Because ${step.nickname} failed, these agents never got their data: ${step.downstreamAgents.join(', ')}.`,
          fix: `Fix ${step.nickname} first, then run the test again.`,
        });
      }
    }

    // Warning: agent output is suspiciously short or generic
    if (step.status === 'success' && step.output) {
      const output = step.output as string;

      if (output.length < 50) {
        diagnostics.push({
          agentId: step.agentId, nickname: step.nickname, severity: 'warning',
          message: `${step.nickname} gave a very short response (${output.length} characters). It may not have enough instructions to work with.`,
          fix: `Open ${step.nickname} and add more detail to its Core Task and Instructions.`,
        });
      }

      if (output.includes('I\'d be happy to help') || output.includes('I can help') || output.includes('How can I assist')) {
        diagnostics.push({
          agentId: step.agentId, nickname: step.nickname, severity: 'tip',
          message: `${step.nickname} responded like a chatbot instead of doing its job. Its prompt may be too vague.`,
          fix: `Open ${step.nickname} and make its Core Task more specific. Tell it exactly what to produce, not just what its role is.`,
        });
      }

      if (output.includes('I don\'t have access') || output.includes('I cannot') || output.includes('I\'m unable')) {
        diagnostics.push({
          agentId: step.agentId, nickname: step.nickname, severity: 'tip',
          message: `${step.nickname} said it can't do what was asked. It may need different instructions or a connected data source.`,
          fix: `Open ${step.nickname} and review its Core Task. Make sure it's asking for something the AI can actually do without external tools.`,
        });
      }
    }

    // Slow agent
    if (step.durationMs > 15000) {
      diagnostics.push({
        agentId: step.agentId, nickname: step.nickname, severity: 'tip',
        message: `${step.nickname} took ${(step.durationMs / 1000).toFixed(0)} seconds. That's slow and could cause timeouts in production.`,
        fix: `Try simplifying ${step.nickname}'s instructions or switching it to a faster model.`,
      });
    }
  }

  // Check for agents that were skipped entirely
  for (const step of steps) {
    for (const downstream of step.downstreamAgents || []) {
      // downstream is a nickname, not ID, so we check by name
      const wasProcessed = steps.some((s: any) => s.nickname === downstream);
      if (!wasProcessed) {
        diagnostics.push({
          agentId: step.agentId, nickname: downstream, severity: 'warning',
          message: `${downstream} was supposed to receive data from ${step.nickname} but never ran.`,
          fix: `This usually means a previous agent failed or the swarm reached its processing limit. Check the agents above for errors.`,
        });
      }
    }
  }

  return diagnostics;
}

function DiagnosticsSection({ steps, onOpenAgent }: { steps: any[]; onOpenAgent?: (agentId: string) => void }) {
  const diagnostics = analyzeLiveResults(steps);
  if (diagnostics.length === 0) {
    return (
      <div style={{
        marginTop: 16, padding: '12px 14px', borderRadius: 8,
        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
        fontSize: 13, color: '#22c55e', textAlign: 'center',
      }}>
        All agents ran successfully. No issues detected.
      </div>
    );
  }

  const severityColors = {
    error: { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', color: '#f87171' },
    warning: { bg: 'rgba(251,191,36,0.08)', border: '#fbbf24', color: '#fbbf24' },
    tip: { bg: 'rgba(0,217,255,0.06)', border: 'var(--accent-primary)', color: 'var(--text-accent)' },
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        What To Fix ({diagnostics.length} {diagnostics.length === 1 ? 'issue' : 'issues'})
      </div>
      {diagnostics.map((d, i) => {
        const sc = severityColors[d.severity];
        return (
          <div key={i} style={{
            padding: '10px 14px', marginBottom: 6, borderRadius: 8,
            background: sc.bg, borderLeft: `3px solid ${sc.border}`,
          }}>
            <div style={{ fontSize: 12, color: sc.color, fontWeight: 600, marginBottom: 4 }}>
              {d.message}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {d.fix}
            </div>
            {onOpenAgent && (
              <button onClick={() => onOpenAgent(d.agentId)} style={{
                padding: '3px 10px', borderRadius: 4, border: `1px solid ${sc.border}`,
                background: 'transparent', color: sc.color, fontSize: 10, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-primary)',
              }}>Fix {d.nickname}</button>
            )}
          </div>
        );
      })}
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
