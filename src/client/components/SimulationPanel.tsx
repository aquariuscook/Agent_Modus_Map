import React, { useState, useEffect, useCallback, useRef } from 'react';
import { runSimulation, getSwarmCostEstimate, runLiveTestStreaming, getSwarmPackage, deploySwarm as apiDeploySwarm, pauseDeployment, resumeDeployment, stopDeployment, getDeployStatus, getDeployResults } from '../api.js';

function linkifyText(text: string): string {
  // Escape HTML first to prevent XSS
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Make URLs clickable
  return escaped.replace(
    /(https?:\/\/[^\s)<>,]+)/g,
    '<a href="$1" target="_blank" rel="noopener" style="color: var(--accent-primary); text-decoration: underline;">$1</a>'
  );
}

// Shared helper functions for copy/download (used by both SimulationPanel and DeployTab)
function doCopyResults(result: any, type: 'mock' | 'live'): void {
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
}

function doCopyLeadSheet(result: any): void {
  if (!result) return;
  const scoutStep = result.steps?.find((s: any) => s.nickname === 'Scout');
  const profileStep = result.steps?.find((s: any) => s.nickname === 'Profile');
  const qualifyStep = result.steps?.find((s: any) => s.nickname === 'Qualify');
  const combined = [scoutStep?.output, profileStep?.output, qualifyStep?.output].filter(Boolean).join('\n');

  const urls = combined.match(/https?:\/\/[^\s)>\]|,]+/g) || [];
  const emails = combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const phones = combined.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];

  const lines: string[] = [];
  lines.push('Company\tWebsite\tContact\tPhone\tEmail\tScore\tNotes');
  lines.push('---\t---\t---\t---\t---\t---\t---');

  const scoutText = scoutStep?.output || '';
  const companyMatches = scoutText.match(/\*\*\d+\.\s+([^|*]+)/g) || [];
  for (const match of companyMatches) {
    const name = match.replace(/\*\*\d+\.\s+/, '').replace(/\*\*/g, '').trim();
    const urlForCompany = urls.find((u: string) => u.toLowerCase().includes(name.split(/\s/)[0].toLowerCase())) || '';
    lines.push(`${name}\t${urlForCompany}\t\t${phones[0] || ''}\t${emails[0] || ''}\t\t`);
  }

  if (companyMatches.length === 0) {
    lines.push('(Could not auto-extract companies. See full report for details.)');
  }

  lines.push('');
  lines.push('All URLs found:');
  for (const url of [...new Set(urls)]) lines.push(url);
  if (emails.length) { lines.push(''); lines.push('Emails found:'); for (const e of [...new Set(emails)]) lines.push(e); }
  if (phones.length) { lines.push(''); lines.push('Phones found:'); for (const p of [...new Set(phones)]) lines.push(p); }

  navigator.clipboard.writeText(lines.join('\n'));
}

