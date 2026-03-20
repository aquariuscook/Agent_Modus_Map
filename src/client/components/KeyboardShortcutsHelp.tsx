import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['?'], description: 'Show this help' },
  { keys: ['Esc'], description: 'Close panel / Deselect' },
  { keys: ['P'], description: 'Toggle agent palette' },
  { keys: ['V'], description: 'Toggle validation panel' },
  { keys: ['C'], description: 'Toggle chat panel' },
  { keys: ['H'], description: 'Toggle health dashboard' },
  { keys: ['T'], description: 'Open template browser' },
  { keys: ['D'], description: 'Open decision traces' },
  { keys: ['G'], description: 'Open governance panel' },
  { keys: ['O'], description: 'Open optimization panel' },
  { keys: ['L'], description: 'Open collaboration panel' },
  { keys: ['E'], description: 'Export swarm' },
  { keys: ['I'], description: 'Import swarm' },
  { keys: ['Cmd', 'Z'], description: 'Undo' },
  { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo' },
  { keys: ['Delete'], description: 'Delete selected agent' },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 12,
        padding: '24px 32px', maxWidth: 450, width: '90%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: '#e2e8f0', fontSize: 18 }}>Keyboard Shortcuts</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>X</button>
        </div>

        {SHORTCUTS.map((s, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0', borderBottom: i < SHORTCUTS.length - 1 ? '1px solid #1e293b' : 'none',
          }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{s.description}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {s.keys.map(k => (
                <kbd key={k} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                  background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
                  fontFamily: '"SF Mono", monospace',
                }}>{k}</kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
