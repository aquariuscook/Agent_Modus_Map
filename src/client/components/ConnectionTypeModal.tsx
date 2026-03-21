import React from 'react';
import type { RelationshipType } from '../../shared/types/index.js';

const types: Array<{ type: RelationshipType; label: string; color: string; description: string }> = [
  { type: 'dependsOn', label: 'Depends On', color: '#00d9ff', description: 'Source requires data or services from target' },
  { type: 'feedsInto', label: 'Feeds Into', color: '#7c3aed', description: 'Source sends output to target for processing' },
  { type: 'collaboratesWith', label: 'Collaborates With', color: '#fbbf24', description: 'Agents coordinate as peers' },
  { type: 'canOverride', label: 'Can Override', color: '#ef4444', description: 'Source has authority to block or supersede target' },
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
          background: 'linear-gradient(145deg, #1e293b, #0f172a)',
          border: '2px solid rgba(0, 217, 255, 0.3)',
          borderRadius: 16,
          padding: 24,
          width: 340,
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ color: '#00d9ff', fontSize: 16, marginBottom: 16, textAlign: 'center' }}>
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
              <div style={{ color: '#8b9dc3', fontSize: 11, marginTop: 2 }}>{t.description}</div>
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
            color: '#8b9dc3',
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