function doDownloadReport(result: any): void {
  if (!result) return;
  const lines: string[] = [];
  lines.push('# Swarm Test Report');
  lines.push(`**Date:** ${new Date().toLocaleDateString()}`);
  lines.push(`**Duration:** ${(result.totalDurationMs / 1000).toFixed(1)}s | **Cost:** $${result.totalCost || '0'} | **Tokens:** ${((result.totalInputTokens || 0) + (result.totalOutputTokens || 0)).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  for (const step of result.steps || []) {
    lines.push(`## ${step.nickname}`);
    lines.push(`**Status:** ${step.status} | **Duration:** ${step.durationMs}ms | **Cost:** $${step.cost || '0'}`);
    lines.push('');
    lines.push(step.output || step.error || '(no output)');
    lines.push('');
    if (step.downstreamAgents?.length) lines.push(`*Passes to: ${step.downstreamAgents.join(', ')}*`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `swarm-report-${new Date().toISOString().split('T')[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  swarmId: string;
  isOpen: boolean;
  onToggle: () => void;
  onOpenAgent?: (agentId: string) => void;
  defaultTab?: Tab;
}

type Tab = 'simulate' | 'cost' | 'live' | 'deploy';

export function SimulationPanel({ swarmId, isOpen, onToggle, onOpenAgent, defaultTab }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab || 'simulate');
  const prevDefaultTab = React.useRef(defaultTab);

  // Only update tab when defaultTab actually changes (not on every render)
  useEffect(() => {
    if (defaultTab && defaultTab !== prevDefaultTab.current) {
      setTab(defaultTab);
      prevDefaultTab.current = defaultTab;
    }
  }, [defaultTab]);
  const [simResult, setSimResult] = useState<any>(null);
  const [costResult, setCostResult] = useState<any>(null);
  const [liveResult, setLiveResult] = useState<any>(null);
  const [swarmPackage, setSwarmPackage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sampleInput, setSampleInput] = useState('');
  const [liveInput, setLiveInput] = useState('');
  const [liveProgress, setLiveProgress] = useState<{ agent: string; step: number; total: number } | null>(null);
  const [callsPerDay, setCallsPerDay] = useState('');
  const [deployQuery, setDeployQuery] = useState(() => localStorage.getItem('agent-modus-deploy-query') || '');

  const handleDeployQueryChange = useCallback((q: string) => {
    setDeployQuery(q);
    localStorage.setItem('agent-modus-deploy-query', q);
  }, []);

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
    doCopyResults(result, type);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadReport(result: any) {
    doDownloadReport(result);
  }

  function copyLeadSheet(result: any) {
    doCopyLeadSheet(result);
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
    <><div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999,
    }} onClick={onToggle} />
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 560, maxHeight: '85vh',
      background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 16,
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
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

                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button onClick={() => copyResults(liveResult, 'live')} style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-default)',
                    background: 'transparent', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-primary)',
                  }}>{copied ? 'Copied!' : 'Copy All'}</button>
                  <button onClick={() => copyLeadSheet(liveResult)} style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--accent-secondary, #a855f7)',
                    background: 'transparent', color: 'var(--accent-secondary, #a855f7)', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-primary)',
                  }}>Copy Leads</button>
                  <button onClick={() => downloadReport(liveResult)} style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-default)',
                    background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-primary)',
                  }}>Download</button>
                </div>

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
                        maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap',
                        padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elevated)',
                      }}
                        dangerouslySetInnerHTML={{ __html: linkifyText(step.output || '') }}
                      />
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

        {tab === 'deploy' && <DeployTab swarmId={swarmId} query={deployQuery} onQueryChange={handleDeployQueryChange} />}
      </div>
    </div>
    </>
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

const DeployTab = React.memo(function DeployTab({ swarmId, query, onQueryChange }: { swarmId: string; query: string; onQueryChange: (q: string) => void }) {
  const [schedule, setSchedule] = useState<string>('once');
  const [budget, setBudget] = useState('1.00');
  const [deployStatus, setDeployStatus] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [copiedBtn, setCopiedBtn] = useState<string | null>(null);
  const queryPrefilledRef = useRef(false);

  function copyResults(result: any, type: 'mock' | 'live') {
    doCopyResults(result, type);
    setCopiedBtn('all');
    setTimeout(() => setCopiedBtn(null), 2000);
  }

  function copyLeadSheet(result: any) {
    doCopyLeadSheet(result);
    setCopiedBtn('leads');
    setTimeout(() => setCopiedBtn(null), 2000);
  }

  function downloadReport(result: any) {
    doDownloadReport(result);
    setCopiedBtn('download');
    setTimeout(() => setCopiedBtn(null), 2000);
  }

  const lastStatusJson = useRef('');
  const lastResultsJson = useRef('');

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getDeployStatus(swarmId);
      const statusJson = JSON.stringify(status);
      if (statusJson !== lastStatusJson.current) {
        lastStatusJson.current = statusJson;
        setDeployStatus(status);
        if (status?.query && !queryPrefilledRef.current) {
          onQueryChange(status.query);
          queryPrefilledRef.current = true;
        }
      }
      const history = await getDeployResults(swarmId);
      const historyJson = JSON.stringify(history?.length || 0);
      if (historyJson !== lastResultsJson.current) {
        lastResultsJson.current = historyJson;
        setResults(history || []);
      }
    } catch { /* no deployment yet */ }
  }, [swarmId]);

  // Load status once on mount
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      refreshStatus();
    }
  }, []);

  // Poll for status only when actively running
  useEffect(() => {
    if (!deployStatus || deployStatus.status !== 'running') return;
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [deployStatus?.status]);

  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDeploy() {
    if (!query.trim()) return;
    setShowConfirm(false);
    setDeploying(true);
    try {
      const result = await apiDeploySwarm(swarmId, query.trim(), schedule, budget ? Number(budget) : undefined);
      setDeployStatus(result);
      setTimeout(refreshStatus, 3000); // refresh after first run likely completes
    } catch (err: any) {
      setDeployStatus({ status: 'error', error: err.message, runCount: 0, totalCost: 0, budgetLimit: null } as any);
    } finally { setDeploying(false); }
  }

  const isRunning = deployStatus?.status === 'running';
  const isPaused = deployStatus?.status === 'paused';
  const isStopped = !deployStatus || ['stopped', 'completed', 'budget_reached', 'error'].includes(deployStatus.status);

  const statusColors: Record<string, string> = {
    running: '#22c55e', paused: '#fbbf24', stopped: 'var(--text-tertiary)',
    completed: 'var(--accent-primary)', error: '#ef4444', budget_reached: '#fbbf24',
  };
  const statusLabels: Record<string, string> = {
    running: 'Running', paused: 'Paused', stopped: 'Stopped',
    completed: 'Completed', error: 'Error', budget_reached: 'Budget Reached',
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        Deploy this swarm to run inside the app. Set a query, schedule, and budget limit. Results accumulate here.
      </div>

      {/* Status bar */}
      {deployStatus && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          padding: '10px 14px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColors[deployStatus.status] || 'var(--text-tertiary)', animation: isRunning ? 'healthPulse 2s ease-in-out infinite' : 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{statusLabels[deployStatus.status] || deployStatus.status}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {deployStatus.runCount} runs, ${deployStatus.totalCost?.toFixed(4) || '0'} spent
              {deployStatus.budgetLimit ? ` / $${deployStatus.budgetLimit} limit` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {isRunning && <button onClick={async () => { await pauseDeployment(swarmId); refreshStatus(); }} style={ctrlBtn}>Pause</button>}
            {isPaused && <button onClick={async () => { await resumeDeployment(swarmId); refreshStatus(); }} style={{ ...ctrlBtn, color: '#22c55e', borderColor: '#22c55e' }}>Resume</button>}
            {(isRunning || isPaused) && <button onClick={async () => { await stopDeployment(swarmId); refreshStatus(); }} style={{ ...ctrlBtn, color: '#ef4444', borderColor: '#ef4444' }}>Stop</button>}
          </div>
        </div>
      )}

      {/* Deploy form */}
      {isStopped && (
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>What should this swarm do?</div>
          <textarea
            value={query} onChange={e => onQueryChange(e.target.value)}
            placeholder="e.g. Find medium-sized companies on Long Island that need AI training..."
            style={{
              width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
              color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-primary)',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>How often?</div>
              <select value={schedule} onChange={e => setSchedule(e.target.value)} style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13,
                fontFamily: 'var(--font-primary)', cursor: 'pointer',
              }}>
                <option value="once">Run once</option>
                <option value="hourly">Every hour</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Budget limit ($)</div>
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} step="0.50" min="0.10"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-default)',
                  background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13,
                  fontFamily: 'var(--font-primary)', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <button onClick={() => setShowConfirm(true)} disabled={deploying || !query.trim()} style={{
            marginTop: 16, padding: '12px 24px', borderRadius: 8, border: 'none',
            background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: deploying || !query.trim() ? 'default' : 'pointer',
            fontFamily: 'var(--font-primary)', opacity: deploying || !query.trim() ? 0.4 : 1,
            width: '100%',
          }}>{deploying ? 'Deploying...' : 'Deploy Swarm'}</button>

          {showConfirm && (
            <div style={{
              marginTop: 12, padding: '14px 16px', borderRadius: 8,
              background: 'var(--status-warn-bg, rgba(245,158,11,0.1))',
              border: '1px solid var(--status-warn-strong, #d97706)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                This will use API credits
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                Each run costs approximately $0.03-0.05. Your budget limit is set to ${budget || '1.00'}.
                {schedule !== 'once' && ` It will run ${schedule} until you stop it or the budget is reached.`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 12 }}>Cancel</button>
                <button onClick={handleDeploy} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 12, fontWeight: 600 }}>Confirm Deploy</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results history */}
      {results.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Results ({results.length})
          </div>
          {results.map((run: any, i: number) => (
            <details key={run.id || i} style={{
              marginBottom: 6, borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)', overflow: 'hidden',
            }}>
              <summary style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                color: 'var(--text-primary)',
              }}>
                <span>
                  <span style={{ color: run.status === 'success' ? '#22c55e' : '#ef4444', marginRight: 6 }}>{'●'}</span>
                  Run #{results.length - i} - {new Date(run.timestamp).toLocaleString()}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {run.agentsProcessed} agents, ${run.cost?.toFixed(4) || '0'}
                </span>
              </summary>
              <div style={{ padding: '0 14px 14px', maxHeight: 400, overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button onClick={() => { const r = { steps: run.steps, totalDurationMs: run.durationMs, totalCost: run.cost, totalInputTokens: run.totalTokens, totalOutputTokens: 0, status: run.status }; downloadReport(r); }} style={{ ...ctrlBtn, flex: 1 }}>{copiedBtn === 'download' ? 'Downloaded!' : 'Download'}</button>
                  <button onClick={() => { const r = { steps: run.steps }; copyLeadSheet(r); }} style={{ ...ctrlBtn, flex: 1, color: 'var(--accent-secondary, #a855f7)', borderColor: 'var(--accent-secondary, #a855f7)' }}>{copiedBtn === 'leads' ? 'Copied!' : 'Copy Leads'}</button>
                  <button onClick={() => { const r = { steps: run.steps, totalDurationMs: run.durationMs, totalCost: run.cost, totalInputTokens: run.totalTokens, totalOutputTokens: 0, agentsProcessed: run.agentsProcessed, status: run.status }; copyResults(r, 'live'); }} style={{ ...ctrlBtn, flex: 1 }}>{copiedBtn === 'all' ? 'Copied!' : 'Copy All'}</button>
                </div>
                {run.error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{run.error}</div>}
                {(run.steps || []).map((step: any, j: number) => (
                  <div key={j} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{step.nickname}</div>
                    <div style={{
                      fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5,
                      maxHeight: 100, overflowY: 'auto', whiteSpace: 'pre-wrap',
                      padding: '6px 8px', borderRadius: 4, background: 'var(--bg-elevated)', marginTop: 4,
                    }} dangerouslySetInnerHTML={{ __html: linkifyText((step.output || step.error || '').slice(0, 500)) }} />
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
});

const ctrlBtn: React.CSSProperties = {
  padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
  border: '1px solid var(--border-default)', background: 'transparent',
  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-primary)',
};

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
