// Design system tokens from ADR-002
// Ocean gradient palette carried from the prototype

export const colors = {
  bg: {
    primary: '#0a0e27',
    secondary: '#1a1f3a',
    card: 'linear-gradient(145deg, #1e293b, #0f172a)',
    cardSolid: '#1e293b',
  },
  text: {
    primary: '#ffffff',
    secondary: '#8b9dc3',
    muted: '#a0aec0',
  },
  layers: {
    customer: '#00d9ff',
    product: '#a855f7',
    order: '#22c55e',
    operations: '#fb923c',
    intelligence: '#fbbf24',
  },
  relationships: {
    dependsOn: { color: '#00d9ff', style: 'solid', width: 3 },
    feedsInto: { color: '#7c3aed', style: 'dashed', width: 3 },
    collaboratesWith: { color: '#fbbf24', style: 'dotted', width: 2 },
    canOverride: { color: '#ef4444', style: 'solid', width: 4 },
  },
  badges: {
    hub: { bg: 'rgba(251, 191, 36, 0.2)', border: '#fbbf24' },
    critical: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444' },
    entry: { bg: 'rgba(34, 197, 94, 0.2)', border: '#22c55e' },
    human: { bg: 'rgba(168, 85, 247, 0.2)', border: '#a855f7' },
    auto: { bg: 'rgba(0, 217, 255, 0.2)', border: '#00d9ff' },
  },
  health: {
    healthy: '#22c55e',
    degraded: '#fbbf24',
    unhealthy: '#ef4444',
    unknown: '#6b7280',
  },
} as const;

export const typography = {
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  sizes: {
    xs: '10px',
    sm: '13px',
    base: '14px',
    md: '18px',
    lg: '24px',
    xl: '28px',
    xxl: '48px',
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '15px',
  lg: '25px',
  xl: '40px',
  xxl: '80px',
} as const;

export const borders = {
  radius: {
    sm: '10px',
    md: '15px',
    lg: '20px',
    full: '50%',
  },
  badge: '12px',
} as const;
