import React, { useState, useEffect } from 'react';
import { listSwarms, createBlankSwarm, importFromCSV, getCSVTemplateUrl, getTemplates, instantiateTemplate, deleteSwarm, getAllResults, listInterviews } from '../api.js';
import { SettingsPanel } from './SettingsPanel.js';
import { ThemeToggle } from './ThemeToggle.js';
import { LogoWithText } from './Logo.js';
import { useTheme } from '../hooks/useTheme.js';
import type { Swarm } from '../../shared/types/index.js';
import type { TemplateInfo } from '../api.js';

interface DashboardProps {
  onOpenSwarm: (swarmId: string) => void;
  onStartInterview?: () => void;
  onResumeInterview?: (interviewId: string) => void;
  onShowPricing?: () => void;
  onShowLogin?: () => void;
}

type View = 'home' | 'templates' | 'csv';

function InputModal({ title, placeholder, defaultValue, onConfirm, onCancel }: {
  title: string; placeholder?: string; defaultValue?: string;
  onConfirm: (value: string) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue || '');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>{title}</div>
        <input
          value={value} onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && value.trim() && onConfirm(value.trim())}
          style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
          <button onClick={onCancel} style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)' }}>Cancel</button>
          <button onClick={() => value.trim() && onConfirm(value.trim())} style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent-primary)', color: 'var(--text-inverse)', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, opacity: value.trim() ? 1 : 0.4 }}>Create</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button onClick={onCancel} style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--status-error-strong, #dc2626)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{confirmLabel || 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

function SwarmExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', padding: 0,
          color: 'var(--accent-primary)', fontSize: 'var(--text-sm)',
          fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-primary)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
        What is a swarm?
      </button>
      {open && (
        <div style={{
          marginTop: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)',
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 560,
        }}>
          <p style={{ margin: '0 0 8px' }}>
            A swarm is a team of AI agents that work together on a task.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            Each agent has a specific job (like finding leads, writing emails, or qualifying prospects).
          </p>
          <p style={{ margin: 0 }}>
            You design the team, connect them, test them, then deploy.
          </p>
        </div>
      )}
    </div>
  );
}

