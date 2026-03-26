import React, { useState } from 'react';

interface Props {
  onDismiss: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Agent Modus',
    content: 'Design teams of AI agents that work together. No code required.',
    detail: 'You can build from scratch, use a template, or import existing agents.',
    icon: '👋',
  },
  {
    title: 'How it works',
    content: 'Your swarm has 4 modes:',
    detail: null,
    modes: [
      { name: 'Build', desc: 'Add agents and connect them' },
      { name: 'Watch', desc: 'Monitor health and decisions' },
      { name: 'Test', desc: 'Run mock tests and live tests' },
      { name: 'Ship', desc: 'Deploy and export your swarm' },
    ],
    icon: '⚙️',
  },
  {
    title: 'Get started',
    content: 'Try the Lead Gen template to see a working swarm.',
    detail: 'Or start from scratch and build your own.',
    icon: '🚀',
  },
];

export function OnboardingOverlay({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
        borderRadius: 16, padding: 32, maxWidth: 480, width: '90%', textAlign: 'center',
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === step ? 'var(--accent-primary)' : 'var(--bg-overlay)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 36, marginBottom: 12 }}>{current.icon}</div>

        <h2 style={{
          color: 'var(--text-primary)', fontSize: 22, margin: '0 0 12px', fontWeight: 700,
        }}>
          {current.title}
        </h2>

        <p style={{
          color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, margin: '0 0 8px',
        }}>
          {current.content}
        </p>

        {/* Step 2: mode list */}
        {'modes' in current && current.modes && (
          <div style={{
            textAlign: 'left', margin: '12px auto 16px', maxWidth: 320,
          }}>
            {current.modes.map(mode => (
              <div key={mode.name} style={{
                display: 'flex', gap: 8, alignItems: 'baseline',
                marginBottom: 8, fontSize: 14,
              }}>
                <span style={{
                  fontWeight: 600, color: 'var(--accent-primary)',
                  minWidth: 52,
                }}>
                  {mode.name}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {mode.desc}
                </span>
              </div>
            ))}
          </div>
        )}

        {current.detail && (
          <p style={{
            color: 'var(--text-tertiary)', fontSize: 13, margin: '0 0 24px',
            lineHeight: 1.5,
          }}>
            {current.detail}
          </p>
        )}

        {!current.detail && !('modes' in current) && (
          <div style={{ marginBottom: 24 }} />
        )}

        {'modes' in current && <div style={{ marginBottom: 16 }} />}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{
              padding: '10px 20px', borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 14,
              fontFamily: 'var(--font-primary)',
            }}>Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: 'var(--accent-primary)', color: 'var(--text-inverse)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              fontFamily: 'var(--font-primary)',
            }}>Next</button>
          ) : (
            <button onClick={onDismiss} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: 'var(--accent-primary)', color: 'var(--text-inverse)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              fontFamily: 'var(--font-primary)',
            }}>Start Building</button>
          )}
          {step < STEPS.length - 1 && (
            <button onClick={onDismiss} style={{
              padding: '10px 16px', borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--text-tertiary)',
              cursor: 'pointer', fontSize: 13,
              fontFamily: 'var(--font-primary)',
            }}>Skip</button>
          )}
        </div>
      </div>
    </div>
  );
}
