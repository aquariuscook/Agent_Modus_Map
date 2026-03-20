import React, { useState, useEffect } from 'react';
import type { Agent, Badge, LayerDefinition } from '../../shared/types/index.js';

const ALL_BADGES: Badge[] = [
  'HUB', 'CRITICAL', 'ENTRY', 'AUTO', 'HUMAN', 'APPROVAL',
  'ALWAYS_ON', 'ADVISORY', 'CAN_OVERRIDE', 'HIGH_PRIORITY', 'MEDIUM', 'LOGS_ALL',
];

interface PropertyEditorProps {
  agent: Agent;
  layers: LayerDefinition[];
  onSave: (agentId: string, changes: Partial<Agent>) => void;
  onDelete: (agentId: string) => void;
  onClose: () => void;
  dependentCount: number;
}

export function PropertyEditor({ agent, layers, onSave, onDelete, onClose, dependentCount }: PropertyEditorProps) {
  const [nickname, setNickname] = useState(agent.nickname);
  const [formalName, setFormalName] = useState(agent.formalName);
  const [descriptor, setDescriptor] = useState(agent.descriptor);
  const [layerId, setLayerId] = useState(agent.layerId);
  const [badges, setBadges] = useState<Badge[]>(agent.badges);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setNickname(agent.nickname);
    setFormalName(agent.formalName);
    setDescriptor(agent.descriptor);
    setLayerId(agent.layerId);
    setBadges(agent.badges);
    setDirty(false);
    setConfirmDelete(false);
  }, [agent.id]);

  function markDirty() { setDirty(true); }

  function handleSave() {
    onSave(agent.id, { nickname, formalName, descriptor, layerId, badges });
    setDirty(false);
  }

  function toggleBadge(badge: Badge) {
    setBadges(prev => prev.includes(badge) ? prev.filter(b => b !== badge) : [...prev, badge]);
    markDirty();
  }

  const layer = layers.find(l => l.id === layerId);
  const borderColor = layer?.colorTheme || '#00d9ff';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    marginTop: 4,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#8b9dc3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    display: 'block',
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: 300,
      height: '100%',
      background: 'rgba(15, 23, 42, 0.97)',
      borderLeft: `2px solid ${borderColor}`,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideIn 0.2s ease',
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Edit Agent</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#8b9dc3', cursor: 'pointer', fontSize: 18,
        }}>{'\u00D7'}</button>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        <label style={labelStyle}>Nickname</label>
        <input value={nickname} onChange={e => { setNickname(e.target.value); markDirty(); }} style={inputStyle} />

        <label style={labelStyle}>Formal Name</label>
        <input value={formalName} onChange={e => { setFormalName(e.target.value); markDirty(); }} style={inputStyle} />

        <label style={labelStyle}>Descriptor</label>
        <input value={descriptor} onChange={e => { setDescriptor(e.target.value); markDirty(); }} style={inputStyle} />

        <label style={labelStyle}>Layer</label>
        <select
          value={layerId}
          onChange={e => { setLayerId(e.target.value); markDirty(); }}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {layers.map(l => (
            <option key={l.id} value={l.id} style={{ background: '#1e293b' }}>{l.name}</option>
          ))}
        </select>

        <label style={labelStyle}>Badges</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {ALL_BADGES.slice(0, showAdvanced ? ALL_BADGES.length : 6).map(badge => (
            <button
              key={badge}
              onClick={() => toggleBadge(badge)}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 8,
                border: `1px solid ${badges.includes(badge) ? borderColor : 'rgba(255,255,255,0.15)'}`,
                background: badges.includes(badge) ? `${borderColor}25` : 'transparent',
                color: badges.includes(badge) ? '#fff' : '#8b9dc3',
                cursor: 'pointer',
              }}
            >
              {badge.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Advanced toggle (ADR-006) */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            marginTop: 12,
            background: 'none',
            border: 'none',
            color: '#00d9ff',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
        </button>

        {showAdvanced && (
          <div style={{ marginTop: 10, padding: 10, background: 'rgba(0,217,255,0.04)', borderRadius: 8 }}>
            <label style={labelStyle}>Agent ID</label>
            <div style={{ fontSize: 11, color: '#a0aec0', fontFamily: 'monospace', marginTop: 4 }}>{agent.id}</div>

            <label style={labelStyle}>Position</label>
            <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 4 }}>
              x: {Math.round(agent.position.x)}, y: {Math.round(agent.position.y)}
            </div>

            <label style={labelStyle}>All Badges</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {ALL_BADGES.slice(6).map(badge => (
                <button
                  key={badge}
                  onClick={() => toggleBadge(badge)}
                  style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 8,
                    border: `1px solid ${badges.includes(badge) ? borderColor : 'rgba(255,255,255,0.15)'}`,
                    background: badges.includes(badge) ? `${borderColor}25` : 'transparent',
                    color: badges.includes(badge) ? '#fff' : '#8b9dc3',
                    cursor: 'pointer',
                  }}
                >
                  {badge.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dirty && (
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#00d9ff',
              color: '#0a0e27',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Save Changes
          </button>
        )}

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Delete Agent
          </button>
        ) : (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 8, border: '1px solid #ef4444' }}>
            {dependentCount > 0 && (
              <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>
                Warning: {dependentCount} agent{dependentCount > 1 ? 's' : ''} depend on this agent. Deleting it will remove those relationships.
              </div>
            )}
            <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>
              Delete "{agent.nickname}" permanently?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onDelete(agent.id)}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none',
                  background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent', color: '#8b9dc3', cursor: 'pointer', fontSize: 12,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