export function Dashboard({ onOpenSwarm, onStartInterview, onResumeInterview, onShowPricing, onShowLogin }: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [view, setView] = useState<View>('home');
  const [nameModal, setNameModal] = useState<{ title: string; placeholder?: string; defaultValue?: string; onConfirm: (v: string) => void } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [creating, setCreating] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [csvName, setCsvName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [activeInterviews, setActiveInterviews] = useState<Array<{ id: string; phase: number; goal: string; updatedAt: string }>>([]);

  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    listSwarms().then(setSwarms).catch(err => { setLoadError('Could not connect to server. Make sure it\'s running.'); console.error(err); });
    getTemplates().then(setTemplates).catch(() => {});
    getAllResults().then(r => setRecentResults((r || []).slice(0, 5))).catch(() => {});
    listInterviews().then(interviews => {
      setActiveInterviews(interviews);
    }).catch(() => {});
  }, []);

  const handleCreateBlank = async () => {
    setNameModal({
      title: 'Name your swarm',
      placeholder: 'e.g. Customer Support Team',
      onConfirm: async (name) => {
        setNameModal(null);
        setCreating(true);
        try {
          const swarm = await createBlankSwarm(name);
          onOpenSwarm(swarm.id);
        } finally { setCreating(false); }
      }
    });
  };


  const handleInstantiateTemplate = async (templateId: string, name: string) => {
    setCreating(true);
    try {
      const swarm = await instantiateTemplate(templateId, name);
      onOpenSwarm(swarm.id);
    } finally { setCreating(false); }
  };

  const handleCSVImport = async () => {
    if (!csvData.trim() || !csvName.trim()) return;
    setCreating(true);
    try {
      const result = await importFromCSV(csvData, csvName.trim());
      onOpenSwarm(result.swarmId);
    } finally { setCreating(false); }
  };

  const domainColors: Record<string, string> = {
    Support: 'var(--gem-cyan-400)', Media: 'var(--gem-amethyst-400)',
    Engineering: 'var(--gem-amber-400)', Data: 'var(--gem-sapphire-400)',
    Security: 'var(--gem-ruby-400)', Research: 'var(--gem-sapphire-400)',
    Sales: 'var(--gem-cyan-400)', HR: 'var(--gem-emerald-400)',
  };

  return (
    <div style={{ minHeight: '100vh', padding: 'var(--space-10) var(--space-6)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--space-12)', paddingBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <LogoWithText size={36} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onShowPricing && (
              <button onClick={onShowPricing} style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-default)',
                background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-primary)',
              }}>Pricing</button>
            )}
            <button onClick={() => setSettingsOpen(true)} style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-default)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-primary)',
            }}>Settings</button>
            {onShowLogin && (
              <button onClick={onShowLogin} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)',
              }}>Sign In</button>
            )}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {view === 'home' && (
          <>
            {loadError && (
              <div style={{ padding: '16px 20px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#f87171', fontSize: 14 }}>{loadError}</div>
                <button onClick={() => window.location.reload()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #f87171', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>
              </div>
            )}

            {/* Hero */}
            <div style={{ marginBottom: 'var(--space-10)' }}>
              <h1 style={{
                fontSize: 'var(--text-4xl)', fontWeight: 800, color: 'var(--text-primary)',
                lineHeight: 1.2, letterSpacing: '-0.03em', marginBottom: 'var(--space-3)',
              }}>
                Design your agent swarm
              </h1>
              <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 560 }}>
                Build, connect, and monitor multi-agent AI systems. Start from scratch, use a template, or import your existing agents.
              </p>
            </div>

            {/* What is a swarm? explainer */}
            <SwarmExplainer />

            {/* Action Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
              <button onClick={onStartInterview} style={{
                ...cardBase, cursor: 'pointer', textAlign: 'left',
                borderColor: '#22c55e',
                boxShadow: '0 0 0 1px #22c55e, 0 0 20px rgba(34,197,94,0.1), inset 0 1px 0 rgba(255,255,255,0.03)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 'var(--space-3)' }}>&#10070;</div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Prompt to Agent</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Describe your goal, we build the swarm</div>
              </button>

              <button onClick={handleCreateBlank} disabled={creating} style={{
                ...cardBase, borderColor: 'var(--border-accent)',
                cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 0 0 1px var(--border-accent), inset 0 1px 0 rgba(255,255,255,0.03)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 'var(--space-3)' }}>+</div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Start from Scratch</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Build your own agents and swarms</div>
              </button>

              <button onClick={() => setView('templates')} style={{ ...cardBase, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 28, marginBottom: 'var(--space-3)' }}>&#9638;</div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Use a Template</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{templates.length} industry templates</div>
              </button>

              <button onClick={() => setView('csv')} style={{ ...cardBase, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 28, marginBottom: 'var(--space-3)' }}>&#8613;</div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Import CSV</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Upload a spreadsheet of agents</div>
              </button>
            </div>

            {/* In-Progress Interviews */}
            {activeInterviews.length > 0 && (
              <>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#22c55e', marginBottom: 'var(--space-4)',
                }}>Continue Building</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
                  {activeInterviews.map(interview => (
                    <button key={interview.id} onClick={() => onResumeInterview?.(interview.id)} style={{
                      ...cardBase, cursor: 'pointer', textAlign: 'left',
                      borderColor: '#22c55e', borderLeftWidth: 3,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {(interview as any).name || interview.goal || 'New interview'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {(interview as any).hasConfig ? 'Ready to deploy' : `Building, last updated ${new Date(interview.updatedAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: 'rgba(0,217,255,0.1)',
                        color: 'var(--accent-primary)',
                      }}>Continue</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Swarm List */}
            {swarms.length > 0 && (
              <>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 'var(--space-4)',
                }}>Your Swarms</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {swarms.map(s => (
                    <button key={s.id} onClick={() => onOpenSwarm(s.id)} style={{
                      ...cardBase, cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                      padding: 'var(--space-4) var(--space-5)',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 'var(--radius-md)',
                        background: 'var(--accent-primary-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0,
                      }}>
                        {s.agents.length > 0 ? s.agents.length : '+'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                        {s.description && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.description}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', flexShrink: 0 }}>
                        <span style={{ ...badgeStyle, background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)', borderColor: 'rgba(0,200,184,0.2)' }}>{s.agents.length} agents</span>
                        <span style={{ ...badgeStyle }}>{s.relationships.length} rel</span>
                        <span style={{ ...badgeStyle }}>{s.layers.length} layers</span>
                      </div>
                      <div style={{
                        width: 8, height: 8, borderRadius: 'var(--radius-full)',
                        background: 'var(--gem-emerald-400)', boxShadow: '0 0 6px var(--gem-emerald-500)',
                        flexShrink: 0,
                      }} />
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({
                            title: `Delete "${s.name}"?`,
                            message: 'This will permanently remove this swarm and all its agents. This cannot be undone.',
                            onConfirm: () => {
                              setConfirmModal(null);
                              deleteSwarm(s.id).then(() => setSwarms(swarms.filter(sw => sw.id !== s.id)));
                            }
                          });
                        }}
                        style={{
                          color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14,
                          padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                        }}
                        title="Delete swarm"
                      >X</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {swarms.length === 0 && (
              <div style={{
                textAlign: 'center', padding: 'var(--space-16) var(--space-8)',
                color: 'var(--text-tertiary)', fontSize: 'var(--text-base)',
                border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-lg)',
              }}>
                No swarms yet. Create one above to get started.
              </div>
            )}

            {/* Recent Results */}
            {recentResults.length > 0 && (
              <div style={{ marginTop: 'var(--space-10)' }}>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 'var(--space-4)',
                }}>Recent Results</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {recentResults.map((r: any) => {
                    const swarm = swarms.find(s => s.id === r.swarmId);
                    const swarmName = swarm?.name || 'Unknown Swarm';
                    const date = new Date(r.timestamp);
                    const isSuccess = r.status === 'success';
                    return (
                      <button key={r.id} onClick={() => onOpenSwarm(r.swarmId)} style={{
                        ...cardBase, cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                        padding: 'var(--space-3) var(--space-5)',
                      }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: 'var(--radius-full)', flexShrink: 0,
                          background: isSuccess ? '#22c55e' : '#ef4444',
                          boxShadow: isSuccess ? '0 0 6px rgba(34,197,94,0.5)' : '0 0 6px rgba(239,68,68,0.5)',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{swarmName}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', flexShrink: 0 }}>
                          <span style={{ ...badgeStyle }}>{r.agentsProcessed} agents</span>
                          <span style={{ ...badgeStyle }}>${(r.cost || 0).toFixed(4)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'templates' && (
          <>
            <button onClick={() => setView('home')} style={backBtn}>Back to Dashboard</button>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>Templates</div>
            <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-8)' }}>Choose a starting point</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {templates.map(t => {
                const color = domainColors[t.domain] || 'var(--text-secondary)';
                return (
                  <button key={t.id} onClick={() => {
                    setNameModal({
                      title: `Name your ${t.name} swarm`,
                      placeholder: `e.g. My ${t.name}`,
                      defaultValue: `My ${t.name}`,
                      onConfirm: (name) => { setNameModal(null); handleInstantiateTemplate(t.id, name); }
                    });
                  }} style={{ ...cardBase, cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color, marginTop: 2 }}>{t.domain}</div>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                        <div>{t.agentCount} agents</div>
                        <div>{t.layerCount} layers</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-3)' }}>{t.description}</div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      {t.tags.slice(0, 4).map(tag => (
                        <span key={tag} style={{ ...badgeStyle }}>{tag}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {view === 'csv' && (
          <>
            <button onClick={() => setView('home')} style={backBtn}>Back to Dashboard</button>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>Import</div>
            <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-8)' }}>Import from CSV</h2>

            <div style={{ ...cardBase, maxWidth: 600 }}>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <a href={getCSVTemplateUrl()} download style={{ color: 'var(--accent-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, textDecoration: 'none' }}>
                  Download CSV Template
                </a>
              </div>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={labelStyle}>Swarm Name</label>
                <input value={csvName} onChange={e => setCsvName(e.target.value)} placeholder="My Imported Swarm" style={inputStyle} />
              </div>
              <div style={{
                border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-8) var(--space-4)', textAlign: 'center', cursor: 'pointer',
                marginBottom: 'var(--space-3)', transition: 'border-color 0.2s',
              }} onClick={() => document.getElementById('csvFileInput3')?.click()}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>Click to upload CSV file</div>
              </div>
              <input type="file" id="csvFileInput3" accept=".csv" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) { const text = await file.text(); setCsvData(text); }
              }} />
              <textarea value={csvData} onChange={e => setCsvData(e.target.value)} placeholder="Or paste CSV data here..."
                style={{ ...inputStyle, minHeight: 120, fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 'var(--text-xs)' }} />
              <button onClick={handleCSVImport} disabled={creating || !csvData.trim() || !csvName.trim()} style={{
                ...btnPrimary, width: '100%', marginTop: 'var(--space-3)',
                opacity: (creating || !csvData.trim() || !csvName.trim()) ? 0.5 : 1,
              }}>
                {creating ? 'Importing...' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {nameModal && <InputModal {...nameModal} onCancel={() => setNameModal(null)} />}
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
    </div>
  );
}

// Shared inline styles using CSS variables
const cardBase: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: 'var(--font-primary)',
  color: 'var(--text-primary)',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 'var(--text-xs)', fontWeight: 500,
  padding: '3px var(--space-2)', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  fontFamily: 'var(--font-primary)',
};

const backBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--accent-primary)',
  cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 500,
  padding: 0, marginBottom: 'var(--space-6)',
  fontFamily: 'var(--font-primary)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)',
  marginBottom: 'var(--space-1)', display: 'block',
};

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)', background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)', width: '100%',
  outline: 'none', boxSizing: 'border-box', resize: 'vertical' as const,
};

const btnPrimary: React.CSSProperties = {
  fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)',
  fontWeight: 600, borderRadius: 'var(--radius-md)',
  cursor: 'pointer', border: 'none',
  background: 'var(--accent-primary)', color: 'var(--bg-base)',
  padding: 'var(--space-3) var(--space-5)',
};
