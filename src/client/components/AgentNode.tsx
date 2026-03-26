import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Badge } from '../../shared/types/index.js';

export interface AgentNodeData {
  nickname: string;
  formalName: string;
  descriptor: string;
  badges: Badge[];
  layerColor: string;
  isSelected: boolean;
  isInBlastRadius: boolean;
  blastRadiusHops: number | null;
  emoji?: string;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  onInfoClick?: () => void;
}

const badgeColors: Record<string, { bg: string; border: string }> = {
  HUB: { bg: 'rgba(251, 191, 36, 0.25)', border: '#fbbf24' },
  CRITICAL: { bg: 'rgba(239, 68, 68, 0.25)', border: '#ef4444' },
  ENTRY: { bg: 'rgba(34, 197, 94, 0.25)', border: '#22c55e' },
  HUMAN: { bg: 'rgba(168, 85, 247, 0.25)', border: 'var(--accent-secondary)' },
  AUTO: { bg: 'rgba(0, 217, 255, 0.2)', border: 'var(--accent-primary)' },
  APPROVAL: { bg: 'rgba(168, 85, 247, 0.2)', border: 'var(--accent-secondary)' },
  ALWAYS_ON: { bg: 'rgba(0, 217, 255, 0.2)', border: 'var(--accent-primary)' },
  ADVISORY: { bg: 'rgba(139, 157, 195, 0.2)', border: 'var(--text-secondary)' },
  CAN_OVERRIDE: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444' },
  HIGH_PRIORITY: { bg: 'rgba(251, 146, 60, 0.2)', border: 'var(--accent-primary)' },
  MEDIUM: { bg: 'rgba(139, 157, 195, 0.15)', border: 'var(--text-secondary)' },
  LOGS_ALL: { bg: 'rgba(251, 191, 36, 0.2)', border: '#fbbf24' },
};

function getBadgeStyle(badge: Badge) {
  return badgeColors[badge] || { bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.3)' };
}

function AgentNodeComponent({ data }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  const isHighlighted = d.isSelected || d.isInBlastRadius;

  return (
    <div style={{
      width: 220,
      background: 'var(--bg-elevated)',
      borderRadius: 16,
      padding: '16px 14px',
      border: `3px solid ${d.isSelected ? 'var(--text-inverse)' : d.isInBlastRadius ? '#ef4444' : d.layerColor}`,
      boxShadow: isHighlighted
        ? `0 0 ${d.isSelected ? 30 : 20}px ${d.isSelected ? d.layerColor : 'rgba(239, 68, 68, 0.6)'}`
        : '0 4px 20px rgba(0, 0, 0, 0.3)',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      opacity: d.isInBlastRadius || d.isSelected || (!d.isSelected && !d.isInBlastRadius) ? 1 : 0.4,
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: d.layerColor, width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: d.layerColor, width: 8, height: 8, border: 'none' }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: d.layerColor, width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: d.layerColor, width: 8, height: 8, border: 'none' }} />

      {d.blastRadiusHops !== null && (
        <div style={{
          position: 'absolute',
          top: -10,
          right: -10,
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: '#ef4444',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--bg-surface)',
        }}>
          {d.blastRadiusHops}
        </div>
      )}

      {/* Info button */}
      <div
        onClick={(e) => { e.stopPropagation(); d.onInfoClick?.(); }}
        style={{
          position: 'absolute', top: 8, left: 8,
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          border: `1px solid ${d.layerColor}50`,
          color: d.layerColor,
          fontSize: 12, fontWeight: 700, fontStyle: 'italic',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = d.layerColor + '30'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
        title="View agent details"
      >i</div>

      <style>{`@keyframes healthPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Health indicator */}
      {d.healthStatus && d.healthStatus !== 'unknown' && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 12, height: 12, borderRadius: '50%',
          background: d.healthStatus === 'healthy' ? '#22c55e' : d.healthStatus === 'degraded' ? '#fbbf24' : '#ef4444',
          boxShadow: `0 0 8px ${d.healthStatus === 'healthy' ? '#22c55e' : d.healthStatus === 'degraded' ? '#fbbf24' : '#ef4444'}`,
          animation: d.healthStatus !== 'healthy' ? 'healthPulse 2s ease-in-out infinite' : 'none',
        }} />
      )}

      {d.emoji && (
        <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 4 }}>{d.emoji}</div>
      )}

      <div style={{
        fontSize: 20,
        fontWeight: 700,
        textAlign: 'center',
        color: 'var(--text-primary)',
        marginBottom: 4,
      }}>
        {d.nickname}
      </div>

      <div style={{
        fontSize: 11,
        textAlign: 'center',
        color: 'var(--text-secondary)',
        marginBottom: 6,
        lineHeight: 1.3,
      }}>
        {d.formalName}
      </div>

      <div style={{
        fontSize: 12,
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontStyle: 'italic',
        marginBottom: 10,
      }}>
        "{d.descriptor}"
      </div>

      <div style={{
        display: 'flex',
        gap: 4,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {d.badges.map((badge) => {
          const style = getBadgeStyle(badge);
          return (
            <span key={badge} style={{
              fontSize: 9,
              padding: '2px 7px',
              borderRadius: 10,
              background: style.bg,
              color: 'var(--text-primary)',
              border: `1px solid ${style.border}`,
              whiteSpace: 'nowrap',
            }}>
              {badge.replace('_', ' ')}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
