import React from 'react';

interface Props {
  size?: number;
  color?: string;
}

export function Logo({ size = 36, color }: Props) {
  const c = color || 'var(--accent-primary)';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer circle */}
      <circle cx="50" cy="50" r="46" stroke={c} strokeWidth="2.5" opacity="0.8" />

      {/* A shape - angular peak */}
      <path d="M50 12 L22 78 L32 78 L50 30 L68 78 L78 78 Z" stroke={c} strokeWidth="2.2" strokeLinejoin="round" fill="none" />

      {/* A crossbar */}
      <line x1="33" y1="60" x2="67" y2="60" stroke={c} strokeWidth="2" />

      {/* M shape - woven through the A */}
      <path d="M18 80 L34 28 L50 58 L66 28 L82 80" stroke={c} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" fill="none" />

      {/* Central diamond accent */}
      <path d="M50 42 L44 52 L50 62 L56 52 Z" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.15" />
    </svg>
  );
}

export function LogoWithText({ size = 36 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <Logo size={size} />
      <div style={{
        fontSize: size > 30 ? 'var(--text-xl)' : 'var(--text-base)',
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        Agent<span style={{ color: 'var(--accent-primary)' }}>Modus</span>
      </div>
    </div>
  );
}
