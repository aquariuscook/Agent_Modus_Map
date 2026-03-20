import React from 'react';
import { ThemeToggle } from './ThemeToggle.js';
import { useTheme } from '../hooks/useTheme.js';

export type EditorMode = 'design' | 'monitor' | 'analyze';

interface EditorToolbarProps {
  swarmName: string;
  agentCount: number;
  relationshipCount: number;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onBack: () => void;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

  // Design mode actions
  onTogglePalette: () => void;
  onToggleChat: () => void;
  onToggleValidation: () => void;
  onToggleOrchestrator: () => void;

  // Monitor mode actions
  onOpenHealth: () => void;
  onOpenTraces: () => void;
  onOpenGovernance: () => void;
  onOpenCollaboration: () => void;

  // Analyze mode actions
  onOpenOptimization: () => void;
  onOpenDocs: () => void;
  onExportJSON: () => void;
  onExportHTML: () => void;
  onImport: () => void;

  // Blast radius
  showBlastRadius: boolean;
  onToggleBlastRadius: () => void;
}

const modeColors: Record<EditorMode, string> = {
  design: '#00d9ff',
  monitor: '#22c55e',
  analyze: '#a855f7',
};

const btnStyle = (active?: boolean, color?: string): React.CSSProperties => ({
  padding: '5px 12px',
  borderRadius: 6,
  border: `1px solid ${active ? (color || '#00d9ff') : 'rgba(255,255,255,0.12)'}`,
  background: active ? `${color || '#00d9ff'}20` : 'rgba(255,255,255,0.04)',
  color: active ? (color || '#00d9ff') : '#8b9dc3',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  transition: 'all 0.2s',
  whiteSpace: 'nowrap' as const,
});

export function EditorToolbar(props: EditorToolbarProps) {
  const {
    swarmName, agentCount, relationshipCount, mode, onModeChange, onBack,
    healthStatus,
  } = props;

  const { theme, toggleTheme } = useTheme();

  const healthColors: Record<string, string> = {
    healthy: '#22c55e', degraded: '#fbbf24', unhealthy: '#ef4444', unknown: '#6b7280',
  };
  const hColor = healthColors[healthStatus || 'unknown'];
  const mColor = modeColors[mode];

  return (
    <div style={{
      padding: '8px 16px',
      background: 'var(--bg-surface)',
      borderBottom: `2px solid ${mColor}40`,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      zIndex: 10,
    }}>
      {/* Back + Swarm Name */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
        fontSize: 16, padding: '2px 6px',
      }}>{'<'}</button>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{swarmName}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{agentCount} agents, {relationshipCount} rel</div>
      </div>

      {/* Health dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%', background: hColor,
        boxShadow: `0 0 6px ${hColor}`, marginLeft: 4,
      }} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Mode Switcher */}
      <div style={{
        display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)',
        borderRadius: 8, padding: 2,
      }}>
        {(['design', 'monitor', 'analyze'] as EditorMode[]).map(m => (
          <button key={m} onClick={() => onModeChange(m)} style={{
            padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
            background: mode === m ? modeColors[m] : 'transparent',
            color: mode === m ? '#0a0e27' : '#64748b',
            transition: 'all 0.2s',
          }}>{m}</button>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Mode-specific actions */}
      {mode === 'design' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={props.onTogglePalette} style={btnStyle(false, mColor)}>+ Agent</button>
          <button onClick={props.onToggleOrchestrator} style={btnStyle(false, mColor)}>Connect</button>
          <button onClick={props.onToggleValidation} style={btnStyle(false, mColor)}>Validate</button>
          <button onClick={props.onToggleChat} style={btnStyle(false, mColor)}>Chat</button>
          <button onClick={props.onToggleBlastRadius} style={btnStyle(props.showBlastRadius, '#ef4444')}>
            {props.showBlastRadius ? 'Blast: ON' : 'Blast'}
          </button>
        </div>
      )}

      {mode === 'monitor' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={props.onOpenHealth} style={btnStyle(false, mColor)}>Health</button>
          <button onClick={props.onOpenTraces} style={btnStyle(false, mColor)}>Traces</button>
          <button onClick={props.onOpenGovernance} style={btnStyle(false, mColor)}>Governance</button>
          <button onClick={props.onOpenCollaboration} style={btnStyle(false, mColor)}>Collab</button>
        </div>
      )}

      {mode === 'analyze' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={props.onOpenOptimization} style={btnStyle(false, mColor)}>Optimize</button>
          <button onClick={props.onOpenDocs} style={btnStyle(false, mColor)}>Docs</button>
          <button onClick={props.onExportJSON} style={btnStyle(false, mColor)}>Export JSON</button>
          <button onClick={props.onExportHTML} style={btnStyle(false, mColor)}>Export HTML</button>
          <button onClick={props.onImport} style={btnStyle(false, mColor)}>Import</button>
        </div>
      )}

      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </div>
  );
}
