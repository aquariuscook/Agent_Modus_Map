import React, { useState, useEffect } from 'react';
import { getTemplates, instantiateTemplate, type TemplateInfo } from '../api.js';

const domainColors: Record<string, string> = {
  'Support': '#00d9ff',
  'Media': '#a855f7',
  'Retail': '#22c55e',
  'Engineering': '#fb923c',
  'Logistics': '#fbbf24',
};

interface TemplateBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSwarmCreated: (swarmId: string) => void;
}

export function TemplateBrowser({ isOpen, onClose, onSwarmCreated }: TemplateBrowserProps) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [swarmName, setSwarmName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getTemplates().then(setTemplates).catch(console.error);
    }
  }, [isOpen]);

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
          Start from a Template
        </h2>
        <p style={{ color: '#8b9dc3', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
          Choose a proven architecture and customize it for your needs.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        </div>

        {selectedTemplate && (
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
