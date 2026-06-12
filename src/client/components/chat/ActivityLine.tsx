import type { CopilotStatusEvent, InterviewStatusEvent } from '../../api.js';

/** Structural type accepted by ActivityLine — both CopilotStatusEvent and InterviewStatusEvent satisfy this. */
export type StatusEvent = CopilotStatusEvent | InterviewStatusEvent;

interface ActivityLineProps {
  event: StatusEvent;
  isLatest: boolean;
}

const STEP_LABELS: Record<string, string> = {
  'selecting-model': 'Selecting model',
  'sending-request': 'Sending request',
  'waiting-response': 'Waiting for response',
  'response-received': 'Response received',
  'error': 'Error',
};

const STEP_ICONS: Record<string, string> = {
  'selecting-model': '🔍',
  'sending-request': '📤',
  'waiting-response': '⏳',
  'response-received': '✅',
  'error': '❌',
};

export function ActivityLine({ event, isLatest }: ActivityLineProps) {
  const label = STEP_LABELS[event.step] || event.step;
  const icon = STEP_ICONS[event.step] || '•';
  const parts: string[] = [];

  if (event.provider) {
    const modelName = event.model?.split('/').pop() || event.model || '';
    parts.push(`${event.provider}/${modelName}`);
  }
  if (event.messageCount != null) {
    parts.push(`${event.messageCount} msg${event.messageCount !== 1 ? 's' : ''}`);
  }
  if (event.toolCount != null && event.toolCount > 0) {
    parts.push(`${event.toolCount} tool${event.toolCount !== 1 ? 's' : ''}`);
  }
  if (event.durationMs != null) {
    parts.push(event.durationMs >= 1000 ? `${(event.durationMs / 1000).toFixed(1)}s` : `${event.durationMs}ms`);
  }
  if (event.inputTokens != null) {
    const inK = event.inputTokens >= 1000 ? `${(event.inputTokens / 1000).toFixed(1)}k` : `${event.inputTokens}`;
    const outK = event.outputTokens != null
      ? (event.outputTokens >= 1000 ? `${(event.outputTokens / 1000).toFixed(1)}k` : `${event.outputTokens}`)
      : '';
    parts.push(`${inK}${outK ? `→${outK}` : ''} tok`);
  }
  if (event.error) {
    parts.push(event.error);
  }

  return (
    <div style={{
      fontSize: 11, lineHeight: 1.4,
      color: isLatest ? 'var(--text-secondary)' : 'var(--text-tertiary)',
      display: 'flex', gap: 5, alignItems: 'baseline',
      animation: isLatest ? 'chatFadeIn 0.2s ease-out' : 'none',
      opacity: isLatest ? 1 : 0.6,
    }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ fontWeight: isLatest ? 500 : 400 }}>{label}</span>
      {parts.length > 0 && (
        <span style={{ color: 'var(--text-tertiary)' }}>{parts.join(' · ')}</span>
      )}
    </div>
  );
}
