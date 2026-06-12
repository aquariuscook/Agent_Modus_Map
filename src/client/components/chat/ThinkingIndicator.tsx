interface ThinkingIndicatorProps {
  /** Label shown next to the dots. Default: "Thinking" */
  label?: string;
}

export function ThinkingIndicator({ label = 'Thinking' }: ThinkingIndicatorProps) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
      {[0, 1, 2].map(idx => (
        <div key={idx} style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--text-tertiary)',
          animation: `chatPulse 1.2s ease-in-out ${idx * 0.15}s infinite`,
        }} />
      ))}
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>{label}</span>
    </div>
  );
}
