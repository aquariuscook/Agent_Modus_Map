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
}

const badgeColors: Record<string, { bg: string; border: string }> = {
  HUB: { bg: 'rgba(251, 191, 36, 0.25)', border: '#fbbf24' },
  CRITICAL: { bg: 'rgba(239, 68, 68, 0.25)', border: '#ef4444' },
  ENTRY: { bg: 'rgba(34, 197, 94, 0.25)', border: '#22c55e' },
  HUMAN: { bg: 'rgba(168, 85, 247, 0.25)', border: '#a855f7' },
  AUTO: { bg: 'rgba(0, 217, 255, 0.2)', border: '#00d9ff' },
  APPROVAL: { bg: 'rgba(168, 85, 247, 0.2)', border: '#a855f7' },
  ALWAYS_ON: { bg: 'rgba(0, 217, 255, 0.2)', border: '#00d9ff' },
  ADVISORY: { bg: 'rgba(139, 157, 195, 0.2)', border: '#8b9dc3' },
  CAN_OVERRIDE: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444' },
  HIGH_PRIORITY: { bg: 'rgba(251, 146, 60, 0.2)', border: '#fb923c' },
  MEDIUM: { bg: 'rgba(139, 157, 195, 0.15)', border: '#8b9dc3' },
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
      background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: 16,
      padding: '16px 14px',
      border: `3px solid ${d.isSelected ? '#ffffff' : d.isInBlastRadius ? '#ef4444' : d.layerColor}`,
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
          border: '2px solid #0f172a',
        }}>
          {d.blastRadiusHops}
        </div>
      )}

      <div style={{
        fontSize: 20,
        fontWeight: 700,
        textAlign: 'center',
        color: '#fff',
        marginBottom: 4,
      }}>
        {d.nickname}
      </div>

      <div style={{
        fontSize: 11,
        textAlign: 'center',
        color: '#8b9dc3',
        marginBottom: 6,
        lineHeight: 1.3,
      }}>
        {d.formalName}
      </div>

      <div style={{
        fontSize: 12,
        textAlign: 'center',
        color: '#a0aec0',
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
              color: '#fff',
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
