import React, { useState, useRef, useEffect } from 'react';
import { askCopilotStreaming, type CopilotStatusEvent } from '../api.js';
import { Logo } from './Logo.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  swarmId: string;
  isOpen: boolean;
  onToggle: () => void;
  onHighlightAgents?: (nicknames: string[]) => void;
}

// ── Activity log line (matches InterviewPanel pattern) ─────────────────────

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

function ActivityLine({ event, isLatest }: { event: CopilotStatusEvent; isLatest: boolean }) {
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

// ── Component ──────────────────────────────────────────────────────────────

export function ChatPanel({ swarmId, isOpen, onToggle, onHighlightAgents }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'Hey, I\'m the Agent Modus copilot. I can help you with anything:\n\n- "Help me set up a lead gen swarm"\n- "How do I add my API keys?"\n- "What does each agent do?"\n- "Why isn\'t my deploy returning good results?"\n- "Help me write a better search query"',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusEvents, setStatusEvents] = useState<CopilotStatusEvent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusEvents]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    setStatusEvents([]);

    try {
      const history = [...messages.slice(1), { role: 'user' as const, content: question }]
        .map(m => ({ role: m.role, content: m.content }));

      const result = await askCopilotStreaming(history, swarmId, (event) => {
        setStatusEvents(prev => [...prev, event]);
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.answer,
      }]);
    } catch (err: any) {
      const msg = err.message || 'Something went wrong.';
      const isConfig = msg.includes('API key') || msg.includes('Add any');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isConfig
          ? 'Add any LLM API key in Settings (Anthropic, NVIDIA, or OpenAI) to use the copilot.'
          : `Error: ${msg}`,
      }]);
    } finally {
      setLoading(false);
      setStatusEvents([]);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--bg-elevated)',
          border: '2px solid var(--accent-primary)',
          cursor: 'pointer',
          boxShadow: '0 4px 20px var(--border-accent)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        title="Ask about your swarm"
      >
        <Logo size={36} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      right: 20,
      width: 420,
      height: 500,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-accent)',
      borderRadius: 16,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 30,
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-accent)' }}>Copilot</span>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18 }}>{'×'}</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '90%',
              padding: '10px 14px',
              borderRadius: 12,
              background: msg.role === 'user' ? 'var(--accent-primary-muted)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${msg.role === 'user' ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {/* Thinking indicator + Activity log during loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 16px',
              borderRadius: '16px 16px 16px 4px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 200,
              maxWidth: 360,
            }}>
              {/* Pulsing dots header */}
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
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>Thinking</span>
              </div>
              {/* Activity log */}
              {statusEvents.map((evt, i) => (
                <ActivityLine key={i} event={evt} isLatest={i === statusEvents.length - 1} />
              ))}
              {statusEvents.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Connecting…</div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your swarm..."
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--accent-primary-muted)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            fontSize: 13,
          }}
        >
          Ask
        </button>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes chatPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
