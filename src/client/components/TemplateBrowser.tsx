import React, { useState, useEffect } from 'react';
import { getTemplates, instantiateTemplate, createBlankSwarm, listSwarms, importFromCSV, getCSVTemplateUrl, type TemplateInfo } from '../api.js';
import type { Swarm } from '../../shared/types/index.js';

const domainColors: Record<string, string> = {
  'Support': '#00d9ff',
  'Media': '#a855f7',
  'Retail': '#22c55e',
  'Engineering': '#fb923c',
  'Logistics': '#fbbf24',
  'Data': '#06b6d4',
  'Security': '#ef4444',
  'Research': '#3b82f6',
  'Sales': '#06b6d4',
  'HR': '#3b82f6',
};

interface TemplateBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSwarmCreated: (swarmId: string) => void;
}

export function TemplateBrowser({ isOpen, onClose, onSwarmCreated }: TemplateBrowserProps) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [existingSwarms, setExistingSwarms] = useState<Swarm[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [mode, setMode] = useState<'choose' | 'blank' | 'template' | 'existing' | 'csv'>('choose');
  const [swarmName, setSwarmName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getTemplates().then(setTemplates).catch(console.error);
      listSwarms().then(setExistingSwarms).catch(console.error);
      setMode('choose');
      setSelectedTemplate(null);
      setSwarmName('');
    }
  }, [isOpen]);

  async function handleCreateBlank() {
    if (!swarmName.trim()) return;
    setCreating(true);
    try {
      const swarm = await createBlankSwarm(swarmName.trim());
      onSwarmCreated(swarm.id);
      onClose();
    } catch (err) {
      console.error('Failed to create blank swarm:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleCreate() {
    if (!selectedTemplate || !swarmName.trim()) return;
    setCreating(true);
    try {
      const swarm = await instantiateTemplate(selectedTemplate.id, swarmName.trim());
      onSwarmCreated(swarm.id);
      onClose();
    } catch (err) {
      console.error('Failed to create from template:', err);
    } finally {
      setCreating(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        border: '2px solid rgba(0, 217, 255, 0.3)',
        borderRadius: 20,
        padding: 30,
        width: 640,
        maxHeight: '80vh',
        overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ color: '#00d9ff', fontSize: 22, marginBottom: 8, textAlign: 'center' }}>
          {mode === 'choose' ? 'Create a Swarm' : mode === 'blank' ? 'Start from Scratch' : mode === 'existing' ? 'Open Existing' : 'Start from Template'}
        </h2>
        <p style={{ color: '#8b9dc3', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
          {mode === 'choose' ? 'Design from scratch, use a template, or open an existing swarm.' :
           mode === 'blank' ? 'Name your swarm and start with a blank canvas.' :
           mode === 'existing' ? 'Switch to a swarm you already created.' :
           'Choose a proven architecture and customize it for your needs.'}
        </p>

        {mode !== 'choose' && (
          <button onClick={() => setMode('choose')} style={{
            background: 'none', border: 'none', color: '#00d9ff', cursor: 'pointer',
            fontSize: 12, marginBottom: 16, padding: 0,
          }}>Back to options</button>
        )}

        {/* Choose mode */}
        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div onClick={() => setMode('blank')} style={{
              padding: 20, borderRadius: 14, border: '2px solid rgba(0,217,255,0.3)',
              background: 'rgba(0,217,255,0.05)', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#00d9ff' }}>Start from Scratch</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
                Blank canvas with 4 default layers. Add agents and connections as you design.
              </div>
            </div>

            <div onClick={() => setMode('template')} style={{
              padding: 20, borderRadius: 14, border: '2px solid rgba(168,85,247,0.3)',
              background: 'rgba(168,85,247,0.05)', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#a855f7' }}>Use a Template</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
                {templates.length} industry templates with pre-built agents and relationships.
              </div>
            </div>

            <div onClick={() => setMode('csv')} style={{
              padding: 20, borderRadius: 14, border: '2px solid rgba(251,191,36,0.3)',
              background: 'rgba(251,191,36,0.05)', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fbbf24' }}>Import from CSV</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
                Upload a spreadsheet with agent definitions, relationships, and config.
              </div>
            </div>

            {existingSwarms.length > 1 && (
              <div onClick={() => setMode('existing')} style={{
                padding: 20, borderRadius: 14, border: '2px solid rgba(34,197,94,0.3)',
                background: 'rgba(34,197,94,0.05)', cursor: 'pointer', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#22c55e' }}>Open Existing</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
                  {existingSwarms.length} swarms available. Switch to a different design.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Blank canvas mode */}
        {mode === 'blank' && (
          <div style={{ padding: 16, background: 'rgba(0,217,255,0.05)', borderRadius: 12 }}>
            <label style={{ fontSize: 12, color: '#8b9dc3', display: 'block', marginBottom: 6 }}>
              Name your swarm
            </label>
            <input
              value={swarmName}
              onChange={e => setSwarmName(e.target.value)}
              placeholder="My Agent Swarm"
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid rgba(0,217,255,0.3)', background: 'rgba(0,0,0,0.3)',
                color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
              You'll get 4 default layers: Interface, Processing, Intelligence, Operations. You can customize them later.
            </div>
            <button
              onClick={handleCreateBlank}
              disabled={creating || !swarmName.trim()}
              style={{
                width: '100%', marginTop: 12, padding: '12px', borderRadius: 10,
                border: 'none', background: '#00d9ff', color: '#0a0e27',
                fontWeight: 700, fontSize: 15, cursor: creating ? 'default' : 'pointer',
                opacity: creating || !swarmName.trim() ? 0.5 : 1,
              }}
            >
              {creating ? 'Creating...' : 'Create Blank Swarm'}
            </button>
          </div>
        )}

        {/* Existing swarms mode */}
        {mode === 'existing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {existingSwarms.map(s => (
              <div key={s.id} onClick={() => { onSwarmCreated(s.id); onClose(); }} style={{
                padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.agents.length} agents</div>
                </div>
                {s.description && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{s.description.slice(0, 100)}</div>}
              </div>
            ))}
          </div>
        )}

        {/* CSV import mode */}
        {mode === 'csv' && (
          <div>
            <div style={{ padding: 16, background: 'rgba(251,191,36,0.05)', borderRadius: 12, marginBottom: 16, border: '1px solid rgba(251,191,36,0.2)' }}>
              <div style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>CSV Format</div>
              <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
                Columns: Nickname, Emoji, Formal Name, Descriptor, Layer, Badges, Core Task, Inputs, Outputs, Depends On, Feeds Into, Collaborates With, Can Override
                <br />Use semicolons (;) to separate multiple values within a cell.
              </div>
              <a href={getCSVTemplateUrl()} download style={{ color: '#00d9ff', fontSize: 12, fontWeight: 600, marginTop: 8, display: 'inline-block' }}>
                Download CSV Template
              </a>
            </div>
            <label style={{ fontSize: 12, color: '#8b9dc3', display: 'block', marginBottom: 6 }}>Swarm Name</label>
            <input value={swarmName} onChange={e => setSwarmName(e.target.value)} placeholder="My Imported Swarm"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(0,217,255,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
            <div style={{
              border: '2px dashed rgba(251,191,36,0.4)', borderRadius: 12, padding: '40px 20px',
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s',
            }} onClick={() => document.getElementById('csvFileInput')?.click()}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📤</div>
              <div style={{ color: '#94a3b8', fontSize: 14 }}>Click to upload CSV file</div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>or paste CSV data below</div>
            </div>
            <input type="file" id="csvFileInput" accept=".csv" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !swarmName.trim()) return;
              const text = await file.text();
              setCreating(true);
              try {
                const result = await importFromCSV(text, swarmName.trim());
                onSwarmCreated(result.swarmId);
                onClose();
              } catch (err) { console.error(err); } finally { setCreating(false); }
            }} />
            <textarea placeholder="Or paste CSV data here..." style={{
              width: '100%', minHeight: 100, marginTop: 12, padding: '10px 14px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)',
              color: '#fff', fontSize: 12, fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }} id="csvPasteArea" />
            <button onClick={async () => {
              const text = (document.getElementById('csvPasteArea') as HTMLTextAreaElement)?.value;
              if (!text?.trim() || !swarmName.trim()) return;
              setCreating(true);
              try {
                const result = await importFromCSV(text, swarmName.trim());
                onSwarmCreated(result.swarmId);
                onClose();
              } catch (err) { console.error(err); } finally { setCreating(false); }
            }} disabled={creating} style={{
              width: '100%', marginTop: 12, padding: '12px', borderRadius: 10, border: 'none',
              background: '#fbbf24', color: '#0a0e27', fontWeight: 700, fontSize: 15,
              cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.5 : 1,
            }}>
              {creating ? 'Importing...' : 'Import from Pasted CSV'}
            </button>
          </div>
        )}

        {/* Template mode */}
        {mode === 'template' && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {templates.map(template => {
            const color = domainColors[template.domain] || '#8b9dc3';
            const isSelected = selectedTemplate?.id === template.id;

            return (
              <div
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  setSwarmName(`My ${template.name}`);
                }}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  border: `2px solid ${isSelected ? color : 'rgba(255,255,255,0.08)'}`,
                  background: isSelected ? `${color}10` : 'rgba(255, 255, 255, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>{template.name}</div>
                    <div style={{ fontSize: 12, color, marginTop: 2 }}>{template.domain}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#8b9dc3' }}>{template.agentCount} agents</div>
                    <div style={{ fontSize: 12, color: '#8b9dc3' }}>{template.layerCount} layers</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#a0aec0', marginTop: 8, lineHeight: 1.4 }}>
                  {template.description}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {template.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)', color: '#8b9dc3',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>}

        {mode === 'template' && selectedTemplate && (
          <div style={{ marginTop: 20, padding: 16, background: 'rgba(0,217,255,0.05)', borderRadius: 12 }}>
            <label style={{ fontSize: 12, color: '#8b9dc3', display: 'block', marginBottom: 6 }}>
              Name your swarm
            </label>
            <input
              value={swarmName}
              onChange={e => setSwarmName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(0, 217, 255, 0.3)',
                background: 'rgba(0, 0, 0, 0.3)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !swarmName.trim()}
              style={{
                width: '100%',
                marginTop: 12,
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                background: '#00d9ff',
                color: '#0a0e27',
                fontWeight: 700,
                fontSize: 15,
                cursor: creating ? 'default' : 'pointer',
                opacity: creating || !swarmName.trim() ? 0.5 : 1,
              }}
            >
              {creating ? 'Creating...' : `Create from ${selectedTemplate.name}`}
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: '#8b9dc3',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
