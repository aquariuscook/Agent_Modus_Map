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
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [csvName, setCsvName] = useState('');

  useEffect(() => {
    listSwarms().then(setSwarms).catch(console.error);
    getTemplates().then(setTemplates).catch(console.error);
  }, []);

  const handleCreateBlank = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const swarm = await createBlankSwarm(newName.trim());
      onOpenSwarm(swarm.id);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleInstantiateTemplate = async (templateId: string, name: string) => {
    setCreating(true);
    try {
      const swarm = await instantiateTemplate(templateId, name);
      onOpenSwarm(swarm.id);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleCSVImport = async () => {
    if (!csvData.trim() || !csvName.trim()) return;
    setCreating(true);
    try {
      const result = await importFromCSV(csvData, csvName.trim());
      onOpenSwarm(result.swarmId);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const domainColors: Record<string, string> = {
    Support: '#00d9ff', Media: '#a855f7', Engineering: '#fb923c', Data: '#06b6d4',
    Security: '#ef4444', Research: '#3b82f6', Sales: '#06b6d4', HR: '#3b82f6',
  };

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-16)', paddingBottom: 'var(--space-6)', borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <h1 style={{
              color: 'var(--text-primary)', fontSize: 'var(--text-xl)', fontWeight: 700,
              letterSpacing: '-0.02em', margin: 0,
            }}>Agent<span style={{ color: 'var(--accent-primary)' }}>Modus</span></h1>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-10)' }}>
          Design, monitor, and optimize multi-agent swarms
        </p>

        {view === 'home' && (
          <>
            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
              <ActionCard
                title="Start from Scratch"
                description="Blank canvas with default layers"
                color="#00d9ff"
                onClick={() => {
                  const name = prompt('Name your swarm:');
                  if (name) { setNewName(name); createBlankSwarm(name).then(s => onOpenSwarm(s.id)); }
                }}
              />
              <ActionCard
                title="Use a Template"
                description={`${templates.length} industry templates`}
                color="#a855f7"
                onClick={() => setView('templates')}
              />
              <ActionCard
                title="Import CSV"
                description="Upload a spreadsheet of agents"
                color="#fbbf24"
                onClick={() => setView('csv')}
              />
            </div>

            {/* Existing Swarms */}
            <h2 style={{ color: '#e2e8f0', fontSize: 20, marginBottom: 16 }}>Your Swarms</h2>
            {swarms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 15 }}>
                No swarms yet. Create one above to get started.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {swarms.map(s => (
                  <div key={s.id} onClick={() => onOpenSwarm(s.id)} style={{
                    padding: 20, borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                    background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                    border: '2px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>{s.name}</div>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', background: '#22c55e',
                        boxShadow: '0 0 6px #22c55e',
                      }} />
                    </div>
                    {s.description && (
                      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10, lineHeight: 1.4 }}>
                        {s.description.slice(0, 120)}{s.description.length > 120 ? '...' : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}>
                      <span>{s.agents.length} agents</span>
                      <span>{s.relationships.length} relationships</span>
                      <span>{s.layers.length} layers</span>
                    </div>
                    {s.templateSource && (
                      <div style={{ fontSize: 11, color: '#00d9ff', marginTop: 6 }}>
                        From: {s.templateSource}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'templates' && (
          <>
            <button onClick={() => setView('home')} style={{
              background: 'none', border: 'none', color: '#00d9ff', cursor: 'pointer',
              fontSize: 13, marginBottom: 20, padding: 0,
            }}>Back to Dashboard</button>

            <h2 style={{ color: '#e2e8f0', fontSize: 20, marginBottom: 16 }}>Choose a Template</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {templates.map(t => {
                const color = domainColors[t.domain] || '#8b9dc3';
                return (
                  <div key={t.id} onClick={() => {
                    const name = prompt(`Name your ${t.name} swarm:`, `My ${t.name}`);
                    if (name) handleInstantiateTemplate(t.id, name);
                  }} style={{
                    padding: 20, borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                    background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                    border: `2px solid ${color}30`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>{t.name}</div>
                        <div style={{ fontSize: 12, color, marginTop: 2 }}>{t.domain}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                        <div>{t.agentCount} agents</div>
                        <div>{t.layerCount} layers</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 10, lineHeight: 1.4 }}>{t.description}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {t.tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.06)', color: '#8b9dc3',
                        }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view === 'csv' && (
          <>
            <button onClick={() => setView('home')} style={{
              background: 'none', border: 'none', color: '#00d9ff', cursor: 'pointer',
              fontSize: 13, marginBottom: 20, padding: 0,
            }}>Back to Dashboard</button>

            <h2 style={{ color: '#e2e8f0', fontSize: 20, marginBottom: 16 }}>Import from CSV</h2>
            <div style={{
              padding: 20, borderRadius: 14,
              background: 'linear-gradient(145deg, #1e293b, #0f172a)',
              border: '2px solid rgba(251,191,36,0.2)',
            }}>
              <div style={{ marginBottom: 16 }}>
                <a href={getCSVTemplateUrl()} download style={{ color: '#00d9ff', fontSize: 13, fontWeight: 600 }}>
                  Download CSV Template
                </a>
              </div>
              <label style={{ fontSize: 12, color: '#8b9dc3', display: 'block', marginBottom: 6 }}>Swarm Name</label>
              <input value={csvName} onChange={e => setCsvName(e.target.value)} placeholder="My Imported Swarm"
                style={inputStyle} />
              <label style={{ fontSize: 12, color: '#8b9dc3', display: 'block', marginTop: 12, marginBottom: 6 }}>Upload or Paste CSV</label>
              <div style={{
                border: '2px dashed rgba(251,191,36,0.3)', borderRadius: 10, padding: '30px 16px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 12,
              }} onClick={() => document.getElementById('csvFileInput2')?.click()}>
                <div style={{ color: '#94a3b8', fontSize: 14 }}>Click to upload CSV file</div>
              </div>
              <input type="file" id="csvFileInput2" accept=".csv" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) { const text = await file.text(); setCsvData(text); }
              }} />
              <textarea value={csvData} onChange={e => setCsvData(e.target.value)} placeholder="Or paste CSV data here..."
                style={{ ...inputStyle, minHeight: 120, fontFamily: 'monospace', fontSize: 11 }} />
              <button onClick={handleCSVImport} disabled={creating || !csvData.trim() || !csvName.trim()} style={{
                width: '100%', marginTop: 12, padding: 12, borderRadius: 10, border: 'none',
                background: '#fbbf24', color: '#0a0e27', fontWeight: 700, fontSize: 15,
                cursor: creating ? 'default' : 'pointer', opacity: (creating || !csvData.trim() || !csvName.trim()) ? 0.5 : 1,
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

function ActionCard({ title, description, color, onClick }: { title: string; description: string; color: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.2s',
      background: 'var(--bg-surface)',
      border: `1px solid var(--border-default)`, textAlign: 'center',
    }}>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color }}>{title}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>{description}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box',
  resize: 'vertical' as const, fontFamily: 'var(--font-primary)',
};
