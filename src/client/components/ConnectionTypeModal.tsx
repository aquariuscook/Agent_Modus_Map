import React from 'react';
import type { RelationshipType } from '../../shared/types/index.js';

const types: Array<{ type: RelationshipType; label: string; color: string; description: string }> = [
  { type: 'dependsOn', label: 'Needs', color: 'var(--text-accent)', description: 'This agent needs information or services from the other agent to do its job' },
  { type: 'feedsInto', label: 'Sends data to', color: 'var(--accent-secondary)', description: 'This agent passes its results to the other agent for further work' },
  { type: 'collaboratesWith', label: 'Works with', color: '#fbbf24', description: 'These agents work together as equals, sharing information back and forth' },
  { type: 'canOverride', label: 'Can overrule', color: '#ef4444', description: 'This agent has the authority to change or block the other agent\'s decisions' },
];

interface ConnectionTypeModalProps {
  onSelect: (type: RelationshipType) => void;
  onCancel: () => void;
}

export function ConnectionTypeModal({ onSelect, onCancel }: ConnectionTypeModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '2px solid var(--border-accent)',
          borderRadius: 16,
          padding: 24,
          width: 340,
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ color: 'var(--text-accent)', fontSize: 16, marginBottom: 16, textAlign: 'center' }}>
          Select Relationship Type
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {types.map(t => (
            <button
              key={t.type}
              onClick={() => onSelect(t.type)}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: `2px solid ${t.color}40`,
                background: `${t.color}10`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = t.color;
                (e.currentTarget as HTMLButtonElement).style.background = `${t.color}20`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${t.color}40`;
                (e.currentTarget as HTMLButtonElement).style.background = `${t.color}10`;
              }}
            >
              <div style={{ color: t.color, fontWeight: 600, fontSize: 14 }}>{t.label}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>{t.description}</div>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '8px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
