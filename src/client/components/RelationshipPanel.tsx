import React from 'react';
import type { Agent, Swarm, BlastRadiusResult } from '../../shared/types/index.js';

interface RelationshipPanelProps {
  agent: Agent;
  swarm: Swarm;
  blastRadius: BlastRadiusResult[];
  showBlastRadius: boolean;
  onClose: () => void;
}

const typeLabels: Record<string, { label: string; color: string; icon: string }> = {
  dependsOn: { label: 'Depends On', color: '#00d9ff', icon: '\u2190' },
  feedsInto: { label: 'Feeds Into', color: '#7c3aed', icon: '\u2192' },
  collaboratesWith: { label: 'Collaborates With', color: '#fbbf24', icon: '\u2194' },
  canOverride: { label: 'Can Override', color: '#ef4444', icon: '\u26A1' },
};

function getAgentNickname(agentId: string, agents: Agent[]): string {
  return agents.find(a => a.id === agentId)?.nickname || 'Unknown';
}

export function RelationshipPanel({ agent, swarm, blastRadius, showBlastRadius, onClose }: RelationshipPanelProps) {
  const relationships = swarm.relationships.filter(
    r => r.sourceAgentId === agent.id || r.targetAgentId === agent.id
  );

  const grouped: Record<string, string[]> = {};
  for (const rel of relationships) {
    const key = rel.type;
    if (!grouped[key]) grouped[key] = [];
    if (rel.sourceAgentId === agent.id) {
      grouped[key].push(getAgentNickname(rel.targetAgentId, swarm.agents));
    } else {
      grouped[key].push(getAgentNickname(rel.sourceAgentId, swarm.agents));
    }
  }

  // Deduplicate
  for (const key of Object.keys(grouped)) {
    grouped[key] = [...new Set(grouped[key])];
  }

  const layer = swarm.layers.find(l => l.id === agent.layerId);

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
      border: `2px solid ${layer?.colorTheme || '#00d9ff'}`,
      borderRadius: 16,
      padding: '20px 28px',
      maxWidth: 700,
      minWidth: 400,
      zIndex: 50,
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
      animation: 'slideUp 0.25s ease',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(40px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>

      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '2px solid #ef4444',
          color: '#ef4444',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        \u00D7
      </button>

      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{agent.nickname}</span>
        <span style={{ fontSize: 13, color: '#8b9dc3', marginLeft: 10 }}>{agent.formalName}</span>
        <span style={{ fontSize: 12, color: '#a0aec0', marginLeft: 10, fontStyle: 'italic' }}>"{agent.descriptor}"</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {Object.entries(grouped).map(([type, agents]) => {
          const meta = typeLabels[type] || { label: type, color: '#8b9dc3', icon: '' };
          return (
            <div key={type} style={{
              background: 'rgba(255, 255, 255, 0.04)',
              padding: 12,
              borderRadius: 10,
              borderLeft: `4px solid ${meta.color}`,
            }}>
              <div style={{ fontSize: 11, color: '#8b9dc3', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                {meta.label}
              </div>
              {agents.map(name => (
                <div key={name} style={{ color: '#fff', fontSize: 13, marginBottom: 3 }}>
                  {meta.icon} {name}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {showBlastRadius && blastRadius.length > 0 && (
        <div style={{
          marginTop: 12,
          padding: 12,
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 10,
          borderLeft: '4px solid #ef4444',
        }}>
          <div style={{ fontSize: 11, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Blast Radius ({blastRadius.length} agents affected)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {blastRadius.map(b => (
              <span key={b.nickname} style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 8,
                background: `rgba(239, 68, 68, ${0.3 - b.hops * 0.08})`,
                color: '#fff',
                border: '1px solid rgba(239, 68, 68, 0.5)',
              }}>
                {b.nickname} (hop {b.hops})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
