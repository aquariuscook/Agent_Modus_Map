import React, { useState, useEffect } from 'react';
import { listSwarms, createBlankSwarm, importFromCSV, getCSVTemplateUrl, getTemplates, instantiateTemplate } from '../api.js';
import { ThemeToggle } from './ThemeToggle.js';
import { useTheme } from '../hooks/useTheme.js';
import type { Swarm } from '../../shared/types/index.js';
import type { TemplateInfo } from '../api.js';

interface DashboardProps {
  onOpenSwarm: (swarmId: string) => void;
}

type View = 'home' | 'templates' | 'csv';

export function Dashboard({ onOpenSwarm }: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [view, setView] = useState<View>('home');
  const [creating, setCreating] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [csvName, setCsvName] = useState('');

  useEffect(() => {
    listSwarms().then(setSwarms).catch(console.error);
    getTemplates().then(setTemplates).catch(console.error);
  }, []);

  const handleCreateBlank = async () => {
    const name = prompt('Name your swarm:');
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const swarm = await createBlankSwarm(name.trim());
      onOpenSwarm(swarm.id);
    } finally { setCreating(false); }
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
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Agent<span style={{ color: 'var(--accent-primary)' }}>Modus</span>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>

        {view === 'home' && (
          <>
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

            {/* Action Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
              <button onClick={handleCreateBlank} disabled={creating} style={{
                ...cardBase, borderColor: 'var(--border-accent)',
                cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 0 0 1px var(--border-accent), inset 0 1px 0 rgba(255,255,255,0.03)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 'var(--space-3)' }}>+</div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Start from Scratch</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Blank canvas with default layers</div>
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
                    const name = prompt(`Name your ${t.name} swarm:`, `My ${t.name}`);
                    if (name) handleInstantiateTemplate(t.id, name);
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
