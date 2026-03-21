import React, { useState } from 'react';

interface Props {
  onDismiss: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Agent Modus',
    content: 'Your enterprise tool for designing, monitoring, and optimizing multi-agent swarms. No coding required.',
    highlight: 'Get started by exploring the canvas or loading a template.',
  },
  {
    title: 'Design Your Swarm',
    content: 'Drag agents from the palette onto the canvas. Connect them by dragging between nodes. Each agent has a role, layer, and configurable properties.',
    highlight: 'Try clicking the + button on the left sidebar.',
  },
  {
    title: 'Monitor Health',
    content: 'Green, yellow, and red indicators show agent health in real-time. Click the heart icon in the header to open the health dashboard with sparkline metrics.',
    highlight: 'Health data updates every 15 seconds.',
  },
  {
    title: 'Ask Questions',
    content: 'Use the chat panel to ask natural language questions about your swarm. "What depends on Orchestrator?" or "Show me the critical path."',
    highlight: 'Click the chat icon on the right side.',
  },
  {
    title: 'Optimize and Govern',
    content: 'Run bottleneck analysis, what-if simulations, and cost modeling. Track every change in the audit log. Generate documentation automatically.',
    highlight: 'Use the toolbar buttons in the header.',
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
        background: '#0a1628', border: '1px solid #00d9ff', borderRadius: 16,
        padding: 32, maxWidth: 500, width: '90%', textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === step ? '#00d9ff' : '#1e3a5f',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <h2 style={{ color: '#e2e8f0', fontSize: 22, margin: '0 0 12px', fontWeight: 700 }}>
          {current.title}
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, margin: '0 0 16px' }}>
          {current.content}
        </p>
        <p style={{ color: '#00d9ff', fontSize: 13, fontStyle: 'italic', margin: '0 0 24px' }}>
          {current.highlight}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid #1e3a5f',
              background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14,
            }}>Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#00d9ff', color: '#0a1628', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}>Next</button>
          ) : (
            <button onClick={onDismiss} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#00d9ff', color: '#0a1628', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}>Start Designing</button>
          )}
          {step < STEPS.length - 1 && (
            <button onClick={onDismiss} style={{
              padding: '10px 16px', borderRadius: 8, border: 'none',
              background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 13,
            }}>Skip</button>
          )}
        </div>
      </div>
    </div>
  );
}
