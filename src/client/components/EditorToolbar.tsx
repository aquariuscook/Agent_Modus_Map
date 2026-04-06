import React from 'react';
import { ThemeToggle } from './ThemeToggle.js';
import { Logo } from './Logo.js';
import { useTheme } from '../hooks/useTheme.js';

export type EditorMode = 'build' | 'watch' | 'test' | 'ship';

interface EditorToolbarProps {
  swarmName: string;
  agentCount: number;
  relationshipCount: number;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onBack: () => void;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

  // Build mode actions
  onTogglePalette: () => void;
  onToggleChat: () => void;
  onToggleValidation: () => void;
  onToggleOrchestrator: () => void;

  // Watch mode actions
  onOpenHealth: () => void;
  onOpenTraces: () => void;
  onOpenGovernance: () => void;
  onOpenCollaboration: () => void;

  // Test mode actions
  onToggleSimulation: () => void;
  onOpenOptimization: () => void;
  onOpenDocs: () => void;

  // Ship mode actions
  onExportJSON: () => void;
  onExportHTML: () => void;
  onExportHandoff: () => void;
  onImport: () => void;

  // Blast radius
  showBlastRadius: boolean;
  onToggleBlastRadius: () => void;
}

const modeColors: Record<EditorMode, string> = {
  build: 'var(--accent-primary)',
  watch: '#22c55e',
  test: '#fbbf24',
  ship: 'var(--accent-secondary)',
};

const modeLabels: Record<EditorMode, string> = {
  build: 'Build',
  watch: 'Watch',
  test: 'Test',
  ship: 'Ship',
};

const btnStyle = (active?: boolean, color?: string): React.CSSProperties => ({
  padding: '5px 12px',
  borderRadius: 6,
  border: `1px solid ${active ? (color || 'var(--accent-primary)') : 'rgba(255,255,255,0.12)'}`,
  background: active ? `${color || 'var(--accent-primary)'}20` : 'rgba(255,255,255,0.04)',
  color: active ? (color || 'var(--accent-primary)') : 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  transition: 'all 0.2s',
  whiteSpace: 'nowrap' as const,
  fontFamily: 'var(--font-primary)',
});

export function EditorToolbar(props: EditorToolbarProps) {
  const {
    swarmName, agentCount, relationshipCount, mode, onModeChange, onBack,
    healthStatus,
  } = props;

  const { theme, toggleTheme } = useTheme();

  const healthColors: Record<string, string> = {
    healthy: '#22c55e', degraded: '#fbbf24', unhealthy: '#ef4444', unknown: 'var(--text-tertiary)',
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
      {/* Back + Logo + Swarm Name */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer',
        fontSize: 16, padding: '2px 6px',
      }}>{'<'}</button>
      <Logo size={28} />
      <div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{swarmName}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{agentCount} agents, {relationshipCount} rel</div>
      </div>

      {/* Health dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%', background: hColor,
        boxShadow: `0 0 6px ${hColor}`, marginLeft: 4,
      }} />

      {/* Mode Switcher */}
      <div style={{
        display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)',
        borderRadius: 8, padding: 2, marginLeft: 'auto',
      }}>
        {(['build', 'watch', 'test', 'ship'] as EditorMode[]).map(m => (
          <button key={m} onClick={() => onModeChange(m)} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
            background: mode === m ? modeColors[m] : 'transparent',
            color: mode === m ? 'var(--text-inverse)' : 'var(--text-tertiary)',
            transition: 'all 0.2s',
            fontFamily: 'var(--font-primary)',
          }}>{modeLabels[m]}</button>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Mode-specific actions */}
      {mode === 'build' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={props.onTogglePalette} style={btnStyle(false, mColor)}>+ Agent</button>
          <button onClick={props.onToggleOrchestrator} style={btnStyle(false, mColor)}>Connect</button>
          <button onClick={props.onToggleValidation} style={btnStyle(false, mColor)}>Validate</button>
          <button onClick={props.onToggleChat} style={btnStyle(false, mColor)}>Chat</button>
          <button onClick={props.onToggleBlastRadius} style={btnStyle(props.showBlastRadius, '#ef4444')}>
            {props.showBlastRadius ? 'Impact: ON' : 'Impact'}
          </button>
        </div>
      )}

      {mode === 'watch' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={props.onOpenHealth} style={btnStyle(false, mColor)}>Health</button>
          <button onClick={props.onOpenTraces} style={btnStyle(false, mColor)}>Trace</button>
          <button onClick={props.onOpenGovernance} style={btnStyle(false, mColor)}>Audit</button>
          <button onClick={props.onOpenCollaboration} style={btnStyle(false, mColor)}>History</button>
        </div>
      )}

      {mode === 'test' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={props.onToggleSimulation} style={btnStyle(false, mColor)}>Run Test</button>
          <button onClick={props.onOpenOptimization} style={btnStyle(false, mColor)}>Optimize</button>
          <button onClick={props.onOpenDocs} style={btnStyle(false, mColor)}>Docs</button>
        </div>
      )}

      {mode === 'ship' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={props.onToggleSimulation} style={btnStyle(false, '#22c55e')}>Deploy</button>
          <button onClick={props.onExportHandoff} style={btnStyle(false, mColor)}>Handoff Doc</button>
          <button onClick={props.onExportJSON} style={btnStyle(false, mColor)}>Export JSON</button>
          <button onClick={props.onImport} style={btnStyle(false, mColor)}>Import</button>
        </div>
      )}

      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </div>
  );
}
